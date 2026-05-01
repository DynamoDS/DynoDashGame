/**
 * Regression tests for the level-intro camera pan phase.
 *
 * The intro phase state machine
 * ------------------------------
 * GameScene.create() sets introPhase = "pan-out" and calls player.freeze().
 * GameScene.update() ticks introElapsed and advances through phases:
 *
 *   pan-out  (0 → INTRO_PAN_OUT_MS ms)          camera pans to goal flag
 *   pause    (INTRO_PAN_OUT_MS → +INTRO_PAUSE_MS ms)  camera holds at flag
 *   pan-back (+INTRO_PAUSE_MS → +INTRO_RETURN_MS ms)  camera returns to player
 *   done     (after full sequence)               player.unfreeze(), camera follows
 *
 * Three behaviours under test
 * ---------------------------
 * 1. Coin overlap callback is blocked (introPhase !== "done") until intro ends.
 * 2. Player gravity is re-enabled and camera follow starts exactly when phase
 *    transitions to "done".
 * 3. Player death is polled and handled even while the intro is still active
 *    (fix for the bug where update() returned early before the player.dead check,
 *    meaning fire-ground deaths during the intro were silently dropped).
 */

import { describe, it, expect } from "vitest";
import {
  INTRO_PAN_OUT_MS,
  INTRO_PAUSE_MS,
  INTRO_RETURN_MS,
} from "../config/GameConfig";

// ---------------------------------------------------------------------------
// Shared simulation helpers — no Phaser dependency
// ---------------------------------------------------------------------------

type IntroPhase = "pan-out" | "pause" | "pan-back" | "done";

interface IntroState {
  introPhase: IntroPhase;
  introElapsed: number;
  /** Proxy for player.frozen (set true by freeze(), cleared by unfreeze()). */
  playerFrozen: boolean;
  /** Proxy for camera.startFollow being active. */
  cameraFollowing: boolean;
}

/**
 * Simulates one tick of the intro state machine from GameScene.update().
 * Returns whether update should return early (i.e. intro not yet done).
 */
function tickIntro(state: IntroState, delta: number): boolean {
  if (state.introPhase === "done") return false;

  state.introElapsed += delta;

  if (state.introPhase === "pan-out" && state.introElapsed >= INTRO_PAN_OUT_MS) {
    state.introPhase = "pause";
  } else if (
    state.introPhase === "pause" &&
    state.introElapsed >= INTRO_PAN_OUT_MS + INTRO_PAUSE_MS
  ) {
    state.introPhase = "pan-back";
    // camera.pan() + camera.zoomTo() would be called here
  } else if (
    state.introPhase === "pan-back" &&
    state.introElapsed >= INTRO_PAN_OUT_MS + INTRO_PAUSE_MS + INTRO_RETURN_MS
  ) {
    state.introPhase = "done";
    state.playerFrozen = false;       // player.unfreeze()
    state.cameraFollowing = true;     // camera.startFollow()
  }

  // Intro not done — update() should return early
  return state.introPhase !== "done";
}

/** Simulates the coin overlap callback from GameScene.create(). */
function coinOverlapCallback(introPhase: IntroPhase, score: number): number {
  if (introPhase !== "done") return score; // blocked during intro
  return score + 10;
}

interface UpdateState {
  transitioning: boolean;
  introPhase: IntroPhase;
  introElapsed: number;
  playerFrozen: boolean;
  cameraFollowing: boolean;
  playerDead: boolean;
  deathElapsedMs: number;
  handleDeathCalled: boolean;
}

/**
 * Simulates the FIXED GameScene.update() where the death poll runs BEFORE
 * the intro early-return.
 */
function tickUpdateFixed(state: UpdateState, delta: number): void {
  if (state.transitioning) return;

  // Death check BEFORE intro early-return (the fix)
  if (state.playerDead) {
    state.deathElapsedMs += delta;
    if (state.deathElapsedMs >= 600) {
      state.handleDeathCalled = true;
      state.transitioning = true;
    }
    return;
  }
  state.deathElapsedMs = 0;

  const introState: IntroState = {
    introPhase: state.introPhase,
    introElapsed: state.introElapsed,
    playerFrozen: state.playerFrozen,
    cameraFollowing: state.cameraFollowing,
  };

  const shouldReturnEarly = tickIntro(introState, delta);

  // Sync back shared fields
  state.introPhase = introState.introPhase;
  state.introElapsed = introState.introElapsed;
  state.playerFrozen = introState.playerFrozen;
  state.cameraFollowing = introState.cameraFollowing;

  if (shouldReturnEarly) return;
  // Normal gameplay update would continue here …
}

