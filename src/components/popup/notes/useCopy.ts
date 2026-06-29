import { useCallback, useRef, useState } from "react";

/** One-click copy with a brief "Copied" confirmation. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback((text: string) => {
    if (!text) {
      return;
    }
    void navigator.clipboard.writeText(text);
    setCopied(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), 1200);
  }, []);

  return [copied, copy];
}
