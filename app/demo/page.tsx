"use client";

import { useState } from "react";
import Link from "next/link";

const MOCK_PROFILE = {
  first_name: "Calvin",
  last_name: "Hobbes",
  email: "calvin@example.com",
  forwarding_address: "calvin4821@usebrief.me",
  digest_time: "21:00:00",
  is_active: true,
};

const MOCK_NEWSLETTERS = [
  {
    id: "1",
    sender_email: "briefing@morningbrew.com",
    sender_name: "Morning Brew",
    subject: "☕ The AI investment surge continues",
    summary:
      "Venture capital poured $18B into AI startups last quarter, a 340% YoY increase. Anthropic and OpenAI lead fundraising, while enterprise AI adoption hit 67% among Fortune 500 companies. Analysts predict consolidation in 2025 as smaller players struggle to compete on compute costs.",
    extracted_links: [
      { url: "#", text: "VC AI Investment Report Q4 2024" },
      { url: "#", text: "Fortune 500 AI Adoption Survey" },
    ],
    received_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    included_in_digest: false,
    digest_sent_at: null,
  },
  {
    id: "2",
    sender_email: "newsletter@tldr.tech",
    sender_name: "TLDR Tech",
    subject: "TLDR: Rust tops developer satisfaction for 9th year, Apple Vision Pro 2 leaks",
    summary:
      "Stack Overflow's annual survey reveals Rust remains the most-loved language for the 9th consecutive year, with 84% satisfaction. Apple's Vision Pro 2 reportedly features a 30% lighter form factor and M4 chip. GitHub Copilot now writes 46% of code at companies that have adopted it.",
    extracted_links: [
      { url: "#", text: "Stack Overflow Developer Survey 2024" },
      { url: "#", text: "GitHub Copilot Usage Statistics" },
    ],
    received_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    included_in_digest: false,
    digest_sent_at: null,
  },
  {
    id: "3",
    sender_email: "digest@stratechery.com",
    sender_name: "Stratechery",
    subject: "The Aggregation Theory of AI",
    summary:
      "Ben Thompson argues that AI will follow the same aggregation pattern as Google and Facebook — platforms that control distribution will ultimately capture the most value, not model creators. This has significant implications for how enterprises should think about AI vendor lock-in and data moats.",
    extracted_links: [
      { url: "#", text: "Aggregation Theory explained" },
    ],
    received_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    included_in_digest: false,
    digest_sent_at: null,
  },
  {
    id: "4",
    sender_email: "hello@finimize.com",
    sender_name: "Finimize",
    subject: "Fed holds rates — here's what it means for your portfolio",
    summary:
      "The Federal Reserve held rates steady at 5.25-5.5% citing persistent services inflation. Markets rallied 1.2% on dovish forward guidance hinting at 2 cuts in 2025. Analysts recommend rotating from cash into short-duration bonds as yields are expected to compress over the next 12 months.",
    extracted_links: [
      { url: "#", text: "Fed Statement November 2024" },
      { url: "#", text: "Bond rotation strategy guide" },
    ],
    received_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    included_in_digest: true,
    digest_sent_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    sender_email: "weekly@hackernewsletter.com",
    sender_name: "Hacker Newsletter",
    subject: "Hacker Newsletter #676",
    summary:
      "This week's top HN stories: a deep dive on SQLite's surprising scalability limits, a viral post on why most 'clean code' advice is wrong, and discussion around Cloudflare's new AI gateway product that saw 50k signups in 48 hours.",
    extracted_links: [
      { url: "#", text: "SQLite scalability deep dive" },
      { url: "#", text: "Cloudflare AI Gateway announcement" },
    ],
    received_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    included_in_digest: true,
    digest_sent_at: new Date(Date.now() - 39 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_SENDERS = [
  { email: "briefing@morningbrew.com", name: "Morning Brew", count: 47 },
  { email: "newsletter@tldr.tech", name: "TLDR Tech", count: 38 },
  { email: "digest@stratechery.com", name: "Stratechery", count: 29 },
  { email: "hello@finimize.com", name: "Finimize", count: 22 },
  { email: "weekly@hackernewsletter.com", name: "Hacker Newsletter", count: 19 },
  { email: "news@thehustle.com", name: "The Hustle", count: 14 },
  { email: "updates@cbinsights.com", name: "CB Insights", count: 11 },
];

type Tab = "overview" | "newsletters" | "archive" | "settings";

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [digestTime, setDigestTime] = useState("21:00:00");

  const today = MOCK_NEWSLETTERS.filter((n) => !n.included_in_digest);
  const archived = MOCK_NEWSLETTERS.filter((n) => n.included_in_digest);

  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const navLinks: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "newsletters", label: "Newsletters" },
    { key: "archive", label: "Archive" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo banner */}
      <div className="bg-amber-400 text-amber-900 text-center text-sm py-2 px-4 font-medium">
        Demo mode — no real data. All content is simulated.{" "}
        <Link href="/" className="underline font-semibold">
          Create a real account →
        </Link>
      </div>

      {/* Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-lg font-bold text-blue-700">NewsletterRollup</span>
              <nav className="hidden sm:flex items-center gap-1">
                {navLinks.map((link) => (
                  <button
                    key={link.key}
                    onClick={() => setTab(link.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tab === link.key
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
            </div>
            <span className="text-sm text-gray-500">
              {MOCK_PROFILE.first_name} {MOCK_PROFILE.last_name}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {MOCK_PROFILE.first_name}!
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Here&apos;s your newsletter digest overview.
              </p>
            </div>

            {/* Forwarding address */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h2 className="font-semibold text-blue-900 mb-2">Your forwarding address</h2>
              <p className="text-blue-700 text-sm mb-3">
                Subscribe newsletters to this address to include them in your digest:
              </p>
              <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-4 py-3">
                <code className="text-blue-800 font-mono text-sm flex-1">
                  {MOCK_PROFILE.forwarding_address}
                </code>
                <button
                  onClick={handleCopy}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="mt-4 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Getting started:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-600">
                  <li>Copy your forwarding address above</li>
                  <li>Update your newsletter subscriptions to this address</li>
                  <li>You&apos;ll receive a nightly digest at 9 PM</li>
                </ol>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total newsletters received", value: 180 },
                { label: "Active sources", value: MOCK_SENDERS.length },
                { label: "Last digest sent", value: "Today, 9:00 PM" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-6">
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Today's pending */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">
                  Today&apos;s newsletters — pending digest ({today.length})
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  These will be included in tonight&apos;s 9 PM digest
                </p>
              </div>
              <ul className="divide-y divide-gray-50">
                {today.map((nl) => (
                  <li key={nl.id} className="px-6 py-5">
                    <div style={{ borderLeft: "3px solid #0066cc", paddingLeft: "12px" }}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{nl.sender_name}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{nl.subject}</p>
                          <p className="text-gray-700 text-sm mt-2 leading-relaxed">{nl.summary}</p>
                          {nl.extracted_links.map((link, i) => (
                            <span
                              key={i}
                              className="block text-blue-600 text-xs mt-1 cursor-default"
                            >
                              → {link.text}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {new Date(nl.received_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Digest status */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Digest status</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Active — digest sent at 21:00 daily
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  Active
                </span>
              </div>
            </div>
          </div>
        )}

        {/* NEWSLETTERS */}
        {tab === "newsletters" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Newsletter sources</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Manage your sources. Block senders to exclude them from your digest.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">
                  Active sources ({MOCK_SENDERS.filter((s) => !blocked.has(s.email)).length})
                </h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {MOCK_SENDERS.filter((s) => !blocked.has(s.email)).map((sender) => (
                  <li key={sender.email} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{sender.name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{sender.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400">{sender.count} emails</span>
                      <button
                        onClick={() => setBlocked((prev) => new Set([...prev, sender.email]))}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                      >
                        Block
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {blocked.size > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">
                    Blocked senders ({blocked.size})
                  </h2>
                </div>
                <ul className="divide-y divide-gray-50">
                  {MOCK_SENDERS.filter((s) => blocked.has(s.email)).map((sender) => (
                    <li
                      key={sender.email}
                      className="flex items-center justify-between px-6 py-4 opacity-60"
                    >
                      <div>
                        <p className="font-medium text-gray-900 text-sm line-through">
                          {sender.name}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">{sender.email}</p>
                      </div>
                      <button
                        onClick={() =>
                          setBlocked((prev) => {
                            const next = new Set(prev);
                            next.delete(sender.email);
                            return next;
                          })
                        }
                        className="text-sm text-blue-500 hover:text-blue-700 font-medium"
                      >
                        Unblock
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ARCHIVE */}
        {tab === "archive" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Digest archive</h1>
              <p className="text-gray-500 mt-1 text-sm">Past digests you&apos;ve received.</p>
            </div>

            {[
              {
                date: "Yesterday, Nov 14 2024",
                items: archived,
              },
              {
                date: "Wednesday, Nov 13 2024",
                items: [MOCK_NEWSLETTERS[1], MOCK_NEWSLETTERS[3]],
              },
            ].map((group) => (
              <div
                key={group.date}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="font-semibold text-gray-900">{group.date}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {group.items.length} newsletters
                  </p>
                </div>
                <ul className="divide-y divide-gray-50">
                  {group.items.map((nl) => (
                    <li key={nl.id + group.date} className="px-6 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className="flex-1"
                          style={{ borderLeft: "3px solid #0066cc", paddingLeft: "12px" }}
                        >
                          <p className="font-semibold text-gray-900 text-sm">{nl.sender_name}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{nl.subject}</p>
                          <p className="text-gray-700 text-sm mt-2 leading-relaxed">{nl.summary}</p>
                          {nl.extracted_links.slice(0, 2).map((link, i) => (
                            <span key={i} className="block text-blue-600 text-xs mt-1 cursor-default">
                              → {link.text}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => setTab("overview")}
                          className="text-xs text-blue-600 hover:underline flex-shrink-0"
                        >
                          Read full →
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Manage your profile and digest preferences.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
              <h2 className="font-semibold text-gray-900">Profile</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input
                    type="text"
                    defaultValue={MOCK_PROFILE.first_name}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input
                    type="text"
                    defaultValue={MOCK_PROFILE.last_name}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={MOCK_PROFILE.email}
                  disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forwarding address
                </label>
                <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                  <code className="text-sm text-gray-600 flex-1 font-mono">
                    {MOCK_PROFILE.forwarding_address}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <h2 className="font-semibold text-gray-900 pt-2">Digest preferences</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery time
                </label>
                <select
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[
                    ["06:00:00", "6:00 AM"],
                    ["09:00:00", "9:00 AM"],
                    ["12:00:00", "12:00 PM"],
                    ["18:00:00", "6:00 PM"],
                    ["21:00:00", "9:00 PM"],
                    ["00:00:00", "12:00 AM"],
                  ].map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isActive ? "Digest active" : "Digest paused"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isActive
                      ? "You'll receive your nightly digest"
                      : "Vacation mode — no digests will be sent"}
                  </p>
                </div>
              </div>

              <button className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors">
                Save settings
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <p className="text-sm text-gray-500 italic">
                Account deletion is disabled in demo mode.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
              <p className="text-blue-800 font-semibold mb-2">Ready to use the real thing?</p>
              <p className="text-blue-600 text-sm mb-4">
                Create a free account to start receiving your actual newsletter digest.
              </p>
              <Link
                href="/"
                className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                Get started free →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
