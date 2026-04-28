# 2026 Summit Hackathon — Dyno Dash

Dyno Dash is a pixel-art 2D platformer built with [Phaser 3](https://phaser.io/) and TypeScript. Platforms are generated from Dynamo `.dyn` graphs — each Dynamo node becomes a platform slab, and wires between nodes become rideable bezier connectors. The game includes Dynamo-themed trivia, character customization, and a rocket boost mechanic.

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080).

## Gameplay

- **Move**: Arrow keys / WASD
- **Jump**: Up / W / Space (with coyote time and jump buffering)
- **Rocket boost**: Hold Shift to ascend — burns fuel, recharges on ground
- **Ride wires**: Walk off the edge of a node slab onto the bezier wire connecting to the next — slope affects your speed
- **Trivia**: Every 5 collectibles collected triggers a Dynamo trivia question from Jacob Small; correct answers grant a life, wrong answers deal knockback
- **Goal**: Reach the flag at the rightmost node

### Level 2

Every third platform becomes a moving red node that oscillates horizontally. Wires connected to moving platforms track their movement in real time.

**Jacobot** — a robot boss stands on the rightmost platform. He hurls random software bugs (beetle, spider, fly) toward the player on a randomised timer. Each hit costs 25 HP. Bugs arc ballistically toward the player's position with a small spread, so standing still is dangerous.

## Characters

Choose from 5 archetypes at the character select screen, each with a fully customisable colour palette (body, skin, legs):

| Archetype | Description |
|-----------|-------------|
| Achintya  | Default hero |
| Trygve    | Nordic warrior |
| Aaron     | Speedrunner |
| Ashish    | Tech wizard |
| Misha     | Stealth runner |

## Loading a Dynamo Graph

From the main menu, upload a `.dyn` file to generate a level from your own Dynamo graph. Each node becomes a platform slab; `Connectors` in the graph become wires. Without an upload, a built-in default graph is used.

## Project Structure

```
├── src/
│   ├── main.ts                    # Entry point, Phaser game config
│   ├── config/
│   │   └── GameConfig.ts          # Shared constants (tile size 32px, gravity 1200, etc.)
│   ├── scenes/
│   │   ├── BootScene.ts           # Pixel-art rendering setup
│   │   ├── PreloadScene.ts        # Asset loading
│   │   ├── MenuScene.ts           # Main menu + .dyn file upload
│   │   ├── GameScene.ts           # Core gameplay loop
│   │   ├── UIScene.ts             # HUD (hearts, rocket fuel bar)
│   │   ├── CharacterSelectScene.ts
│   │   ├── CharacterBuilderScene.ts  # Colour palette customisation
│   │   ├── RosterScene.ts
│   │   ├── GameOverScene.ts
│   │   └── WinScene.ts
│   ├── entities/
│   │   ├── Player.ts              # Movement, jump, rocket boost, damage
│   │   ├── Jacobot.ts             # Boss enemy: throws bugs ballistically at the player
│   │   └── NodeConnector.ts       # Bezier wire (rideable; breaks after 2 s)
│   ├── character/
│   │   ├── PlayerArchetype.ts     # Archetype IDs and labels
│   │   ├── CharacterAppearance.ts # Colour palettes
│   │   └── renderPlayerTexture.ts # Per-archetype pixel-art draw functions
│   ├── levels/
│   │   └── buildLevelFromGraph.ts # Spawns all world content from a LevelGraph
│   ├── level-graph/
│   │   ├── types.ts               # LevelGraph / GraphNode types
│   │   └── graph.ts               # Validation helpers
│   ├── dyn/
│   │   ├── types.ts               # DynNode / DynWireEdge parsers
│   │   └── defaultDynRaw.ts       # Built-in fallback .dyn graph
│   ├── trivia/
│   │   ├── TriviaSystem.ts        # DOM overlay quiz UI + lives logic
│   │   └── questions.ts           # Dynamo trivia question bank
│   ├── audio/
│   │   └── SoundEngine.ts         # SFX and music helpers
│   ├── easterEgg/
│   │   └── konami.ts              # Konami code handler
│   └── utils/
│       └── PlaceholderTextures.ts # Procedural textures (no external assets needed)
├── public/
│   ├── assets/                    # Static assets (logo, audio, fonts)
│   └── levels/
│       └── example-level.json     # JSON level graph (used when no .dyn is uploaded)
└── dist/                          # Production build output (git-ignored)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload at http://localhost:8080 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Preview production build at http://localhost:8080 |

## Known Limitations (Alpha)

| Area | Detail |
|------|--------|
| **Levels** | Two designed levels exist. From level 3 onward the game enters **Endless Mode** — same level 2 layout with scaling difficulty (faster Jacobot throws, higher bug damage, more moving platforms, shorter wire break time). No final level or end screen yet. |
| **Input** | Keyboard only. No gamepad or touch/mobile support. |
| **Level graph** | All levels share a single `example-level.json`. The uploaded `.dyn` file is the only per-run variable; there is no multi-level `.dyn` sequencing. |
| **File upload** | `.dyn` files are capped at 5 MB. Very large or deeply nested graphs may produce crowded platform layouts. |
| **Score** | Accumulates across levels within a run. Resets to 0 on each life lost and on game-over restart. |
| **Browser** | Tested on Chromium-based browsers and Firefox. Safari Web Audio autoplay policy may delay music until the first user interaction. |

## Tech Stack

- [Phaser 3](https://phaser.io/) — game framework with arcade physics
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [Vite](https://vitejs.dev/) — dev server and bundler
- Internal resolution **640×360** upscaled with `pixelArt: true` (nearest-neighbour) for crisp pixel art
