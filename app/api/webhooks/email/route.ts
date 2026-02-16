import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ExtractedLink } from "@/types/database";
import { summarizeNewsletter, MAX_CONTENT_BYTES, MAX_LINKS } from "@/lib/summarize";

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

  return links.slice(0, MAX_LINKS);
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
  const { summary, links, status } = await summarizeNewsletter(
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
