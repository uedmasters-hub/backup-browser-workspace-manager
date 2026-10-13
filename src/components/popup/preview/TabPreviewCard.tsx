import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Moon, Pin, Volume2, VolumeX, VenetianMask } from "lucide-react";

import Portal from "../menus/Portal";
import { usePreviewStore } from "../../../stores/previewStore";
import { useTabStore } from "../../../stores/tabStore";
import { TAB_GROUP_COLOR_HEX } from "../tab-groups/tabGroupColors";
import { formatTabAge } from "../tabFormat";
import {
  getPageMeta,
  getTabSnapshot,
} from "../../../browser/services/tabPreviewService";
import type { PageMeta, TabSnapshot } from "../../../browser/services/tabPreviewService";

const GAP = 6;
const EDGE = 8;
const IMAGE_HEIGHT = 168;

type Loaded = {
  key: string;
  snapshot: TabSnapshot | null;
  meta: PageMeta | null;
};

function splitUrl(url: string): { host: string; rest: string } {
  try {
    const u = new URL(url);
    return {
      host: u.hostname.replace(/^www\./, ""),
      rest: `${u.pathname === "/" ? "" : u.pathname}${u.search}`,
    };
  } catch {
    return { host: "", rest: url };
  }
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "dark" | "rose";
}) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-600",
    dark: "bg-neutral-900 text-white",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

type Visual =
  | { kind: "loading" }
  | { kind: "snapshot"; snapshot: TabSnapshot }
  | { kind: "image"; src: string }
  | { kind: "none" };

function Picture({ visual, onImageError }: { visual: Visual; onImageError: () => void }) {
  if (visual.kind === "loading") {
    return <div className="bwm-skeleton h-full w-full" />;
  }
  if (visual.kind === "snapshot") {
    const age = formatTabAge(visual.snapshot.capturedAt);
    return (
      <>
        <img
          src={visual.snapshot.dataUrl}
          alt=""
          className="h-full w-full object-cover object-top"
        />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {age === "Now" ? "Snapshot · just now" : `Snapshot · ${age} ago`}
        </span>
      </>
    );
  }
  if (visual.kind === "image") {
    return (
      <img
        src={visual.src}
        alt=""
        referrerPolicy="no-referrer"
        onError={onImageError}
        className="h-full w-full object-cover"
      />
    );
  }
  return null;
}

/**
 * Floating "smart preview" for the hovered tab row: page snapshot (or the
 * page's own share image), title, description, address and status.
 * Purely visual — pointer events pass through, so the row's open / close
 * controls behave exactly as before.
 */
