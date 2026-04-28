import Phaser from "phaser";
import {
  DYN_LAYOUT_GRAPH_SPAN_PX,
  DYN_LAYOUT_TILE_Y_MAX,
  DYN_LAYOUT_TILE_Y_MIN,
  DYN_LAYOUT_X_SCALE,
  DYN_LAYOUT_Y_SCALE,
  GAME_HEIGHT,
  GAME_WIDTH,
  JACOBOT_MIN_THROW_MS,
  JACOBOT_MAX_THROW_MS,
  LEVEL_FALL_BELOW_GROUND_PX,
  LEVEL_GROUND_GAP_PX,
  TILE_SIZE,
  WORLD_TOP_Y,
} from "../config/GameConfig";
import { REG_LEVEL_FALL_DEATH_Y } from "../config/registryKeys";
import type { GraphNode, LevelGraph } from "../level-graph/types";
import { validateLevelGraph } from "../level-graph/graph";
import { Player } from "../entities/Player";
import { isRecord, normalizeDynNodeId, type DynNode, type DynWireEdge } from "../dyn/types";
import { dynamoPortCenterYFromTop, generateDynamoNodeTexture } from "../utils/PlaceholderTextures";
import { NodeConnector } from "../entities/NodeConnector";
import { Jacobot, JACOBOT_BUG_DAMAGE } from "../entities/Jacobot";

export interface BuiltLevel {
  worldWidth: number;
  player: Player;
  /** World-space spawn position (centre of the leftmost platform). */
  spawnX: number;
  spawnY: number;
  coins: Phaser.Physics.Arcade.StaticGroup;
  fireGround: Phaser.Physics.Arcade.StaticGroup;
  safeGround: Phaser.Physics.Arcade.StaticGroup;
  connectors: NodeConnector[];
  flag: Phaser.Physics.Arcade.Image;
  movingPlatforms: Phaser.Physics.Arcade.Image[];
  jacobot?: Jacobot;
}

/** Optional overrides when building a level (see {@link LEVEL_GROUND_GAP_PX} for the default gap). */
export interface BuildLevelOptions {
  /**
   * Gap from lowest node / collectibles / goal bottom to top of ground tiles (px).
   * Ignored if the graph’s `level_meta` sets `lowestNodeToFloorGapPx`.
   */
  lowestNodeToFloorGapPx?: number;
}

function expectNumber(props: Record<string, unknown>, key: string, nodeId: string): number {
  const v = props[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new TypeError(`Node "${nodeId}": props.${key} must be a finite number`);
  }
  return v;
}

function expectNumberArray(props: Record<string, unknown>, key: string, nodeId: string): number[] {
  const v = props[key];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "number" && Number.isFinite(x))) {
    throw new TypeError(`Node "${nodeId}": props.${key} must be an array of finite numbers`);
  }
  return v as number[];
}

function expectSegmentTuple(
  raw: unknown,
  nodeId: string,
  index: number,
): [number, number, number] {
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new TypeError(`Node "${nodeId}": segments[${index}] must be [tileX, tileY, widthTiles]`);
  }
  const [a, b, c] = raw;
  if (
    typeof a !== "number" ||
    typeof b !== "number" ||
    typeof c !== "number" ||
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c)
  ) {
    throw new TypeError(`Node "${nodeId}": segments[${index}] must be numeric`);
  }
  return [a, b, c];
}

function expectPositionTuple(raw: unknown, nodeId: string, index: number): [number, number] {
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new TypeError(`Node "${nodeId}": positions[${index}] must be [x, y]`);
  }
  const [x, y] = raw;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`Node "${nodeId}": positions[${index}] must be numeric`);
  }
  return [x, y];
}

function propsOf(node: GraphNode): Record<string, unknown> {
  const p = node.props;
  if (p === undefined) {
    return {};
  }
  if (!isRecord(p)) {
    throw new TypeError(`Node "${node.id}": props must be an object`);
  }
  return p;
}

