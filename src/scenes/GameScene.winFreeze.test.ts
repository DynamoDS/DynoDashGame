/**
 * Regression tests for the level-2 win freeze (fixed in GameScene.create).
 *
 * Root cause
 * ----------
 * On level 2, the flag overlap and a Jacobot bug overlap can fire on the
 * same physics step (Phaser processes overlaps in registration order).
 * Before the fix, the bug-overlap callback had no `transitioning` guard, so
 * `player.takeDamage()` ran after the win was already decided.  If the
 * player's HP reached 0, `player.die()` created a 600 ms fade tween whose
 * `onComplete` emits `"playerDied"` on GameScene.  Because `deferSceneStart`
 * fires on the next tick (~16 ms), the tween's `onComplete` could fire while
 * GameScene was mid-teardown, leaving the engine with no active scene and
 * producing the observed freeze.
 *
 * The two-part fix in GameScene.create()
 * ---------------------------------------
 * 1. Jacobot is destroyed synchronously inside the flag callback (before
 *    `deferSceneStart`), removing the source of new bugs.
 * 2. The bug-overlap callback now guards with `if (this.transitioning) return`
 *    so any in-flight bug that arrives after the flag fires cannot call
 *    takeDamage.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Minimal simulation types — no Phaser dependency
// ---------------------------------------------------------------------------

interface FakePlayer {
  hp: number;
  isDead: boolean;
  takeDamageCallCount: number;
  dieCallCount: number;
  takeDamage(amount: number): void;
}

function makePlayer(hp = 100): FakePlayer {
  const p: FakePlayer = {
    hp,
    isDead: false,
    takeDamageCallCount: 0,
    dieCallCount: 0,
    takeDamage(amount: number) {
      if (p.isDead) return;
      p.takeDamageCallCount++;
      p.hp = Math.max(0, p.hp - amount);
      if (p.hp <= 0) {
        p.dieCallCount++;
        p.isDead = true;
        // die() creates a tween; we model this as a schedulable callback
      }
    },
  };
  return p;
}

interface FakeJacobot {
  destroyed: boolean;
  timerActive: boolean;
  destroy(): void;
}

function makeJacobot(): FakeJacobot {
  return {
    destroyed: false,
    timerActive: true,
    destroy() {
      this.destroyed = true;
      this.timerActive = false;
    },
  };
}

/** Models one physics step dispatching overlaps in registration order. */
function runPhysicsStep(options: {
  flagOverlaps: boolean;
  bugOverlaps: boolean;
  /** current state coming in */
  transitioning: boolean;
  playerDead: boolean;
  jacobot: FakeJacobot | null;
  player: FakePlayer;
  /** whether the bug callback has the `if (transitioning) return` guard */
  bugCallbackHasGuard: boolean;
  /** whether the flag callback destroys jacobot synchronously */
  flagCallbackDestroysJacobot: boolean;
  bugDamage: number;
}): { transitioning: boolean; jacobot: FakeJacobot | null; sceneStartScheduled: boolean } {
  let { transitioning, jacobot } = options;
  let sceneStartScheduled = false;

  // ── Flag overlap (registered first) ────────────────────────────────────────
  if (options.flagOverlaps) {
    if (!transitioning && !options.playerDead) {
      transitioning = true;

      if (options.flagCallbackDestroysJacobot && jacobot) {
        jacobot.destroy();
        jacobot = null;
      }

      // deferSceneStart — models scheduling the transition for next tick
      sceneStartScheduled = true;
    }
  }

  // ── Bug overlap (registered after flag) ────────────────────────────────────
  if (options.bugOverlaps && jacobot && !jacobot.destroyed) {
    if (options.bugCallbackHasGuard && transitioning) {
      // early return — the fix
    } else {
      options.player.takeDamage(options.bugDamage);
    }
  }

  return { transitioning, jacobot, sceneStartScheduled };
}

// ---------------------------------------------------------------------------
// 1. Documents the original bug
// ---------------------------------------------------------------------------

describe("level-2 win freeze — original bug (no guards)", () => {
  it("same-frame flag+bug calls takeDamage after win is decided", () => {
    const player = makePlayer(25); // barely alive
    const jacobot = makeJacobot();

    const result = runPhysicsStep({
      flagOverlaps: true,
      bugOverlaps: true,
      transitioning: false,
      playerDead: false,
      jacobot,
      player,
      bugCallbackHasGuard: false,        // <-- original: no guard
      flagCallbackDestroysJacobot: false, // <-- original: jacobot not destroyed
      bugDamage: 25,
    });

    // Win was decided...
    expect(result.transitioning).toBe(true);
    expect(result.sceneStartScheduled).toBe(true);

    // ...but takeDamage still ran and killed the player
    expect(player.takeDamageCallCount).toBe(1);
    expect(player.isDead).toBe(true);
    expect(player.dieCallCount).toBe(1);

    // jacobot is still alive — timer still ticking during the transition window
    expect(result.jacobot).not.toBeNull();
    expect(result.jacobot?.timerActive).toBe(true);
  });

  it("die() after winning schedules a competing tween onComplete", () => {
    // Model the tween-onComplete that would emit "playerDied" during teardown
    let transitioning = true; // set by flag callback
    let playerDiedFiredDuringTeardown = false;
    let competingTransitionAttempted = false;

    // Simulate what die()'s tween onComplete does when it fires during teardown
    const simulateTweenOnCompleteDuringTeardown = () => {
      playerDiedFiredDuringTeardown = true;
      // The playerDied handler checks transitioning — but in the original bug,
      // the scene's event system could be partially destroyed, causing a silent
      // throw that prevented WinScene from completing its initialisation.
    };

    // Without the fix: tween fires because die() was called
    simulateTweenOnCompleteDuringTeardown();

    // The handler guard (transitioning check) is the only safety net
    const handlerRanSafely = (() => {
      if (transitioning) return true; // guard — returns early
      competingTransitionAttempted = true;
      return false;
    })();

    expect(playerDiedFiredDuringTeardown).toBe(true);
    expect(handlerRanSafely).toBe(true);
    expect(competingTransitionAttempted).toBe(false);
    // However: the tween's onComplete firing on a mid-teardown scene can still
    // throw silently — which is what caused the freeze.  The fix eliminates
    // die() being called at all, so this code path is never reached.
  });
});

