import { useEffect, useState } from "react";
import { VenetianMask, X } from "lucide-react";

import { useWindowStore } from "../../stores/windowStore";
import {
  PRIVATE_LABEL,
  openExtensionSettings,
} from "../../browser/services/incognitoService";
import {
  getPrivateHintDismissed,
  setPrivateHintDismissed,
} from "../../browser/storage/preferencesRepository";

/**
 * Shown under the window cards while the browser is hiding private windows
 * from the extension. One click opens the setting; it can be dismissed for
 * good (the header menu keeps a way back in).
 */
export default function PrivateWindowsHint() {
  const allowed = useWindowStore((state) => state.incognitoAllowed);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    void getPrivateHintDismissed().then(setDismissed);
  }, []);

  if (allowed !== false || dismissed !== false) {
    return null;
  }

  return (
    <div className="mx-5 mt-3 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
        <VenetianMask size={16} strokeWidth={2.25} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800">
          {PRIVATE_LABEL.window} windows are hidden
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
          Turn on “{PRIVATE_LABEL.setting}” for this extension to see and
          manage them here.
        </p>
        <button
          type="button"
          onClick={() => void openExtensionSettings()}
          className="mt-2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
        >
          Open extension settings
        </button>
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={() => {
          setDismissed(true);
          void setPrivateHintDismissed();
        }}
        className="shrink-0 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
      >
        <X size={15} />
      </button>
    </div>
  );
}
