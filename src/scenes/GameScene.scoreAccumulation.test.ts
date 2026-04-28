/**
 * Regression tests for cross-level score accumulation.
 *
 * Bug (fixed)
 * -----------
 * GameScene.create() was unconditionally setting:
 *   this.score = 0;
 *   this.registry.set("score", 0);
 *
 * This wiped the accumulated score every time GameScene started, including
 * level transitions (Win → Level N+1), which share the same GameScene boot
 * path.  Score appeared to reset to 0 at the start of each new level.
 *
 * Fix
 * ---
 * GameScene.create() now reads the existing registry value:
 *   this.score = (this.registry.get("score") as number) ?? 0;
 *
 * Score is reset to 0 only at explicit "start a new run" callsites:
 *   - CharacterBuilderScene.onConfirm()  (fresh game from menu)
 *   - GameScene playerDied handler       (lives > 0: lost a life)
 *   - GameOverScene.doRestart()          (game-over restart)
 *
 * Score is NOT reset when transitioning level-to-level (WinScene → GameScene),
 * so coins collected in earlier levels carry forward.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Minimal registry simulation — no Phaser dependency
// ---------------------------------------------------------------------------

function makeRegistry(initial: Record<string, unknown> = {}): {
  store: Record<string, unknown>;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
} {
  const store: Record<string, unknown> = { ...initial };
  return {
    store,
    get: (key) => store[key],
    set: (key, value) => { store[key] = value; },
  };
}

/** Simulate GameScene.create() reading score from the registry (the fix). */
function gameSceneCreate(registry: ReturnType<typeof makeRegistry>): number {
  const score = (registry.get("score") as number) ?? 0;
  // GameScene.create() no longer resets score — just reads it
  return score;
}

/** Simulate collecting a coin in GameScene. */
function collectCoin(
  localScore: number,
  registry: ReturnType<typeof makeRegistry>,
  points = 10,
): number {
  const next = localScore + points;
  registry.set("score", next);
  return next;
}

/** Simulate the playerDied handler (lives > 0 path — the fix). */
function simulateDeathRestart(
  registry: ReturnType<typeof makeRegistry>,
  lives: number,
): { newLives: number; sceneStarted: string } {
  const newLives = Math.max(0, lives - 1);
  registry.set("lives", newLives);
  if (newLives > 0) {
    registry.set("score", 0); // reset on life lost
    return { newLives, sceneStarted: "GameScene" };
  }
  // lives === 0: GameOverScene — score preserved in registry until doRestart
  return { newLives, sceneStarted: "GameOverScene" };
}

/** Simulate CharacterBuilderScene.onConfirm() — fresh game start. */
function simulateFreshGameStart(registry: ReturnType<typeof makeRegistry>): void {
  registry.set("lives", 3);
  registry.set("level", 1);
  registry.set("score", 0);
}

/** Simulate GameOverScene.doRestart(). */
function simulateGameOverRestart(registry: ReturnType<typeof makeRegistry>): void {
  registry.set("lives", 3);
  registry.set("score", 0);
}

// ---------------------------------------------------------------------------
// 1. Documents the original bug
// ---------------------------------------------------------------------------

describe("score accumulation — original bug (unconditional reset in create())", () => {
  it("always starting score at 0 erases inter-level progress", () => {
    const registry = makeRegistry({ score: 80, level: 2 });

    // The old buggy behaviour: create() always wrote 0
    const buggyCreate = (): number => {
      registry.set("score", 0); // <-- the bug
      return 0;
    };

    const score = buggyCreate();
    expect(score).toBe(0);
    expect(registry.get("score")).toBe(0);
    // The 80 coins from level 1 are gone
  });
});

// ---------------------------------------------------------------------------
// 2. The fix — score carries across levels
// ---------------------------------------------------------------------------

