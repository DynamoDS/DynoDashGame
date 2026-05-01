import Phaser from "phaser";
import { PLAYER_FUEL_MAX, PLAYER_JUMP_VELOCITY, WIRE_SPEED, WIRE_GRAVITY, WIRE_BREAK_MS, INTRO_PAN_OUT_MS, INTRO_PAUSE_MS, INTRO_RETURN_MS, INTRO_ZOOM_OUT } from "../config/GameConfig";
import { REG_DYN_EDGES, REG_DYN_NODES, REG_FUEL, REG_HEALTH, REG_HIGH_SCORE, REG_LEVEL, REG_LIVES, REG_SCORE } from "../config/registryKeys";
import { Player } from "../entities/Player";
import { parseLevelGraph } from "../level-graph/graph";
import { deferSceneStart, deferSceneRestart } from "../utils/sceneUtils";
import { buildLevelFromGraph } from "../levels/buildLevelFromGraph";
import type { NodeConnector } from "../entities/NodeConnector";
import type { DynNode, DynWireEdge } from "../dyn/types";
import { soundEngine } from "../audio/SoundEngine";
import { TriviaSystem } from "../trivia/TriviaSystem";
import type { Jacobot } from "../entities/Jacobot";

const LEVEL_CACHE_KEY = "level_example";

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private coins!: Phaser.Physics.Arcade.StaticGroup;
  private connectors: NodeConnector[] = [];
  private activeConnector: NodeConnector | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private triviaSystem!: TriviaSystem;
  private escKey?: Phaser.Input.Keyboard.Key;
  private jacobot: Jacobot | null = null;
  private transitioning = false;
  private wireBreakMs = WIRE_BREAK_MS;
  private deathElapsedMs = 0;
  private spawnX = 0;
  private spawnY = 0;
  private introPhase: "pan-out" | "pause" | "pan-back" | "done" = "done";
  private introElapsed = 0;
  private goalX = 0;
  private goalY = 0;
  /** Cooldown after a Jacobot body-bump so one touch doesn't re-trigger every frame. */
  private jacobotBumpCooldownMs = 0;
  score = 0;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.score = (this.registry.get(REG_SCORE) as number) ?? 0;
    this.transitioning = false;
    this.deathElapsedMs = 0;
    this.jacobotBumpCooldownMs = 0;
    this.registry.set(REG_HEALTH, 100);
    this.activeConnector = null;
    this.registry.set(REG_FUEL, PLAYER_FUEL_MAX);
    soundEngine.resume();
    soundEngine.startMusic();

    this.events.once("shutdown", this.cleanup, this);

    const raw = this.cache.json.get(LEVEL_CACHE_KEY) as unknown;
    let graph;
    try {
      graph = parseLevelGraph(raw);
    } catch (e) {
      console.error("Failed to parse level graph — check levels/example-level.json", e);
      this.add.text(10, 10, "Level load error — see console", { fontSize: "14px", color: "#ff4444" });
      return;
    }

    const dynNodes = this.registry.get(REG_DYN_NODES) as DynNode[] | undefined;
    const dynEdges = this.registry.get(REG_DYN_EDGES) as DynWireEdge[] | undefined;
    const level = (this.registry.get(REG_LEVEL) as number) ?? 1;
    // Wire break threshold shortens by 200 ms per level above 2, floored at 800 ms
    this.wireBreakMs = Math.max(800, WIRE_BREAK_MS - Math.max(0, level - 2) * 200);
    const built = buildLevelFromGraph(this, graph, dynNodes, dynEdges, undefined, level);

    this.player = built.player;
    this.spawnX = built.spawnX;
    this.spawnY = built.spawnY;
    this.coins = built.coins;
    this.connectors = built.connectors;
    this.jacobot = built.jacobot ?? null;
    this.triviaSystem = new TriviaSystem(this, this.player);

    this.goalX = built.flag.x;
    this.goalY = built.flag.y;
    this.introPhase = "pan-out";
    this.introElapsed = 0;
    this.player.freeze();
    const cam = this.cameras.main;
    cam.centerOn(this.spawnX, this.spawnY);
    cam.pan(this.goalX, this.goalY, INTRO_PAN_OUT_MS, "Sine.easeInOut");
    cam.zoomTo(INTRO_ZOOM_OUT, INTRO_PAN_OUT_MS, "Sine.easeInOut");

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Flag — registered first so it takes priority over same-frame death events.
    // Guard against dead-player physics bodies drifting into the flag after death.
    this.physics.add.overlap(this.player.sprite, built.flag, () => {
      if (this.transitioning || this.player.dead) return;
      this.transitioning = true;
      // Destroy Jacobot immediately so its throw timer and any in-flight bugs
      // cannot call player.die() between now and the scene transition.  If
      // die() fires its onComplete during GameScene teardown it leaves the
      // engine in a state where GameScene is gone but WinScene never fully
      // initialises — producing the level-2 freeze.
      this.jacobot?.destroy();
      this.jacobot = null;
      soundEngine.stopMusic();
      deferSceneStart(this, "WinScene");
    });

    // Jacobot fruit hits — registered after flag so flag wins on same-frame collisions
    if (this.jacobot) {
      this.physics.add.overlap(
        this.player.sprite,
        this.jacobot.bugs,
        (_player, bug) => {
          if (this.transitioning || this.introPhase !== "done") return;
          (bug as Phaser.Physics.Arcade.Sprite).destroy();
          this.player.takeDamage(this.jacobot?.bugDamage ?? 25);
        },
      );
    }

    // Fire ground — player burns on contact
    this.physics.add.collider(this.player.sprite, built.fireGround, () => {
      this.player.isOnFireGround = true;
    });

    this.physics.add.overlap(
      this.player.sprite,
      this.coins,
      (_player, coin) => {
        if (this.introPhase !== "done") return;
        const c = coin as Phaser.Physics.Arcade.Sprite;
        const cx = c.x;
        const cy = c.y;
        c.destroy();
        this.score += 10;
        this.registry.set(REG_SCORE, this.score);
        soundEngine.playCoin();
        this.triviaSystem.onNodeCollected(cx, cy);
      },
    );

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on("down", this.onEscToMenu, this);

    // Launch UIScene — if already running it's a no-op; if stopped it starts fresh
    this.scene.launch("UIScene");
  }

  private onEscToMenu(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.detachFromWire();
    deferSceneStart(this, "MenuScene");
  }

  private cleanup(): void {
    this.detachFromWire();
    this.escKey?.off("down", this.onEscToMenu, this);
    this.escKey = undefined;
    soundEngine.stopMusic();
    this.triviaSystem?.destroy();
    this.jacobot?.destroy();
    this.jacobot = null;
  }

  private handleDeath(): void {
    this.transitioning = true;
    // Destroy Jacobot immediately — same guard as the flag overlap handler.
    // Jacobot's throw timer fires on a randomised interval; if it fires during
    // scene shutdown it can corrupt the restart, causing the level-2+ freeze.
    this.jacobot?.destroy();
    this.jacobot = null;
    const lives = Math.max(0, ((this.registry.get(REG_LIVES) as number) ?? 3) - 1);
    this.registry.set(REG_LIVES, lives);

    if (lives > 0) {
      this.registry.set(REG_SCORE, 0);
      deferSceneRestart(this);
    } else {
      const prev = parseInt(localStorage.getItem("highScore") ?? "0", 10);
      const highScore = Math.max(this.score, prev);
      localStorage.setItem("highScore", String(highScore));
      this.registry.set(REG_HIGH_SCORE, highScore);
      deferSceneStart(this, "GameOverScene", { score: this.score, highScore });
    }
  }

  update(): void {
    if (this.transitioning) return;

    const delta = this.game.loop.delta;

    // Poll for player death before the intro early-return so that a death
    // triggered during the intro (e.g. fire ground) is still handled correctly.
    if (this.player.dead) {
      this.deathElapsedMs += delta;
      if (this.deathElapsedMs >= 600) {
        this.handleDeath();
      }
      return;
    }
    this.deathElapsedMs = 0;

    if (this.introPhase !== "done") {
      this.introElapsed += delta;
      if (this.introPhase === "pan-out" && this.introElapsed >= INTRO_PAN_OUT_MS) {
        this.introPhase = "pause";
      } else if (this.introPhase === "pause" && this.introElapsed >= INTRO_PAN_OUT_MS + INTRO_PAUSE_MS) {
        this.introPhase = "pan-back";
        this.cameras.main.pan(this.spawnX, this.spawnY, INTRO_RETURN_MS, "Sine.easeInOut");
        this.cameras.main.zoomTo(1, INTRO_RETURN_MS, "Sine.easeInOut");
      } else if (
        this.introPhase === "pan-back" &&
        this.introElapsed >= INTRO_PAN_OUT_MS + INTRO_PAUSE_MS + INTRO_RETURN_MS
      ) {
        this.introPhase = "done";
        this.player.unfreeze();
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
      }
      return;
    }

    this.player.update();
    this.jacobot?.update();

    // ── Jacobot body-bump — touching the boss teleports the player back to start ─
    if (this.jacobot) {
      this.jacobotBumpCooldownMs = Math.max(0, this.jacobotBumpCooldownMs - delta);
      if (this.jacobotBumpCooldownMs === 0) {
        const dx = this.player.sprite.x - this.jacobot.sprite.x;
        const dy = this.player.sprite.y - this.jacobot.sprite.y;
        if (dx * dx + dy * dy < 28 * 28) {
          this.detachFromWire();
          this.player.sprite.setPosition(this.spawnX, this.spawnY);
          this.player.arcadeBody.setVelocity(0, 0);
          this.jacobotBumpCooldownMs = 1500;
          soundEngine.playDeath();
        }
      }
    }
    const sprite = this.player.sprite;
    const body = this.player.arcadeBody;

    // ── Wire riding ────────────────────────────────────────────────────────
    if (this.activeConnector) {
      const conn = this.activeConnector;

      const jumpPressed =
        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.spaceKey);

      if (jumpPressed) {
        this.detachFromWire();
        body.setVelocityY(PLAYER_JUMP_VELOCITY);
      } else if (conn.isBroken) {
        this.detachFromWire();
      } else {
        const slope = conn.getSlopeAt(sprite.x);
        let dir = 0;
        if (this.cursors.right.isDown) dir = 1;
        else if (this.cursors.left.isDown) dir = -1;

        const speedX = WIRE_SPEED * dir + slope * WIRE_GRAVITY;
        const newX = sprite.x + (speedX * delta) / 1000;
        const wireY = conn.getWireY(newX);

        if (wireY === null) {
          this.detachFromWire();
          body.setVelocityX(speedX);
        } else {
          sprite.setPosition(newX, wireY - body.halfHeight);
          body.velocity.x = 0;
          body.velocity.y = 0;
          if (speedX > 1) sprite.setFlipX(false);
          else if (speedX < -1) sprite.setFlipX(true);

          conn.standMs += delta;
          if (conn.standMs >= this.wireBreakMs) {
            conn.doBreak();
            this.detachFromWire();
          }
        }
      }
    } else {
      if (body.velocity.y >= -30) {
        const playerBottom = sprite.y + body.halfHeight;
        for (const conn of this.connectors) {
          if (conn.isBroken) continue;
          const wireY = conn.getWireY(sprite.x);
          if (wireY === null) continue;
          if (playerBottom >= wireY - 4 && playerBottom <= wireY + 8) {
            this.attachToWire(conn);
            break;
          }
        }
      }
    }

    for (const conn of this.connectors) {
      if (!conn.isBroken) conn.tick();
    }
  }

  private attachToWire(conn: NodeConnector): void {
    this.activeConnector = conn;
    this.player.onWire = true;
    this.player.arcadeBody.allowGravity = false;
    this.player.arcadeBody.setVelocity(0, 0);
    soundEngine.startWireSlide();
  }

  private detachFromWire(): void {
    if (!this.activeConnector) return;
    this.activeConnector.standMs = 0;
    this.activeConnector = null;
    this.player.onWire = false;
    this.player.arcadeBody.allowGravity = true;
    soundEngine.stopWireSlide();
  }
}
