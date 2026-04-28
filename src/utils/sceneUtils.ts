import Phaser from "phaser";

/**
 * Defers scene.start() to the next engine tick.
 *
 * Phaser's scene manager throws if scene.start() is called synchronously inside
 * a physics overlap, collider, or keyboard callback. Wrapping in a zero-delay
 * delayedCall lets the current update cycle finish first.
 */
export function deferSceneStart(scene: Phaser.Scene, key: string, data?: object): void {
  scene.time.delayedCall(0, () => scene.scene.start(key, data));
}

/**
 * Defers scene.restart() to the next engine tick.
 *
 * Use this instead of deferSceneStart(scene, scene.scene.key) when restarting
 * the current scene. scene.restart() uses Phaser's dedicated 'restart' op which
 * properly re-runs the full shutdown → physics-reset → create cycle.
 * deferSceneStart with the same key queues a 'stop' + 'start' pair — the SHUTDOWN
 * state that 'stop' leaves skips some reinitialization steps in 'start', which
 * breaks physics bodies and tweens on scenes with complex state (level 2+).
 */
export function deferSceneRestart(scene: Phaser.Scene): void {
  scene.time.delayedCall(0, () => scene.scene.restart());
}
