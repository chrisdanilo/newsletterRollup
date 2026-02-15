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

function parseEmailBody(body: string): {
  senderEmail: string;
  senderName: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  forwardingAddress: string;
} {
  // Parse JSON body from email service (Cloudflare Email Routing / SendGrid / Resend inbound)
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = {};
  }

  return {
    senderEmail: parsed.from?.email || parsed.sender || parsed.from || "",
    senderName: parsed.from?.name || parsed.fromName || "",
    subject: parsed.subject || "(No Subject)",
    htmlContent: parsed.html || parsed.htmlContent || "",
    textContent: parsed.text || parsed.textContent || parsed.plain || "",
    forwardingAddress: parsed.to?.email || parsed.recipient || parsed.to || "",
  };
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (secret !== process.env.EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
  }

  const { senderEmail, senderName, subject, htmlContent, textContent, forwardingAddress } =
    parseEmailBody(body);

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

  const rawContent = htmlContent || textContent;
  const extractedLinks = htmlContent ? extractLinks(htmlContent) : [];

  // Store newsletter in database
  const { data: newsletter, error: insertError } = await supabaseAdmin
    .from("newsletters")
    .insert({
      user_id: profile.id,
      sender_email: senderEmail.toLowerCase(),
      sender_name: senderName || null,
      subject,
      raw_content: rawContent,
      extracted_links: extractedLinks,
    })
    .select()
    .single();

  if (insertError) {
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
