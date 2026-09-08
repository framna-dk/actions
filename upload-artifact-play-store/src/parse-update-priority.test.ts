import { parseInAppUpdatePriority } from "./parse-update-priority.js";

describe("parseInAppUpdatePriority", () => {
  // Explicit tuple type: without it the table infers as (string | number | undefined)[][]
  // and `raw` is not assignable to the string | undefined parameter.
  it.each<[string | undefined, number]>([
    [undefined, 0],
    ["", 0],
    ["   ", 0],
    ["0", 0],
    ["3", 3],
    ["5", 5],
    [" 4 ", 4],
  ])("parses %p as %p", (raw, expected) => {
    expect(parseInAppUpdatePriority(raw)).toBe(expected);
  });

  it.each(["-1", "6", "1.5", "abc"])("throws for invalid priority %p", (raw) => {
    expect(() => parseInAppUpdatePriority(raw)).toThrow(/inAppUpdatePriority/);
  });
});
