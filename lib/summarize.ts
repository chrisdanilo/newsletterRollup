import Anthropic from "@anthropic-ai/sdk";
import { ExtractedLink } from "@/types/database";

// Shared truncation limits — one place to change them all
export const MAX_CONTENT_BYTES = 500_000; // hard cap on raw stored content
export const MAX_PROMPT_CHARS = 8_000;    // chars sent to Claude
export const MAX_LINKS = 20;              // links stored per newsletter

/**
 * Strips HTML tags and whitespace from raw email content, then truncates to
 * MAX_PROMPT_CHARS before sending to Claude.
 */
export function cleanContentForPrompt(rawContent: string): string {
  return rawContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROMPT_CHARS);
}

/**
 * Merges AI-extracted links with HTML-extracted links, deduplicates by URL,
 * and caps the result at MAX_LINKS.
 */
export function mergeLinks(
  htmlLinks: ExtractedLink[],
  aiLinks: { url: string; text: string }[]
): ExtractedLink[] {
  const merged = [...htmlLinks];
  for (const aiLink of aiLinks) {
    if (!merged.some((l) => l.url === aiLink.url)) {
      merged.push(aiLink);
    }
  }
  return merged.slice(0, MAX_LINKS);
}

/**
 * Calls Claude to summarize a newsletter and extract meaningful links.
 * Returns summary, merged links, and a status.
 *
 * Never throws — on failure it returns status='failed' so the caller can
 * update the DB row to a terminal state rather than leaving it 'pending'.
 */
export async function summarizeNewsletter(
  newsletterId: string,
  subject: string,
  rawContent: string,
  htmlLinks: ExtractedLink[]
): Promise<{ summary: string; links: ExtractedLink[]; status: "done" | "failed" }> {
  const cleanContent = cleanContentForPrompt(rawContent);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system:
        "You summarize newsletters. Always respond with valid JSON only — no prose, no markdown, no code fences.",
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

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

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

    return {
      summary: result.summary,
      links: mergeLinks(htmlLinks, result.extracted_links || []),
      status: "done",
    };
  } catch (err) {
    console.error(`Summarization failed for newsletter ${newsletterId}:`, err);
    return { summary: "", links: htmlLinks, status: "failed" };
  }
}
