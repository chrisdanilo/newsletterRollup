import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// This route is a retry endpoint for newsletters whose summarization_status
// is 'pending' or 'failed'. The primary path is now synchronous inside the
// email webhook handler.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== process.env.EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newsletterId } = await request.json();

  if (!newsletterId) {
    return NextResponse.json({ error: "Missing newsletterId" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const { data: newsletter, error: fetchError } = await supabaseAdmin
    .from("newsletters")
    .select("*")
    .eq("id", newsletterId)
    .single();

  if (fetchError || !newsletter) {
    return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
  }

  // Only retry newsletters that haven't successfully summarized
  if (newsletter.summarization_status === "done") {
    return NextResponse.json({ success: true, skipped: true });
  }

  const cleanContent = newsletter.raw_content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: "You summarize newsletters. Always respond with valid JSON only — no prose, no markdown, no code fences.",
      messages: [
        {
          role: "user",
          content: `Summarize this newsletter for a busy reader in 1-3 concise sentences. Extract meaningful article/resource URLs (skip unsubscribe and tracking links).

Subject: ${newsletter.subject}

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
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    const existingLinks = newsletter.extracted_links || [];
    const merged = [...existingLinks];
    for (const aiLink of (result.extracted_links || [])) {
      if (!merged.some((l: { url: string }) => l.url === aiLink.url)) {
        merged.push(aiLink);
      }
    }

    await supabaseAdmin
      .from("newsletters")
      .update({
        summary: result.summary,
        extracted_links: merged.slice(0, 20),
        summarization_status: "done",
      })
      .eq("id", newsletterId);

    return NextResponse.json({ success: true, summary: result.summary });
  } catch (err) {
    console.error("Summarization retry failed:", err);

    await supabaseAdmin
      .from("newsletters")
      .update({ summarization_status: "failed" })
      .eq("id", newsletterId);

    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
}
