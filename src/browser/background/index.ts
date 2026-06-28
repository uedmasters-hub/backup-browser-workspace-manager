import {
  FOCUS_SEARCH_COMMAND,
  FOCUS_SEARCH_MESSAGE,
  FOCUS_SEARCH_REQUEST_KEY,
} from "../commands";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Browser Workspace Manager installed");
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== FOCUS_SEARCH_COMMAND) {
    return;
  }

  await chrome.storage.session.set({
    [FOCUS_SEARCH_REQUEST_KEY]: true,
  });

  try {
    await chrome.action.openPopup();
  } catch (error) {
    console.warn(
      "[focus-search] could not open the popup",
      error
    );
  }

  try {
    await chrome.runtime.sendMessage(
      FOCUS_SEARCH_MESSAGE
    );
  } catch {
    // The session flag focuses search when the popup finishes opening.
  }
});
