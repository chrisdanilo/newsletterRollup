"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import CopyButton from "./CopyButton";
import toast from "react-hot-toast";
import {
  TIMEZONES,
  DIGEST_TIMES,
  detectBrowserTimezone,
  isValidTimezone,
  isValidDigestTime,
} from "@/lib/formatting";

interface Props {
  profile: Profile | null;
}

export default function SettingsForm({ profile }: Props) {
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [digestTime, setDigestTime] = useState(profile?.digest_time || "21:00:00");
  const [timezone, setTimezone] = useState(
    profile?.timezone || detectBrowserTimezone()
  );
  const [isActive, setIsActive] = useState(profile?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus inside the modal and close on Escape
  useEffect(() => {
    if (!showDeleteModal) return;

    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowDeleteModal(false);
      } else if (e.key === "Tab" && focusable && focusable.length > 0) {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showDeleteModal]);

  const supabase = createClient();
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Validate timezone and digest_time at the boundary before writing to DB.
    // The dropdowns already constrain these values, but we validate explicitly
    // so a crafted request can't store an unsupported timezone that would silently
    // break digest delivery.
    if (!isValidTimezone(timezone)) {
      toast.error("Invalid timezone selected");
      setLoading(false);
      return;
    }
    if (!isValidDigestTime(digestTime)) {
      toast.error("Invalid digest time selected");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          digest_time: digestTime,
          timezone,
          is_active: isActive,
        })
        .eq("id", profile!.id);

      if (error) throw error;
      toast.success("Settings saved");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);

    try {
      // Delete profile (cascades to newsletters)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profile!.id);

      if (profileError) throw profileError;

      await supabase.auth.signOut();
      toast.success("Account deleted successfully");
      router.push("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
      setDeleteLoading(false);
    }
  }

  // Find the display label for the current digest time + timezone
  const selectedTimeLabel = DIGEST_TIMES.find((t) => t.value === digestTime)?.label ?? digestTime;
  const selectedTzLabel = TIMEZONES.find((t) => t.value === timezone)?.label.split(" — ")[0] ?? timezone;

  return (
    <div className="space-y-6">
      {/* Profile */}
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <h2 className="font-semibold text-gray-900">Profile</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={profile?.email || ""}
            disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Forwarding address
          </label>
          <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
            <code className="text-sm text-gray-600 flex-1 font-mono">
              {profile?.forwarding_address}
            </code>
            <CopyButton text={profile?.forwarding_address || ""} />
          </div>
          <p className="text-xs text-gray-400 mt-1">Forwarding address cannot be changed</p>
        </div>

        <h2 className="font-semibold text-gray-900 pt-2">Digest preferences</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery time
            </label>
            <select
              value={digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DIGEST_TIMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time zone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-gray-400 -mt-2">
          Your digest will arrive at {selectedTimeLabel} {selectedTzLabel}.
          Time zone was auto-detected from your browser.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={isActive ? "Digest active — click to pause" : "Digest paused — click to activate"}
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
                ? "You&apos;ll receive your nightly digest"
                : "Vacation mode — no digests will be sent"}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? "Saving..." : "Save settings"}
        </button>
      </form>

      {/* Danger zone */}
      <div className="bg-white border border-red-200 rounded-xl p-6">
        <h2 className="font-semibold text-red-700 mb-2">Danger zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Permanently delete your account and all your newsletters. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Delete account
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl"
          >
            <h3 id="delete-modal-title" className="text-xl font-bold text-gray-900 mb-2">
              Delete your account?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              This will permanently delete all your newsletters and account data.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteLoading ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