const PLATFORM_MIN_TILES = 3;
const PLATFORM_MAX_TILES = 6;
const NODE_H = 48; // Dynamo node slab height in pixels (must match usage below)
/** Top header strip on the slab; must match `HEADER_H` in generateDynamoNodeTexture. */
const NODE_HEADER_H = 16;

/**
 * Approximate pixels per character at the 10 px header font (conservative sans-serif average).
 * Used to size platform slabs to fit their node label without clipping.
 */
const HEADER_CHAR_PX = 7;
/** Total horizontal label padding (left + right) accounted for when sizing slabs. */
const LABEL_PAD_PX = 8;

type PlatformEntry = {
  seg: [number, number, number];
  name: string;
  collectX: number;
  collectY: number;
  /** Dyn layouts: world Y of slab top in px (continuous; avoids stacking many nodes on one tile row). */
  slabTopYPx?: number;
  /** Fan-in / fan-out from `dynEdges`; drives port triangles on the slab texture. */
  numInputs?: number;
  numOutputs?: number;
};

function attachDynPortCountsFromEdges(
  layout: PlatformEntry[],
  dynNodes: DynNode[],
  edges: DynWireEdge[],
): void {
  const idToIndex = new Map<string, number>();
  dynNodes.forEach((n, i) => idToIndex.set(normalizeDynNodeId(n.id), i));
  const ins = new Array(layout.length).fill(0);
  const outs = new Array(layout.length).fill(0);
  for (const e of edges) {
    const fi = idToIndex.get(e.fromNodeId);
    const ti = idToIndex.get(e.toNodeId);
    if (fi === undefined || ti === undefined || fi === ti) continue;
    outs[fi] += 1;
    ins[ti] += 1;
  }
  for (let i = 0; i < layout.length; i += 1) {
    layout[i].numInputs = Math.max(1, ins[i]);
    layout[i].numOutputs = Math.max(1, outs[i]);
  }
}

/**
 * Derive one platform slab per Dynamo node.
 *
 * Expects {@link DynNode} `x`/`y` to already be filled from `View.NodeViews` in `parseDynFile`
 * (Dynamo does not put canvas X/Y on `Nodes[]` entries themselves).
 *
 * Horizontal: `minX`…`maxX` is normalised to `DYN_LAYOUT_GRAPH_SPAN_PX * DYN_LAYOUT_X_SCALE` world px
 * (same baseline span as vertical; tune in {@link GameConfig}).
 * Vertical: `minY`…`maxY` into tile rows {@link DYN_LAYOUT_TILE_Y_MIN}–{@link DYN_LAYOUT_TILE_Y_MAX}
 * band, scaled by `DYN_LAYOUT_GRAPH_SPAN_PX * DYN_LAYOUT_Y_SCALE` for continuous slab tops.
 *
 * **Order** matches the `Nodes[]` array in the .dyn file (no re-sorting).
 */
