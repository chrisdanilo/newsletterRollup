import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ExtractedLink } from "@/types/database";

export const dynamic = "force-dynamic";

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

    // Skip unsubscribe links, tracking pixels, and empty URLs
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

  return links.slice(0, 20); // max 20 links
}

function parseSendGridFrom(from: string): { email: string; name: string } {
  // SendGrid from field is like "Name <email@example.com>" or just "email@example.com"
  const match = from.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: "", email: from.trim().toLowerCase() };
}

function extractMessageId(headersRaw: string): string | null {
  // The "headers" field from SendGrid contains raw SMTP headers as a string
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

  // SendGrid Inbound Parse sends multipart/form-data
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const from = formData.get("from")?.toString() || "";
    const { email: senderEmail, name: senderName } = parseSendGridFrom(from);

    // SendGrid puts the recipient in "to" or the envelope JSON
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

  // Fallback: JSON body (other providers)
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
  // Verify webhook secret
  const secret = request.nextUrl.searchParams.get("secret") ||
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

  // Look up user by forwarding address
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

  // Store newsletter in database.
  // The DB trigger will reject this if the user has received >= 50 newsletters
  // in the last 24 hours (rate limit enforced at DB layer).
  // The unique index on (user_id, message_id) silently deduplicates replays.
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
    })
    .select()
    .single();

  if (insertError) {
    // Duplicate message_id — already processed, tell SendGrid it succeeded
    if (insertError.code === "23505") {
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }
    // Rate limit exceeded
    if (insertError.message?.includes("Rate limit exceeded")) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    console.error("Failed to insert newsletter:", insertError);
    return NextResponse.json({ error: "Failed to store email" }, { status: 500 });
  }

  // Trigger summarization in background (fire and forget)
  if (newsletter) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.EMAIL_WEBHOOK_SECRET!,
      },
      body: JSON.stringify({ newsletterId: newsletter.id }),
    }).catch(err => console.error("Failed to trigger summarization:", err));
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
