import { useState } from "react";
import { Check } from "lucide-react";

import {
  BaseDialog,
  DialogFooter,
  DialogHeader,
} from ".";

import { WORKSPACE_COLORS } from "../../../constants/workspaceColors";

import { useUIStore } from "../../../stores/uiStore";
import { useWindowStore } from "../../../stores/windowStore";

export default function ColorPickerDialog() {
  const activeDialog = useUIStore(
    (state) => state.activeDialog
  );

  const activeWorkspaceId = useUIStore(
    (state) => state.activeWorkspaceId
  );

  const closeColorPicker = useUIStore(
    (state) => state.closeColorPicker
  );

  const windows = useWindowStore(
    (state) => state.windows
  );

  const updateWorkspaceColor =
    useWindowStore(
      (state) =>
        state.updateWorkspaceColor
    );

  const workspace = windows.find(
    (item) =>
      item.chromeWindowId ===
      activeWorkspaceId
  );

  const [selectedColor, setSelectedColor] =
    useState<string>(
      WORKSPACE_COLORS[0]
    );

  // Reset the selection to the workspace's color when the dialog
  // targets a different workspace (render-time sync, no effect).
  const [lastId, setLastId] =
    useState(activeWorkspaceId);

  if (activeWorkspaceId !== lastId) {
    setLastId(activeWorkspaceId);
    setSelectedColor(
      workspace?.color ?? WORKSPACE_COLORS[0]
    );
  }

  async function handleSave() {
    if (!activeWorkspaceId) {
      return;
    }

    await updateWorkspaceColor(
      activeWorkspaceId,
      selectedColor
    );

    closeColorPicker();
  }

  return (
    <BaseDialog
      open={
        activeDialog ===
        "color-picker"
      }
      onClose={
        closeColorPicker
      }
    >
      <DialogHeader
        title="Workspace Color"
        subtitle="Choose a color for this workspace"
        onClose={
          closeColorPicker
        }
      />

      <div className="grid grid-cols-4 gap-4 px-6 py-5">
        {WORKSPACE_COLORS.map(
          (color) => {
            const active =
              color ===
              selectedColor;

            return (
              <button
                key={color}
                type="button"
                onClick={() =>
                  setSelectedColor(
                    color
                  )
                }
                className={[
                  "relative h-10 w-10 rounded-full transition-all duration-200",

                  active
                    ? "scale-110 ring-2 ring-neutral-900 ring-offset-2"
                    : "hover:scale-105",
                ].join(" ")}
                style={{
                  backgroundColor:
                    color,
                }}
              >
                {active && (
                  <Check
                    size={16}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
                  />
                )}
              </button>
            );
          }
        )}
      </div>

      <DialogFooter
        left={
          <span>
            {
              WORKSPACE_COLORS.length
            }{" "}
            Colors
          </span>
        }
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={
                closeColorPicker
              }
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleSave
              }
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              Save
            </button>
          </div>
        }
      />
    </BaseDialog>
  );
}