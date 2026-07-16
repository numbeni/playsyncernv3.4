import { describe, it } from "node:test";
import assert from "node:assert";
import { buildCapacityDefinitions } from "./capacity-definitions.ts";

describe("buildCapacityDefinitions", () => {
  it("produces the PS5_ONLY template", () => {
    const defs = buildCapacityDefinitions("PS5_ONLY");
    assert.deepStrictEqual(defs, [
      { capacityKind: "Z2_PS5", instanceNo: 1, displayLabel: "Z2 PS5 #1" },
      { capacityKind: "Z2_PS5", instanceNo: 2, displayLabel: "Z2 PS5 #2" },
      {
        capacityKind: "Z3_SHARED_PS5_PS4",
        instanceNo: 0,
        displayLabel: "Z3 Shared PS5/PS4",
      },
    ]);
  });

  it("produces the PS4_AND_PS5 template", () => {
    const defs = buildCapacityDefinitions("PS4_AND_PS5");
    assert.deepStrictEqual(defs, [
      { capacityKind: "Z2_PS5", instanceNo: 1, displayLabel: "Z2 PS5 #1" },
      { capacityKind: "Z2_PS5", instanceNo: 2, displayLabel: "Z2 PS5 #2" },
      { capacityKind: "Z2_PS4", instanceNo: 0, displayLabel: "Z2 PS4" },
      {
        capacityKind: "Z3_SHARED_PS5_PS4",
        instanceNo: 0,
        displayLabel: "Z3 Shared PS5/PS4",
      },
    ]);
  });

  it("produces the PS4_ONLY template including the shared Z3 slot", () => {
    const defs = buildCapacityDefinitions("PS4_ONLY");
    assert.deepStrictEqual(defs, [
      { capacityKind: "Z2_PS4", instanceNo: 0, displayLabel: "Z2 PS4" },
      {
        capacityKind: "Z3_SHARED_PS5_PS4",
        instanceNo: 0,
        displayLabel: "Z3 Shared PS5/PS4",
      },
    ]);
  });
});
