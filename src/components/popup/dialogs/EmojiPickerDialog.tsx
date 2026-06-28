import { useState } from "react";

import BaseDialog from "./BaseDialog";
import DialogFooter from "./DialogFooter";
import DialogHeader from "./DialogHeader";

import { WORKSPACE_EMOJIS } from "../../../constants/workspaceEmojis";

import { useUIStore } from "../../../stores/uiStore";
import { useWindowStore } from "../../../stores/windowStore";

export default function EmojiPickerDialog() {
  const activeDialog = useUIStore(
    (state) => state.activeDialog
  );

  const activeWorkspaceId = useUIStore(
    (state) => state.activeWorkspaceId
  );

  const closeEmojiPicker = useUIStore(
    (state) => state.closeEmojiPicker
  );

  const windows = useWindowStore(
    (state) => state.windows
  );

  const updateWorkspaceEmoji =
    useWindowStore(
      (state) =>
        state.updateWorkspaceEmoji
    );

  const workspace = windows.find(
    (item) =>
      item.chromeWindowId ===
      activeWorkspaceId
  );

  const [selectedEmoji, setSelectedEmoji] =
    useState<string>(
      WORKSPACE_EMOJIS[0]
    );

  // Reset the selection to the workspace's emoji when the dialog
  // targets a different workspace (render-time sync, no effect).
  const [lastId, setLastId] =
    useState(activeWorkspaceId);

  if (activeWorkspaceId !== lastId) {
    setLastId(activeWorkspaceId);
    setSelectedEmoji(
      workspace?.emoji ?? WORKSPACE_EMOJIS[0]
    );
  }

  async function handleSave() {
    if (!activeWorkspaceId) {
      return;
    }

    await updateWorkspaceEmoji(
      activeWorkspaceId,
      selectedEmoji
    );

    closeEmojiPicker();
  }

  return (
    <BaseDialog
      open={
        activeDialog ===
        "emoji-picker"
      }
      onClose={
        closeEmojiPicker
      }
    >
      <DialogHeader
        title="Workspace Emoji"
        subtitle="Choose an emoji"
        onClose={
          closeEmojiPicker
        }
      />

      <div className="grid grid-cols-4 gap-3 px-6 py-5">
        {WORKSPACE_EMOJIS.map(
          (emoji) => {
            const active =
              emoji ===
              selectedEmoji;

            return (
              <button
                key={emoji}
                type="button"
                onClick={() =>
                  setSelectedEmoji(
                    emoji
                  )
                }
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all",

                  active
                    ? "bg-neutral-900 text-white"
                    : "hover:bg-neutral-100",
                ].join(" ")}
              >
                {emoji}
              </button>
            );
          }
        )}
      </div>

      <DialogFooter
        left={
          <span>
            {
              WORKSPACE_EMOJIS.length
            }{" "}
            Emojis
          </span>
        }
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={
                closeEmojiPicker
              }
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleSave
              }
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Save
            </button>
          </div>
        }
      />
    </BaseDialog>
  );
}