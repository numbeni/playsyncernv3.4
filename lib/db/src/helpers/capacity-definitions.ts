/**
 * buildCapacityDefinitions — returns the ordered list of capacity slots that
 * must be created when an account is registered.
 *
 * Commander decision 2 (final, must not be changed):
 *
 *   PS5_ONLY:
 *     Z2 PS5 #1   (capacityKind=Z2_PS5, instanceNo=1)
 *     Z2 PS5 #2   (capacityKind=Z2_PS5, instanceNo=2)
 *     Z3 PS5      (capacityKind=Z3_PS5, instanceNo=0)
 *
 *   PS4_AND_PS5:
 *     Z2 PS5 #1   (capacityKind=Z2_PS5, instanceNo=1)
 *     Z2 PS5 #2   (capacityKind=Z2_PS5, instanceNo=2)
 *     Z2 PS4      (capacityKind=Z2_PS4, instanceNo=0)
 *     Z3 PS5      (capacityKind=Z3_PS5, instanceNo=0)
 *
 *   PS4_ONLY:
 *     Z2 PS4      (capacityKind=Z2_PS4, instanceNo=0)
 *
 * instanceNo is always NOT NULL (Commander decision 3):
 *   - Z2_PS5 slots use 1-based instanceNo to distinguish #1 / #2.
 *   - Z2_PS4 and Z3_PS5 are singletons → instanceNo=0 (avoids nullable unique).
 *
 * Never store labels like "Z2 PS4 #1", "Z2 PS4 #0", or "Z3 PS5 #0".
 *
 * Commander decision 10: changing game platform must NOT regenerate existing
 * capacities. This function is only called when an account is first created.
 */

export type GamePlatform = "PS5_ONLY" | "PS4_AND_PS5" | "PS4_ONLY";
export type CapacityKind = "Z2_PS5" | "Z2_PS4" | "Z3_PS5";

export interface CapacityDefinition {
  capacityKind: CapacityKind;
  instanceNo: number;
  displayLabel: string;
}

export function buildCapacityDefinitions(
  platform: GamePlatform,
): CapacityDefinition[] {
  switch (platform) {
    case "PS5_ONLY":
      return [
        { capacityKind: "Z2_PS5", instanceNo: 1, displayLabel: "Z2 PS5 #1" },
        { capacityKind: "Z2_PS5", instanceNo: 2, displayLabel: "Z2 PS5 #2" },
        { capacityKind: "Z3_PS5", instanceNo: 0, displayLabel: "Z3 PS5" },
      ];

    case "PS4_AND_PS5":
      return [
        { capacityKind: "Z2_PS5", instanceNo: 1, displayLabel: "Z2 PS5 #1" },
        { capacityKind: "Z2_PS5", instanceNo: 2, displayLabel: "Z2 PS5 #2" },
        { capacityKind: "Z2_PS4", instanceNo: 0, displayLabel: "Z2 PS4" },
        { capacityKind: "Z3_PS5", instanceNo: 0, displayLabel: "Z3 PS5" },
      ];

    case "PS4_ONLY":
      return [
        { capacityKind: "Z2_PS4", instanceNo: 0, displayLabel: "Z2 PS4" },
      ];
  }
}