export default function TabPreviewCard() {
  const tabId = usePreviewStore((s) => s.tabId);
  const anchor = usePreviewStore((s) => s.anchor);
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === tabId));
  const groups = useTabStore((s) => s.groups);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  // Hold the card back until its content is in (or 300 ms pass), so it
  // doesn't open with a skeleton and then jump in size.
  const [waitedKey, setWaitedKey] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{
    top: number;
    below: boolean;
  } | null>(null);

  const key = tab ? `${tab.id}|${tab.url}` : "";

  useEffect(() => {
    if (!key) return;
    const timer = window.setTimeout(() => setWaitedKey(key), 300);
    return () => window.clearTimeout(timer);
  }, [key]);

  useEffect(() => {
    if (!tab) return;
    let cancelled = false;
    void Promise.all([
      getTabSnapshot(tab.id, tab.url),
      getPageMeta(tab.id, tab.url, tab.discarded),
    ]).then(([snapshot, meta]) => {
      if (!cancelled) setLoaded({ key, snapshot, meta });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Prefer below the row; flip above when there isn't room; clamp otherwise.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !anchor) {
      setPlacement(null);
      return;
    }
    const h = el.offsetHeight;
    const vh = window.innerHeight;
    if (anchor.bottom + GAP + h <= vh - EDGE) {
      setPlacement({ top: anchor.bottom + GAP, below: true });
    } else if (anchor.top - GAP - h >= EDGE) {
      setPlacement({ top: anchor.top - GAP - h, below: false });
    } else {
      setPlacement({
        top: Math.max(EDGE, Math.min(vh - h - EDGE, anchor.bottom + GAP)),
        below: true,
      });
    }
  }, [anchor, key, loaded, failedImage]);

  if (!tab || !anchor) return null;

  const current = loaded?.key === key ? loaded : null;
  const ready = current !== null || waitedKey === key;

  const ogImage = current?.meta?.image;
  const visual: Visual = !current
    ? { kind: "loading" }
    : current.snapshot
      ? { kind: "snapshot", snapshot: current.snapshot }
      : ogImage && failedImage !== ogImage
        ? { kind: "image", src: ogImage }
        : { kind: "none" };
  const { host, rest } = splitUrl(tab.url);
  const group = groups.find((g) => g.id === tab.groupId);
  const description = current?.meta?.description;
  const siteName = current?.meta?.siteName;
  const age = formatTabAge(tab.lastAccessed);

  return (
    <Portal>
      <div
        ref={cardRef}
        role="tooltip"
        data-ready={ready && placement ? "true" : "false"}
        aria-live="polite"
        style={{
          position: "fixed",
          top: placement?.top ?? anchor.bottom + GAP,
          left: anchor.left,
          width: anchor.width,
          zIndex: 9998,
          visibility: placement && ready ? "visible" : "hidden",
          transformOrigin: placement?.below === false ? "bottom center" : "top center",
        }}
        className="pointer-events-none overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_18px_48px_-12px_rgba(15,23,42,0.28)]"
      >
        {visual.kind !== "none" && (
          <div
            className="relative w-full overflow-hidden border-b border-neutral-100 bg-neutral-50"
            style={{ height: IMAGE_HEIGHT }}
          >
            <Picture
              visual={visual}
              onImageError={() => setFailedImage(ogImage ?? null)}
            />
          </div>
        )}

        <div className="space-y-1.5 px-3.5 pb-3 pt-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            {tab.favicon && (
              <img src={tab.favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />
            )}
            <span className="truncate">
              {siteName && siteName.toLowerCase() !== host ? `${siteName} · ${host}` : host || "Local page"}
            </span>
            <span className="ml-auto shrink-0">
              {age === "—" ? "" : age === "Now" ? "Viewed just now" : `Viewed ${age} ago`}
            </span>
          </div>

          <p className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">
            {tab.title || tab.url}
          </p>

          {visual.kind === "none" && tab.discarded && !description && (
            <p className="text-xs text-neutral-400">
              Asleep — open it once to get a snapshot.
            </p>
          )}

          {description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">
              {description}
            </p>
          ) : !current && !tab.discarded ? (
            <div className="space-y-1.5 py-0.5">
              <div className="bwm-skeleton h-2.5 w-11/12 rounded-full" />
              <div className="bwm-skeleton h-2.5 w-7/12 rounded-full" />
            </div>
          ) : null}

          {rest && (
            <p className="truncate font-mono text-[10.5px] text-neutral-400">
              {host}
              <span className="text-neutral-300">{rest}</span>
            </p>
          )}

          {(group || tab.pinned || tab.audible || tab.muted || tab.discarded || tab.incognito) && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {group && (
                <Chip>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: TAB_GROUP_COLOR_HEX[group.color] }}
                  />
                  {group.title || "Group"}
                </Chip>
              )}
              {tab.pinned && (
                <Chip>
                  <Pin size={11} /> Pinned
                </Chip>
              )}
              {tab.muted ? (
                <Chip tone="rose">
                  <VolumeX size={11} /> Muted
                </Chip>
              ) : tab.audible ? (
                <Chip tone="rose">
                  <Volume2 size={11} /> Playing
                </Chip>
              ) : null}
              {tab.discarded && (
                <Chip>
                  <Moon size={11} /> Asleep
                </Chip>
              )}
              {tab.incognito && (
                <Chip tone="dark">
                  <VenetianMask size={11} /> Private
                </Chip>
              )}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
