"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface Props {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
