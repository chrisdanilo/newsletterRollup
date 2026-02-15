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

  const uniqueSenders = new Set((senders || []).map((s: { sender_email: string }) => s.sender_email)).size;

  const lastDigest = lastDigestRow?.digest_sent_at
    ? new Date(lastDigestRow.digest_sent_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Never";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.first_name}!
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here&apos;s your newsletter digest overview.
        </p>
      </div>

      {/* Forwarding address */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="font-semibold text-blue-900 mb-2">
          Your forwarding address
        </h2>
        <p className="text-blue-700 text-sm mb-3">
          Subscribe newsletters to this address to include them in your digest:
        </p>
        <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-4 py-3">
          <code className="text-blue-800 font-mono text-sm flex-1">
            {profile?.forwarding_address}
          </code>
          <CopyButton text={profile?.forwarding_address || ""} />
        </div>
        <div className="mt-4 text-xs text-blue-700 space-y-1">
          <p className="font-medium">Getting started:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600">
            <li>Copy your forwarding address above</li>
            <li>Go to each newsletter you subscribe to</li>
            <li>Update your email address to your forwarding address</li>
            <li>You&apos;ll receive a digest at 9 PM every night</li>
          </ol>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total newsletters received",
            value: totalNewsletters ?? 0,
          },
          { label: "Active sources", value: uniqueSenders },
          { label: "Last digest sent", value: lastDigest },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-200 rounded-xl p-6"
          >
            <p className="text-gray-500 text-sm">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Digest status */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Digest status</h2>
            <p className="text-sm text-gray-500 mt-1">
              {profile?.is_active
                ? `Active — digest sent at ${profile?.digest_time?.slice(0, 5) || "21:00"} daily`
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
