import { createClient } from "@/lib/supabase/server";
import NewsletterManagement from "@/components/NewsletterManagement";

export default async function NewslettersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: newsletters } = await supabase
    .from("newsletters")
    .select("sender_email, sender_name, id")
    .eq("user_id", user!.id)
    .order("received_at", { ascending: false });

  const { data: blockedSenders } = await supabase
    .from("blocked_senders")
    .select("*")
    .eq("user_id", user!.id);

  // Group by sender
  const senderMap = new Map<
    string,
    { email: string; name: string | null; count: number }
  >();

  for (const nl of newsletters || []) {
    if (!senderMap.has(nl.sender_email)) {
      senderMap.set(nl.sender_email, {
        email: nl.sender_email,
        name: nl.sender_name,
        count: 0,
      });
    }
    senderMap.get(nl.sender_email)!.count++;
  }

  const senders = Array.from(senderMap.values()).sort(
    (a, b) => b.count - a.count
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Newsletter sources</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage where your newsletters come from. Block senders to exclude them from your digest.
        </p>
      </div>
      <NewsletterManagement senders={senders} blockedSenders={blockedSenders || []} />
    </div>
  );
}
