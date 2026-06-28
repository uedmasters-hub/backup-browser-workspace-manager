export const FOCUS_SEARCH_COMMAND = "focus-search";

export const FOCUS_SEARCH_REQUEST_KEY =
  "focusSearchOnOpen";

export const FOCUS_SEARCH_MESSAGE = {
  type: FOCUS_SEARCH_COMMAND,
} as const;

export function isFocusSearchMessage(
  message: unknown
): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === FOCUS_SEARCH_COMMAND
  );
}
