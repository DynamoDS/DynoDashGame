import { describe, it, expect } from "vitest";
import {
  appearanceFromIndices,
  BODY_PALETTE,
  SKIN_PALETTE,
  LEGS_PALETTE,
  DEFAULT_CHARACTER,
} from "./CharacterAppearance";

describe("appearanceFromIndices", () => {
  it("returns the correct colour for index 0 on each slot", () => {
    const a = appearanceFromIndices(0, 0, 0);
    expect(a.bodyColor).toBe(BODY_PALETTE[0]);
    expect(a.skinColor).toBe(SKIN_PALETTE[0]);
    expect(a.legsColor).toBe(LEGS_PALETTE[0]);
  });

  it("wraps body index at palette length", () => {
    const len = BODY_PALETTE.length;
    expect(appearanceFromIndices(len, 0, 0).bodyColor).toBe(BODY_PALETTE[0]);
    expect(appearanceFromIndices(len + 1, 0, 0).bodyColor).toBe(BODY_PALETTE[1]);
  });

  it("wraps negative body index (palette is cyclic)", () => {
    const len = BODY_PALETTE.length;
    expect(appearanceFromIndices(-1, 0, 0).bodyColor).toBe(BODY_PALETTE[len - 1]);
    expect(appearanceFromIndices(-len, 0, 0).bodyColor).toBe(BODY_PALETTE[0]);
  });

  it("wraps skin index at palette length", () => {
    const len = SKIN_PALETTE.length;
    expect(appearanceFromIndices(0, len, 0).skinColor).toBe(SKIN_PALETTE[0]);
    expect(appearanceFromIndices(0, -1, 0).skinColor).toBe(SKIN_PALETTE[len - 1]);
  });

  it("wraps legs index at palette length", () => {
    const len = LEGS_PALETTE.length;
    expect(appearanceFromIndices(0, 0, len).legsColor).toBe(LEGS_PALETTE[0]);
    expect(appearanceFromIndices(0, 0, -1).legsColor).toBe(LEGS_PALETTE[len - 1]);
  });

  it("each slot is independent", () => {
    const a = appearanceFromIndices(1, 2, 3);
    expect(a.bodyColor).toBe(BODY_PALETTE[1]);
    expect(a.skinColor).toBe(SKIN_PALETTE[2]);
    expect(a.legsColor).toBe(LEGS_PALETTE[3]);
  });

  it("DEFAULT_CHARACTER matches index 0 for body and legs (their palettes start there)", () => {
    const fromZero = appearanceFromIndices(0, 0, 0);
    expect(fromZero.bodyColor).toBe(DEFAULT_CHARACTER.bodyColor);
    expect(fromZero.skinColor).toBe(DEFAULT_CHARACTER.skinColor);
    expect(fromZero.legsColor).toBe(DEFAULT_CHARACTER.legsColor);
  });
});

describe("palette invariants", () => {
  it("all palettes have the same length (8 entries each)", () => {
    expect(BODY_PALETTE.length).toBe(8);
    expect(SKIN_PALETTE.length).toBe(8);
    expect(LEGS_PALETTE.length).toBe(8);
  });

  it("all palette entries are valid 24-bit hex colours", () => {
    const valid = (c: number) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
    expect(BODY_PALETTE.every(valid)).toBe(true);
    expect(SKIN_PALETTE.every(valid)).toBe(true);
    expect(LEGS_PALETTE.every(valid)).toBe(true);
  });

  it("no duplicate colours within each palette", () => {
    const unique = (arr: number[]) => new Set(arr).size === arr.length;
    expect(unique(BODY_PALETTE)).toBe(true);
    expect(unique(SKIN_PALETTE)).toBe(true);
    expect(unique(LEGS_PALETTE)).toBe(true);
  });
});
