import Phaser from "phaser";
import type { CharacterAppearance } from "./CharacterAppearance";
import type { PlayerArchetypeId } from "./PlayerArchetype";

const PLAYER_W = 24;
const PLAYER_H = 32;

/**
 * Trygve — cross-country skier (original pixel art).
 * bodyColor = jacket + beanie, skinColor = face, legsColor = ski pants.
 */
function drawTrygve(g: Phaser.GameObjects.Graphics, a: CharacterAppearance): void {
  const ski = 0xd4e4ee;
  const skiEdge = 0x9eb8c8;
  const pole = 0x5a6570;
  const boot = 0x1e1e24;
  const goggle = 0x2a4a66;
  const glove = 0xf2f2f2;

  g.clear();
  // Skis (parallel planks + snow strip between)
  g.fillStyle(skiEdge);
  g.fillRect(0, 30, 24, 2);
  g.fillStyle(ski);
  g.fillRect(0, 28, 10, 4);
  g.fillRect(14, 28, 10, 4);

  g.fillStyle(boot);
  g.fillRect(4, 24, 4, 4);
  g.fillRect(16, 24, 4, 4);

  g.fillStyle(a.legsColor);
  g.fillRect(4, 18, 4, 8);
  g.fillRect(16, 18, 4, 8);
  g.fillRect(8, 20, 8, 6);

  g.fillStyle(pole);
  g.fillRect(0, 12, 2, 18);
  g.fillRect(22, 12, 2, 18);

  g.fillStyle(a.bodyColor);
  g.fillRect(4, 10, 16, 10);
  g.fillRect(6,  8, 12,  4);

  g.fillStyle(glove);
  g.fillRect(2, 12, 4, 4);
  g.fillRect(18,12, 4, 4);

  g.fillStyle(a.skinColor);
  g.fillRect(6, 4, 12, 8);

  g.fillStyle(goggle);
  g.fillRect(6, 6, 12, 2);

  g.fillStyle(0x111133);
  g.fillRect(8, 8, 2, 2);
  g.fillRect(14,8, 2, 2);

  g.fillStyle(a.bodyColor);
  g.fillRect(6, 0, 12, 4);
}

/**
 * Aaron — slim plumber-style silhouette (original pixel art; not Nintendo IP).
 * bodyColor = cap + shirt, skinColor = face, legsColor = overalls + leg fill.
 * Hair / stache / shoes use black & cool neutrals (no brown).
 */
function drawAaron(g: Phaser.GameObjects.Graphics, a: CharacterAppearance): void {
  const cap = a.bodyColor;
  const face = a.skinColor;
  const overalls = a.legsColor;
  const hairBlack = 0x000000;
  const stache = 0x1a1a22;
  const shoe = 0x252530;
  const eyeDark = 0x1a1a1a;
  const glove = 0xf5f5f5;

  g.clear();
  g.fillStyle(cap);
  g.fillRect(8,  0,  8,  2);
  g.fillRect(6,  2, 12,  4);
  g.fillRect(8,  6,  8,  2);

  g.fillStyle(hairBlack);
  g.fillRect(6,  4,  2,  6);
  g.fillRect(16, 4,  2,  6);

  g.fillStyle(face);
  g.fillRect(8,  6,  8, 10);

  g.fillStyle(eyeDark);
  g.fillRect(8, 10,  4,  4);
  g.fillRect(12,10,  4,  4);
  g.fillStyle(glove);
  g.fillRect(8, 10,  2,  2);
  g.fillRect(14,10,  2,  2);

  g.fillStyle(stache);
  g.fillRect(8, 14,  8,  4);

  g.fillStyle(cap);
  g.fillRect(4, 18,  2,  8);
  g.fillRect(18,18,  2,  8);

  g.fillStyle(overalls);
  g.fillRect(8, 18,  8, 10);
  g.fillRect(6, 24, 12,  6);

  g.fillStyle(glove);
  g.fillRect(10,20,  2,  2);
  g.fillRect(12,20,  2,  2);
  g.fillRect(2, 22,  2,  4);
  g.fillRect(20,22,  2,  4);

  g.fillStyle(overalls);
  g.fillRect(8, 28,  4,  4);
  g.fillRect(16,28,  4,  4);

  g.fillStyle(shoe);
  g.fillRect(6, 30,  6,  2);
  g.fillRect(12,30,  6,  2);
}

/**
 * Ashish — hoodie + glasses (open face, maker vibe).
 * bodyColor = hoodie, skinColor = face, legsColor = pants.
 */
