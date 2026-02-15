import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExtractedLink } from "@/types/database";
import NewsletterContent from "@/components/NewsletterContent";

export default async function NewsletterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: newsletter, error } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !newsletter) {
    notFound();
  }

  const links = (newsletter.extracted_links as ExtractedLink[]) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard/archive"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to archive
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {newsletter.subject}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span>
                <strong className="text-gray-700">From:</strong>{" "}
                {newsletter.sender_name
                  ? `${newsletter.sender_name} <${newsletter.sender_email}>`
                  : newsletter.sender_email}
              </span>
              <span>
                <strong className="text-gray-700">Received:</strong>{" "}
                {new Date(newsletter.received_at).toLocaleString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {newsletter.summary && (
            <div className="px-8 py-5 bg-blue-50 border-b border-blue-100">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                AI Summary
              </p>
              <p className="text-blue-900 text-sm leading-relaxed">
                {newsletter.summary}
              </p>
            </div>
          )}

          {links.length > 0 && (
            <div className="px-8 py-5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Key links
              </p>
              <ul className="space-y-2">
                {links.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline"
                    >
                      → {link.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-8 py-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Full email content
            </p>
            <NewsletterContent rawContent={newsletter.raw_content} />
          </div>
        </div>
      </div>
    </div>
  );
}
