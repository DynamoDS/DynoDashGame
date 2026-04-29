export const TILE_SIZE = 32; // px — all sprites and maps use this grid

/** Tile rows bounding normalized Dynamo Y (slab tops span this band). */
export const DYN_LAYOUT_TILE_Y_MIN = 2;
export const DYN_LAYOUT_TILE_Y_MAX = 9;

/**
 * World pixel span for the full dynamo min→max range on each axis after normalization.
 * Matches vertical band height: (row max − row min) × tile size.
 */
export const DYN_LAYOUT_GRAPH_SPAN_PX =
  (DYN_LAYOUT_TILE_Y_MAX - DYN_LAYOUT_TILE_Y_MIN) * TILE_SIZE;

/** Multiplier on horizontal normalized layout (same baseline span as Y). */
export const DYN_LAYOUT_X_SCALE = 7;
/** Multiplier on vertical normalized layout. */
export const DYN_LAYOUT_Y_SCALE = 2;

/**
 * Default vertical gap from the bottom of the lowest gameplay content (nodes, collectibles,
 * goal) to the top surface of the ground tiles (px). Override per level with `level_meta`
 * `lowestNodeToFloorGapPx`, or pass `lowestNodeToFloorGapPx` in `buildLevelFromGraph` options.
 */
export const LEVEL_GROUND_GAP_PX = 112;
/** Space below the ground surface before the player dies / world floor (px). */
export const LEVEL_FALL_BELOW_GROUND_PX = 320;

export const GAME_WIDTH = 640;  // internal resolution (upscaled by CSS)
export const GAME_HEIGHT = 360; // 16:9 at 2x the tile size

/** World Y of the top edge (negative = open sky above the level). */
export const WORLD_TOP_Y = -500_000;
/** World Y of the bottom edge (room to fall below the viewport). */
export const WORLD_BOTTOM_Y = GAME_HEIGHT * 4;
/** Full world height in pixels (for physics + camera bounds). */
export const WORLD_HEIGHT_PX = WORLD_BOTTOM_Y - WORLD_TOP_Y;

export const GRAVITY = 1200;
export const PLAYER_SPEED = 240;
export const PLAYER_JUMP_VELOCITY = -640;

// ── Player feel ────────────────────────────────────────────────────────────────
/** Ms after leaving ground where a jump still counts (fixes tile-seam gaps while running). */
export const COYOTE_MS = 90;
/** Ms to remember an early jump press before landing. */
export const JUMP_BUFFER_MS = 120;

// ── Wire riding ────────────────────────────────────────────────────────────────
/** Base horizontal speed while riding a wire (px/s). */
export const WIRE_SPEED = 160;
/** Extra px/s contributed by gravity on a slope=1 wire. */
export const WIRE_GRAVITY = 300;

// ── Jacobot boss ───────────────────────────────────────────────────────────────
export const JACOBOT_MIN_THROW_MS = 1500;
export const JACOBOT_MAX_THROW_MS = 2800;
export const JACOBOT_FLIGHT_TIME_MIN = 1.7;
export const JACOBOT_FLIGHT_TIME_MAX = 2.4;
/** Random horizontal spread added to each throw target (px, applied as ±). */
export const JACOBOT_SPREAD_X = 48;

// ── Player stats ───────────────────────────────────────────────────────────────
export const HP_MAX = 100;
export const LIVES_MAX = 3;

// ── Wire rendering ─────────────────────────────────────────────────────────────
/** ms of riding before the wire starts flashing orange. */
export const WIRE_WARN_MS = 1200;
/** ms of riding before the wire breaks entirely. */
export const WIRE_BREAK_MS = 2000;
/** px probe distance used to estimate wire slope (getSlopeAt). */
export const WIRE_SLOPE_DX = 2;
/** Bezier control-point distance as a fraction of wire horizontal span. */
export const WIRE_BEZIER_CONTROL_FACTOR = 0.4;
/** Blink period (ms) when wire is in warning state. */
export const WIRE_BLINK_PERIOD_MS = 100;
/** Number of segments used to tessellate the bezier for rendering. */
export const WIRE_CURVE_SEGMENTS = 24;
/** Duration (ms) of the red flash before a broken wire disappears. */
export const WIRE_BREAK_FLASH_MS = 180;

// ── Level intro camera pan ─────────────────────────────────────────────────────
/** Duration of the outward pan from spawn to goal flag (ms). */
export const INTRO_PAN_OUT_MS = 2000;
/** Pause at goal flag before panning back (ms). */
export const INTRO_PAUSE_MS = 500;
/** Duration of the return pan from goal flag back to player (ms). */
export const INTRO_RETURN_MS = 1000;
/** Camera zoom level during overview (1 = normal; smaller = more world visible). */
export const INTRO_ZOOM_OUT = 0.2;

/** Max fuel (matches UI bar denominator). */
export const PLAYER_FUEL_MAX = 72;
/** Upward velocity while holding Shift with fuel (Arcade Y is down-positive). */
export const PLAYER_ROCKET_VELOCITY_Y = -200;
/** Fuel consumed per second while boosting. */
export const PLAYER_FUEL_DRAIN_PER_SEC = 65;
/** Fuel restored per second on the ground when not boosting. */
export const PLAYER_FUEL_RECHARGE_PER_SEC = 12;
