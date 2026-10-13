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
 * The app's icon, sharpest source first:
 *   1. the page's own best icon (SVG / Apple touch icon / largest size),
 *   2. the site's /apple-touch-icon.png (180px on most sites),
 *   3. the favicon seen on an open tab,
 *   4. the site's /favicon.ico,
 *   5. a letter tile.
 * Fades in once loaded (no broken-image flash). Tiny bitmaps (<24px) are
 * drawn smaller instead of being stretched into a blur.
 */
export default function AppIcon({
  name,
  url,
  icon,
  hiRes,
}: {
  name: string;
  url: string;
  icon?: string;
  hiRes?: string;
}) {
  const candidates = [
    hiRes || undefined,
    `${url}apple-touch-icon.png`,
    icon,
    `${url}favicon.ico`,
  ].filter((c, i, all): c is string => Boolean(c) && all.indexOf(c) === i);

  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<{ src: string; small: boolean } | null>(null);
  const src = candidates.find((c) => !failed.includes(c));

  if (!src) return <Monogram name={name} />;

  const ready = loaded?.src === src;
  const size = ready && loaded.small ? "h-5 w-5" : "h-7 w-7";

  return (
    <img
      key={src}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        const img = e.currentTarget;
        // A decodable "image" of 0px (e.g. an HTML 404 page) counts as failed.
        if (!img.naturalWidth) {
          setFailed((f) => [...f, src]);
          return;
        }
        setLoaded({ src, small: img.naturalWidth < 24 && !src.endsWith(".svg") });
      }}
      onError={() => setFailed((f) => [...f, src])}
      className={[
        size,
        "rounded-md object-contain transition-opacity duration-150",
        ready ? "opacity-100" : "opacity-0",
      ].join(" ")}
    />
  );
}
