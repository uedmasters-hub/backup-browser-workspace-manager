import { useState } from "react";

import type { WorkspaceWindow } from "../../types/window";

import {
  ArchivedHeader,
  ArchivedWorkspaceCard,
} from "./archived";

type Props = {
  windows: WorkspaceWindow[];

  onRestore: (
    chromeWindowId: number
  ) => void;

  onDelete: (
    chromeWindowId: number
  ) => void;
};

export default function ArchivedSection({
  windows,
  onRestore,
  onDelete,
}: Props) {
  const [expanded, setExpanded] =
    useState(false);

  if (windows.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 px-5">
      <ArchivedHeader
        count={windows.length}
        expanded={expanded}
        onToggle={() =>
          setExpanded(
            (value) => !value
          )
        }
      />

      {expanded && (
        <div className="mt-3 space-y-3">
          {windows.map(
            (window) => (
              <ArchivedWorkspaceCard
                key={window.id}
                window={window}
                onRestore={() =>
                  onRestore(
                    window.chromeWindowId!
                  )
                }
                onDelete={() =>
                  onDelete(
                    window.chromeWindowId!
                  )
                }
              />
            )
          )}
        </div>
      )}
    </section>
  );
}