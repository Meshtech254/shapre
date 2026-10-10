/** All inference modes consume the same monthly streaming-minute allowance. */
export function sessionBudget(allowanceMinutes: number, usedMinutes: number) {
  const remainingSeconds = Math.floor((allowanceMinutes - usedMinutes) * 60);
  if (remainingSeconds < 1) throw new Error("Monthly streaming limit reached.");
  return Math.min(8 * 60 * 60, remainingSeconds);
}