function dynNodesToPlatformLayout(
  nodes: DynNode[],
  safeGroundCols: number,
): { platforms: PlatformEntry[]; worldWidth: number } {
  if (nodes.length === 0) return { platforms: [], worldWidth: 2560 };

  const xs = nodes.map((n) => n.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rangeX = maxX - minX || 1;
  const startLeftPx = (safeGroundCols + 1) * TILE_SIZE;

  const ys = nodes.map((n) => n.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;

  const tileYMin = DYN_LAYOUT_TILE_Y_MIN;
  const tileYMax = DYN_LAYOUT_TILE_Y_MAX;
  const bandTopMinPx = tileYMin * TILE_SIZE;
  const bandSpanPx = DYN_LAYOUT_GRAPH_SPAN_PX * DYN_LAYOUT_Y_SCALE;
  const horizSpanPx = DYN_LAYOUT_GRAPH_SPAN_PX * DYN_LAYOUT_X_SCALE;

  const platforms: PlatformEntry[] = [];
  let maxRightPx = startLeftPx;

  for (const n of nodes) {
    const tX = (n.x - minX) / rangeX;
    const leftPx = startLeftPx + tX * horizSpanPx;
    const tileX = Math.round(leftPx / TILE_SIZE);
    const tY = (n.y - minY) / rangeY;
    const slabTopY = bandTopMinPx + tY * bandSpanPx;
    const tileY = Math.round(slabTopY / TILE_SIZE);
    const labelLen = shortName(n.name).length;
    const wTiles = Math.min(
      PLATFORM_MAX_TILES,
      Math.max(PLATFORM_MIN_TILES, Math.ceil((labelLen * HEADER_CHAR_PX + LABEL_PAD_PX) / TILE_SIZE)),
    );
    const platformWPx = wTiles * TILE_SIZE;
    const slabCenterX = leftPx + platformWPx / 2;
    platforms.push({
      seg: [tileX, Math.min(tileYMax, Math.max(tileYMin, tileY)), wTiles],
      name: n.name,
      collectX: slabCenterX,
      collectY: slabTopY - 16,
      slabTopYPx: slabTopY,
    });
    maxRightPx = Math.max(maxRightPx, leftPx + platformWPx);
  }

  const worldWidth = Math.max(2560, maxRightPx + 160);
  return { platforms, worldWidth };
}

/** Strip Dynamo-style namespace prefix for display. */
function shortName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : name;
}

/**
 * Spawns world content from a validated {@link LevelGraph}. Known node types:
 * - `level_meta` — worldWidth, optional cloudPositions[], optional lowestNodeToFloorGapPx
 * - `platform_bundle` — segments: [tileX, tileY, widthTiles][]
 * - `coin_group` — positions: [x, y][]
 * - `player_spawn` — x, y (world pixels)
 * - `goal_flag` — x, y (world pixels)
 *
 * If `dynNodes` are provided, coin piles are replaced by Dynamo node blocks
 * whose positions are mapped from graph space to world space.
 *
 * If `dynWireEdges` is non-empty, wires follow the .dyn `Connectors` graph (fan-in / fan-out).
 * Otherwise wires default to consecutive slabs in `Nodes[]` order.
 */
export function buildLevelFromGraph(
  scene: Phaser.Scene,
  graph: LevelGraph,
  dynNodes?: DynNode[],
  dynWireEdges?: DynWireEdge[],
  options?: BuildLevelOptions,
  level: number = 1,
): BuiltLevel {
  const issues = validateLevelGraph(graph);
  if (issues.length > 0) {
    const msg = issues.map((i) => i.message).join("; ");
    throw new Error(`Invalid level graph: ${msg}`);
  }

  let worldWidth = 2560;
  let cloudPositions: number[] | undefined;
  let safeGroundCols = 0;
  let lowestNodeToFloorGapFromMeta: number | undefined;

  const platformSegments: [number, number, number][] = [];
  const coinPositions: [number, number][] = [];
  let spawnX = 48;
  let spawnY = GAME_HEIGHT - TILE_SIZE - 40;
  let goalX = worldWidth - 48;
  let goalY = GAME_HEIGHT - TILE_SIZE - 24;

  for (const node of graph.nodes) {
    const props = propsOf(node);
    switch (node.type) {
      case "level_meta": {
        worldWidth = Math.max(1, Math.floor(expectNumber(props, "worldWidth", node.id)));
        if (props.cloudPositions !== undefined) {
          cloudPositions = expectNumberArray(props, "cloudPositions", node.id);
        }
        if (props.safeGroundCols !== undefined) {
          safeGroundCols = Math.max(0, Math.floor(expectNumber(props, "safeGroundCols", node.id)));
        }
        if (props.lowestNodeToFloorGapPx !== undefined) {
          const g = expectNumber(props, "lowestNodeToFloorGapPx", node.id);
          if (g < 0) {
            throw new TypeError(`Node "${node.id}": props.lowestNodeToFloorGapPx must be >= 0`);
          }
          lowestNodeToFloorGapFromMeta = Math.floor(g);
        }
        break;
      }
      case "platform_bundle": {
        const segs = props.segments;
        if (!Array.isArray(segs)) {
          throw new TypeError(`Node "${node.id}": props.segments must be an array`);
        }
        segs.forEach((row, i) => {
          platformSegments.push(expectSegmentTuple(row, node.id, i));
        });
        break;
      }
      case "coin_group": {
        const pos = props.positions;
        if (!Array.isArray(pos)) {
          throw new TypeError(`Node "${node.id}": props.positions must be an array`);
        }
        pos.forEach((pair, i) => {
          coinPositions.push(expectPositionTuple(pair, node.id, i));
        });
        break;
      }
      case "player_spawn": {
        spawnX = expectNumber(props, "x", node.id);
        spawnY = expectNumber(props, "y", node.id);
        break;
      }
      case "goal_flag": {
        goalX = expectNumber(props, "x", node.id);
        goalY = expectNumber(props, "y", node.id);
        break;
      }
      default:
        break;
    }
  }

  // When a .dyn file is loaded, derive one platform per Dynamo node and
  // scale the world wide enough to hold them all comfortably.
  let dynLayout: PlatformEntry[] | undefined;
  if (dynNodes && dynNodes.length > 0) {
    const layout = dynNodesToPlatformLayout(dynNodes, safeGroundCols);
    worldWidth = layout.worldWidth;
    dynLayout = layout.platforms;
    // Replace the JSON platform segments with one slab per Dynamo node
    platformSegments.length = 0;
    for (const { seg } of dynLayout) platformSegments.push(seg);
    if (dynWireEdges && dynWireEdges.length > 0) {
      attachDynPortCountsFromEdges(dynLayout, dynNodes, dynWireEdges);
    }
  }

  // Tracks the platform index on which the boss (Jacobot) should stand in level 2+.
  let bossPlatformIdx: number | undefined;

  // Spawn on the leftmost platform; win flag on rightmost graph X (dyn) or last segment (JSON level)
  if (platformSegments.length > 0) {
    let spawnIdx = 0;
    for (let i = 1; i < platformSegments.length; i++) {
      if (platformSegments[i][0] < platformSegments[spawnIdx][0]) spawnIdx = i;
    }
    const [firstTileX, firstTileY, firstW] = platformSegments[spawnIdx];
    const firstTop =
      dynLayout?.[spawnIdx]?.slabTopYPx !== undefined
        ? dynLayout[spawnIdx].slabTopYPx!
        : firstTileY * TILE_SIZE;
    spawnX = firstTileX * TILE_SIZE + (firstW * TILE_SIZE) / 2;
    spawnY = firstTop - 24; // sprite center; feet land 8 px above slab (halfHeight=16)

    let goalIdx = platformSegments.length - 1;
    if (dynNodes !== undefined && dynNodes.length > 0 && dynLayout !== undefined) {
      for (let i = 1; i < dynNodes.length; i += 1) {
        if (dynNodes[i].x > dynNodes[goalIdx].x) goalIdx = i;
      }
    }

    const [goalTileX, goalTileY, goalW] = platformSegments[goalIdx];
    const goalTop = dynLayout?.[goalIdx]?.slabTopYPx ?? goalTileY * TILE_SIZE;
    goalX = (goalTileX + goalW) * TILE_SIZE + 16; // just past that slab's right edge
    goalY = goalTop;

    // Jacobot stands on the platform immediately left of the goal so it guards
    // the approach without sitting directly on the flag hitbox.
    // Only assign a boss platform when there is a distinct platform to the left;
    // with a single platform the flag and boss would overlap, so skip spawning.
    bossPlatformIdx = goalIdx > 0 ? goalIdx - 1 : undefined;
  }

  // Lowest point of gameplay (slabs, coins); ground is placed below with a gap for falling.
  let maxContentBottom = TILE_SIZE * 3;
  for (let i = 0; i < platformSegments.length; i += 1) {
    const [, ty] = platformSegments[i];
    const top = dynLayout?.[i]?.slabTopYPx ?? ty * TILE_SIZE;
    maxContentBottom = Math.max(maxContentBottom, top + NODE_H);
  }
  for (const [, cy] of coinPositions) {
    maxContentBottom = Math.max(maxContentBottom, cy + 8);
  }
  if (platformSegments.length > 0) {
    maxContentBottom = Math.max(maxContentBottom, goalY);
  }

  const optGap = options?.lowestNodeToFloorGapPx;
  const gapFromOptions =
    optGap !== undefined && Number.isFinite(optGap) ? Math.max(0, Math.floor(optGap)) : undefined;
  const lowestNodeToFloorGapPx =
    lowestNodeToFloorGapFromMeta ?? gapFromOptions ?? LEVEL_GROUND_GAP_PX;

  const groundCenterY = maxContentBottom + lowestNodeToFloorGapPx + TILE_SIZE / 2;
  const physicsWorldBottom = groundCenterY + TILE_SIZE / 2 + LEVEL_FALL_BELOW_GROUND_PX;
  // Top must match WORLD_TOP_Y so collideWorldBounds does not block y < 0 (open sky / infinite jump).
  const physicsBottom = Math.max(GAME_HEIGHT * 4, physicsWorldBottom);
  const physicsHeight = physicsBottom - WORLD_TOP_Y;
  scene.physics.world.setBounds(0, WORLD_TOP_Y, worldWidth, physicsHeight);
  scene.registry.set(REG_LEVEL_FALL_DEATH_Y, physicsWorldBottom);

  const groundCols = Math.ceil(worldWidth / TILE_SIZE);
  const clouds = cloudPositions ?? [120, 360, 680, 1040, 1400, 1800, 2200];

  for (let x = 0; x < worldWidth; x += GAME_WIDTH) {
    scene.add.image(x, 0, "bg").setOrigin(0, 0).setScrollFactor(0.3);
  }

  for (const cx of clouds) {
    // Deterministic Y offset derived from X so cloud positions are stable across restarts
    const cloudY = 40 + ((cx * 17 + 53) % 61);
    scene.add.image(cx, cloudY, "cloud").setScrollFactor(0.15);
  }

  const safeGround = scene.physics.add.staticGroup();
  const fireGround = scene.physics.add.staticGroup();
  for (let col = 0; col < groundCols; col++) {
    const tx = col * TILE_SIZE + TILE_SIZE / 2;
    const ty = groundCenterY;
    if (col < safeGroundCols) {
      safeGround.create(tx, ty, "tile_ground_safe").refreshBody();
    } else {
      fireGround.create(tx, ty, "tile_ground").refreshBody();
    }
  }

  const platforms = scene.physics.add.staticGroup();
  const movingPlatforms: Phaser.Physics.Arcade.Image[] = [];
  const movingPlatformMap = new Map<number, Phaser.Physics.Arcade.Image>();
  for (let i = 0; i < platformSegments.length; i++) {
    const [tx, ty, w] = platformSegments[i];
    const widthPx = w * TILE_SIZE;
    const ni = dynLayout?.[i]?.numInputs ?? 1;
    const no = dynLayout?.[i]?.numOutputs ?? 1;

    // Level 2+: moving platform density increases each level.
    // extra=0 (L2): every 3rd moves; extra=1 (L3): every 2nd; extra≥2 (L4+): all middle move.
    const extra = Math.max(0, level - 2);
    const movingSkip = extra >= 2 ? 1 : extra === 1 ? 2 : 3;
    const isMoving = level >= 2
      && i > 0
      && i < platformSegments.length - 1
      && (movingSkip === 1 || i % movingSkip === 1);

    const textureKey = isMoving
      ? `dynamo_node_red_w${w}_i${ni}_o${no}`
      : `dynamo_node_w${w}_i${ni}_o${no}`;
    generateDynamoNodeTexture(scene, textureKey, widthPx, NODE_H, ni, no, isMoving);

    const slabTopY = dynLayout?.[i]?.slabTopYPx ?? ty * TILE_SIZE;
    const cx = tx * TILE_SIZE + widthPx / 2;
    const cy = slabTopY + NODE_H / 2;

    // Build text labels (shared by static and moving platforms)
    const tweenExtras: Phaser.GameObjects.Text[] = [];

    const nodeName = dynLayout?.[i]?.name;
    if (nodeName !== undefined) {
      const headerMidY = slabTopY + NODE_HEADER_H / 2;
      const headerText = scene.add
        .text(cx, headerMidY, shortName(nodeName), {
          fontSize: "10px",
          color: "#d6eaf8",
          wordWrap: { width: widthPx - 4 },
          align: "center",
          maxLines: 1,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2);
      tweenExtras.push(headerText);
    }

    const rawName = dynLayout ? dynLayout[i].name : "?";
    const label = dynLayout ? shortName(rawName) : rawName;
    const bodyText = scene.add
      .text(cx, slabTopY + 24, label, {
        fontSize: "8px",
        color: dynLayout ? "#aed6f1" : "#ffd700",
        fontStyle: "bold",
        wordWrap: { width: widthPx - 4 },
        align: "center",
        maxLines: 1,
      })
      .setOrigin(0.5)
      .setDepth(2);
    tweenExtras.push(bodyText);

    if (isMoving) {
      const mp = scene.physics.add.image(cx, cy, textureKey);
      mp.setImmovable(true);
      (mp.body as Phaser.Physics.Arcade.Body).allowGravity = false;
      scene.tweens.add({
        targets: [mp, ...tweenExtras],
        x: cx + 64,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      movingPlatforms.push(mp);
      movingPlatformMap.set(i, mp);
    } else {
      (platforms.create(cx, cy, textureKey) as Phaser.Physics.Arcade.Sprite).refreshBody();
    }
  }

  // --- Wire connectors: real graph (Connectors) when available, else chain in Nodes[] order ---
  const connectors: NodeConnector[] = [];

  const slabGeom = (i: number) => {
    const [tx, ty, w] = platformSegments[i];
    const top = dynLayout?.[i]?.slabTopYPx ?? ty * TILE_SIZE;
    const left = tx * TILE_SIZE;
    const right = left + w * TILE_SIZE;
    return { top, left, right };
  };

  const canUseGraphWires =
    dynLayout !== undefined &&
    dynNodes !== undefined &&
    dynNodes.length > 0 &&
    dynWireEdges !== undefined &&
    dynWireEdges.length > 0;

  let builtWiresFromDynGraph = false;
  if (canUseGraphWires) {
    const idToIndex = new Map<string, number>();
    dynNodes.forEach((n, i) => idToIndex.set(normalizeDynNodeId(n.id), i));

    type Resolved = { fromIdx: number; toIdx: number };
    const resolved: Resolved[] = [];
    for (const e of dynWireEdges) {
      const fi = idToIndex.get(e.fromNodeId);
      const ti = idToIndex.get(e.toNodeId);
      if (fi === undefined || ti === undefined) continue;
      if (fi === ti) continue;
      resolved.push({ fromIdx: fi, toIdx: ti });
    }

    if (resolved.length > 0) {
      builtWiresFromDynGraph = true;
      const outByFrom = new Map<number, number[]>();
      const inByTo = new Map<number, number[]>();
      resolved.forEach((r, ei) => {
        if (!outByFrom.has(r.fromIdx)) outByFrom.set(r.fromIdx, []);
        outByFrom.get(r.fromIdx)!.push(ei);
        if (!inByTo.has(r.toIdx)) inByTo.set(r.toIdx, []);
        inByTo.get(r.toIdx)!.push(ei);
      });
      for (const arr of outByFrom.values()) {
        arr.sort((a, b) => resolved[a].toIdx - resolved[b].toIdx);
      }
      for (const arr of inByTo.values()) {
        arr.sort((a, b) => resolved[a].fromIdx - resolved[b].fromIdx);
      }

      for (let ei = 0; ei < resolved.length; ei++) {
        const { fromIdx: i, toIdx: j } = resolved[ei];
        const g0 = slabGeom(i);
        const g1 = slabGeom(j);
        const ax = g0.right;
        const bx = g1.left;
        const outList = outByFrom.get(i);
        const inList = inByTo.get(j);
        const outSlot = outList !== undefined ? outList.indexOf(ei) : 0;
        const inSlot = inList !== undefined ? inList.indexOf(ei) : 0;
        const nOut = dynLayout?.[i]?.numOutputs ?? 1;
        const nIn = dynLayout?.[j]?.numInputs ?? 1;
        const ay = g0.top + dynamoPortCenterYFromTop(outSlot, nOut, NODE_H);
        const by = g1.top + dynamoPortCenterYFromTop(inSlot, nIn, NODE_H);
        connectors.push(new NodeConnector(scene, ax, ay, bx, by, movingPlatformMap.get(i), movingPlatformMap.get(j)));
      }
    }
  }

  if (!builtWiresFromDynGraph) {
    for (let i = 0; i + 1 < platformSegments.length; i++) {
      const [tx1, ty1, w1] = platformSegments[i];
      const [tx2, ty2] = platformSegments[i + 1];

      const top1 = dynLayout?.[i]?.slabTopYPx ?? ty1 * TILE_SIZE;
      const top2 = dynLayout?.[i + 1]?.slabTopYPx ?? ty2 * TILE_SIZE;

      const ax = (tx1 + w1) * TILE_SIZE;
      const ay = top1 + dynamoPortCenterYFromTop(0, 1, NODE_H);
      const bx = tx2 * TILE_SIZE;
      const by = top2 + dynamoPortCenterYFromTop(0, 1, NODE_H);
      connectors.push(new NodeConnector(scene, ax, ay, bx, by, movingPlatformMap.get(i), movingPlatformMap.get(i + 1)));
    }
  }

  const flag = scene.physics.add.staticImage(goalX, goalY, "flag");
  flag.setOrigin(0.5, 1);
  flag.refreshBody();

  // --- Collectibles: node blocks on each platform (from .dyn) or default coins ---
  const collectibles = scene.physics.add.staticGroup();

  if (dynLayout && dynLayout.length > 0) {
    for (const { collectX, collectY } of dynLayout) {
      collectibles.create(collectX, collectY, "node_block").refreshBody();
    }
  } else {
    for (const [cx, cy] of coinPositions) {
      collectibles.create(cx, cy, "coin");
    }
  }

  const player = new Player(scene, spawnX, spawnY);

  // Spawn Jacobot on the last platform in level 2+
  let jacobot: Jacobot | undefined;
  if (level >= 2 && bossPlatformIdx !== undefined) {
    const [btx, bty, bw] = platformSegments[bossPlatformIdx];
    const bTop = dynLayout?.[bossPlatformIdx]?.slabTopYPx ?? bty * TILE_SIZE;
    const bx = btx * TILE_SIZE + (bw * TILE_SIZE) / 2;
    const by = bTop - 16; // sprite center sits on top of the slab
    const extraLevels = Math.max(0, level - 2);
    jacobot = new Jacobot(scene, bx, by, player, movingPlatformMap.get(bossPlatformIdx), {
      minThrowMs: Math.max(600,  JACOBOT_MIN_THROW_MS - extraLevels * 100),
      maxThrowMs: Math.max(1000, JACOBOT_MAX_THROW_MS - extraLevels * 200),
      bugDamage:  Math.min(50,   JACOBOT_BUG_DAMAGE   + extraLevels * 3),
    });
  }

  scene.physics.add.collider(player.sprite, safeGround);
  scene.physics.add.collider(player.sprite, platforms);
  for (const mp of movingPlatforms) {
    scene.physics.add.collider(player.sprite, mp);
  }

  scene.cameras.main.setBounds(0, WORLD_TOP_Y, worldWidth, physicsHeight);
  scene.cameras.main.startFollow(player.sprite, true, 0.1, 0.1);

  return { worldWidth, player, spawnX, spawnY, coins: collectibles, fireGround, safeGround, connectors, flag, movingPlatforms, jacobot };
}
