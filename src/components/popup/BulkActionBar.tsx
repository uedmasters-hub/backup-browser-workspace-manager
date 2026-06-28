import { useState } from "react";
import {
  Copy,
  FolderPlus,
  Move,
  Pin,
  Trash2,
  Ungroup,
} from "lucide-react";

import { useTabStore } from "../../stores/tabStore";
import { useUIStore } from "../../stores/uiStore";

export default function BulkActionBar() {
  const selectionMode = useTabStore(
    (state) => state.selectionMode
  );

  const selectedTabs = useTabStore(
    (state) => state.selectedTabs
  );

  const tabs = useTabStore(
    (state) => state.tabs
  );

  const pinSelectedTabs = useTabStore(
    (state) => state.pinSelectedTabs
  );

  const duplicateSelectedTabs = useTabStore(
    (state) => state.duplicateSelectedTabs
  );

  const closeSelectedTabs = useTabStore(
    (state) => state.closeSelectedTabs
  );

  const ungroupSelectedTabs = useTabStore(
    (state) => state.ungroupSelectedTabs
  );

  const openDialog = useUIStore(
    (state) => state.openDialog
  );

  const [loading, setLoading] =
    useState(false);

  const allPinned =
    selectedTabs.length > 0 &&
    selectedTabs.every((id) =>
      tabs.find((tab) => tab.id === id)
        ?.pinned
    );
  const hasGroupedTabs = selectedTabs.some(
    (id) =>
      tabs.find((tab) => tab.id === id)?.groupId !== -1
  );

  if (
    !selectionMode ||
    selectedTabs.length === 0
  ) {
    return null;
  }

  async function handlePin() {
    try {
      setLoading(true);
      await pinSelectedTabs();
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate() {
    try {
      setLoading(true);
      await duplicateSelectedTabs();
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    try {
      setLoading(true);
      await closeSelectedTabs();
    } finally {
      setLoading(false);
    }
  }

  async function handleUngroup() {
    try {
      setLoading(true);
      await ungroupSelectedTabs();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xl backdrop-blur">
        <div className="border-b border-neutral-100 px-4 py-2 text-center text-xs font-medium text-neutral-500">
          {selectedTabs.length} Selected
        </div>

        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
          <ActionButton
            icon={<Move size={18} />}
            label="Move"
            disabled={loading}
            onClick={() =>
              openDialog("move-tabs")
            }
          />

          <ActionButton
            icon={<FolderPlus size={18} />}
            label="Group"
            disabled={loading}
            onClick={() => openDialog("group-tabs")}
          />

          {hasGroupedTabs && (
            <ActionButton
              icon={<Ungroup size={18} />}
              label="Ungroup"
              disabled={loading}
              onClick={handleUngroup}
            />
          )}

          <ActionButton
            icon={
              <Pin
                size={18}
                fill={
                  allPinned
                    ? "currentColor"
                    : "none"
                }
              />
            }
            label={
              loading
                ? "Working..."
                : allPinned
                ? "Unpin"
                : "Pin"
            }
            disabled={loading}
            onClick={handlePin}
          />

          <ActionButton
            icon={<Copy size={18} />}
            label={
              loading
                ? "Duplicating..."
                : "Duplicate"
            }
            disabled={loading}
            onClick={handleDuplicate}
          />

          <ActionButton
            icon={<Trash2 size={18} />}
            label={
              loading
                ? "Closing..."
                : "Close"
            }
            danger
            disabled={loading}
            onClick={handleClose}
          />
        </div>
      </div>
    </div>
  );
}

type ActionButtonProps = {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
};

function ActionButton({
  icon,
  label,
  danger = false,
  disabled = false,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "",
        danger
          ? "text-red-500 hover:bg-red-50"
          : "text-neutral-700 hover:bg-neutral-100",
      ].join(" ")}
    >
      {icon}

      <span className="text-[11px] font-medium">
        {label}
      </span>
    </button>
  );
}