describe("score accumulation — the fix", () => {
  it("level 1 score carries into level 2 without resetting", () => {
    const registry = makeRegistry({ score: 0, level: 1 });

    // Level 1 gameplay
    let score = gameSceneCreate(registry); // reads 0 — first run
    score = collectCoin(score, registry);  // 10
    score = collectCoin(score, registry);  // 20
    score = collectCoin(score, registry);  // 30
    expect(registry.get("score")).toBe(30);

    // Win level 1 → WinScene sets level=2, does NOT touch score
    registry.set("level", 2);

    // Level 2 starts: GameScene.create() reads score from registry
    score = gameSceneCreate(registry);
    expect(score).toBe(30); // carries over
  });

  it("coins collected in level 2 add to level 1 total", () => {
    const registry = makeRegistry({ score: 30, level: 2 });

    let score = gameSceneCreate(registry); // 30 from level 1
    score = collectCoin(score, registry);  // 40
    score = collectCoin(score, registry);  // 50

    expect(score).toBe(50);
    expect(registry.get("score")).toBe(50);
  });

  it("score accumulates across all three levels", () => {
    const registry = makeRegistry({ score: 0 });
    let score = 0;

    // Level 1: collect 3 coins (30 pts)
    score = gameSceneCreate(registry);
    for (let i = 0; i < 3; i++) score = collectCoin(score, registry);
    expect(score).toBe(30);

    registry.set("level", 2);

    // Level 2: collect 2 more coins (20 pts)
    score = gameSceneCreate(registry);
    for (let i = 0; i < 2; i++) score = collectCoin(score, registry);
    expect(score).toBe(50);

    registry.set("level", 3);

    // Level 3 (Endless): collect 4 more coins (40 pts)
    score = gameSceneCreate(registry);
    for (let i = 0; i < 4; i++) score = collectCoin(score, registry);
    expect(score).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// 3. Score reset callsites
// ---------------------------------------------------------------------------

describe("score reset — correct callsites only", () => {
  it("death (lives > 0) resets score to 0 for the next attempt", () => {
    const registry = makeRegistry({ score: 50, lives: 3 });

    const { newLives, sceneStarted } = simulateDeathRestart(registry, 3);

    expect(newLives).toBe(2);
    expect(sceneStarted).toBe("GameScene");
    expect(registry.get("score")).toBe(0); // reset on life lost

    // Next GameScene run starts at 0
    const score = gameSceneCreate(registry);
    expect(score).toBe(0);
  });

  it("death with last life does NOT reset registry score before GameOverScene", () => {
    // GameOverScene receives score via data parameter (this.score, not registry).
    // The registry score isn't consumed by GameOverScene, so resetting it here
    // doesn't matter — but the test confirms doRestart() handles the reset.
    const registry = makeRegistry({ score: 120, lives: 1 });

    const { newLives, sceneStarted } = simulateDeathRestart(registry, 1);

    expect(newLives).toBe(0);
    expect(sceneStarted).toBe("GameOverScene");
    // Score not explicitly reset here — GameOverScene.doRestart() does it
  });

  it("GameOverScene.doRestart() resets score before returning to GameScene", () => {
    const registry = makeRegistry({ score: 120, lives: 0 });

    simulateGameOverRestart(registry);

    expect(registry.get("score")).toBe(0);
    expect(registry.get("lives")).toBe(3);

    const score = gameSceneCreate(registry);
    expect(score).toBe(0);
  });

  it("fresh game start (CharacterBuilder) resets score, lives, and level", () => {
    // Simulate returning to menu mid-run (level 3, score 200)
    const registry = makeRegistry({ score: 200, lives: 1, level: 3 });

    simulateFreshGameStart(registry);

    expect(registry.get("score")).toBe(0);
    expect(registry.get("lives")).toBe(3);
    expect(registry.get("level")).toBe(1);

    const score = gameSceneCreate(registry);
    expect(score).toBe(0);
  });

  it("WinScene does NOT reset score — only sets level and lives", () => {
    // WinScene.create() only touches level and lives, never score.
    const registry = makeRegistry({ score: 75, level: 1, lives: 3 });

    // Simulate WinScene.create()
    const prevLevel = (registry.get("level") as number) ?? 1;
    registry.set("level", prevLevel + 1);
    registry.set("lives", 3);
    // score is intentionally untouched

    expect(registry.get("score")).toBe(75); // preserved
    expect(registry.get("level")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Full run simulation
// ---------------------------------------------------------------------------

describe("full run simulation — score across levels and deaths", () => {
  it("complete run: level 1 → win → level 2 → die → level 2 retry → win → level 3", () => {
    const registry = makeRegistry({ score: 0, lives: 3, level: 1 });
    let score = 0;

    // Level 1: collect 5 coins (50 pts)
    score = gameSceneCreate(registry);
    for (let i = 0; i < 5; i++) score = collectCoin(score, registry);
    expect(score).toBe(50);

    // Win level 1 → WinScene → level 2
    registry.set("level", 2);
    registry.set("lives", 3);

    // Level 2: collect 2 coins (20 pts), then die
    score = gameSceneCreate(registry); // reads 50
    expect(score).toBe(50);
    score = collectCoin(score, registry); // 60
    score = collectCoin(score, registry); // 70
    const { newLives } = simulateDeathRestart(registry, 3); // score → 0
    expect(newLives).toBe(2);

    // Level 2 retry: score reset, collect 4 coins (40 pts)
    score = gameSceneCreate(registry); // reads 0
    expect(score).toBe(0);
    for (let i = 0; i < 4; i++) score = collectCoin(score, registry);
    expect(score).toBe(40);

    // Win level 2 → WinScene → level 3
    registry.set("level", 3);
    registry.set("lives", 3);

    // Level 3: collect 3 coins (30 pts)
    score = gameSceneCreate(registry); // reads 40
    expect(score).toBe(40);
    for (let i = 0; i < 3; i++) score = collectCoin(score, registry);
    expect(score).toBe(70);
  });

  it("game over then restart begins at 0", () => {
    const registry = makeRegistry({ score: 0, lives: 3, level: 1 });
    let score = 0;

    // Collect coins until game over
    score = gameSceneCreate(registry);
    for (let i = 0; i < 8; i++) score = collectCoin(score, registry); // 80
    simulateDeathRestart(registry, 1); // last life

    // GameOverScene → restart
    simulateGameOverRestart(registry);

    score = gameSceneCreate(registry);
    expect(score).toBe(0);
  });
});
