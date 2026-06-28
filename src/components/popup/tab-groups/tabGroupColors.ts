import type { TabGroupColor } from "../../../types/tab";

export const TAB_GROUP_COLOR_HEX: Record<
  TabGroupColor,
  string
> = {
  grey: "#9AA0A6",
  blue: "#4F8DF7",
  red: "#E85D5D",
  yellow: "#E6B94E",
  green: "#49A66F",
  pink: "#D96CA8",
  purple: "#8A6BE8",
  cyan: "#36AFC2",
  orange: "#E58A45",
};

export const TAB_GROUP_COLORS = Object.entries(
  TAB_GROUP_COLOR_HEX
) as Array<[TabGroupColor, string]>;
