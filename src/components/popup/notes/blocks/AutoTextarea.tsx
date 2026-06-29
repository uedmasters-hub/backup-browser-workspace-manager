import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

/** Textarea that grows with its content — no inner scrollbar. */
export default function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus = false,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus();
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "w-full resize-none bg-transparent outline-none placeholder:text-neutral-300",
        className,
      ].join(" ")}
    />
  );
}
