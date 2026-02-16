import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { summarizeNewsletter } from "@/lib/summarize";

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

  const { summary, links, status } = await summarizeNewsletter(
    newsletter.id,
    newsletter.subject,
    newsletter.raw_content,
    newsletter.extracted_links || []
  );

  if (status === "done") {
    await supabaseAdmin
      .from("newsletters")
      .update({
        summary,
        extracted_links: links,
        summarization_status: "done",
      })
      .eq("id", newsletterId);

    return NextResponse.json({ success: true, summary });
  } else {
    await supabaseAdmin
      .from("newsletters")
      .update({ summarization_status: "failed" })
      .eq("id", newsletterId);

    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
}
