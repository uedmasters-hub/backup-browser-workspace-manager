import type { Note } from "../../../types/notes";

export function noteToText(note: Note): string {
  const lines: string[] = [];
  const title = note.title.trim() || "Untitled note";
  lines.push(`# ${title}`, "");

  for (const block of note.blocks) {
    switch (block.type) {
      case "text":
        lines.push(block.text, "");
        break;
      case "checklist":
        for (const item of block.items) {
          lines.push(`- [${item.done ? "x" : " "}] ${item.text}`);
        }
        lines.push("");
        break;
      case "link":
        lines.push(`${block.label || block.url}: ${block.url}`, "");
        break;
      case "callout":
        lines.push(`> ${block.text}`, "");
        break;
      case "divider":
        lines.push("---", "");
        break;
      case "password":
        lines.push(`[\u{1F512} ${block.label || "Password"} \u2014 encrypted]`, "");
        break;
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
