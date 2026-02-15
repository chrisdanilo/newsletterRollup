"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

interface Props {
  rawContent: string;
}

export default function NewsletterContent({ rawContent }: Props) {
  const isHtml = rawContent.includes("<") && rawContent.includes(">");

  const sanitizedHtml = useMemo(() => {
    if (!isHtml) return null;
    return DOMPurify.sanitize(rawContent, {
      ALLOWED_TAGS: [
        "p", "br", "div", "span", "a", "h1", "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li", "blockquote", "strong", "em", "b", "i", "u",
        "img", "table", "thead", "tbody", "tr", "th", "td", "hr",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "class", "width", "height"],
      FORCE_BODY: true,
    });
  }, [rawContent, isHtml]);

  if (isHtml && sanitizedHtml) {
    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  return (
    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
      {rawContent}
    </pre>
  );
}
