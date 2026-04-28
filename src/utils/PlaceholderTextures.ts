import Phaser from "phaser";
import { DEFAULT_CHARACTER } from "../character/CharacterAppearance";
import { drawPlayerGraphics } from "../character/renderPlayerTexture";

/**
 * Generates all placeholder textures via Phaser's Graphics API.
 * Call once from PreloadScene.create() before starting GameScene.
 * Replace each generateTexture call with a real asset load when ready.
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Sky background (640×360 gradient blocks) ---
  g.clear();
  g.fillStyle(0x1a1a2e); g.fillRect(0,   0, 640, 120);
  g.fillStyle(0x16213e); g.fillRect(0, 120, 640, 120);
  g.fillStyle(0x0f3460); g.fillRect(0, 240, 640, 120);
  // stars
  g.fillStyle(0xffffff);
  const stars = [[40,20],[120,50],[200,16],[300,36],[400,10],[500,60],[580,24],[80,90],[260,80],[620,100]];
  for (const [x, y] of stars) { g.fillRect(x, y, 2, 2); }
  g.generateTexture("bg", 640, 360);

  // --- Ground tile 32×32 (fire) ---
  g.clear();
  g.fillStyle(0x8b0000); g.fillRect(0,  0, 32, 32);   // deep red base
  g.fillStyle(0xcc2200); g.fillRect(0,  8, 32, 24);   // red mid
  g.fillStyle(0xff4400); g.fillRect(0, 16, 32, 16);   // orange-red
  g.fillStyle(0xff6600); g.fillRect(0, 24, 32,  8);   // orange glow
  // flame tips
  g.fillStyle(0xff8800); g.fillRect( 2,  4,  4,  8);
  g.fillStyle(0xffaa00); g.fillRect( 2,  0,  2,  6);
  g.fillStyle(0xff8800); g.fillRect(10,  2,  4, 10);
  g.fillStyle(0xffcc00); g.fillRect(12,  0,  2,  4);
  g.fillStyle(0xff8800); g.fillRect(18,  4,  4,  8);
  g.fillStyle(0xffaa00); g.fillRect(18,  0,  2,  6);
  g.fillStyle(0xff8800); g.fillRect(26,  2,  4, 10);
  g.fillStyle(0xffcc00); g.fillRect(28,  0,  2,  4);
  g.generateTexture("tile_ground", 32, 32);

  // --- Safe ground tile 32×32 (grass/dirt, no fire) ---
  g.clear();
  g.fillStyle(0x5a3e2b); g.fillRect(0,  0, 32, 32);   // dirt
  g.fillStyle(0x4a7c59); g.fillRect(0,  0, 32,  8);   // grass top
  g.fillStyle(0x3d5a40); g.fillRect(0,  6, 32,  2);   // grass shadow
  g.fillStyle(0x6b4c33); g.fillRect(4, 12,  6,  4);   // dirt detail
  g.fillStyle(0x6b4c33); g.fillRect(18, 20,  6,  4);
  g.generateTexture("tile_ground_safe", 32, 32);

  // --- Platform tile 32×16 ---
  g.clear();
  g.fillStyle(0x7b5e3a); g.fillRect(0, 0, 32, 16);
  g.fillStyle(0x5a9e6b); g.fillRect(0, 0, 32,  6);
  g.fillStyle(0x4a7c59); g.fillRect(0, 4, 32,  2);
  g.generateTexture("tile_platform", 32, 16);

  // --- Player 24×32 (default hero + palette; builder can swap archetype) ---
  drawPlayerGraphics(g, 0, DEFAULT_CHARACTER);
  g.generateTexture("player", 24, 32);

  // --- Rocket flame particle (16×16 soft blob for ADD-blended exhaust) ---
  g.clear();
  g.fillStyle(0x666666);
  g.fillRect(0,  0, 16, 16);
  g.fillStyle(0xaaaaaa);
  g.fillRect(2,  2, 12, 12);
  g.fillStyle(0xdddddd);
  g.fillRect(4,  4,  8,  8);
  g.fillStyle(0xffffff);
  g.fillRect(6,  6,  4,  4);
  g.generateTexture("rocket_flame", 16, 16);

  // --- Coin 16×16 ---
  g.clear();
  g.fillStyle(0xffd700); g.fillRect( 4,  0,  8, 16);
  g.fillStyle(0xffd700); g.fillRect( 0,  4, 16,  8);
  g.fillStyle(0xffec6e); g.fillRect( 6,  2,  4, 12);   // shine
  g.fillStyle(0xffec6e); g.fillRect( 2,  6, 12,  4);
  g.fillStyle(0xcc9900); g.fillRect( 4,  4,  8,  8);   // inner shadow
  g.fillStyle(0xffd700); g.fillRect( 6,  6,  4,  4);
  g.generateTexture("coin", 16, 16);

  // --- Flag (goal) 22×48 ---
  g.clear();
  g.fillStyle(0xaaaaaa); g.fillRect( 6,  0,  4, 48);   // pole
  g.fillStyle(0xff4444); g.fillRect(10,  2, 12, 10);   // flag
  g.fillStyle(0xff6666); g.fillRect(10,  2, 12,  4);
  g.generateTexture("flag", 22, 48);

  // --- Cloud 64×32 ---
  g.clear();
  g.fillStyle(0xddeeff);
  g.fillRect(16, 16, 32, 16);
  g.fillRect( 8,  8, 48, 16);
  g.fillRect( 0,  8, 64, 16);
  g.fillRect( 8,  0, 32, 16);
  g.fillStyle(0xffffff);
  g.fillRect(16,  0, 16,  8);
  g.fillRect( 8,  8, 16,  8);
  g.generateTexture("cloud", 64, 32);

  // --- Node block 32×24 (Dynamo-style node visual) ---
  g.clear();
  g.fillStyle(0x1a3a5c); g.fillRect( 0,  0, 32, 24);   // dark body
  g.fillStyle(0x2980b9); g.fillRect( 2,  2, 28,  6);   // header bar
  g.fillStyle(0x5dade2); g.fillRect( 2,  2, 28,  4);   // header highlight
  g.fillStyle(0x154360); g.fillRect( 2,  8, 28, 14);   // body area
  g.fillStyle(0x5dade2); g.fillRect( 0,  8,  4,  4);   // left input port
  g.fillStyle(0x5dade2); g.fillRect(28,  8,  4,  4);   // right output port
  g.fillStyle(0xaed6f1); g.fillRect( 6, 12,  8,  2);   // node label line 1
  g.fillStyle(0x7fb3d3); g.fillRect( 6, 16, 14,  2);   // node label line 2
  g.fillStyle(0xffd700); g.fillRect(26, 18,  4,  4);   // output value dot
  g.generateTexture("node_block", 32, 24);

  // --- Jacob Small NPC 24×32 (white lab coat, glasses, dark hair) ---
  g.clear();
  // Lab coat body (white)
  g.fillStyle(0xeeeeee); g.fillRect( 2,  8, 20, 20);
  // Lapels / collar (light grey)
  g.fillStyle(0xcccccc); g.fillRect( 8,  8,  8, 10);
  // Head (skin)
  g.fillStyle(0xffcc88); g.fillRect( 4,  0, 16, 14);
  // Hair (dark brown)
  g.fillStyle(0x3a2000); g.fillRect( 4,  0, 16,  4);
  g.fillStyle(0x3a2000); g.fillRect( 4,  2,  2,  4); // left sideburn
  g.fillStyle(0x3a2000); g.fillRect(18,  2,  2,  4); // right sideburn
  // Glasses frames
  g.fillStyle(0x222222); g.fillRect( 4,  4,  8,  6);
  g.fillStyle(0x222222); g.fillRect(12,  4,  8,  6);
  // Lens tint (blue)
  g.fillStyle(0x88ccff); g.fillRect( 6,  6,  4,  4);
  g.fillStyle(0x88ccff); g.fillRect(14,  6,  4,  4);
  // Nose bridge
  g.fillStyle(0x222222); g.fillRect(10,  6,  2,  2);
  // Mouth (slight smile)
  g.fillStyle(0xcc7755); g.fillRect( 8, 10,  8,  2);
  // Legs (dark trousers)
  g.fillStyle(0x334466); g.fillRect( 2, 26,  8,  6);
  g.fillStyle(0x334466); g.fillRect(14, 26,  8,  6);
  g.generateTexture("npc_jacob", 24, 32);

  // --- Jacobot 24×32 (robot boss — metallic chassis, red glowing eyes, chest panel) ---
  g.clear();
  // Antenna tip (gold) + shaft (grey)
  g.fillStyle(0xffdd00); g.fillRect(11,  0,  2,  3);
  g.fillStyle(0x778899); g.fillRect(10,  2,  4,  2);
  // Head (metallic slate blue-grey)
  g.fillStyle(0x445566); g.fillRect( 4,  4, 16, 12);
  g.fillStyle(0x5a7090); g.fillRect( 4,  4, 16,  2); // forehead highlight
  // Red glowing eyes
  g.fillStyle(0xff2200); g.fillRect( 6,  8,  4,  3);
  g.fillStyle(0xff2200); g.fillRect(14,  8,  4,  3);
  g.fillStyle(0xff8888); g.fillRect( 7,  8,  2,  2); // left shine
  g.fillStyle(0xff8888); g.fillRect(15,  8,  2,  2); // right shine
  // Mouth grille (dark slots)
  g.fillStyle(0x223344); g.fillRect( 7, 13, 10,  2);
  g.fillStyle(0x4488aa); g.fillRect( 8, 13,  2,  2);
  g.fillStyle(0x4488aa); g.fillRect(11, 13,  2,  2);
  g.fillStyle(0x4488aa); g.fillRect(14, 13,  2,  2);
  // Neck connector
  g.fillStyle(0x334455); g.fillRect( 9, 16,  6,  2);
  // Body / torso
  g.fillStyle(0x334455); g.fillRect( 2, 18, 20,  8);
  g.fillStyle(0x223344); g.fillRect( 2, 22, 20,  1); // panel seam
  // Chest indicator (cyan light)
  g.fillStyle(0x4fc3f7); g.fillRect( 7, 19,  4,  3);
  g.fillStyle(0x88eeff); g.fillRect( 8, 19,  2,  2);
  // Shoulder bolts
  g.fillStyle(0x667788); g.fillRect( 2, 18,  3,  3);
  g.fillStyle(0x667788); g.fillRect(19, 18,  3,  3);
  // Legs
  g.fillStyle(0x2a3a4a); g.fillRect( 4, 26,  6,  6);
  g.fillStyle(0x2a3a4a); g.fillRect(14, 26,  6,  6);
  // Feet (wider than legs)
  g.fillStyle(0x1a2a3a); g.fillRect( 3, 30,  8,  2);
  g.fillStyle(0x1a2a3a); g.fillRect(13, 30,  8,  2);
  g.generateTexture("jacobot", 24, 32);

  // --- Bug: Beetle 16×16 (red shell, antennae, 6 legs) ---
  g.clear();
  g.fillStyle(0x222222); g.fillRect( 5,  0,  1,  2); g.fillRect(10,  0,  1,  2); // antennae
  g.fillStyle(0x550000); g.fillRect( 6,  1,  4,  1); // antennae base
  g.fillStyle(0x880000); g.fillRect( 5,  2,  6,  3); // head
  g.fillStyle(0xaa1111); g.fillRect( 2,  5, 12,  7); g.fillRect( 3, 12,  10, 2); g.fillRect( 4,  4,  8,  1); // shell
  g.fillStyle(0xcc2222); g.fillRect( 4,  6,  3,  3); // shell highlight
  g.fillStyle(0x660000); g.fillRect( 7,  5,  2,  9); // center split
  g.fillStyle(0x333333); g.fillRect( 0,  6,  3,  1); g.fillRect( 0,  8,  2,  1); g.fillRect( 0, 10,  3,  1); // left legs
  g.fillStyle(0x333333); g.fillRect(13,  6,  3,  1); g.fillRect(14,  8,  2,  1); g.fillRect(13, 10,  3,  1); // right legs
  g.generateTexture("bug_beetle", 16, 16);

  // --- Bug: Spider 16×16 (purple, 8 legs, red eyes) ---
  g.clear();
  g.fillStyle(0x220055); g.fillRect( 4,  1,  8,  5); g.fillRect( 3,  2, 10,  3); g.fillRect( 5,  0,  6,  1); // abdomen
  g.fillStyle(0x330066); g.fillRect( 6,  6,  4,  1); // waist
  g.fillStyle(0x4400aa); g.fillRect( 3,  7, 10,  5); g.fillRect( 4, 12,  8,  2); g.fillRect( 5, 14,  6,  1); // thorax
  g.fillStyle(0xff2200); g.fillRect( 5,  8,  2,  2); g.fillRect( 9,  8,  2,  2); // eyes
  g.fillStyle(0x222222); // legs
  g.fillRect( 0,  2,  3,  1); g.fillRect( 0,  4,  4,  1); // upper left
  g.fillRect(13,  2,  3,  1); g.fillRect(12,  4,  4,  1); // upper right
  g.fillRect( 0,  9,  3,  1); g.fillRect( 0, 11,  4,  1); // lower left
  g.fillRect(13,  9,  3,  1); g.fillRect(12, 11,  4,  1); // lower right
  g.generateTexture("bug_spider", 16, 16);

  // --- Bug: Fly 16×16 (teal body, blue wings, compound eyes) ---
  g.clear();
  g.fillStyle(0xaaddff); g.fillRect( 0,  4,  5,  4); g.fillRect(11,  4,  5,  4); // wings
  g.fillStyle(0x88bbdd); g.fillRect( 1,  5,  3,  2); g.fillRect(12,  5,  3,  2); // wing shading
  g.fillStyle(0x005544); g.fillRect( 5,  4,  6,  8); g.fillRect( 6,  3,  4,  9); g.fillRect( 7,  2,  2,  1); // body
  g.fillStyle(0x002233); g.fillRect( 5,  7,  6,  1); g.fillRect( 5,  9,  6,  1); // stripes
  g.fillStyle(0x007755); g.fillRect( 5,  1,  6,  3); g.fillRect( 6,  0,  4,  1); // head
  g.fillStyle(0x00ff44); g.fillRect( 5,  1,  2,  2); g.fillRect( 9,  1,  2,  2); // compound eyes
  g.fillStyle(0xaaffcc); g.fillRect( 5,  1,  1,  1); g.fillRect( 9,  1,  1,  1); // eye highlights
  g.generateTexture("bug_fly", 16, 16);

  g.destroy();
}

/** Header height on generated Dynamo node textures; keep in sync with buildLevel port math. */
export const DYNAMO_NODE_HEADER_H = 16;