function drawAshish(g: Phaser.GameObjects.Graphics, a: CharacterAppearance): void {
  g.clear();
  g.fillStyle(a.bodyColor);
  g.fillRect(4,  0, 16,  8);
  g.fillRect(2,  6, 20,  4);
  g.fillRect(4, 14, 16, 12);
  g.fillRect(2, 16,  4,  8);
  g.fillRect(18,16,  4,  8);

  g.fillStyle(a.skinColor);
  g.fillRect(6,  6, 12, 10);

  g.fillStyle(0x2a2a38);
  g.fillRect(6, 10, 12,  2);
  g.fillStyle(0x111133);
  g.fillRect(6, 12,  4,  4);
  g.fillRect(14,12,  4,  4);
  g.fillStyle(0xffffff);
  g.fillRect(8, 12,  2,  2);
  g.fillRect(16,12,  2,  2);

  g.fillStyle(a.legsColor);
  g.fillRect(6, 24, 12,  4);
  g.fillRect(4, 26,  6,  6);
  g.fillRect(14,26,  6,  6);
}

/**
 * Achintya — broad shoulders, tank; long dark hair (crown, bangs, side locks).
 * bodyColor = top, skinColor = face + arms, legsColor = shorts / legs.
 */
function drawAchintya(g: Phaser.GameObjects.Graphics, a: CharacterAppearance): void {
  const hairBlack = 0x000000;

  g.clear();
  g.fillStyle(a.bodyColor);
  g.fillRect(4, 14, 16, 12);

  g.fillStyle(a.skinColor);
  g.fillRect(4,  4, 16, 12);
  g.fillRect(0, 16,  4,  8);
  g.fillRect(20,16,  4,  8);

  g.fillStyle(hairBlack);
  g.fillRect(4,  0, 16,  8);
  g.fillRect(0,  6,  4, 18);
  g.fillRect(20, 6,  4, 18);

  g.fillStyle(0x111133);
  g.fillRect(6, 10,  4,  4);
  g.fillRect(14,10,  4,  4);
  g.fillStyle(0xffffff);
  g.fillRect(8, 10,  2,  2);
  g.fillRect(16,10,  2,  2);

  g.fillStyle(a.skinColor);
  g.fillRect(0, 16,  4,  8);
  g.fillRect(20,16,  4,  8);

  g.fillStyle(a.legsColor);
  g.fillRect(4, 24,  6,  8);
  g.fillRect(14,24,  6,  8);
}

/**
 * Misha — tall frame, hair volume, rectangular glasses.
 * bodyColor = top + hair accent, skinColor = face, legsColor = pants.
 */
function drawMisha(g: Phaser.GameObjects.Graphics, a: CharacterAppearance): void {
  g.clear();
  g.fillStyle(a.bodyColor);
  g.fillRect(8,  2,  8,  6);
  g.fillStyle(a.skinColor);
  g.fillRect(6,  8, 12, 12);

  g.fillStyle(0x1a1a2e);
  g.fillRect(6, 12, 12,  2);

  g.fillStyle(0x111133);
  g.fillRect(8, 14,  4,  4);
  g.fillRect(14,14,  4,  4);
  g.fillStyle(0xffffff);
  g.fillRect(8, 14,  2,  2);
  g.fillRect(16,14,  2,  2);

  g.fillStyle(a.bodyColor);
  g.fillRect(6, 20, 12,  6);
  g.fillStyle(a.legsColor);
  g.fillRect(6, 26,  4,  6);
  g.fillRect(14,26,  4,  6);
}

export function drawPlayerGraphics(
  g: Phaser.GameObjects.Graphics,
  archetypeId: PlayerArchetypeId,
  appearance: CharacterAppearance,
): void {
  switch (archetypeId) {
    case 0:
      drawAchintya(g, appearance);
      break;
    case 1:
      drawTrygve(g, appearance);
      break;
    case 2:
      drawAaron(g, appearance);
      break;
    case 3:
      drawAshish(g, appearance);
      break;
    case 4:
      drawMisha(g, appearance);
      break;
  }
}

/**
 * Replaces the global `player` texture. Any sprite using the old texture must be destroyed first.
 */
export function regeneratePlayerTexture(
  scene: Phaser.Scene,
  archetypeId: PlayerArchetypeId,
  appearance: CharacterAppearance,
): void {
  if (scene.textures.exists("player")) {
    scene.textures.remove("player");
  }
  const g = scene.make.graphics({ x: 0, y: 0 });
  drawPlayerGraphics(g, archetypeId, appearance);
  g.generateTexture("player", PLAYER_W, PLAYER_H);
  g.destroy();
}

export const PLAYER_TEXTURE_SIZE = { width: PLAYER_W, height: PLAYER_H };
