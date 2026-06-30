export function formatTabAge(lastAccessed?: number): string {
  if (!lastAccessed) {
    return "—";
  }

  const elapsed = Math.max(0, Date.now() - lastAccessed);
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  return `${Math.floor(months / 12)}y`;
}