/**
 * World Y offset from slab top to the center of port `slot` (0-based), matching
 * {@link generateDynamoNodeTexture} spacing (even distribution in the body below the header).
 */
export function dynamoPortCenterYFromTop(
  slot: number,
  portCount: number,
  heightPx: number = 48,
  headerH: number = DYNAMO_NODE_HEADER_H,
): number {
  const pc = Math.max(1, Math.floor(portCount));
  const s = Math.max(0, Math.min(pc - 1, Math.floor(slot)));
  const step = (heightPx - headerH) / (pc + 1);
  return Math.round(headerH + step * (s + 1));
}

/**
 * Generates a single Dynamo-node-styled texture at the given pixel dimensions.
 * Safe to call multiple times — skips generation if the key already exists.
 *
 * Visual anatomy (matches Dynamo UI conventions):
 *   ┌─ accent line (1px, category blue) ──────────────────────┐
 *   │  header bar (dark blue)                                   │
 *   ├───────────────────────────────────────────────────────────┤
 *   ▶  input port                      body (#2D2D2D)  output ◀│
 *   └───────────────────────────────────────────────────────────┘
 */
export function generateDynamoNodeTexture(
  scene: Phaser.Scene,
  key: string,
  widthPx: number,
  heightPx: number = 48,
  numInputs: number = 1,
  numOutputs: number = 1,
  red: boolean = false,
): void {
  if (scene.textures.exists(key)) return;

  const HEADER_H = DYNAMO_NODE_HEADER_H;
  const PORT_W = 10;
  const PORT_H = 10;

  const g = scene.make.graphics({ x: 0, y: 0, add: false } as Phaser.Types.GameObjects.Graphics.Options);

  // Body
  g.fillStyle(red ? 0x2d1a1a : 0x2d2d2d);
  g.fillRect(0, 0, widthPx, heightPx);

  // Header bar
  g.fillStyle(red ? 0x5c1a1a : 0x1a3a5c);
  g.fillRect(0, 0, widthPx, HEADER_H);

  // Header top accent
  g.fillStyle(red ? 0xd94a4a : 0x4a90d9);
  g.fillRect(0, 0, widthPx, 2);

  // Header / body separator
  g.fillStyle(0x3a3a3a);
  g.fillRect(0, HEADER_H, widthPx, 2);

  // Outer border
  g.lineStyle(2, red ? 0x5a2a2a : 0x454545);
  g.strokeRect(0, 0, widthPx, heightPx);

  // Input port triangles ▶ (left edge, pointing right into the node)
  const inputStep = (heightPx - HEADER_H) / (numInputs + 1);
  for (let i = 0; i < numInputs; i++) {
    const py = Math.round(HEADER_H + inputStep * (i + 1));
    g.fillStyle(red ? 0xf74f4f : 0x4fc3f7);
    g.fillTriangle(0, py - PORT_H / 2, 0, py + PORT_H / 2, PORT_W, py);
  }

  // Output port triangles ◀ (right edge, pointing left out of the node)
  const outputStep = (heightPx - HEADER_H) / (numOutputs + 1);
  for (let i = 0; i < numOutputs; i++) {
    const py = Math.round(HEADER_H + outputStep * (i + 1));
    g.fillStyle(red ? 0xc78484 : 0x81c784);
    g.fillTriangle(widthPx, py - PORT_H / 2, widthPx, py + PORT_H / 2, widthPx - PORT_W, py);
  }

  g.generateTexture(key, widthPx, heightPx);
  g.destroy();
}
