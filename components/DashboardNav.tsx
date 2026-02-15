"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import toast from "react-hot-toast";

interface Props {
  profile: Profile | null;
}

export default function DashboardNav({ profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    toast.success("Signed out");
  }

  const navLinks = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/newsletters", label: "Newsletters" },
    { href: "/dashboard/archive", label: "Archive" },
    { href: "/dashboard/settings", label: "Settings" },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-bold text-blue-700">
              NewsletterRollup
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {profile && (
              <span className="text-sm text-gray-500 hidden sm:block">
                {profile.first_name} {profile.last_name}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
