"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BlockedSender } from "@/types/database";
import toast from "react-hot-toast";

interface Sender {
  email: string;
  name: string | null;
  count: number;
}

interface Props {
  senders: Sender[];
  blockedSenders: BlockedSender[];
}

export default function NewsletterManagement({ senders, blockedSenders }: Props) {
  const [blocked, setBlocked] = useState<Set<string>>(
    new Set(blockedSenders.map((b) => b.sender_email))
  );
  const [search, setSearch] = useState("");
  const supabase = createClient();

  const filteredSenders = senders.filter(
    (s) =>
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.name?.toLowerCase() || "").includes(search.toLowerCase())
  );

  async function blockSender(email: string) {
    const { error } = await supabase
      .from("blocked_senders")
      .insert({ sender_email: email });

    if (error) {
      toast.error("Failed to block sender");
    } else {
      setBlocked((prev) => new Set([...prev, email]));
      toast.success("Sender blocked");
    }
  }

  async function unblockSender(email: string) {
    const { error } = await supabase
      .from("blocked_senders")
      .delete()
      .eq("sender_email", email);

    if (error) {
      toast.error("Failed to unblock sender");
    } else {
      setBlocked((prev) => {
        const next = new Set(prev);
        next.delete(email);
        return next;
      });
      toast.success("Sender unblocked");
    }
  }

  if (senders.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <p className="text-gray-500">No newsletters received yet.</p>
        <p className="text-sm text-gray-400 mt-2">
          Forward emails to your address to get started.
        </p>
      </div>
    );
  }

  const activeSenders = filteredSenders.filter((s) => !blocked.has(s.email));
  const blockedSendersList = filteredSenders.filter((s) => blocked.has(s.email));

  return (
    <div className="space-y-6">
      <div>
        <input
          type="search"
          placeholder="Search senders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-80"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Active sources ({activeSenders.length})
          </h2>
        </div>
        {activeSenders.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm text-center">No active senders.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {activeSenders.map((sender) => (
              <li
                key={sender.email}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {sender.name || sender.email}
                  </p>
                  {sender.name && (
                    <p className="text-gray-400 text-xs mt-0.5">{sender.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">
                    {sender.count} email{sender.count !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => blockSender(sender.email)}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    Block
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {blockedSendersList.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Blocked senders ({blockedSendersList.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {blockedSendersList.map((sender) => (
              <li
                key={sender.email}
                className="flex items-center justify-between px-6 py-4 opacity-60"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm line-through">
                    {sender.name || sender.email}
                  </p>
                  {sender.name && (
                    <p className="text-gray-400 text-xs mt-0.5">{sender.email}</p>
                  )}
                </div>
                <button
                  onClick={() => unblockSender(sender.email)}
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
  );
}
