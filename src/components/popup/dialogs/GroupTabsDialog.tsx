import { FolderPlus } from "lucide-react";

import {
  BaseDialog,
  DialogHeader,
  DialogItem,
  DialogList,
} from ".";

import { useTabStore } from "../../../stores/tabStore";
import { useUIStore } from "../../../stores/uiStore";
import { splitGroupTitle } from "../../../browser/services/tabGroupService";
import {
  TAB_GROUP_COLOR_HEX,
} from "../tab-groups/tabGroupColors";

export default function GroupTabsDialog() {
  const activeDialog = useUIStore(
    (state) => state.activeDialog
  );
  const closeDialog = useUIStore(
    (state) => state.closeDialog
  );
  const groups = useTabStore((state) => state.groups);
  const groupSelectedTabs = useTabStore(
    (state) => state.groupSelectedTabs
  );

  async function handleGroup(groupId?: number) {
    await groupSelectedTabs(groupId);
    closeDialog();
  }

  return (
    <BaseDialog
      open={activeDialog === "group-tabs"}
      onClose={closeDialog}
    >
      <DialogHeader
        title="Group tabs"
        subtitle="Create a group or add to an existing one"
        onClose={closeDialog}
      />

      <DialogList isEmpty={false}>
        <DialogItem
          title="New group"
          subtitle="Create a native Chrome tab group"
          leading={<FolderPlus size={19} />}
          onClick={() => handleGroup()}
        />

        {groups
          .slice()
          .sort((a, b) => a.firstIndex - b.firstIndex)
          .map((group) => {
            const { emoji, name } = splitGroupTitle(
              group.title
            );

            return (
              <DialogItem
                key={group.id}
                title={`${emoji ? `${emoji} ` : ""}${name}`}
                subtitle={`${group.tabCount} tabs`}
                leading={
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor:
                        TAB_GROUP_COLOR_HEX[group.color],
                    }}
                  />
                }
                onClick={() => handleGroup(group.id)}
              />
            );
          })}
      </DialogList>
    </BaseDialog>
  );
}
