import { useMediaStore } from "../../stores/mediaStore";

export default function MediaSeek({
  tabId,
  currentTime,
  duration,
}: {
  tabId: number;
  currentTime: number;
  duration: number;
}) {
  const seek = useMediaStore((state) => state.seek);
  const previewSeek = useMediaStore((state) => state.previewSeek);
  const setDragging = useMediaStore((state) => state.setDragging);

  const pct =
    duration > 0
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;

  return (
    <input
      type="range"
      min={0}
      max={duration}
      step={0.1}
      value={Math.min(currentTime, duration)}
      aria-label="Seek"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        setDragging(tabId, true);
      }}
      onChange={(event) => previewSeek(tabId, Number(event.target.value))}
      onPointerUp={(event) => {
        const value = Number((event.target as HTMLInputElement).value);
        setDragging(tabId, false);
        void seek(tabId, value);
      }}
      onKeyUp={(event) => {
        const value = Number((event.target as HTMLInputElement).value);
        void seek(tabId, value);
      }}
      className="bwm-seek w-full"
      style={{ ["--pct" as string]: `${pct}%` }}
    />
  );
}
