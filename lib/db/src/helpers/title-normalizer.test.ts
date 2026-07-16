import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanGameTitle,
  normalizeGameTitle,
  prepareGameTitle,
  GameTitleError,
} from "./title-normalizer.ts";

describe("cleanGameTitle", () => {
  test("trims surrounding whitespace", () => {
    assert.equal(cleanGameTitle(" fc 26 "), "fc 26");
  });

  test("collapses repeated internal whitespace to one space", () => {
    assert.equal(cleanGameTitle("FC   26"), "FC 26");
    assert.equal(cleanGameTitle("FC\t\t26"), "FC 26");
    assert.equal(cleanGameTitle("FC\n\n26"), "FC 26");
  });

  test("preserves display casing", () => {
    assert.equal(cleanGameTitle("  FC 26 Ultimate Edition  "), "FC 26 Ultimate Edition");
  });

  test("collapses tabs and newlines", () => {
    assert.equal(cleanGameTitle("FC\t26\nUltimate"), "FC 26 Ultimate");
  });
});

describe("normalizeGameTitle", () => {
  test("trims surrounding whitespace", () => {
    assert.equal(normalizeGameTitle(" fc 26 "), "fc 26");
  });

  test("collapses repeated internal whitespace to one space", () => {
    assert.equal(normalizeGameTitle("FC   26"), "fc 26");
  });

  test("lowercases for case-insensitive duplicate detection", () => {
    assert.equal(normalizeGameTitle("FC 26"), "fc 26");
  });

  test("makes equivalent titles collide", () => {
    assert.equal(
      normalizeGameTitle("  FC   26  "),
      normalizeGameTitle("fc 26"),
    );
  });

  test("keeps distinct editions distinct", () => {
    assert.notEqual(
      normalizeGameTitle("FC 26"),
      normalizeGameTitle("FC 26 Ultimate Edition"),
    );
  });
});

describe("prepareGameTitle", () => {
  test("returns cleaned display and normalized title", () => {
    const result = prepareGameTitle("  FC   26  ");
    assert.equal(result.title, "FC 26");
    assert.equal(result.titleNormalized, "fc 26");
  });

  test("throws GameTitleError for whitespace-only input", () => {
    assert.throws(() => prepareGameTitle("   "), GameTitleError);
    assert.throws(() => prepareGameTitle("\t\n"), GameTitleError);
  });

  test("throws GameTitleError for title over 120 characters", () => {
    assert.throws(() => prepareGameTitle("a".repeat(121)), GameTitleError);
  });

  test("accepts a 120-character cleaned title", () => {
    const result = prepareGameTitle("a".repeat(120));
    assert.equal(result.title.length, 120);
  });
});
