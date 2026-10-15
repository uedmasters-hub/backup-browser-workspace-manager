import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { Note, NoteProject } from "../../types/notes";

export async function getNotes(): Promise<Note[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.NOTES);
  const data = result[STORAGE_KEYS.NOTES];
  return Array.isArray(data) ? (data as Note[]) : [];
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
}

export async function getNoteProjects(): Promise<NoteProject[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.NOTE_PROJECTS);
  const data = result[STORAGE_KEYS.NOTE_PROJECTS];
  return Array.isArray(data) ? (data as NoteProject[]) : [];
}

export async function saveNoteProjects(projects: NoteProject[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTE_PROJECTS]: projects });
}
