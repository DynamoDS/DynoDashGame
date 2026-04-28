/**
 * Phaser registry key constants.
 *
 * All cross-scene state is passed through `this.registry.get/set`.  Using
 * named constants here instead of raw string literals means a typo in a key
 * name is a TypeScript compile error, not a silent runtime bug.
 *
 * To add a new key: define it here and import it at both the write site and
 * the read site.  Never pass a raw string to registry.get/set.
 */

/** Accumulated coin score for the current run. */
export const REG_SCORE = "score";

/** Remaining lives (integer, 0–LIVES_MAX). */
export const REG_LIVES = "lives";

/** Current level number (1-based). */
export const REG_LEVEL = "level";

/** Player HP (0–HP_MAX). */
export const REG_HEALTH = "health";

/** Rocket fuel (0–PLAYER_FUEL_MAX). */
export const REG_FUEL = "fuel";

/** All-time high score, persisted in localStorage and mirrored here for UIScene. */
export const REG_HIGH_SCORE = "highScore";

/** Parsed DynNode array from the uploaded or default .dyn file. */
export const REG_DYN_NODES = "dynNodes";

/** Parsed DynWireEdge array from the uploaded or default .dyn file. */
export const REG_DYN_EDGES = "dynEdges";

/**
 * `true` only after the player picks a .dyn file (not the bundled default).
 * Used by MenuScene to show/hide the "level loaded from upload" banner.
 */
export const REG_DYN_FROM_UPLOAD = "dynFromUpload";

/**
 * Y-coordinate (world px) below which the player is considered to have fallen
 * off the level.  Set by buildLevelFromGraph; read by Player.update().
 */
export const REG_LEVEL_FALL_DEATH_Y = "levelFallDeathY";
