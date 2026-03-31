/**
 * Spaced repetition logic.
 *
 * - First review: interval = 1 day
 * - Correct: interval * 2
 * - Incorrect: interval / 2 (minimum 1 day)
 */

const MIN_INTERVAL_DAYS = 1;

export function computeNextInterval(
  currentInterval: number,
  correct: boolean
): number {
  if (correct) {
    return currentInterval * 2;
  }
  return Math.max(currentInterval / 2, MIN_INTERVAL_DAYS);
}

export function computeDueDate(fromDate: Date, intervalDays: number): Date {
  const due = new Date(fromDate);
  due.setDate(due.getDate() + Math.round(intervalDays));
  return due;
}
