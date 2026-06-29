import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { Note } from "../../types/notes";

export async function getNotes(): Promise<Note[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.NOTES);
  const data = result[STORAGE_KEYS.NOTES];
  return Array.isArray(data) ? (data as Note[]) : [];
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
}
