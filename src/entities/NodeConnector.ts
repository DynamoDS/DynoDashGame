import Phaser from "phaser";
import {
  WIRE_WARN_MS,
  WIRE_SLOPE_DX,
  WIRE_BEZIER_CONTROL_FACTOR,
  WIRE_BLINK_PERIOD_MS,
  WIRE_CURVE_SEGMENTS,
  WIRE_BREAK_FLASH_MS,
} from "../config/GameConfig";

/**
 * A Dynamo-style bezier wire between two node slabs.
 *
 * No physics body — GameScene constrains the player to the curve while riding.
 * The wire breaks after 2 s of continuous riding.
 *
 * Optional anchorA / anchorB allow endpoints to follow moving platforms:
 * the wire tracks the platform's X displacement each frame.
 */
export class NodeConnector {
  private gfx: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  // Backing fields (base positions, set at construction after optional swap)
  private _ax: number;
  private _ay: number;
  private _bx: number;
  private _by: number;

  // Optional moving-platform anchors
  private _anchorA: Phaser.Physics.Arcade.Image | undefined;
  private _anchorAInitX = 0;
  private _anchorB: Phaser.Physics.Arcade.Image | undefined;
  private _anchorBInitX = 0;

  /** Accumulated ms the player has been riding this wire (managed by GameScene). */
  standMs = 0;
  private broken = false;

  constructor(
    scene: Phaser.Scene,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    anchorA?: Phaser.Physics.Arcade.Image,
    anchorB?: Phaser.Physics.Arcade.Image,
  ) {
    this.scene = scene;
    // Bezier math assumes left → right; swap if the upstream node sits to the right in world space.
    if (ax > bx) {
      this._ax = bx;
      this._ay = by;
      this._bx = ax;
      this._by = ay;
      this._anchorA = anchorB;
      this._anchorAInitX = anchorB ? anchorB.x : 0;
      this._anchorB = anchorA;
      this._anchorBInitX = anchorA ? anchorA.x : 0;
    } else {
      this._ax = ax;
      this._ay = ay;
      this._bx = bx;
      this._by = by;
      this._anchorA = anchorA;
      this._anchorAInitX = anchorA ? anchorA.x : 0;
      this._anchorB = anchorB;
      this._anchorBInitX = anchorB ? anchorB.x : 0;
    }

    this.gfx = scene.add.graphics();
    this.redraw();
  }

  // ---------------------------------------------------------------------------
  // Dynamic endpoint accessors (follow moving platform anchors)
  // ---------------------------------------------------------------------------

  get ax(): number {
    return this._ax + (this._anchorA ? this._anchorA.x - this._anchorAInitX : 0);
  }

  get ay(): number {
    return this._ay;
  }

  get bx(): number {
    return this._bx + (this._anchorB ? this._anchorB.x - this._anchorBInitX : 0);
  }

  get by(): number {
    return this._by;
  }

  // ---------------------------------------------------------------------------
  // Curve helpers
  // ---------------------------------------------------------------------------

  /** Wire Y at a given world X, or null if X is outside the wire range. */
  getWireY(x: number): number | null {
    if (x < this.ax || x > this.bx) return null;
    const t = (x - this.ax) / (this.bx - this.ax);
    return this.evalY(t);
  }

  /** Slope (dy/dx) at a given world X. Positive = wire goes down on screen. */
  getSlopeAt(x: number): number {
    const dx = WIRE_SLOPE_DX;
    const y1 = this.getWireY(Math.max(this.ax, x - dx));
    const y2 = this.getWireY(Math.min(this.bx, x + dx));
    if (y1 === null || y2 === null) return 0;
    return (y2 - y1) / (2 * dx);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Redraw the visual wire (call every frame). Uses standMs for colour. */
  tick(): void {
    if (this.broken) return;
    this.redraw();
  }

  doBreak(): void {
    if (this.broken) return;
    this.broken = true;

    // Brief red flash then disappear
    this.gfx.clear();
    this.gfx.lineStyle(2, 0xff2200, 1);
    this.gfx.strokePoints(this.curvePoints(), false);

    this.scene.time.delayedCall(WIRE_BREAK_FLASH_MS, () => {
      if (this.gfx && this.gfx.active) this.gfx.destroy();
    });
  }

  get isBroken(): boolean {
    return this.broken;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Evaluate the bezier Y at parameter t ∈ [0, 1].
   * Control points: P0=(ax,ay), P1=(ax+cpd,ay), P2=(bx−cpd,by), P3=(bx,by)
   * Since P0.y == P1.y and P2.y == P3.y this simplifies to:
   *   y(t) = ay·(1−t)²·(1+2t)  +  by·t²·(3−2t)
   */
  private evalY(t: number): number {
    const s = 1 - t;
    return this.ay * s * s * (1 + 2 * t) + this.by * t * t * (3 - 2 * t);
  }

  private curvePoints(): Phaser.Math.Vector2[] {
    const cpd = (this.bx - this.ax) * WIRE_BEZIER_CONTROL_FACTOR;
    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(this.ax, this.ay),
      new Phaser.Math.Vector2(this.ax + cpd, this.ay),
      new Phaser.Math.Vector2(this.bx - cpd, this.by),
      new Phaser.Math.Vector2(this.bx, this.by),
    );
    return curve.getPoints(WIRE_CURVE_SEGMENTS);
  }

  private redraw(): void {
    this.gfx.clear();

    let color = 0x4fc3f7; // default Dynamo wire blue
    let alpha = 1.0;

    if (this.standMs >= WIRE_WARN_MS) {
      color = 0xff6600;
      alpha = Math.floor(this.standMs / WIRE_BLINK_PERIOD_MS) % 2 === 0 ? 1.0 : 0.35;
    } else if (this.standMs > 0) {
      color = 0x80d8ff; // slightly brighter while riding
    }

    this.gfx.lineStyle(1, color, alpha);
    this.gfx.strokePoints(this.curvePoints(), false);
  }
}
