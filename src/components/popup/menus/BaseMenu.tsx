import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";

import Portal from "./Portal";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function BaseMenu({
  open,
  onClose,
  children,
}: Props) {
  const ref =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(
      event: MouseEvent
    ) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node
        )
      ) {
        onClose();
      }
    }

    function handleKey(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener(
      "mousedown",
      handleClick
    );

    document.addEventListener(
      "keydown",
      handleKey
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClick
      );

      document.removeEventListener(
        "keydown",
        handleKey
      );
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div
        ref={ref}
        className="
          absolute
          right-4
          top-14
          z-[9999]
          w-56
          overflow-hidden
          rounded-2xl
          border
          border-neutral-200
          bg-white
          shadow-2xl
        "
      >
        {children}
      </div>
    </Portal>
  );
}