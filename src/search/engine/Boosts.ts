/**
 * Recency boost: recently touched records get a small additive bump so that,
 * among equally relevant text matches, the freshest one wins. Decays linearly
 * to zero over two weeks.
 */
export function recencyBoost(
  timestamp?: number,
  maxBoost = 5,
  windowDays = 14
): number {
  if (!timestamp) {
    return 0;
  }

  const ageDays = (Date.now() - timestamp) / 86_400_000;

  if (ageDays <= 0) {
    return maxBoost;
  }

  if (ageDays >= windowDays) {
    return 0;
  }

  return maxBoost * (1 - ageDays / windowDays);
}
