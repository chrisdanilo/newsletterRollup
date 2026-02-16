"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [mode, setMode] = useState<"landing" | "signup" | "login">("landing");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup failed");

      // Generate forwarding address
      const random4 = Math.floor(1000 + Math.random() * 9000).toString();
      const forwardingAddress = `${formData.firstName.toLowerCase()}${random4}@${
        process.env.NEXT_PUBLIC_APP_DOMAIN || "usebrief.me"
      }`;

      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        forwarding_address: forwardingAddress,
      });

      if (profileError) throw profileError;

      toast.success("Account created! Check your email to verify.");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "signup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h2>
          <p className="text-gray-500 mb-6 text-sm">Get your personal newsletter forwarding address</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Chris"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Danilo"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min. 8 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <button onClick={() => setMode("login")} className="text-blue-600 font-medium hover:underline">
              Sign in
            </button>
          </p>
          <button onClick={() => setMode("landing")} className="mt-2 text-center w-full text-sm text-gray-400 hover:text-gray-600">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500 mb-6 text-sm">Sign in to your account</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            New here?{" "}
            <button onClick={() => setMode("signup")} className="text-blue-600 font-medium hover:underline">
              Create account
            </button>
          </p>
          <button onClick={() => setMode("landing")} className="mt-2 text-center w-full text-sm text-gray-400 hover:text-gray-600">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="text-xl font-bold text-blue-700">NewsletterRollup</div>
        <button
          onClick={() => setMode("login")}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          All your newsletters.<br />
          <span className="text-blue-600">One smart digest.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Stop drowning in newsletter emails. NewsletterRollup aggregates every newsletter you receive
          and delivers a single AI-summarized digest every night — so you never miss what matters.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => setMode("signup")}
            className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg transition-colors"
          >
            Get started for free
          </button>
          <Link
            href="/demo"
            className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors"
          >
            See a live demo →
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">No credit card required</p>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Create your account",
              desc: "Sign up in seconds and get a unique forwarding email address like chris1234@usebrief.me.",
            },
            {
              step: "2",
              title: "Forward your newsletters",
              desc: "Subscribe your newsletters to your forwarding address. We receive them throughout the day.",
            },
            {
              step: "3",
              title: "Get your nightly digest",
              desc: "Every evening, we send you an AI-summarized rollup of everything you received. Skim or deep-dive.",
            },
          ].map(item => (
            <div key={item.step} className="bg-white rounded-2xl p-8 shadow-md text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Built for busy executives</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "AI-powered summaries", desc: "Claude AI distills each newsletter into 1-3 actionable sentences." },
              { title: "Smart link extraction", desc: "Important links are pulled out so you can deep-dive when you want." },
              { title: "Block noisy senders", desc: "Easily remove sources that aren't adding value to your digest." },
              { title: "Digest archive", desc: "Browse past digests any time — never lose a summary." },
              { title: "Customizable delivery", desc: "Choose when your nightly digest arrives — 6 AM, 9 PM, midnight." },
              { title: "Vacation mode", desc: "Pause digests while you travel. Your newsletters are waiting when you return." },
            ].map(f => (
              <div key={f.title} className="flex gap-4 p-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to reclaim your inbox?</h2>
        <p className="text-gray-600 mb-8">Join thousands of executives who stay informed without the noise.</p>
        <button
          onClick={() => setMode("signup")}
          className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg transition-colors"
        >
          Start your free digest
        </button>
      </section>

      <footer className="text-center py-8 text-sm text-gray-400 border-t">
        © {new Date().getFullYear()} NewsletterRollup. All rights reserved.
      </footer>
    </div>
  );
}
