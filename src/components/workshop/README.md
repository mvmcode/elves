# Workshop Scene

Pixel-art Canvas 2D visualization of the ELVES workshop. Renders a top-down tile-based scene where elf sprites walk between workbenches, carry items, celebrate, sleep, and react to real-time `ElfEvent` streams from agent sessions.

## Architecture

The workshop is a pure Canvas 2D renderer (no DOM elements in the scene). React owns the canvas element and game loop via `WorkshopCanvas.tsx`; all rendering and state lives in plain TypeScript classes.

```
WorkshopCanvas.tsx          React wrapper — owns <canvas>, runs requestAnimationFrame loop,
  |                         bridges Zustand store events into the scene engine.
  v
WorkshopScene.ts            Central orchestrator — holds all subsystems, runs update/render.
  |
  +-- Tilemap.ts            Draws the static workshop: floor, walls, benches, rug, furniture.
  +-- TilemapExtras.ts      Draws dynamic scene elements: delivery chute, clock, cookie jar fill,
  |                         door animation, wreaths, hanging lights.
  +-- Camera.ts             Viewport transform: zoom (1x-4x), pan, follow-elf with lerp, fit-all.
  +-- InteractionHandler.ts Mouse and keyboard input: hit detection, drag-to-pan, wheel-to-zoom,
  |                         double-click-to-follow, keyboard shortcuts (F=fit, R=reset, Space=toggle).
  +-- EventProcessor.ts     Maps ElfEvent types to visual actions on elf sprites and scene state.
  +-- BehaviorSequencer.ts  Multi-step choreography: delivery walks, ceremonies, idle timers,
  |                         permission-granted celebrations.
  +-- AmbientEffects.ts     Event-triggered lighting: red/green flickers, fireworks, warm glow overlay.
  +-- ParticleSystem.ts     GPU-free particle effects: sparkles, confetti, smoke trails.
  +-- Pathfinder.ts         A* grid pathfinding on the tile walkability map.
  +-- NavigationBridge.ts   Connects Pathfinder to elf movement — computes pixel waypoint paths,
  |                         updates dynamic obstacle blocks, finds nearest walkable tiles.
  +-- ElfSprite.ts          Elf state machine: position, animation, speech bubbles, carry items.
  +-- ElfDrawing.ts         Pure stateless render functions for elf body parts and accessories.
  +-- workshop-layout.ts    Constants: tile size, scale, grid dimensions, workbench/furniture positions.

WorkshopOverlay.tsx         React overlay — tooltips, detail panels, positioned above the canvas.
```

## Key Types

All shared types live in `src/types/workshop.ts`:

- **`WorkshopCallbacks`** — Click handlers the scene fires back to React (elf, bench, furniture).
- **`ElfSpriteState`** — Full state enum: `entering | idle | walking | working | carrying | delivering | waiting | celebrating | sleeping | error | permission | arguing | exiting`.
- **`InteractionTarget`** — Discriminated union for hit detection results.
- **`CameraConfig`** — Zoom limits, pan speed, follow lerp factor.
- **`DoorState`** — Door open/close animation progress.
- **`DeliveryWalkState`** — Phase tracking for inter-elf delivery choreography.
- **`CeremonyState`** — Session-complete celebration sequence tracking.

Elf events come from `src/types/elf.ts` as `ElfEvent` with typed payloads.

## Render Order

Each frame, `WorkshopScene.render()` draws layers in this order:

1. Floor tiles and walls (`Tilemap`)
2. Door animation (`TilemapExtras`)
3. Furniture and workbenches (`Tilemap`)
4. Delivery chute, clock, cookie jar fill (`TilemapExtras`)
5. Decorations — wreaths, hanging lights (`TilemapExtras`)
6. Elf shadows, then elf sprites sorted by Y-position (`ElfSprite` via `ElfDrawing`)
7. Particles (`ParticleSystem`)
8. Warm glow / ambient overlay (`AmbientEffects`)
9. Camera transform wraps steps 1-7; overlay renders in screen space after `camera.restore()`.

## Camera Controls

| Input | Action |
|-------|--------|
| Scroll wheel | Zoom toward cursor (1x-4x) |
| Left-drag on empty space | Pan the viewport |
| Middle-drag | Pan (always, even over interactive elements) |
| Double-click elf | Toggle camera follow on that elf |
| `F` key | Fit all elves in viewport |
| `R` key | Reset camera to default |
| `Escape` | Release camera follow |
| `Space` | Toggle workshop/card view |
| `1`-`6` | Focus workbench by index |

## Event-to-Visual Mapping

`EventProcessor` translates `ElfEvent` types into scene actions:

| ElfEvent Type | Visual Effect |
|---------------|---------------|
| `task_start` | Elf walks to assigned bench, starts working animation |
| `tool_use` | Elf shows tool name in speech bubble |
| `tool_result` | Brief result indicator |
| `chat` | Speech bubble; if `targetElfId` in payload, triggers delivery walk |
| `error` | Elf shakes, red ambient flicker |
| `task_complete` | Elf celebrates, green ambient flicker |
| `permission_request` | Elf raises hands, shows permission bubble |
| `permission_granted` | Elf jumps, "Let's go!" bubble, returns to working |
| `session_complete` | All elves celebrate, sparkle burst, walk to cots, sleep |

## Usage

```tsx
import { WorkshopCanvas } from "@/components/workshop/WorkshopCanvas";

<WorkshopCanvas elves={sessionElves} events={sessionEvents} />
```

The component is self-contained: it creates the scene, runs the game loop, and cleans up on unmount. Elf spawns and event processing are driven by the `elves` and `events` props from the Zustand session store.

## Grid Layout

- **Tile size:** 16px base, 3x scale = 48px per tile (`ST = 48`)
- **Grid:** 28 columns x 18 rows = 1344px x 864px canvas
- **Workbenches:** 6 benches at fixed tile positions (see `workshop-layout.ts`)
- **Walkability:** A* pathfinding on a boolean grid; furniture tiles are blocked

## Known Limitations

- Elf sprite file (`ElfSprite.ts`, 628 lines) exceeds the 300-line guideline; drawing was extracted to `ElfDrawing.ts` but the state machine remains large.
- `WorkshopScene.ts` (546 lines) and `Tilemap.ts` (412 lines) are above 300 lines — further extraction would add indirection without clear benefit at current complexity.
- No WebGL fallback — relies entirely on Canvas 2D. Performance is adequate for up to ~20 elves.
- Camera zoom uses integer-aligned rendering but sub-pixel artifacts may appear at non-integer zoom levels.
- Pathfinder does not support diagonal movement.
