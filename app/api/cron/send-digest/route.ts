import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { Profile, Newsletter, ExtractedLink } from "@/types/database";

export const dynamic = "force-dynamic";

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
                `<a href="${l.url}" style="color: #0066cc; font-size: 13px; display: block; margin-bottom: 4px; text-decoration: none;">→ ${l.text}</a>`
            )
            .join("")}
        </div>`
          : "";

      return `
      <div style="border-left: 3px solid #0066cc; padding-left: 16px; margin: 24px 0;">
        <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #1a1a1a;">
          ${nl.sender_name || nl.sender_email}
        </h3>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">${nl.subject}</p>
        <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.5;">
          ${nl.summary || nl.subject}
        </p>
        ${linksHtml}
        <a href="${appUrl}/newsletters/${nl.id}" style="display: inline-block; margin-top: 10px; color: #0066cc; font-size: 13px; text-decoration: none;">
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
        <p style="font-size: 12px; color: #999; margin: 0;">
          <a href="${appUrl}/dashboard" style="color: #666; text-decoration: none;">Manage your digest settings</a>
          · <a href="${appUrl}/dashboard/settings" style="color: #666; text-decoration: none;">Unsubscribe or pause</a>
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

  for (const profile of profiles as Profile[]) {
    try {
      // Get unsent newsletters for this user (not blocked)
      const { data: blockedSenders } = await supabaseAdmin
        .from("blocked_senders")
        .select("sender_email")
        .eq("user_id", profile.id);

      const blockedEmails = (blockedSenders || []).map(
        (b: { sender_email: string }) => b.sender_email
      );

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

      const html = buildDigestHtml(profile, filteredNewsletters, appUrl);
      const subject =
        filteredNewsletters.length === 1
          ? `Your digest: ${filteredNewsletters[0].subject}`
          : `Your digest: ${filteredNewsletters.length} newsletters for ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      await sgMail.send({
        from: `digest@${process.env.NEXT_PUBLIC_APP_DOMAIN || "usebrief.me"}`,
        to: profile.email,
        subject,
        html,
      });

      // Mark newsletters as sent
      const now = new Date().toISOString();
      const newsletterIds = filteredNewsletters.map((nl) => nl.id);

      await supabaseAdmin
        .from("newsletters")
        .update({ included_in_digest: true, digest_sent_at: now })
        .in("id", newsletterIds);

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
