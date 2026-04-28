# Claude Code — Agent Guide for Dyno Dash

Dyno Dash is a Phaser 3 + TypeScript pixel-art platformer. Platforms are generated from Dynamo `.dyn` graphs.

## Critical Rules (read first)

1. **No magic numbers** — all constants in `src/config/GameConfig.ts`
2. **No magic strings** — all registry keys in `src/config/registryKeys.ts`
3. **No image files** — all textures code-drawn in `src/utils/PlaceholderTextures.ts`
4. **No sync scene transitions** — always use `deferSceneStart` / `deferSceneRestart`
5. **Destroy Jacobot before every scene transition** — see pattern below
6. **Check `transitioning` guard** in every overlap/event handler
7. **Every bug fix ships with a regression test** — no exceptions

## Build & Test

```bash
npm install          # install deps
npm run dev          # dev server at http://localhost:8080
npm run build        # tsc + vite production build
npm run test         # vitest (unit tests only — no browser needed)
npm run test:watch   # vitest watch mode
```

**All tests must pass before committing.** TypeScript compilation errors (`npm run build`) are also blocking.

## Project Layout

```
src/
  config/           GameConfig.ts (all constants), registryKeys.ts (all registry string keys)
  scenes/           One file per Phaser scene (GameScene, WinScene, UIScene, …)
  entities/         Player, Jacobot, NodeConnector
  levels/           buildLevelFromGraph.ts — spawns all world content from a LevelGraph
  level-graph/      types.ts + graph.ts — LevelGraph schema and validation
  dyn/              .dyn file parsing, file picker, default graph
  character/        Archetype IDs, colour palettes, per-archetype pixel-art renderer
  trivia/           TriviaSystem (DOM overlay quiz)
  audio/            SoundEngine (singleton module export)
  utils/            PlaceholderTextures.ts — ALL textures are drawn with code (no image files)
  easterEgg/        Konami code handler
public/
  assets/           Static assets (Dynamo logo, audio, fonts)
  levels/           example-level.json — default JSON level graph
```

## Textures: Code-Drawn, No Files

Add textures to `src/utils/PlaceholderTextures.ts`:

```typescript
const g = scene.make.graphics({ x: 0, y: 0 });
g.fillStyle(0x1a3a5c);
g.fillRect(0, 0, w, h);
g.generateTexture("my_key", w, h);
g.destroy();
```

The Dynamo logo PNG (`public/assets/dynamo-logo.png`) is the only external image.

## Constants — One Source of Truth

**Never hardcode magic numbers.** All constants live in `src/config/GameConfig.ts`:

- Physics: `GRAVITY`, `PLAYER_SPEED`, `PLAYER_JUMP_VELOCITY`, `COYOTE_MS`, `JUMP_BUFFER_MS`
- Wire mechanics: `WIRE_SPEED`, `WIRE_GRAVITY`, `WIRE_BREAK_MS`
- Player resources: `PLAYER_FUEL_MAX`, `HP_MAX`, `LIVES_MAX`
- Jacobot boss: `JACOBOT_MIN_THROW_MS`, `JACOBOT_MAX_THROW_MS`, `JACOBOT_BUG_DAMAGE`
- Layout: `TILE_SIZE` (32 px), `GAME_WIDTH` (640), `GAME_HEIGHT` (360)

## Registry Keys — No Magic Strings

All Phaser registry keys are defined in `src/config/registryKeys.ts`. **Never pass raw string literals** to `registry.get()` or `registry.set()`.

```typescript
import { REG_SCORE, REG_LIVES } from "../config/registryKeys";
this.registry.set(REG_SCORE, 0);
```

| Constant | String value | Who writes | Who reads |
|---|---|---|---|
| `REG_SCORE` | `"score"` | GameScene, GameOverScene, CharacterBuilderScene | GameScene, UIScene |
| `REG_LIVES` | `"lives"` | CharacterBuilderScene, WinScene, GameScene, GameOverScene, TriviaSystem | UIScene, GameScene, TriviaSystem |
| `REG_LEVEL` | `"level"` | CharacterBuilderScene, WinScene | GameScene, UIScene |
| `REG_HEALTH` | `"health"` | GameScene, Player | UIScene |
| `REG_FUEL` | `"fuel"` | GameScene, Player | UIScene |
| `REG_HIGH_SCORE` | `"highScore"` | GameScene | UIScene |
| `REG_DYN_NODES` | `"dynNodes"` | PreloadScene, openDynFilePicker | GameScene, MenuScene |
| `REG_DYN_EDGES` | `"dynEdges"` | PreloadScene, openDynFilePicker | GameScene |
| `REG_DYN_FROM_UPLOAD` | `"dynFromUpload"` | PreloadScene, openDynFilePicker | MenuScene |
| `REG_LEVEL_FALL_DEATH_Y` | `"levelFallDeathY"` | buildLevelFromGraph | Player |

