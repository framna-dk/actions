/**
 * Parses and validates the `inAppUpdatePriority` action input.
 */
export function parseInAppUpdatePriority(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 0;

  const priority = Number(raw.trim());

  if (!Number.isInteger(priority)) {
    throw new Error(`inAppUpdatePriority must be an integer between 0 and 5, got "${raw}"`);
  }
  if (priority < 0 || priority > 5) {
    throw new Error(`inAppUpdatePriority must be between 0 and 5, got ${priority}`);
  }
  return priority;
}
