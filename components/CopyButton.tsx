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

      // Announce to screen readers via the global live region in layout.tsx
      const announcer = document.getElementById("sr-announcer");
      if (announcer) announcer.textContent = "Copied to clipboard";

      setTimeout(() => {
        setCopied(false);
        if (announcer) announcer.textContent = "";
      }, 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied" : `${label}: ${text}`}
      className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
