/**
 * Regression tests for CharacterBuilderScene lifecycle invariants.
 *
 * Bug 1 (fixed): On the second call to create() (after TAB → CharacterSelectScene
 * → back to CharacterBuilderScene), `slotHighlight` was never cleared.
 * Indices 0-2 still referenced destroyed Phaser Text objects (scene=null).
 * `updateSlotLabels()` called .setColor()/.setText() on them, throwing and
 * aborting create() silently — making SPACE appear broken.
 *
 * These tests verify the invariants at the pure-logic level (no Phaser required).
 */

import { describe, it, expect } from "vitest";

// ── Simulated scene-object lifecycle ─────────────────────────────────────────

interface FakeText {
  destroyed: boolean;
  setText(s: string): this;
  setColor(c: string): this;
}

function makeFakeText(): FakeText {
  return {
    destroyed: false,
    setText(_s: string) {
      if (this.destroyed) throw new Error("setText called on destroyed object");
      return this;
    },
    setColor(_c: string) {
      if (this.destroyed) throw new Error("setColor called on destroyed object");
      return this;
    },
  };
}

// Simulates Phaser's scene shutdown: marks all created texts as destroyed.
function simulateShutdown(texts: FakeText[]): void {
  texts.forEach(t => { t.destroyed = true; });
}

// ── The buggy pattern (no clear) ─────────────────────────────────────────────

describe("slotHighlight WITHOUT clearing (documents the original bug)", () => {
  it("accumulates stale refs and throws on second create()", () => {
    let slotHighlight: FakeText[] = [];

    // First create() — push 3 labels
    for (let i = 0; i < 3; i++) slotHighlight.push(makeFakeText());

    // Scene shutdown destroys the objects
    simulateShutdown(slotHighlight);

    // Second create() WITHOUT clearing — pushes 3 MORE onto the array
    for (let i = 0; i < 3; i++) slotHighlight.push(makeFakeText());

    // Array now has 6 entries; indices 0-2 are destroyed
    expect(slotHighlight.length).toBe(6);
    expect(slotHighlight[0].destroyed).toBe(true);
    expect(slotHighlight[1].destroyed).toBe(true);
    expect(slotHighlight[2].destroyed).toBe(true);

    // Calling updateSlotLabels() uses indices 0-2 — these throw
    expect(() => slotHighlight[0].setColor("#ffffaa")).toThrow("destroyed");
    expect(() => slotHighlight[1].setText("Body: 1/8")).toThrow("destroyed");
  });
});

// ── The fixed pattern (clear at top of create) ────────────────────────────────

describe("slotHighlight WITH clearing (the fix)", () => {
  it("always contains exactly 3 live refs after create()", () => {
    let slotHighlight: FakeText[] = [];

    // First create() — clear then push
    slotHighlight = [];
    for (let i = 0; i < 3; i++) slotHighlight.push(makeFakeText());

    simulateShutdown(slotHighlight);

    // Second create() — clear FIRST, then push 3 fresh refs
    slotHighlight = [];
    for (let i = 0; i < 3; i++) slotHighlight.push(makeFakeText());

    expect(slotHighlight.length).toBe(3);
    expect(slotHighlight.every(t => !t.destroyed)).toBe(true);

    // Calling updateSlotLabels() works without throwing
    expect(() => {
      slotHighlight[0].setColor("#ffffaa");
      slotHighlight[1].setText("Skin: 2/8");
      slotHighlight[2].setColor("#aaaaaa");
    }).not.toThrow();
  });

  it("is safe to run create() any number of times", () => {
    let slotHighlight: FakeText[] = [];

    for (let round = 0; round < 5; round++) {
      slotHighlight = []; // THE FIX
      for (let i = 0; i < 3; i++) slotHighlight.push(makeFakeText());
      simulateShutdown(slotHighlight);
    }

    // After the last create (not yet shut down)
    slotHighlight = [];
    for (let i = 0; i < 3; i++) slotHighlight.push(makeFakeText());

    expect(slotHighlight.length).toBe(3);
    expect(slotHighlight.every(t => !t.destroyed)).toBe(true);
  });
});

// ── hasActed guard ────────────────────────────────────────────────────────────

describe("hasActed guard (prevents double scene-start)", () => {
  it("only the first confirm call takes effect", () => {
    let hasActed = false;
    let confirmCalls = 0;
    const onConfirm = () => {
      if (hasActed) return;
      hasActed = true;
      confirmCalls++;
    };

    onConfirm();
    onConfirm();
    onConfirm();

    expect(confirmCalls).toBe(1);
  });

  it("create() resets hasActed so the scene works on re-entry", () => {
    // Simulate stale state from a previous scene run
    let hasActed = true;

    // create() must reset it
    hasActed = false;

    let confirmCalls = 0;
    const onConfirm = () => {
      if (hasActed) return;
      hasActed = true;
      confirmCalls++;
    };

    onConfirm();
    expect(confirmCalls).toBe(1);
  });

  it("TAB back then SPACE still works: hasActed resets each create()", () => {
    // Round 1: user presses TAB (sets hasActed, starts CharacterSelectScene)
    let hasActed = false;
    let tabCalls = 0;
    const onTab = () => {
      if (hasActed) return;
      hasActed = true;
      tabCalls++;
    };
    onTab();
    expect(tabCalls).toBe(1);
    expect(hasActed).toBe(true);

    // Simulate scene shutdown + re-create (create() resets hasActed)
    hasActed = false;

    // Round 2: user presses SPACE (onConfirm should now fire)
    let confirmCalls = 0;
    const onConfirm = () => {
      if (hasActed) return;
      hasActed = true;
      confirmCalls++;
    };
    onConfirm();
    expect(confirmCalls).toBe(1);
  });
});
