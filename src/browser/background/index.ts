import {
  FOCUS_SEARCH_COMMAND,
  FOCUS_SEARCH_MESSAGE,
  FOCUS_SEARCH_REQUEST_KEY,
  OPEN_NOTES_COMMAND,
  OPEN_NOTES_MESSAGE,
  OPEN_NOTES_REQUEST_KEY,
} from "../commands";

const COMMAND_CONFIG = {
  [FOCUS_SEARCH_COMMAND]: {
    requestKey: FOCUS_SEARCH_REQUEST_KEY,
    message: FOCUS_SEARCH_MESSAGE,
  },
  [OPEN_NOTES_COMMAND]: {
    requestKey: OPEN_NOTES_REQUEST_KEY,
    message: OPEN_NOTES_MESSAGE,
  },
} as const;

chrome.runtime.onInstalled.addListener(() => {
  console.log("Browser Workspace Manager installed");
});

chrome.commands.onCommand.addListener(async (command) => {
  const config =
    COMMAND_CONFIG[command as keyof typeof COMMAND_CONFIG];

  if (!config) {
    return;
  }

  // Flag the intent so the popup acts on it the moment it mounts.
  await chrome.storage.session.set({
    [config.requestKey]: true,
  });

  try {
    await chrome.action.openPopup();
  } catch (error) {
    console.warn(`[${command}] could not open the popup`, error);
  }

  try {
    await chrome.runtime.sendMessage(config.message);
  } catch {
    // The session flag is consumed when the popup finishes opening.
  }
});
