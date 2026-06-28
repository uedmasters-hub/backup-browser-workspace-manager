import {
  useEffect,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";

type BaseDialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function BaseDialog({
  open,
  onClose,
  children,
}: BaseDialogProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/30 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) =>
          e.stopPropagation()
        }
        className="w-full max-w-[480px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}