## Phaser-Specific Gotchas

### Scene transitions must be deferred

Never call `scene.start()` or `scene.restart()` synchronously inside a physics overlap, collider, or keyboard callback. Always use the helpers in `src/utils/sceneUtils.ts`:

```typescript
import { deferSceneStart, deferSceneRestart } from "../utils/sceneUtils";

deferSceneStart(this, "WinScene");     // go to a different scene
deferSceneRestart(this);               // restart current scene
```

Both helpers wrap the call in `time.delayedCall(0, ...)` so it fires on the next engine tick.

### Destroy Jacobot before ANY scene transition

`Jacobot` fires its throw timer on a randomised interval. If it fires during the scene stop→start sequence it corrupts the restart (level-2+ freeze bug). **Every transition path must destroy Jacobot first:**

```typescript
// In GameScene — required in EVERY branch that transitions away
this.jacobot?.destroy();
this.jacobot = null;
// ... then deferSceneStart / deferSceneRestart
```

Applies to: flag overlap → WinScene, handleDeath → GameScene restart, handleDeath → GameOverScene, ESC → MenuScene.

### `transitioning` guard is mandatory

GameScene uses a `private transitioning = false` flag. Check it at the top of every overlap and event handler to prevent double-transitions on the same frame:

```typescript
if (this.transitioning || this.player.dead) return;
this.transitioning = true;
```

### Physics bodies during scene restart

`scene.restart()` queues a `stop` then `start` — the full `create()` cycle re-runs. Re-create all objects in `create()`; never cache references across restarts.

### Timer/tween chains are unreliable on level 2+

Phaser's tween manager can miss `onComplete` callbacks when many repeat-forever tweens are running. **Do not depend on tween `onComplete` or `time.delayedCall` for game-critical state transitions.** GameScene polls `player.dead` in `update()` instead.

### UIScene is always running in parallel

`UIScene` is launched once from `GameScene.create()` and stays alive across scene transitions. Do not stop or restart UIScene from game logic.

## Testing Patterns

Tests live next to the source files they cover (`<SourceFile>.<topic>.test.ts`). **All tests are pure TypeScript with no Phaser dependency:**

```typescript
// Good: simulate the logic with plain objects
function tickDeathPoll(state: DeathPollState, delta: number): boolean { ... }

// Bad: import Phaser or call scene methods in unit tests
```

**Every bug fix must ship with a regression test.** Model the failure mode first (proves the bug), then the fix (proves the guard). See `GameScene.deathFreeze.test.ts` and `GameScene.scoreAccumulation.test.ts` as references.

## Depth Layering

| Layer | Depth |
|---|---|
| Background, tiles, platforms, collectibles, wires | 0 (default) |
| Platform text labels | 2 |
| Bug projectiles (Jacobot) | 5 |
| Jacobot boss + Jacob Small NPC | 10 |
| Player rocket flame emitter | 99 |
| Player sprite | 100 |
| HUD | UIScene (separate overlay — no depth interaction) |

## Colour Palette

| Role | Hex |
|---|---|
| Node body | `0x2d2d2d` |
| Node header blue | `0x1a3a5c` |
| Node header red (moving platform) | `0x5c1a1a` |
| Accent blue | `0x4a90d9` |
| Wire / input port | `0x4fc3f7` |
| Output port | `0x81c784` |
| Sky | `0x1a1a2e` |
| Fire ground | `0x8b0000` → `0xff6600` |

## Score & Lives State Machine

| Event | Score | Lives |
|---|---|---|
| Fresh game start (CharacterBuilderScene) | Reset to 0 | Reset to 3 |
| Coin collected | +10 | — |
| Level win (WinScene) | **Preserved** | Reset to 3 |
| Player dies, lives > 0 | Reset to 0 | −1 |
| Player dies, lives = 0 → GameOverScene | Sent via `data` param | — |
| GameOverScene restart | Reset to 0 | Reset to 3 |
| Trivia correct | — | +1 (capped at LIVES_MAX) |
| Trivia wrong | — | −1 (floored at 0) |
