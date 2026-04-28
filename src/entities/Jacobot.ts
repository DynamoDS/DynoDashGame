import Phaser from "phaser";
import type { Player } from "./Player";
import {
  GRAVITY,
  JACOBOT_MIN_THROW_MS,
  JACOBOT_MAX_THROW_MS,
  JACOBOT_FLIGHT_TIME_MIN,
  JACOBOT_FLIGHT_TIME_MAX,
  JACOBOT_SPREAD_X,
} from "../config/GameConfig";

const BUG_KEYS = ["bug_beetle", "bug_spider", "bug_fly"];

/** Baseline HP deducted from the player on a direct bug hit (level 2). */
export const JACOBOT_BUG_DAMAGE = 25;

/** Per-level difficulty overrides passed from buildLevelFromGraph. */
export interface JacobotOptions {
  minThrowMs?: number;
  maxThrowMs?: number;
  bugDamage?: number;
}

/**
 * Jacobot — the robot boss on the last platform of level 2+.
 *
 * Stands in place, faces the player, and hurls random bug projectiles
 * on a randomised interval. Bugs arc ballistically toward the player's
 * current position (with a small random spread).
 *
 * If placed on a moving platform, pass the platform's physics image as
 * `anchorImg` so Jacobot tracks its horizontal drift each frame.
 *
 * Pass `options` to override throw timing and damage for higher levels.
 */
export class Jacobot {
  /** Visual sprite (non-physics — Jacobot doesn't move on his own). */
  readonly sprite: Phaser.GameObjects.Image;
  /** Live projectiles — add a physics overlap in GameScene to detect hits. */
  readonly bugs: Phaser.Physics.Arcade.Group;
  /** HP dealt per bug hit — read by GameScene for the overlap callback. */
  readonly bugDamage: number;

  private readonly scene: Phaser.Scene;
  private readonly player: Player;

  private readonly baseX: number;
  private readonly anchorImg: Phaser.Physics.Arcade.Image | undefined;
  private readonly anchorInitX: number;
  private readonly minThrowMs: number;
  private readonly maxThrowMs: number;

  private throwTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    player: Player,
    anchorImg?: Phaser.Physics.Arcade.Image,
    options?: JacobotOptions,
  ) {
    this.scene = scene;
    this.player = player;
    this.baseX = x;
    this.anchorImg = anchorImg;
    this.anchorInitX = anchorImg ? anchorImg.x : 0;
    this.minThrowMs = options?.minThrowMs ?? JACOBOT_MIN_THROW_MS;
    this.maxThrowMs = options?.maxThrowMs ?? JACOBOT_MAX_THROW_MS;
    this.bugDamage = options?.bugDamage ?? JACOBOT_BUG_DAMAGE;

    this.sprite = scene.add.image(x, y, "jacobot").setDepth(10);
    this.bugs = scene.physics.add.group();

    this.scheduleThrow();
  }

  update(): void {
    if (!this.sprite.active) return;

    // Track the moving platform this frame
    if (this.anchorImg) {
      this.sprite.x = this.baseX + (this.anchorImg.x - this.anchorInitX);
    }

    // Face toward the player
    this.sprite.setFlipX(this.player.sprite.x < this.sprite.x);
  }

  destroy(): void {
    this.throwTimer?.remove();
    this.throwTimer = null;
    this.bugs.clear(true, true);
    this.sprite.destroy();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private scheduleThrow(): void {
    const delay = Phaser.Math.Between(this.minThrowMs, this.maxThrowMs);
    this.throwTimer = this.scene.time.delayedCall(delay, () => {
      if (this.sprite.active) {
        this.throwBug();
        this.scheduleThrow();
      }
    });
  }

  private throwBug(): void {
    if (this.player.dead) return;
    const key = Phaser.Utils.Array.GetRandom(BUG_KEYS);
    const startX = this.sprite.x;
    const startY = this.sprite.y - 8; // thrown from roughly hand height

    // Ballistic calculation — arc to arrive near the player's current position.
    // Randomise flight time and add horizontal spread so throws aren't perfectly predictable.
    const flightTime = Phaser.Math.FloatBetween(JACOBOT_FLIGHT_TIME_MIN, JACOBOT_FLIGHT_TIME_MAX);
    const targetX = this.player.sprite.x + Phaser.Math.Between(-JACOBOT_SPREAD_X, JACOBOT_SPREAD_X);
    const targetY = this.player.sprite.y;

    const vx = Phaser.Math.Clamp((targetX - startX) / flightTime, -600, 600);
    const vy = (targetY - startY - 0.5 * GRAVITY * flightTime * flightTime) / flightTime;

    const bug = this.bugs.create(startX, startY, key) as Phaser.Physics.Arcade.Sprite;
    bug.setDepth(5).setScale(2);
    (bug.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
    bug.setAngularVelocity(Phaser.Math.Between(-200, 200));

    // Auto-despawn so stray bugs don't accumulate
    this.scene.time.delayedCall(4000, () => {
      if (bug.active) bug.destroy();
    });
  }
}
