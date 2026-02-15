import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

  // Strip HTML for cleaner summarization input
  const cleanContent = newsletter.raw_content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000); // limit to 8k chars

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are summarizing a newsletter for a busy executive. Extract the key insights in 1-3 concise sentences. Focus on actionable information, trends, or important updates. Also extract all meaningful URLs from the content (articles, reports, resources - not unsubscribe links or tracking pixels).

Newsletter subject: ${newsletter.subject}
Newsletter content:
${cleanContent}

Return JSON format:
{
  "summary": "1-3 sentence summary here",
  "extracted_links": [
    {"url": "https://...", "text": "Link description"},
    ...
  ]
}

Return only valid JSON, no other text.`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    let result: { summary: string; extracted_links: { url: string; text: string }[] };
    try {
      result = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    // Merge AI-extracted links with webhook-extracted links
    const existingLinks = newsletter.extracted_links || [];
    const aiLinks = result.extracted_links || [];
    const mergedLinks = [...existingLinks];

    for (const aiLink of aiLinks) {
      if (!mergedLinks.some((l: { url: string }) => l.url === aiLink.url)) {
        mergedLinks.push(aiLink);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("newsletters")
      .update({
        summary: result.summary,
        extracted_links: mergedLinks.slice(0, 20),
      })
      .eq("id", newsletterId);

    if (updateError) {
      console.error("Failed to update newsletter with summary:", updateError);
      return NextResponse.json({ error: "Failed to save summary" }, { status: 500 });
    }

    return NextResponse.json({ success: true, summary: result.summary });
  } catch (err) {
    console.error("Summarization failed:", err);
    // Store a fallback summary so the newsletter still appears in digest
    await supabaseAdmin
      .from("newsletters")
      .update({ summary: `${newsletter.subject} (Summary unavailable)` })
      .eq("id", newsletterId);

    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
}