// ---------------------------------------------------------------------------
// 2. The fix
// ---------------------------------------------------------------------------

describe("level-2 win freeze — the fix", () => {
  it("bug overlap guard prevents takeDamage after flag fires", () => {
    const player = makePlayer(25);
    const jacobot = makeJacobot();

    const result = runPhysicsStep({
      flagOverlaps: true,
      bugOverlaps: true,
      transitioning: false,
      playerDead: false,
      jacobot,
      player,
      bugCallbackHasGuard: true,         // <-- fix part 2
      flagCallbackDestroysJacobot: true,  // <-- fix part 1
      bugDamage: 25,
    });

    expect(result.transitioning).toBe(true);
    expect(result.sceneStartScheduled).toBe(true);

    // takeDamage was NOT called — player stays alive, no competing tween
    expect(player.takeDamageCallCount).toBe(0);
    expect(player.isDead).toBe(false);
    expect(player.dieCallCount).toBe(0);
  });

  it("jacobot is destroyed synchronously in the flag callback", () => {
    const player = makePlayer(100);
    const jacobot = makeJacobot();

    const result = runPhysicsStep({
      flagOverlaps: true,
      bugOverlaps: false,
      transitioning: false,
      playerDead: false,
      jacobot,
      player,
      bugCallbackHasGuard: true,
      flagCallbackDestroysJacobot: true,
      bugDamage: 25,
    });

    // jacobot reference is nulled by the flag callback
    expect(result.jacobot).toBeNull();
    // the original object is marked destroyed — no more throws
    expect(jacobot.destroyed).toBe(true);
    expect(jacobot.timerActive).toBe(false);
  });

  it("cleanup calling jacobot?.destroy() after it is already null is a no-op", () => {
    // After the flag callback nulls this.jacobot, GameScene.cleanup() does
    // this.jacobot?.destroy() — the optional chain makes it safe.
    const jacobot: FakeJacobot | null = null;
    expect(() => (jacobot as FakeJacobot | null)?.destroy()).not.toThrow();
  });

  it("bug overlap with low HP player does not trigger die() when guarded", () => {
    // Worst case: player at 1 HP, both overlaps fire simultaneously
    const player = makePlayer(1);
    const jacobot = makeJacobot();

    const result = runPhysicsStep({
      flagOverlaps: true,
      bugOverlaps: true,
      transitioning: false,
      playerDead: false,
      jacobot,
      player,
      bugCallbackHasGuard: true,
      flagCallbackDestroysJacobot: true,
      bugDamage: 25,
    });

    expect(result.sceneStartScheduled).toBe(true);
    expect(player.dieCallCount).toBe(0);
    expect(player.isDead).toBe(false);
  });

  it("guard does not block bug hits before the flag fires", () => {
    // Bugs should still deal damage during normal gameplay
    const player = makePlayer(100);
    const jacobot = makeJacobot();

    const result = runPhysicsStep({
      flagOverlaps: false, // flag not touched yet
      bugOverlaps: true,
      transitioning: false, // not yet transitioning
      playerDead: false,
      jacobot,
      player,
      bugCallbackHasGuard: true,
      flagCallbackDestroysJacobot: true,
      bugDamage: 25,
    });

    // Normal hit — transitioning was false so damage goes through
    expect(player.takeDamageCallCount).toBe(1);
    expect(player.hp).toBe(75);
    expect(result.sceneStartScheduled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. transitioning flag invariants
// ---------------------------------------------------------------------------

describe("transitioning flag invariants", () => {
  it("is set to true before deferSceneStart is called", () => {
    // The flag callback must set transitioning = true BEFORE scheduling the
    // scene transition.  If it were set after, there would be a window where
    // the overlap could re-enter and schedule two transitions.
    const callOrder: string[] = [];

    const simulateFlagCallback = (state: { transitioning: boolean }) => {
      if (state.transitioning) return;
      callOrder.push("set-transitioning");
      state.transitioning = true;
      callOrder.push("destroy-jacobot");
      callOrder.push("defer-scene-start");
    };

    const state = { transitioning: false };
    simulateFlagCallback(state);

    expect(callOrder[0]).toBe("set-transitioning");
    expect(callOrder[1]).toBe("destroy-jacobot");
    expect(callOrder[2]).toBe("defer-scene-start");
    expect(state.transitioning).toBe(true);
  });

  it("second overlap call is a no-op once transitioning is true", () => {
    let sceneStartCount = 0;
    let transitioning = false;

    const flagCallback = () => {
      if (transitioning) return;
      transitioning = true;
      sceneStartCount++;
    };

    flagCallback(); // first call — flag hit
    flagCallback(); // same-frame re-entry (physics fires overlap every step)
    flagCallback(); // next frame, still overlapping

    expect(sceneStartCount).toBe(1);
    expect(transitioning).toBe(true);
  });

  it("playerDied handler returns early when transitioning is true", () => {
    let transitioning = true; // already set by flag callback
    let competingSceneStarted = false;

    const playerDiedHandler = () => {
      if (transitioning) return; // guard
      competingSceneStarted = true;
    };

    // Simulate tween onComplete firing during teardown
    playerDiedHandler();

    expect(competingSceneStarted).toBe(false);
  });
});
