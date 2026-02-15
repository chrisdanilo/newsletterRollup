import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Newsletter, ExtractedLink } from "@/types/database";

export default async function ArchivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: newsletters } = await supabase
    .from("newsletters")
    .select("*")
    .eq("user_id", user!.id)
    .eq("included_in_digest", true)
    .order("digest_sent_at", { ascending: false })
    .limit(100);

  // Group by digest date
  const digestGroups = new Map<
    string,
    { date: string; newsletters: Newsletter[] }
  >();

  for (const nl of newsletters as Newsletter[] || []) {
    if (!nl.digest_sent_at) continue;
    const date = new Date(nl.digest_sent_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    if (!digestGroups.has(date)) {
      digestGroups.set(date, { date, newsletters: [] });
    }
    digestGroups.get(date)!.newsletters.push(nl);
  }

  const groups = Array.from(digestGroups.values());

  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digest archive</h1>
          <p className="text-gray-500 mt-1 text-sm">Past digests you&apos;ve received.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">No digests sent yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Your first digest will appear here after it&apos;s sent tonight.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Digest archive</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {groups.length} digest{groups.length !== 1 ? "s" : ""} sent
        </p>
      </div>

      {groups.map((group) => (
        <div
          key={group.date}
          className="bg-white border border-gray-200 rounded-xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">{group.date}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {group.newsletters.length} newsletter{group.newsletters.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ul className="divide-y divide-gray-50">
            {group.newsletters.map((nl) => {
              const links = (nl.extracted_links as ExtractedLink[]) || [];
              return (
                <li key={nl.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div
                        style={{ borderLeft: "3px solid #0066cc", paddingLeft: "12px" }}
                      >
                        <p className="font-semibold text-gray-900 text-sm">
                          {nl.sender_name || nl.sender_email}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{nl.subject}</p>
                        <p className="text-gray-700 text-sm mt-2 leading-relaxed">
                          {nl.summary || nl.subject}
                        </p>
                        {links.slice(0, 3).map((link, i) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-blue-600 text-xs mt-1 hover:underline"
                          >
                            → {link.text}
                          </a>
                        ))}
                      </div>
                    </div>
                    <Link
                      href={`/newsletters/${nl.id}`}
                      className="text-xs text-blue-600 hover:underline flex-shrink-0"
                    >
                      Read full →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
