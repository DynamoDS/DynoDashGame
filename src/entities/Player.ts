import Phaser from "phaser";
import {
  PLAYER_SPEED,
  PLAYER_JUMP_VELOCITY,
  GAME_HEIGHT,
  PLAYER_FUEL_MAX,
  PLAYER_ROCKET_VELOCITY_Y,
  PLAYER_FUEL_DRAIN_PER_SEC,
  PLAYER_FUEL_RECHARGE_PER_SEC,
  COYOTE_MS,
  JUMP_BUFFER_MS,
} from "../config/GameConfig";
import { soundEngine } from "../audio/SoundEngine";
import { REG_FUEL, REG_HEALTH, REG_LEVEL_FALL_DEATH_Y } from "../config/registryKeys";

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey: Phaser.Input.Keyboard.Key;
  private shiftKey: Phaser.Input.Keyboard.Key;
  private flameEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Scratch for getBottomCenter → exhaust followOffset (avoid per-frame alloc). */
  private readonly exhaustAnchorScratch = new Phaser.Math.Vector2();
  private wasOnGround = true;
  private coyoteMs = 0;
  private jumpBufferMs = 0;
  isOnFireGround = false;
  /** Set by GameScene when the player is riding a wire connector. */
  onWire = false;
  health = 100;
  fuel = PLAYER_FUEL_MAX;
  private burnAccum = 0; // frame counter for flicker tint only
  private invincibleMs = 0; // ms of post-hit invincibility remaining
  frozen = false;
  private isDead = false;

  /** Returns true once die() has been called (fade-out tween may still be running). */
  get dead(): boolean {
    return this.isDead;
  }

  /** Typed shortcut — Arcade physics is always used for the player sprite. */
  private get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  /** Exposed for GameScene's wire-riding logic. */
  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body;
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, "player");
    this.sprite.setCollideWorldBounds(true);
    // Above tiles/platforms (depth 0) so rocket exhaust isn't drawn under the level
    this.sprite.setDepth(100);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.jumpKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
    this.shiftKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);

    this.flameEmitter = scene.add.particles(0, 0, "rocket_flame", {
      radial: false,
      lifespan: { min: 100, max: 240 },
      // No lateral spread — random speedX was reading as the plume “swinging” side to side
      speedX: 0,
      speedY: { min: 22, max: 78 },
      scale: { start: 0.22, end: 0.95 },
      alpha: { start: 1, end: 0 },
      rotate: 0,
      frequency: 7,
      quantity: 2,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xff3300, 0xff6600, 0xffaa33, 0xffdd88, 0xff4400],
      emitting: false,
      maxAliveParticles: 64,
    });
    this.flameEmitter.setDepth(99);
    this.flameEmitter.setScrollFactor(1);
    this.flameEmitter.startFollow(this.sprite, 0, 0, true);
  }

  freeze(): void {
    this.frozen = true;
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, 0);
  }

  unfreeze(): void {
    this.frozen = false;
    this.body.setAllowGravity(true);
  }

  knockback(): void {
    this.frozen = false;
    this.body.setAllowGravity(true);
    // Push backward (left) and slightly up so the player falls off the platform
    this.body.setVelocity(-280, -130);
  }

  /** Deal damage from a projectile hit. Includes invincibility frames to prevent rapid stacking. */
  takeDamage(amount: number): void {
    if (this.isDead || this.invincibleMs > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.scene.registry.set(REG_HEALTH, this.health);
    this.invincibleMs = 800;
    this.sprite.setTint(0xff4400);
    this.scene.time.delayedCall(200, () => {
      if (!this.isDead) this.sprite.clearTint();
    });
    // Brief upward impulse
    this.body.setVelocityY(-200);
    if (this.health <= 0) this.die();
  }

  update(): void {
    if (this.isDead) return;
    // Tick invincibility regardless of frozen/wire state
    this.invincibleMs = Math.max(0, this.invincibleMs - this.scene.game.loop.delta);
    if (this.frozen) return;

    // --- Die if fell below the level (see buildLevelFromGraph levelFallDeathY) ---
    const fallDeathY =
      (this.scene.registry.get(REG_LEVEL_FALL_DEATH_Y) as number | undefined) ?? GAME_HEIGHT + 16;
    if (this.sprite.y > fallDeathY) {
      this.die();
      return;
    }

    // Wire mode — movement is handled by GameScene
    if (this.onWire) {
      this.isOnFireGround = false;
      return;
    }

    // --- Burn damage on fire ground contact ---
    if (this.isOnFireGround) {
      this.burnAccum += 1;
      this.sprite.setTint(this.burnAccum % 6 < 3 ? 0xff3300 : 0xff8800);

      // Drain 1 HP per frame (~1.67 s to die at 60 fps)
      this.health = Math.max(0, this.health - 1);
      this.scene.registry.set(REG_HEALTH, this.health);

      if (this.health <= 0) {
        this.die();
        return;
      }
    } else {
      this.burnAccum = 0;
      this.sprite.clearTint();
    }
    this.isOnFireGround = false; // reset; collider will re-set next frame if still touching

    const delta = this.scene.game.loop.delta;
    const onGround = this.body.onFloor();

    if (onGround) {
      this.coyoteMs = COYOTE_MS;
    } else {
      this.coyoteMs = Math.max(0, this.coyoteMs - delta);
    }

    // Horizontal movement
    if (this.cursors.left.isDown) {
      this.sprite.setVelocityX(-PLAYER_SPEED);
      this.sprite.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.sprite.setVelocityX(PLAYER_SPEED);
      this.sprite.setFlipX(false);
    } else {
      this.sprite.setVelocityX(0);
    }

    // Jump — arrow up or space (buffer + coyote so seams while running don't eat inputs)
    const jumpJustPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.jumpKey);

    if (jumpJustPressed) {
      this.jumpBufferMs = JUMP_BUFFER_MS;
    } else {
      this.jumpBufferMs = Math.max(0, this.jumpBufferMs - delta);
    }

    const canJump = onGround || this.coyoteMs > 0;
    if (this.jumpBufferMs > 0 && canJump) {
      this.sprite.setVelocityY(PLAYER_JUMP_VELOCITY);
      this.jumpBufferMs = 0;
      this.coyoteMs = 0;
      soundEngine.playJump();
    }

    // Booster rockets: Shift + fuel → no gravity, steady climb; recharge on ground when idle
    const boosting = this.shiftKey.isDown && this.fuel > 0;
    if (boosting) {
      this.body.setAllowGravity(false);
      this.sprite.setVelocityY(PLAYER_ROCKET_VELOCITY_Y);
      const drain = (PLAYER_FUEL_DRAIN_PER_SEC * delta) / 1000;
      this.fuel = Math.max(0, this.fuel - drain);
      this.scene.registry.set(REG_FUEL, this.fuel);
    } else {
      this.body.setAllowGravity(true);
      if (onGround) {
        const gain = (PLAYER_FUEL_RECHARGE_PER_SEC * delta) / 1000;
        const next = Math.min(PLAYER_FUEL_MAX, this.fuel + gain);
        if (next !== this.fuel) {
          this.fuel = next;
          this.scene.registry.set(REG_FUEL, this.fuel);
        }
      }
    }

    // Squash & stretch on landing
    if (!this.wasOnGround && onGround) {
      this.sprite.setScale(1.3, 0.7);
      soundEngine.playLand();
    }
    if (this.sprite.scaleX !== 1) {
      this.sprite.setScale(
        Phaser.Math.Linear(this.sprite.scaleX, 1, 0.2),
        Phaser.Math.Linear(this.sprite.scaleY, 1, 0.2),
      );
    }

    // Rocket exhaust: after sprite scale is final this frame — feet = bottom-center in world space
    this.sprite.getBottomCenter(this.exhaustAnchorScratch);
    this.flameEmitter.followOffset.set(
      this.exhaustAnchorScratch.x - this.sprite.x,
      this.exhaustAnchorScratch.y - this.sprite.y,
    );
    this.flameEmitter.emitting = boosting;

    this.wasOnGround = onGround;
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.flameEmitter.emitting = false;
    this.flameEmitter.setScale(1);
    this.sprite.setVelocity(0, 0);
    soundEngine.playDeath();
    // Flash red → darken → fade out
    this.sprite.setTint(0xff3300);
    this.scene.time.delayedCall(120, () => this.sprite.setTint(0x222222));
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      delay: 200,
      duration: 400,
    });
  }
}
