import { useCallback, useRef, useState } from "react";

/**
 * One-click copy with a brief "Copied" confirmation. With `html`, formatting
 * comes along when pasting into apps that understand it (Docs, Mail, Notion…).
 */
export function useCopy(): [boolean, (text: string, html?: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback((text: string, html?: string) => {
    if (!text) {
      return;
    }
    if (html && typeof ClipboardItem !== "undefined") {
      void navigator.clipboard
        .write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ])
        .catch(() => navigator.clipboard.writeText(text));
    } else {
      void navigator.clipboard.writeText(text);
    }
    setCopied(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), 1200);
  }, []);

  return [copied, copy];
}
