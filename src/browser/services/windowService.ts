export async function getAllWindows() {
  return chrome.windows.getAll({
    populate: true,
  });
}

export async function getCurrentWindow() {
  return chrome.windows.getCurrent({
    populate: true,
  });
}

export async function focusWindow(
  windowId: number
) {
  return chrome.windows.update(windowId, {
    focused: true,
  });
}