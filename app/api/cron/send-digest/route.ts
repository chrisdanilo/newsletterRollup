import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { Profile, Newsletter, ExtractedLink } from "@/types/database";

export const dynamic = "force-dynamic";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "#";
  } catch {
    return "#";
  }
  return url;
}

/**
 * Returns true if the user's chosen digest hour (in their timezone) matches
 * the current UTC hour. This is called once per hour by the cron job.
 */
function isDigestHourForUser(profile: Profile): boolean {
  const [digestHour] = profile.digest_time.split(":").map(Number);
  try {
    // Get the current hour in the user's timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: profile.timezone || "America/New_York",
      hour: "numeric",
      hour12: false,
    });
    const localHour = parseInt(formatter.format(new Date()), 10);
    // Intl returns 24 for midnight in some environments; normalise to 0
    return (localHour === 24 ? 0 : localHour) === digestHour;
  } catch {
    // Unknown timezone — fall back to always running (safe default)
    return true;
  }
}

function buildDigestHtml(
  profile: Profile,
  newsletters: Newsletter[],
  appUrl: string
): string {
  const newsletterItems = newsletters
    .map((nl) => {
      const links = (nl.extracted_links as ExtractedLink[]) || [];
      const linksHtml =
        links.length > 0
          ? `<div style="margin-top: 8px;">
          ${links
            .slice(0, 5)
            .map(
              (l) =>
                `<a href="${escapeHtml(safeHref(l.url))}" style="color: #0066cc; font-size: 13px; display: block; margin-bottom: 4px; text-decoration: none;">→ ${escapeHtml(l.text)}</a>`
            )
            .join("")}
        </div>`
          : "";

      return `
      <div style="border-left: 3px solid #0066cc; padding-left: 16px; margin: 24px 0;">
        <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #1a1a1a;">
          ${escapeHtml(nl.sender_name || nl.sender_email)}
        </h3>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">${escapeHtml(nl.subject)}</p>
        <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.5;">
          ${escapeHtml(nl.summary || nl.subject)}
        </p>
        ${linksHtml}
        <a href="${escapeHtml(appUrl)}/newsletters/${escapeHtml(nl.id)}" style="display: inline-block; margin-top: 10px; color: #0066cc; font-size: 13px; text-decoration: none;">
          Read full email →
        </a>
      </div>`;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="margin: 0 0 4px 0; font-size: 22px; color: #1a1a1a;">Your Daily Newsletter Digest</h2>
        <p style="margin: 0 0 24px 0; color: #666; font-size: 14px;">
          ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          · You received <strong>${newsletters.length}</strong> newsletter${newsletters.length !== 1 ? "s" : ""} today
        </p>

        ${newsletterItems}

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 24px 0;">
        <p style="font-size: 12px; color: #999; margin: 0 0 8px 0;">
          <a href="${appUrl}/dashboard" style="color: #666; text-decoration: none;">Manage your digest settings</a>
          · <a href="${appUrl}/dashboard/settings" style="color: #666; text-decoration: none;">Unsubscribe or pause</a>
        </p>
        <p style="font-size: 11px; color: #bbb; margin: 0;">
          Summaries powered by Claude AI by Anthropic. Your newsletter content is processed to generate summaries and is never sold or shared with third parties.
        </p>
      </div>
    </body>
    </html>`;
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com";
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  // Get all active users
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("is_active", true);

  if (profilesError) {
    console.error("Failed to fetch profiles:", profilesError);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Digest date in UTC — used as the idempotency key for digest_batches
  const digestDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  for (const profile of profiles as Profile[]) {
    try {
      // Skip users whose local digest hour doesn't match the current hour
      if (!isDigestHourForUser(profile)) {
        skipped++;
        continue;
      }

      // Check whether there is anything to send before claiming the batch slot.
      // This avoids the insert-then-delete pattern for empty digests, which
      // could leave a dangling row if an error occurs between insert and delete.
      const { data: blockedSenders } = await supabaseAdmin
        .from("blocked_senders")
        .select("sender_email")
        .eq("user_id", profile.id);

      const blockedEmails = (blockedSenders || []).map(
        (b: { sender_email: string }) => b.sender_email
      );

      // Get unsent newsletters
      const { data: newsletters, error: nlError } = await supabaseAdmin
        .from("newsletters")
        .select("*")
        .eq("user_id", profile.id)
        .eq("included_in_digest", false)
        .order("received_at", { ascending: false });

      if (nlError) throw nlError;

      const filteredNewsletters = (newsletters as Newsletter[]).filter(
        (nl) => !blockedEmails.includes(nl.sender_email)
      );

      if (filteredNewsletters.length === 0) {
        skipped++;
        continue;
      }

      // Atomically claim this digest slot — prevents double-sends on cron retry.
      // Only insert the batch row once we know there is content to send.
      const { data: batch, error: batchError } = await supabaseAdmin
        .from("digest_batches")
        .insert({ user_id: profile.id, digest_date: digestDate, newsletter_ids: [] })
        .select()
        .single();

      if (batchError) {
        // Unique constraint violation means this digest was already sent this hour
        if (batchError.code === "23505") {
          skipped++;
          continue;
        }
        throw batchError;
      }

      const html = buildDigestHtml(profile, filteredNewsletters, appUrl);
      const subject =
        filteredNewsletters.length === 1
          ? `Your digest: ${filteredNewsletters[0].subject}`
          : `Your digest: ${filteredNewsletters.length} newsletters for ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      const settingsUrl = `${appUrl}/dashboard/settings`;
      await sgMail.send({
        from: `digest@${process.env.NEXT_PUBLIC_APP_DOMAIN || "usebrief.me"}`,
        to: profile.email,
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${settingsUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      // Mark newsletters as sent
      const now = new Date().toISOString();
      const newsletterIds = filteredNewsletters.map((nl) => nl.id);

      await supabaseAdmin
        .from("newsletters")
        .update({ included_in_digest: true, digest_sent_at: now })
        .in("id", newsletterIds);

      // Record the newsletter IDs that went into this batch
      await supabaseAdmin
        .from("digest_batches")
        .update({ newsletter_ids: newsletterIds })
        .eq("id", batch.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send digest for user ${profile.id}:`, err);
      errors.push(profile.email);
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