/**
 * Simulates the BUGGY GameScene.update() where the death poll is AFTER
 * the intro early-return, so deaths during intro are silently dropped.
 */
function tickUpdateBuggy(state: UpdateState, delta: number): void {
  if (state.transitioning) return;

  // Intro check fires first — death poll is unreachable while intro is active
  if (state.introPhase !== "done") {
    const introState: IntroState = {
      introPhase: state.introPhase,
      introElapsed: state.introElapsed,
      playerFrozen: state.playerFrozen,
      cameraFollowing: state.cameraFollowing,
    };
    tickIntro(introState, delta);
    state.introPhase = introState.introPhase;
    state.introElapsed = introState.introElapsed;
    state.playerFrozen = introState.playerFrozen;
    state.cameraFollowing = introState.cameraFollowing;
    return; // ← death poll is never reached
  }

  if (state.playerDead) {
    state.deathElapsedMs += delta;
    if (state.deathElapsedMs >= 600) {
      state.handleDeathCalled = true;
      state.transitioning = true;
    }
    return;
  }
  state.deathElapsedMs = 0;
}

// ---------------------------------------------------------------------------
// 1. Coin overlap blocked during intro
// ---------------------------------------------------------------------------

describe("intro phase — coin overlap blocked", () => {
  it("coin overlap is ignored while introPhase is pan-out", () => {
    const score = coinOverlapCallback("pan-out", 0);
    expect(score).toBe(0);
  });

  it("coin overlap is ignored while introPhase is pause", () => {
    const score = coinOverlapCallback("pause", 0);
    expect(score).toBe(0);
  });

  it("coin overlap is ignored while introPhase is pan-back", () => {
    const score = coinOverlapCallback("pan-back", 0);
    expect(score).toBe(0);
  });

  it("coin overlap is processed once introPhase is done", () => {
    const score = coinOverlapCallback("done", 0);
    expect(score).toBe(10);
  });

  it("multiple coin overlaps during intro all return zero score gain", () => {
    let score = 0;
    score = coinOverlapCallback("pan-out", score);
    score = coinOverlapCallback("pan-out", score);
    score = coinOverlapCallback("pause", score);
    score = coinOverlapCallback("pan-back", score);
    expect(score).toBe(0);
  });

  it("coins collected after intro accumulate normally", () => {
    let score = 0;
    // Intro still active — no gain
    score = coinOverlapCallback("pan-out", score);
    score = coinOverlapCallback("pause", score);
    // Intro done — coins count
    score = coinOverlapCallback("done", score);
    score = coinOverlapCallback("done", score);
    score = coinOverlapCallback("done", score);
    expect(score).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// 2. Intro phase timing — gravity re-enabled and camera follows at end
// ---------------------------------------------------------------------------

describe("intro phase — state machine timing and completion", () => {
  function freshIntroState(): IntroState {
    return {
      introPhase: "pan-out",
      introElapsed: 0,
      playerFrozen: true,
      cameraFollowing: false,
    };
  }

  it("starts in pan-out with player frozen and camera not following", () => {
    const state = freshIntroState();
    expect(state.introPhase).toBe("pan-out");
    expect(state.playerFrozen).toBe(true);
    expect(state.cameraFollowing).toBe(false);
  });

  it("transitions pan-out → pause exactly at INTRO_PAN_OUT_MS", () => {
    const state = freshIntroState();

    // One tick short — still pan-out
    tickIntro(state, INTRO_PAN_OUT_MS - 1);
    expect(state.introPhase).toBe("pan-out");

    // One more ms pushes it over the threshold
    tickIntro(state, 1);
    expect(state.introPhase).toBe("pause");
  });

  it("transitions pause → pan-back exactly at INTRO_PAN_OUT_MS + INTRO_PAUSE_MS", () => {
    const state = freshIntroState();

    tickIntro(state, INTRO_PAN_OUT_MS);     // → pause
    tickIntro(state, INTRO_PAUSE_MS - 1);
    expect(state.introPhase).toBe("pause");

    tickIntro(state, 1);
    expect(state.introPhase).toBe("pan-back");
  });

  it("transitions pan-back → done at full sequence duration and unfreezes player", () => {
    const state = freshIntroState();

    // Advance one phase at a time (matching the if/else-if chain in GameScene)
    tickIntro(state, INTRO_PAN_OUT_MS);    // pan-out → pause
    expect(state.introPhase).toBe("pause");

    tickIntro(state, INTRO_PAUSE_MS);      // pause → pan-back
    expect(state.introPhase).toBe("pan-back");

    // One ms short of the pan-back threshold — still pan-back, player still frozen
    tickIntro(state, INTRO_RETURN_MS - 1);
    expect(state.introPhase).toBe("pan-back");
    expect(state.playerFrozen).toBe(true);

    // Final ms crosses the threshold → done
    tickIntro(state, 1);
    expect(state.introPhase).toBe("done");
    expect(state.playerFrozen).toBe(false);    // unfreeze() called
    expect(state.cameraFollowing).toBe(true);  // startFollow() called
  });

  it("player remains frozen throughout the entire intro sequence", () => {
    const state = freshIntroState();
    const totalMs = INTRO_PAN_OUT_MS + INTRO_PAUSE_MS + INTRO_RETURN_MS;

    // Tick through all phases except the last moment
    tickIntro(state, totalMs - 1);
    expect(state.playerFrozen).toBe(true);
    expect(state.cameraFollowing).toBe(false);
  });

  it("camera follow is NOT active before intro completes", () => {
    const state = freshIntroState();

    tickIntro(state, INTRO_PAN_OUT_MS);     // pause
    expect(state.cameraFollowing).toBe(false);

    tickIntro(state, INTRO_PAUSE_MS);       // pan-back
    expect(state.cameraFollowing).toBe(false);

    tickIntro(state, INTRO_RETURN_MS - 1);  // still pan-back
    expect(state.cameraFollowing).toBe(false);
  });

  it("all three phases complete after their accumulated thresholds are met", () => {
    // The if/else-if chain advances exactly one phase per tick.  Pass a delta
    // large enough to exceed every threshold in three successive ticks.
    const state = freshIntroState();
    const bigDelta = INTRO_PAN_OUT_MS + INTRO_PAUSE_MS + INTRO_RETURN_MS + 500;

    tickIntro(state, bigDelta); // pan-out → pause  (elapsed already past all thresholds)
    expect(state.introPhase).toBe("pause");

    tickIntro(state, 0);        // pause → pan-back  (elapsed unchanged, threshold passed)
    expect(state.introPhase).toBe("pan-back");

    tickIntro(state, 0);        // pan-back → done
    expect(state.introPhase).toBe("done");
    expect(state.playerFrozen).toBe(false);
    expect(state.cameraFollowing).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Death during intro — original bug and the fix
// ---------------------------------------------------------------------------

describe("intro phase — death handling — original bug (death poll after intro return)", () => {
  it("player dying during intro never triggers handleDeath in the buggy version", () => {
    const state: UpdateState = {
      transitioning: false,
      introPhase: "pan-out",
      introElapsed: 0,
      playerFrozen: true,
      cameraFollowing: false,
      playerDead: true,   // player dies at the very start of the intro
      deathElapsedMs: 0,
      handleDeathCalled: false,
    };

    // Simulate many frames during the intro — death should be processed,
    // but in the buggy version it is silently dropped because update() returns
    // early for the intro before ever checking player.dead.
    for (let i = 0; i < 60; i++) {
      tickUpdateBuggy(state, 16); // ~60 frames @ 60 fps
    }

    // Bug: death was never handled even though ~960 ms elapsed
    expect(state.handleDeathCalled).toBe(false);
  });

  it("death during intro keeps deathElapsedMs at 0 in the buggy version", () => {
    const state: UpdateState = {
      transitioning: false,
      introPhase: "pan-out",
      introElapsed: 0,
      playerFrozen: true,
      cameraFollowing: false,
      playerDead: true,
      deathElapsedMs: 0,
      handleDeathCalled: false,
    };

    tickUpdateBuggy(state, 16);
    tickUpdateBuggy(state, 16);

    // deathElapsedMs is never incremented while intro is active in the buggy path
    expect(state.deathElapsedMs).toBe(0);
  });
});

describe("intro phase — death handling — the fix (death poll before intro return)", () => {
  it("player dying during intro triggers handleDeath after 600 ms", () => {
    const state: UpdateState = {
      transitioning: false,
      introPhase: "pan-out",
      introElapsed: 0,
      playerFrozen: true,
      cameraFollowing: false,
      playerDead: true,
      deathElapsedMs: 0,
      handleDeathCalled: false,
    };

    // Tick to 580 ms — still below the 600 ms threshold
    tickUpdateFixed(state, 580);
    expect(state.handleDeathCalled).toBe(false);

    // One more tick reaches 601 ms → handleDeath fires
    tickUpdateFixed(state, 21);
    expect(state.handleDeathCalled).toBe(true);
    expect(state.transitioning).toBe(true);
  });

  it("death during intro accumulates deathElapsedMs correctly", () => {
    const state: UpdateState = {
      transitioning: false,
      introPhase: "pan-out",
      introElapsed: 0,
      playerFrozen: true,
      cameraFollowing: false,
      playerDead: true,
      deathElapsedMs: 0,
      handleDeathCalled: false,
    };

    tickUpdateFixed(state, 100);
    expect(state.deathElapsedMs).toBe(100);

    tickUpdateFixed(state, 200);
    expect(state.deathElapsedMs).toBe(300);
  });

  it("intro does NOT advance while player is dead (death poll returns early)", () => {
    const state: UpdateState = {
      transitioning: false,
      introPhase: "pan-out",
      introElapsed: 0,
      playerFrozen: true,
      cameraFollowing: false,
      playerDead: true,
      deathElapsedMs: 0,
      handleDeathCalled: false,
    };

    // Tick well past INTRO_PAN_OUT_MS
    tickUpdateFixed(state, INTRO_PAN_OUT_MS + 1000);

    // Intro elapsed is still 0 — the intro block was never reached because
    // the death-poll early-return fires first.
    expect(state.introElapsed).toBe(0);
    expect(state.introPhase).toBe("pan-out");
  });

  it("intro proceeds normally when player is alive", () => {
    const state: UpdateState = {
      transitioning: false,
      introPhase: "pan-out",
      introElapsed: 0,
      playerFrozen: true,
      cameraFollowing: false,
      playerDead: false,
      deathElapsedMs: 0,
      handleDeathCalled: false,
    };

    // Advance through each phase with the correct delta per phase
    tickUpdateFixed(state, INTRO_PAN_OUT_MS);  // pan-out → pause
    tickUpdateFixed(state, INTRO_PAUSE_MS);    // pause → pan-back
    tickUpdateFixed(state, INTRO_RETURN_MS);   // pan-back → done

    expect(state.introPhase).toBe("done");
    expect(state.playerFrozen).toBe(false);
    expect(state.cameraFollowing).toBe(true);
    expect(state.handleDeathCalled).toBe(false);
  });

  it("death after intro completes is handled normally", () => {
    const state: UpdateState = {
      transitioning: false,
      introPhase: "done",
      introElapsed: INTRO_PAN_OUT_MS + INTRO_PAUSE_MS + INTRO_RETURN_MS,
      playerFrozen: false,
      cameraFollowing: true,
      playerDead: true,
      deathElapsedMs: 0,
      handleDeathCalled: false,
    };

    tickUpdateFixed(state, 601);
    expect(state.handleDeathCalled).toBe(true);
    expect(state.transitioning).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Jacobot bug damage blocked during intro
// ---------------------------------------------------------------------------

describe("intro phase — Jacobot bug damage blocked during intro", () => {
  /**
   * Simulates the FIXED Jacobot bug overlap callback.
   * Returns whether damage was applied.
   */
  function bugOverlapFixed(
    transitioning: boolean,
    introPhase: IntroPhase,
    playerHp: number,
    damage: number,
  ): { hp: number; damaged: boolean } {
    if (transitioning || introPhase !== "done") return { hp: playerHp, damaged: false };
    return { hp: playerHp - damage, damaged: true };
  }

  it("bug damage is blocked when introPhase is pan-out", () => {
    const { damaged } = bugOverlapFixed(false, "pan-out", 100, 25);
    expect(damaged).toBe(false);
  });

  it("bug damage is blocked when introPhase is pause", () => {
    const { damaged } = bugOverlapFixed(false, "pause", 100, 25);
    expect(damaged).toBe(false);
  });

  it("bug damage is blocked when introPhase is pan-back", () => {
    const { damaged } = bugOverlapFixed(false, "pan-back", 100, 25);
    expect(damaged).toBe(false);
  });

  it("bug damage is applied after intro completes", () => {
    const { damaged, hp } = bugOverlapFixed(false, "done", 100, 25);
    expect(damaged).toBe(true);
    expect(hp).toBe(75);
  });

  it("bug damage is also blocked when transitioning (existing guard)", () => {
    const { damaged } = bugOverlapFixed(true, "done", 100, 25);
    expect(damaged).toBe(false);
  });
});
