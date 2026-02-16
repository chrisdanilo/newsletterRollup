import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { ExtractedLink } from "@/types/database";

export const dynamic = "force-dynamic";

// Vercel Pro/Hobby max is 60s / 10s respectively. Claude usually responds in
// 3-8s. We set a 15s timeout so we fail fast and mark status='failed' rather
// than leaving the row in 'pending' forever.
export const maxDuration = 15;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function extractLinks(html: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const anchorRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").trim();

    if (
      !url ||
      url.startsWith("mailto:") ||
      url.includes("unsubscribe") ||
      url.includes("optout") ||
      url.includes("opt-out") ||
      url.includes("tracking") ||
      !text ||
      text.length < 3
    ) {
      continue;
    }

    links.push({ url, text: text.slice(0, 200) });
  }

  return links.slice(0, 20);
}

function parseSendGridFrom(from: string): { email: string; name: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: "", email: from.trim().toLowerCase() };
}

function extractMessageId(headersRaw: string): string | null {
  const match = headersRaw.match(/^Message-ID:\s*<?([^>\r\n]+)>?/im);
  return match ? match[1].trim() : null;
}

async function parseEmailBody(request: NextRequest): Promise<{
  senderEmail: string;
  senderName: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  forwardingAddress: string;
  messageId: string | null;
}> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const from = formData.get("from")?.toString() || "";
    const { email: senderEmail, name: senderName } = parseSendGridFrom(from);

    let forwardingAddress = formData.get("to")?.toString() || "";
    const envelope = formData.get("envelope")?.toString();
    if (envelope) {
      try {
        const env = JSON.parse(envelope);
        if (Array.isArray(env.to) && env.to.length > 0) {
          forwardingAddress = env.to[0];
        }
      } catch { /* ignore */ }
    }

    const headersRaw = formData.get("headers")?.toString() || "";
    return {
      senderEmail,
      senderName,
      subject: formData.get("subject")?.toString() || "(No Subject)",
      htmlContent: formData.get("html")?.toString() || "",
      textContent: formData.get("text")?.toString() || "",
      forwardingAddress: forwardingAddress.toLowerCase(),
      messageId: extractMessageId(headersRaw),
    };
  }

  const body = await request.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(body); } catch { /* ignore */ }

  return {
    senderEmail: (parsed.from as { email?: string })?.email || (parsed.sender as string) || (parsed.from as string) || "",
    senderName: (parsed.from as { name?: string })?.name || (parsed.fromName as string) || "",
    subject: (parsed.subject as string) || "(No Subject)",
    htmlContent: (parsed.html as string) || (parsed.htmlContent as string) || "",
    textContent: (parsed.text as string) || (parsed.textContent as string) || (parsed.plain as string) || "",
    forwardingAddress: (parsed.to as { email?: string })?.email || (parsed.recipient as string) || (parsed.to as string) || "",
    messageId: (parsed.messageId as string) || null,
  };
}

async function summarize(
  newsletterId: string,
  subject: string,
  rawContent: string,
  existingLinks: ExtractedLink[]
): Promise<{ summary: string; links: ExtractedLink[]; status: "done" | "failed" }> {
  const cleanContent = rawContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: "You summarize newsletters. Always respond with valid JSON only — no prose, no markdown, no code fences.",
      messages: [
        {
          role: "user",
          content: `Summarize this newsletter for a busy reader in 1-3 concise sentences. Extract meaningful article/resource URLs (skip unsubscribe and tracking links).

Subject: ${subject}

Content:
${cleanContent}

Respond with this exact JSON shape:
{"summary":"...","extracted_links":[{"url":"https://...","text":"..."}]}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result: { summary: string; extracted_links: { url: string; text: string }[] };

    try {
      result = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    }

    // Merge AI-extracted links with HTML-extracted links, deduplicated
    const merged = [...existingLinks];
    for (const aiLink of (result.extracted_links || [])) {
      if (!merged.some((l) => l.url === aiLink.url)) {
        merged.push(aiLink);
      }
    }

    return { summary: result.summary, links: merged.slice(0, 20), status: "done" };
  } catch (err) {
    console.error(`Summarization failed for newsletter ${newsletterId}:`, err);
    return { summary: "", links: existingLinks, status: "failed" };
  }
}

export async function POST(request: NextRequest) {
  // Verify webhook secret via headers only — never accept secrets in query params
  // because query strings appear in server logs, CDN logs, and referrer headers.
  const secret =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (secret !== process.env.EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { senderEmail, senderName, subject, htmlContent, textContent, forwardingAddress, messageId } =
    await parseEmailBody(request);

  if (!senderEmail || !forwardingAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("forwarding_address", forwardingAddress.toLowerCase())
    .single();

  if (profileError || !profile) {
    console.error("No user found for forwarding address:", forwardingAddress);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const MAX_CONTENT_BYTES = 500_000; // 500 KB
  const rawContent = (htmlContent || textContent).slice(0, MAX_CONTENT_BYTES);
  const extractedLinks = htmlContent ? extractLinks(htmlContent) : [];

  // Insert newsletter with status='pending'. The DB trigger enforces the
  // 50/24h rate limit; the unique index on (user_id, message_id) deduplicates.
  const { data: newsletter, error: insertError } = await supabaseAdmin
    .from("newsletters")
    .insert({
      user_id: profile.id,
      sender_email: senderEmail.toLowerCase(),
      sender_name: senderName || null,
      subject,
      raw_content: rawContent,
      extracted_links: extractedLinks,
      message_id: messageId || null,
      summarization_status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }
    if (insertError.message?.includes("Rate limit exceeded")) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    console.error("Failed to insert newsletter:", insertError);
    return NextResponse.json({ error: "Failed to store email" }, { status: 500 });
  }

  // Summarize synchronously. The newsletter row is always in a known state
  // when this handler returns — never stuck in 'pending' due to a lost async call.
  const { summary, links, status } = await summarize(
    newsletter.id,
    subject,
    rawContent,
    extractedLinks
  );

  await supabaseAdmin
    .from("newsletters")
    .update({
      summary: summary || null,
      extracted_links: links,
      summarization_status: status,
    })
    .eq("id", newsletter.id);

  return NextResponse.json({ success: true }, { status: 200 });
}
