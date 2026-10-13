import { useState } from "react";

/** Letter tile used when a site has no usable icon. */
function Monogram({ name }: { name: string }) {
  const letter = (name.replace(/^www\./, "").match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase();
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold text-white"
      style={{ backgroundColor: `hsl(${hue} 55% 52%)` }}
    >
      {letter}
    </span>
  );
}

/**
 * The app's icon: the favicon seen on an open tab, else the site's own
 * /favicon.ico, else a letter tile.
 */
export default function AppIcon({
  name,
  url,
  icon,
}: {
  name: string;
  url: string;
  icon?: string;
}) {
  const candidates = [icon, `${url}favicon.ico`].filter(Boolean) as string[];
  const [failed, setFailed] = useState<string[]>([]);
  const src = candidates.find((c) => !failed.includes(c));

  if (!src) return <Monogram name={name} />;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed((f) => [...f, src])}
      className="h-7 w-7 rounded-md object-contain"
    />
  );
}
