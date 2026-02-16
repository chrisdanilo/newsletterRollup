import { createClient } from "@/lib/supabase/server";
import CopyButton from "@/components/CopyButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { count: totalNewsletters } = await supabase
    .from("newsletters")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const { data: lastDigestRow } = await supabase
    .from("newsletters")
    .select("digest_sent_at")
    .eq("user_id", user!.id)
    .eq("included_in_digest", true)
    .order("digest_sent_at", { ascending: false })
    .limit(1)
    .single();

  // Count distinct senders
  const { data: senders } = await supabase
    .from("newsletters")
    .select("sender_email")
    .eq("user_id", user!.id);

  const uniqueSenders = new Set(
    (senders || []).map((s: { sender_email: string }) => s.sender_email)
  ).size;

  // Count newsletters still pending or failed summarization
  const { count: pendingCount } = await supabase
    .from("newsletters")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("summarization_status", "pending");

  const { count: failedCount } = await supabase
    .from("newsletters")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("summarization_status", "failed");

  const lastDigest = lastDigestRow?.digest_sent_at
    ? new Date(lastDigestRow.digest_sent_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Never";

  // Format digest time for display (profile stores "HH:MM:SS")
  const digestHour = profile?.digest_time?.slice(0, 5) ?? "21:00";
  const [h] = digestHour.split(":").map(Number);
  const digestTimeLabel =
    h === 0 ? "12:00 AM" :
    h < 12  ? `${h}:00 AM` :
    h === 12 ? "12:00 PM" :
    `${h - 12}:00 PM`;

  const isFirstTime = !totalNewsletters || totalNewsletters === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{isFirstTime ? "" : " back"}, {profile?.first_name}!
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isFirstTime
            ? "Let's get your newsletter digest set up."
            : "Here's your newsletter digest overview."}
        </p>
      </div>

      {/* Forwarding address — always visible, prominent */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="font-semibold text-blue-900 mb-1">
          Your forwarding address
        </h2>
        <p className="text-blue-700 text-sm mb-3">
          Subscribe your newsletters to this address and we&apos;ll include them in your digest.
        </p>
        <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-4 py-3">
          <code className="text-blue-800 font-mono text-sm flex-1 break-all">
            {profile?.forwarding_address}
          </code>
          <CopyButton text={profile?.forwarding_address || ""} label="Copy address" />
        </div>

        {/* First-time setup guide */}
        {isFirstTime && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
              Getting started — 3 steps
            </p>
            <ol className="space-y-2" aria-label="Setup steps">
              <li className="flex gap-3 text-sm text-blue-700">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center"
                  aria-hidden="true"
                >
                  1
                </span>
                <span>Copy the forwarding address above and keep it handy.</span>
              </li>
              <li className="flex gap-3 text-sm text-blue-700">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center"
                  aria-hidden="true"
                >
                  2
                </span>
                <span>
                  Go to each newsletter you subscribe to and update your subscriber email to the forwarding address.
                </span>
              </li>
              <li className="flex gap-3 text-sm text-blue-700">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center"
                  aria-hidden="true"
                >
                  3
                </span>
                <span>
                  Come back here after your first newsletter arrives. Your digest will be sent at{" "}
                  <strong>{digestTimeLabel}</strong>{" "}
                  ({profile?.timezone ?? "your time zone"}).
                </span>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Summarization status banners — only shown when relevant */}
      {(pendingCount ?? 0) > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-sm text-yellow-800 flex items-center gap-3"
        >
          <svg
            className="w-4 h-4 flex-shrink-0 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>
            <strong>{pendingCount}</strong>{" "}
            newsletter{pendingCount !== 1 ? "s are" : " is"} being summarized — this usually takes a few seconds.
          </span>
        </div>
      )}

      {(failedCount ?? 0) > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-800"
        >
          <strong>{failedCount}</strong>{" "}
          newsletter{failedCount !== 1 ? "s" : ""} couldn&apos;t be summarized and will appear in your
          digest without a summary. They&apos;re still saved — you can read the full content in the archive.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total newsletters received", value: totalNewsletters ?? 0 },
          { label: "Active sources", value: uniqueSenders },
          { label: "Last digest sent", value: lastDigest },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-200 rounded-xl p-6"
          >
            <p className="text-gray-500 text-sm">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Digest schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Digest schedule</h2>
            <p className="text-sm text-gray-500 mt-1">
              {profile?.is_active
                ? `Active — digest sent at ${digestTimeLabel} (${profile?.timezone ?? "UTC"})`
                : "Paused — no digests will be sent"}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              profile?.is_active
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {profile?.is_active ? "Active" : "Paused"}
          </span>
        </div>
      </div>
    </div>
  );
}
