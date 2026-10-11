# CLAUDE.md

<!-- ForgeCraft | 2026-03-16 | tags: UNIVERSAL, GAME | npx forgecraft-mcp refresh . to update -->

## Project Identity
- **Repo**: https://github.com/jghiringhelli/shattered_stars
- **Primary Language**: typescript
- **Framework**: {{framework}}
- **Domain**: {{domain}}
- **Sensitive Data**: NO
- **Project Tags**: `[UNIVERSAL]` `[GAME]`

## Code Standards
- Maximum function/method length: 50 lines (hook-enforced).
- Maximum file length: 300 lines (hook-enforced).
- Maximum function parameters: 5. If more, use a parameter object.
- No circular imports — module dependency graph must be acyclic (hook-enforced).
- Every public function/method must have a JSDoc comment with typed params and returns.
- Delete orphaned code. Do not comment it out. Git has history.
- Before creating a new utility, search the entire codebase for existing ones.
- Reuse existing patterns — check shared modules before writing new.
- No abbreviations in names except universally understood ones (id, url, http, db, api).
- All names must be intention-revealing. If you need a comment to explain what a variable
  holds, the name is wrong.

## Production Code Standards — NON-NEGOTIABLE

These apply to ALL code including prototypes. "It's just a prototype" is never a valid
exception. Prototypes become production code within days at CC development speed.

### SOLID Principles
- **Single Responsibility**: One module = one reason to change. Use "and" to describe it? Split it.
- **Open/Closed**: Extend via interfaces and composition. Never modify working code for new behavior.
- **Liskov Substitution**: Any interface implementation must be fully swappable. No isinstance checks.
- **Interface Segregation**: Small focused interfaces. No god-interfaces.
- **Dependency Inversion**: Depend on abstractions. Concrete classes are injected, never instantiated
  inside business logic.

### Zero Hardcoded Values
- ALL configuration through environment variables or config files. No exceptions.
- ALL external URLs, ports, credentials, thresholds, feature flags must be configurable.
- ALL magic numbers must be named constants with documentation.
- Config is validated at startup — fail fast if required values are missing.

### Zero Mocks in Application Code
- No mock objects, fake data, or stub responses in source code. Ever.
- Mocks belong ONLY in test files.
- For local dev: create proper interface implementations selected via config.
- No `if DEBUG: return fake_data` patterns. Use dependency injection to swap implementations.
- No TODO/FIXME stubs returning hardcoded values. Use NotImplementedError with a description.

### Interfaces First
Before writing any implementation:
1. Define the interface/protocol/abstract class
2. Define the data contracts (input/output DTOs)
3. Write the consuming code against the interface
4. Write tests against the interface
5. THEN implement the concrete class

### Dependency Injection
- Every service receives dependencies through its constructor.
- A composition root (main.py / app.ts / container) wires everything.
- No service locator pattern. No global singletons. No module-level instances.

### Error Handling
- Custom exception hierarchy per module. No bare Exception raises.
- Errors carry context: IDs, timestamps, operation names.
- Fail fast, fail loud. No silent swallowing of exceptions.
- Domain code never returns HTTP status codes — that's the API layer's job.

### Modular from Day One
- Feature-based modules over layer-based. Each feature owns its models, service, repository, routes.
- Module dependency graph must be acyclic.
- Every module has a clear public API via index.ts exports.

## Layered Architecture (Ports & Adapters / Hexagonal)

```
┌─────────────────────────────┐
│  API / CLI / Event Handlers │  ← Thin. Validation + delegation only. No logic.
├─────────────────────────────┤     These are DRIVING ADAPTERS (primary).
│  Services (Business Logic)  │  ← Orchestration. Depends on PORT INTERFACES only.
├─────────────────────────────┤
│  Domain Models              │  ← Pure data + behavior. No I/O. No framework imports.
│  (Entities, Value Objects)  │     The inner hexagon. Zero external dependencies.
├─────────────────────────────┤
│  Port Interfaces            │  ← Abstract contracts (Repository, Gateway, Notifier).
│                             │     Defined by the domain, implemented by adapters.
├─────────────────────────────┤
│  Repositories / Adapters    │  ← DRIVEN ADAPTERS (secondary). All external I/O
│                             │     (DB, APIs, files, queues, email, caches).
├─────────────────────────────┤
│  Infrastructure / Config    │  ← DI container, env config, connection factories
└─────────────────────────────┘
```

### Ports (Interfaces owned by the domain)
- **Repository ports**: `UserRepository`, `OrderRepository` — data persistence contracts.
- **Gateway ports**: `PaymentGateway`, `EmailSender` — external service contracts.
- Ports are defined in the domain/service layer, never in the adapter layer.
- Port interfaces specify WHAT, never HOW.

### Adapters (Implementations of ports)
- **Driving adapters** (primary): HTTP controllers, CLI handlers, message consumers
  — they CALL the application through port interfaces.
- **Driven adapters** (secondary): PostgresUserRepository, StripePaymentGateway,
  SESEmailSender — they ARE CALLED BY the application through port interfaces.
- Adapters are interchangeable. Swap `PostgresUserRepository` for `InMemoryUserRepository`
  in tests without changing a single line of business logic.

### Data Transfer Objects (DTOs)
- Use DTOs at layer boundaries — never pass domain entities to/from the API layer.
- **Request DTOs**: validated at the API boundary (Zod schema → typed object).
- **Response DTOs**: shaped for the consumer, not mirroring the domain model.
- **Domain ↔ Persistence mapping**: repositories map between domain entities and DB rows/documents.
- DTOs are plain data objects — no methods, no behavior, no framework decorators.

### Layer Rules
- Never skip layers. API handlers do not call repositories directly.
- Dependencies point INWARD only. Inner layers never import from outer layers.
- Domain models have ZERO external dependencies.
- The domain layer does not know HTTP, SQL, or any framework exists.

## Clean Code Principles

### Command-Query Separation (CQS)
- **Commands** change state but return nothing (void).
- **Queries** return data but change nothing (no side effects).
- A function should do one or the other, never both.
- Exception: stack.pop() style operations where separation is impractical — document why.

### Guard Clauses & Early Return
- Eliminate deep nesting. Handle invalid cases first, return early.
- The happy path runs at the shallowest indentation level.
- Before:
  ```
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        // actual logic buried 3 levels deep
  ```
- After:
  ```
  if (!user) throw new NotFoundError(...);
  if (!user.isActive) throw new InactiveError(...);
  if (!user.hasPermission) throw new ForbiddenError(...);
  // actual logic at top level
  ```

### Composition over Inheritance
- Prefer composing objects via interfaces and delegation over class inheritance.
- Inheritance creates tight coupling and fragile hierarchies.
- Use inheritance ONLY for genuine "is-a" relationships (rare).
- When in doubt, compose: inject a collaborator, don't extend a base class.

### Law of Demeter (Principle of Least Knowledge)
- A method should only call methods on: its own object, its parameters, objects it creates,
  its direct dependencies.
- Do NOT chain through objects: `order.getCustomer().getAddress().getCity()` — BAD.
- Instead: `order.getShippingCity()` or pass the needed data directly.

### Immutability by Default
- Use `const` over `let`. Use `readonly` on properties and parameters.
- Prefer `ReadonlyArray<T>`, `Readonly<T>`, `ReadonlyMap`, `ReadonlySet`.
- When you need to "modify" data, create a new copy with the change.
- Mutable state is the #1 source of bugs. Restrict it to the smallest possible scope.

### Pure Functions
- A pure function: same inputs → same outputs, no side effects.
- Domain logic, validation, transformation, and calculation should be pure.
- Side effects (I/O, logging, database) are pushed to the edges (adapters).
- Pure functions are trivially testable — no mocks needed.

### Factory Pattern
- Use factories to encapsulate complex object construction.
- Factory methods on the class itself for simple cases: `User.create(dto)`.
- Factory classes/functions when construction involves dependencies or conditional logic.
- Factories are the natural companion to dependency injection — the DI container
  IS the top-level factory.

> **Design reference patterns** (DDD, CQRS, GoF) available on demand via `get_design_reference` tool.

## CI/CD & Deployment

### Pipeline
- Every push triggers: lint → type-check → unit tests → build → integration tests.
- Merges to main additionally run: security scan → deploy to staging → smoke tests → promote.
- Pipeline must complete in under 10 minutes. Parallelize test suites, cache dependencies.
- Failed pipelines block merge. No exceptions.

### Environments
- Minimum three environments: **development** (local), **staging** (mirrors prod), **production**.
- Environment config is injected — same artifact runs everywhere with different env vars.
- Staging is a faithful replica of production (same provider, same DB engine, same services).

### Deployment Strategy
- Default: **rolling deployment** with health checks (zero downtime).
- For critical services: **blue-green** or **canary** with automated rollback on error rate spike.
- Every deploy is tagged with git SHA. Rollback = redeploy a previous SHA.
- Deployment must be one command or one button. No multi-step manual runbooks.

### Preview Environments
- Pull requests get ephemeral preview deployments where feasible (Vercel, Netlify, Railway).
- Preview URLs in PR comments for stakeholder review before merge.

## Testing Pyramid

```
         /  E2E  \          ← 5-10% of tests. Core journeys only.
        / Integration \      ← 20-30%. Real dependencies at boundaries.
       /    Unit Tests   \   ← 60-75%. Fast, isolated, every public function.
```

### Coverage Targets
- Overall minimum: 80% line coverage (blocks commit)
- New/changed code: 90% minimum (measured on diff)
- Critical paths: 95%+ (data pipelines, auth, PHI handling, financial calculations)

### Test Rules
- Every test name is a specification: `test_rejects_duplicate_member_ids` not `test_validation`
- No empty catch blocks. No `assert True`. No tests that can't fail.
- Test files colocated: `[module].test.[ext]` or in `tests/` mirroring src structure.
- Flaky tests are bugs — fix or quarantine, never ignore.

### Test Doubles Taxonomy
Use the correct double for the job:
- **Stub**: Returns canned data. No assertions on calls. Use when you need to control input.
- **Spy**: Records calls. Assert after the fact. Use to verify side effects.
- **Fake**: Working implementation with shortcuts (in-memory DB). Use for integration-speed tests.
- **Mock**: Pre-programmed expectations. Assert call patterns. Use sparingly — they couple to implementation.
Prefer stubs and fakes over mocks. Tests that mock everything test nothing.

### Test Data Builders
- Use Builder or Factory pattern for test data: `UserBuilder.anAdmin().withName('Alice').build()`.
- One builder per domain entity. Builders provide sensible defaults so tests only specify what matters.
- No raw object literals scattered across tests. Centralize in `tests/fixtures/` or `tests/builders/`.

### Property-Based Testing
- For pure functions with wide input ranges, add property tests (fast-check, Hypothesis, QuickCheck).
- Define invariants, not examples: "sorting is idempotent", "encode then decode = identity".
- Property tests complement, not replace, example-based tests.

## Test-Driven Development (TDD)

### Red-Green-Refactor — The Only Cycle
1. **RED**: Write a failing test that describes the desired behavior. Run it. It MUST fail.
   If it passes, the test is wrong — it's not testing what you think.
2. **GREEN**: Write the minimum code to make the test pass. No more.
3. **REFACTOR**: Clean up while all tests stay green. No new behavior in this step.
Repeat. Every feature, every function, every bug fix follows this cycle.

### Tests Are Specifications, Not Confirmations
- Write tests against **expected behavior**, never against current implementation.
- A test that passes on broken code is worse than no test — it provides false confidence.
- Never weaken an assertion to match what the code currently does. If the code disagrees
  with the spec, the code is wrong.
- Never write a test suite after the fact that just "locks in" existing behavior without
  verifying it's correct.

### Bug Fix Protocol
- **Every bug fix starts with a failing test** that reproduces the bug.
- The test must fail before the fix and pass after. No exceptions.
- If you can't write a reproducing test, you don't understand the bug well enough to fix it.

### One Behavior Per Test
- Each test verifies exactly one behavior or rule.
- A test with multiple unrelated assertions is testing multiple things — split it.
- Test name = the specification: `rejects_expired_tokens`, not `test_auth`.

## Data Guardrails ⚠️
- NEVER sample, truncate, or subset data unless explicitly instructed.
- NEVER make simplifying assumptions about distributions, scales, or schemas.
- State exact row counts, column sets, and filters for every data operation.
- If data is too large for in-memory, say so — don't silently downsample.

## Commit Protocol
- Conventional commits: feat|fix|refactor|docs|test|chore(scope): description
- Commits must pass: compilation, lint, tests, coverage gate, anti-pattern scan.
- Keep commits atomic — one logical change per commit.
- Commit BEFORE any risky refactor. Tag stable states.
- Update Status.md at the end of every session.

## MCP-Powered Tooling
### CodeSeeker — Graph-Powered Code Intelligence
CodeSeeker builds a knowledge graph of the codebase with hybrid search
(vector + text + path, fused with RRF). Use it for:
- **Semantic search**: "find code that handles errors like this" — not just grep.
- **Graph traversal**: imports, calls, extends — follow dependency chains.
- **Coding standards**: auto-detected validation, error handling, and state patterns.
- **Contextual reads**: `get_file_context` returns a file with its related code.
Indexing is automatic on first search (~30s–5min depending on codebase size).
Most valuable on mid-to-large projects (10K+ files) with established patterns.
Install: `npx codeseeker install --vscode` or see https://github.com/jghiringhelli/codeseeker

## Engineering Preferences
These calibrate the AI assistant's judgment on subjective trade-offs.
- **DRY is important** — flag repetition aggressively.
- **Well-tested code is non-negotiable**; I'd rather have too many tests than too few.
- **"Engineered enough"** — not under-engineered (fragile, hacky) and not over-engineered
  (premature abstraction, unnecessary complexity).
- **Handle more edge cases**, not fewer; thoughtfulness > speed.
- **Bias toward explicit over clever** — readability wins over brevity.
- When in doubt, ask rather than assume.

## Corrections Log
When I correct your output, record the correction pattern here so you don't repeat it.
### Learned Corrections
- [AI assistant appends corrections here with date and description]

## Game Loop & Frame Timing

- Use a fixed timestep for game logic updates (e.g., 60 Hz / 16.67ms) decoupled from the render frame rate. This ensures deterministic simulation regardless of display refresh rate.
- Accumulate elapsed time and consume it in fixed-size steps. Interpolate visual state between the previous and current simulation state for smooth rendering on variable-rate displays.
- Never tie game logic to `requestAnimationFrame` or vsync directly. Use `deltaTime` from a fixed update loop for physics, AI, and gameplay—use `requestAnimationFrame` only for rendering.
- Profile frame budgets rigorously. At 60 FPS, the total frame budget is ~16ms. Allocate budgets per system (e.g., physics 3ms, AI 2ms, rendering 8ms, overhead 3ms) and alert on overruns.
- Implement a frame rate limiter and graceful degradation: reduce visual quality (particle counts, draw distance, shadow resolution) before dropping simulation fidelity.
- Use a time scale factor to support pause, slow motion, and fast-forward without modifying core loop logic.

## Entity-Component-System (ECS) Architecture

- Separate identity (Entity), data (Component), and behavior (System). Entities are lightweight IDs; components are plain data structs; systems operate on sets of components.
- Organize components for data locality: store components of the same type in contiguous arrays (Struct of Arrays) to maximize CPU cache efficiency during system iteration.
- Systems should have no state of their own. They query the world for entities matching a component archetype and process them in a tight loop.
- Use component composition over inheritance. A `PlayerCharacter` is an entity with `Position`, `Velocity`, `Sprite`, `Health`, and `Input` components—not a deep class hierarchy.
- Implement an event bus or command buffer for deferred entity creation/destruction. Never modify the entity list while iterating over it.
- Tag components (zero-size marker components) are useful for filtering: `IsPlayer`, `IsEnemy`, `IsProjectile` let systems query efficiently without data overhead.

## Asset Management & Input Handling

- Preload and cache assets (textures, audio, meshes, fonts) during loading screens. Use an asset manifest to declare all required assets and track loading progress.
- Implement reference counting or handle-based asset management. Share loaded assets across entities and unload them only when no references remain.
- Use asset atlases (sprite sheets, texture atlases) to reduce draw calls. Batch rendering by texture to minimize GPU state changes.
- Abstract input handling behind an action mapping layer. Map physical inputs (keyboard keys, gamepad buttons, touch gestures) to logical actions (`Jump`, `Attack`, `MoveLeft`) defined in a rebindable configuration.
- Support input buffering: queue player inputs for a short window (2-5 frames) so that slightly early inputs still register. This dramatically improves perceived responsiveness.
- Handle input device hotplugging gracefully. Detect controller connect/disconnect events and update the UI prompts (keyboard glyphs vs. gamepad glyphs) accordingly.
- Implement an input replay/recording system for debugging and automated testing. Serialize input streams with frame timestamps for deterministic playback.

## Phaser 3 Project Setup

### Bootstrap
- Initialize Phaser with an explicit `GameConfig`: set `type: Phaser.AUTO` so Phaser chooses WebGL then falls back to Canvas. Declare `width`, `height`, `scale.mode`, `physics`, and an explicit `scene` array.
- Use Vite (or Webpack 5) as the bundler. Configure asset handling for textures, audio, and tilemaps via `assetsDir` and `publicDir` so raw files remain accessible during development without being inlined.
- Enable `pixelArt: true` and `antialias: false` for pixel-art games to prevent bilinear blurring. Use `roundPixels: true` to snap sprites to whole pixels.

### Scene Architecture
- Divide the game into discrete Scenes: `BootScene` (config/registry), `PreloadScene` (asset loading), `MenuScene`, `GameScene`, `UIScene` (HUD overlay), `PauseScene`, `GameOverScene`.
- Run the HUD as a parallel Scene (`this.scene.launch('UIScene')`) so it renders on top without being destroyed when the game scene restarts.
- Avoid god-object Scenes. Extract game logic into plain TypeScript systems/services injected via the Phaser registry (`this.registry.set('myService', instance)`).
- Use Phaser's `EventEmitter` (`this.events`) for intra-scene communication. Use `this.game.events` for cross-scene messaging. Never let scenes reference each other's instances directly.

### Physics
- Prefer Arcade Physics for simple axis-aligned collision. Use Matter.js integration only when complex polygon shapes are required — it has a significant overhead.
- Define physics bodies on `create()`, not inside `update()`. Destroying and re-creating bodies every frame is expensive.
- Use `setCollideWorldBounds(true)` and `setMaxVelocity()` to prevent tunneling and runaway acceleration.

### Asset Pipeline
- Use `this.load.atlas()` for sprite sheets; minimise the number of texture atlases to 1–2 per scene to keep GPU texture switches low.
- Pack atlases with TexturePacker or Shoebox. Export as JSON (Array or Hash format compatible with Phaser 3).
- Audio: load both `.ogg` and `.mp3` variants; Phaser picks the supported format at runtime. Use `this.sound.add()` and pool frequently played SFX.

## PixiJS Project Setup

### Renderer Initialization
- Use `Application.init()` (PixiJS v8 async API) with an explicit config: `{ width, height, backgroundColor, antialias, resolution: window.devicePixelRatio }`. Append `app.canvas` to the DOM rather than using auto-append to keep layout control.
- For pixel art, set `antialias: false` and `SCALE_MODE.NEAREST` via `TextureStyle.defaultOptions.scaleMode`.
- Prefer `ResizePlugin` with `resizeTo: window` for full-viewport games. For fixed-resolution games, scale a `Container` root and letterbox.

### Scene Graph
- Structure the display list as layered containers: `worldContainer` (tiles + entities), `fxContainer` (particles, lights), `uiContainer` (HUD, menus). Add all three to `app.stage` in order.
- Wrap game entities in typed display-object classes that extend `Container`. Avoid putting game logic directly in display objects — use a separate system that operates on them.
- Use `Container.sortableChildren = true` and manage `zIndex` only where needed. Unnecessary sorting is expensive.

### Rendering Performance
- Batch identical sprites by sharing a `Texture` or `SpriteSheet`. PixiJS auto-batches draw calls when textures are identical — atlas packing is essential.
- Use `ParticleContainer` for large sprite populations (e.g., bullets, sparks). It bypasses the general-purpose display-object pipeline for maximum throughput.
- Use `RenderTexture` for expensive static backgrounds and composited UI panels — render once, display as a sprite each frame.
- Profile with the PixiJS DevTools browser extension. Watch `drawCalls` per frame — target < 50 for smooth 60 FPS on mid-range mobile.

### Asset Loading
- Centralise all asset definitions in a manifest (`assets.ts`) and load via `Assets.loadBundle()`. Use bundles to scope assets per scene and unload on scene exit.
- Use `Assets.backgroundLoadBundle()` to stream assets while showing a menu. Avoid blocking the main thread during level transitions.

## Three.js / WebGL Setup

### Renderer & Scene Bootstrap
- Create a single `WebGLRenderer` with `{ antialias: true, powerPreference: 'high-performance' }`. Reuse it across scenes — creating multiple renderers leaks GPU contexts (browser limit is typically 8–16).
- Set `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` to cap resolution on high-DPI displays and avoid bandwidth-bound scenarios.
- Enable shadow maps only when needed: `renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap`. Limit shadow-casting lights to 1–2 per scene.
- Use `renderer.setAnimationLoop(tick)` for the render loop — it integrates with XR and handles tab visibility correctly, unlike a manual `requestAnimationFrame`.

### Scene & Camera
- Keep one active `Scene` object per game level. On level transition, dispose all geometries, materials, and textures in the outgoing scene before replacing it.
- Use `PerspectiveCamera` for 3D games. Tune `near`/`far` clipping planes tightly — a near/far ratio > 10,000 causes z-fighting. A ratio of 1/1000 is a safe starting-point.
- For 2.5D or UI overlays, maintain a separate orthographic camera and render pass.

### Geometry & Material Management
- Reuse `Geometry` and `Material` instances across `Mesh` objects via `instancedMesh` when drawing > 100 identical objects. `InstancedMesh` reduces draw calls from N to 1.
- Dispose resources explicitly: `geometry.dispose()`, `material.dispose()`, `texture.dispose()`. Three.js does not garbage-collect GPU resources automatically.
- Use `GLTFLoader` for 3D assets. Compress assets with `gltf-transform` using Draco (geometry) and KTX2/Basis (textures) — typically 70–90% smaller than raw GLTF.
- Share a single `TextureLoader` (or `LoadingManager`) across the app. Cache loaded textures in a `Map<string, THREE.Texture>` keyed by URL.

### Lighting & Post-Processing
- Prefer baked lightmaps for static environments to eliminate costly real-time light calculations.
- Use `@react-three/postprocessing` (r3f) or `three/examples/jsm/postprocessing/EffectComposer` for bloom, SSAO, and tonemapping. Chain passes on a single composer to minimize render targets.
- HDR environment maps via `RGBELoader` + `PMREMGenerator` provide physically accurate image-based lighting at low runtime cost.

### Raw Canvas / WebGL (No Framework)
- When authoring raw WebGL, manage shader programs as ES module string literals compiled once and cached in a `Map<string, WebGLProgram>`.
- Use Vertex Array Objects (VAOs) to encapsulate buffer bindings. Bind the VAO at draw time, not per-attribute setup.
- Use `ANGLE_instanced_arrays` (WebGL 1) or native instancing (WebGL 2) for repeated geometry.
- Consider `wgpu`/WebGPU for new projects targeting modern browsers — it exposes compute shaders and reduces CPU-side overhead significantly.

## Web Game Performance

### JavaScript Thread Budget
- Target < 6ms of JavaScript CPU time per 16ms frame. Profile with Chrome DevTools Performance panel. The flame chart pinpoints expensive `update()` call stacks.
- Move physics calculations, pathfinding, and procedural generation to a Web Worker. Communicate via `postMessage` with `SharedArrayBuffer` or `Transferable` objects to avoid serialisation overhead.
- Avoid per-frame allocations: object pools for bullets, particles, and audio nodes. GC pauses at inopportune moments cause visible stutter.

### Memory
- Audit GPU memory with `WEBGL_debug_renderer_info` + `getParameter`. GPU memory exhaustion silently degrades performance before crashing.
- Unload atlas textures on scene exit. GL textures live on the GPU until explicitly deleted — `gl.deleteTexture(tex)` or the framework's `.destroy()` / `.dispose()` equivalents.
- Set a target: < 256 MB JS heap for mobile web games. Use `performance.measureUserAgentSpecificMemory()` in development to track heap growth.

### Asset Delivery
- Serve assets from a CDN with immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`) using content-hashed filenames.
- Use the Compression Streams API or serve assets pre-compressed (Brotli > gzip). Atlas textures in KTX2 format (Basis Universal) reduce GPU upload time and GPU memory by 4–8× over PNG.
- Prefetch assets for the next level during gameplay idle periods with `fetch()` + `Cache API` rather than embedding loading screens in critical path.

### Mobile Web
- Test on real mid-range Android (Snapdragon 665 class) — not just desktop Chrome DevTools emulation. GPU drivers differ significantly.
- Reduce canvas resolution on low-power devices: detect `navigator.hardwareConcurrency < 4` or battery level via Battery API as a proxy for device capability.
- Touch input: use `pointer` events (`pointerdown`, `pointermove`, `pointerup`) instead of separate mouse/touch event handlers. Add `touch-action: none` to the canvas CSS to prevent scroll hijacking.


<!-- Custom Sections (preserved from previous file) -->

## Project Overview

Shattered Stars is a Phaser 3 tactical space combat game inspired by X-Wing Miniatures Game (TMG). It features multiple real-time arcade game modes (skirmish, survival, continuous tactical, dogfight, ace duel, campaign) with X-Wing-inspired ship dials, actions, and upgrade cards. All combat is real-time — the old discrete turn-based engine (BattleManager/TurnSystem) was removed; Campaign now runs on the same real-time flight/combat model as every other mode.


## Tech Stack

- **Engine**: Phaser 3
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Testing**: Vitest
- **Art Pipeline**: Stable Diffusion (A1111 WebUI) with stained glass LoRAs


## Code Style

- Use TypeScript strict mode with `exactOptionalPropertyTypes`
- Prefer `readonly` for immutable data
- Use explicit return types on exported functions
- Follow existing patterns in the codebase
- Keep systems modular and testable


## Commit Policy

**Commit after completing each major phase of work:**

1. After implementing a new system (e.g., OrdnanceSystem, TurretSystem)
2. After fixing a batch of related bugs
3. After adding tests for a feature
4. Before switching to a different task area
5. After refactoring a module

**Commit message format:**
```
type: Short description

Longer explanation if needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`


## Key Systems


### Combat Systems (src/systems/)
- **CombatSystem.ts** - Dice rolling, damage resolution
- **ActionsSystem.ts** - Focus, Evade, Barrel Roll, Boost, etc.
- **TargetingSystem.ts** - Arc checking, range, line of sight
- **MovementSystem.ts** - Maneuver templates and execution
- **OrdnanceSystem.ts** - Missiles, torpedoes, bombs, mines
- **TurretSystem.ts** - Turret arcs and rotation
- **PilotAbilities.ts** - Pilot talents and triggered abilities
- **UpgradeSystem.ts** - Upgrade slots and shop
- **SquadBuilder.ts** - X-Wing TMG style squad building
- **FlightControlSystem.ts** - Momentum-based arcade flying
- **PerformanceSystem.ts** - Adaptive quality for large battles


### Arcade Systems (src/arcade/)
- **systems/CycleFlight.ts** - The X-Wing cycle engine for every battle scene: spawn control from the
  definition, tick motion + cycle stress (AI ships fly BotPilots through the same controls)
- **systems/PlayerFlightPilot.ts** / **PilotFlightControls.ts** - Player flight input shared by all scenes
- **systems/QuickBuildEquip.ts** / **DiceAttack.ts** - Equip quick builds (upgrades + pilot ability) and
  resolve dice-mode shots with them; **ShotConditions.ts** / **PilotAbilityCombat.ts** - conditional ability knobs
- **ShotLevers.ts** - Position levers on every dice shot (rear arc +hit/+dmg, head-on joust −hit) and the squad-mark
  bonus; applied inside resolveDiceAttack (callers pass `targetMarked` to opt into the mark)
- **systems/SquadMark.ts** - One marked target per side (leader/player marks, expires on death or timeout);
  focus fire is what lets a coordinated squad beat solo aces (skill gate 2)
- **ai/** - THE in-game AI = the skill-gate bots (no Phaser). Scenes give each AI ship a **BotPilot**
  (`new BotPilot(tier, {reactionScale, random|seed})`, `fly(frame)` / `onCycleCommitted` / `reset`, same
  shape as PlayerFlightPilot; flies only through applyPilotFlightInput) with the tier from
  **difficultyToTier** (easy=novice, normal=average, hard=expert, brutal=expert ×0.5 reaction), and each
  squad side a **SquadCommand** (orders + SquadMark; `aiLeader: false` on the player's side, where the
  player marks with MARK_TARGET — R / R3 — read via `PlayerFlightPilot.takeMarkRequest()`; `assistMark`
  lets wingmen mark their own focus while the player has none, never overriding a live player mark).
  Novice squads focus without marking; the mark bonus needs 2+ living ships on the side.
  **SquadBattleAi** (Survival/Campaign) adds hazard escape (`safePointFor` → BotPilot `safePoint`)
- **systems/repair/** - Repair events (hull/shield, source kind + ship) consumed by the per-ship overlay
  (src/ui/hud/overlay, `ShipRepairFeedback`) and pooled repair drones (src/rendering/repairDrones);
  `hullRepairPerSecond` knob (pauses after hits)
- **objectives/** - Pure objective models (escort, defend, capture/hold, assassinate, route/race,
  sabotage, salvage, survive, stealth) shared by Campaign and Scenarios
- **ArcadeStress.ts** - Pilot stress driven by ship dial difficulty (green/white/red rates,
  K-turn + boost instant spikes, hysteresis thresholds, HUD color helpers)
- **ArcadeOrdnance.ts** - Arcade ordnance slots, cooldowns, homing
- **ArcadeTurret.ts** - 360° auto-targeting turrets with ms-based cooldowns
- **reinforcements/** - Reinforcement-pool battles (default for Skirmish, Epic, Scenario;
  Classic stays a Squad Builder toggle): per-side pool (1000; Epic 1200) spent on every
  deploy, on-field cap (250; Epic 500), category quotas (bombers / aces / capitals), strategy
  presets + AI planner, the player's reserve + replacement picker (auto-accepts in 5 s),
  pool exhaustion or 3:00 destroyed points decide. Pure `ReinforcementDirector`; scene glue in
  src/scenes/arcadeBattle/reinforcements/ (ReinforcementController, HUD panel, picker).
  Reinforced scenarios play to higher thresholds (reinforcedScenario.ts).
- **scenarios/** - X-Wing 2.0 Scenario mode rules (Satellite Array, Chance Engagement,
  Salvage, Scramble): control (medium+ count double), round scoring (12-cycle rounds),
  half/full destruction points, first to 20; AI objective roles (scenarioAi). Scene glue:
  src/scenes/scenario/ (ScenarioController hooks in ArcadeBattleScene, HUD, picker).


### Modes (beyond the battle scenes)
- **Survival roguelite** - src/systems/survival/* (seeded sector maps, run state/persistence, shop,
  repair dock, events, relics, meta-progression, history), src/data/survival/*, SurvivalMapScene /
  SurvivalSummaryScene. Spec: docs/adr/ADR-0004-survival-roguelite-run-structure.md
- **Campaign (SC2-style)** - src/campaign/* (scripting interpreter, hero powers V/B, armory, research,
  hub mission graph, hazards, save v3), src/data/campaign/*, CampaignCompleteScene. Spec: docs/specs/campaign.md
- **Flight School** - FlightSchoolScene + src/tutorial/* (input-verified lessons, bound keys in prompts)
- **Settings / accessibility** - SettingsScene tabs, src/input/KeyBindings.ts (rebinding profiles),
  src/ui/theme/signalPalettes.ts (colorblind), src/systems/settingsSchema.ts; local telemetry src/telemetry/
  (spec: docs/specs/player-preferences.md). Plan: docs/PROFESSIONALIZATION_PLAN.md


### Menu UI (src/ui/menu/, src/ui/theme/)
- **HoloTheme.ts** tokens + **holoFont.ts** (`holoFont(size, weight)` — never use the `font: "bold 18px Arial"`
  shorthand: Phaser splits it on spaces and drops multi-word families)
- **MenuScaffold.ts** - every non-battle screen: `addMenuBackdrop` (dimmed painted bg), `addMenuHeader`,
  `addBackButton` (top-left), `addFooterHint`; primary action bottom-centre
- **ButtonFactory.ts** renders holo (`HoloPressButton`, fires on press; legacy `color` → variant);
  **MenuFocus.ts** keyboard focus ring; **MenuIcons.ts** procedural glyphs; **holoChrome.ts** frames/gauges
- Main-menu rows stay at x=640, y=220+40·i (`tests/e2e/helpers/game.ts` MENU_POSITIONS)


### Data (src/data/)
- **ShipDefinitions.ts** - All ship stats and configurations
- **ModeBalancing.ts** - Per-mode stat adjustments
- **upgrades/** - Upgrade catalog by category; every card has a real-time effect (spec: docs/specs/upgrades-and-slots.md)
- **ShipSlots.ts** - Slot bar per ship (single source); **ShipLoadouts.ts** - quick-build loadouts, validated by **loadoutRules.ts**
- **shipPricing.ts** - Bare-hull price heuristic (role anchor + lever deltas); variants must differ on real-time levers (spec: docs/specs/ship-variants.md, gate: ShipVariants.test.ts)


### Core Types (src/core/)
- **types.ts** - ShipState, ManeuverDefinition, etc.
- **errors.ts** - Typed error handling
- **ArcadeControls.ts** - Discrete 500ms cycle system: createControlState, processCommand,
  updateManeuver, advanceCycle, startManeuver. Ships always execute a maneuver (default straight);
  nextManeuver queues the next cycle. SPEED_SCALE_FACTOR + baseSize drives per-cycle displacement.


## Factions

| ID | Name | Playstyle |
|----|------|-----------|
| `terran_hegemony` | Terran Hegemony | Elite, expensive ships |
| `free_confederation` | Free Confederation | Balanced, versatile |
| `synthetic_collective` | Synthetic Collective | Swarm tactics, drones |
| `void_corsairs` | Void Corsairs | Fast raiders, hit-and-run |
| `ascendant_empire` | Ascendant Empire | Heavy shields, support |


## Ship Roles

- `light_fighter` - Cheap, fast, low durability
- `heavy_fighter` - Balanced combat ships
- `interceptor` - Very agile, pursuit focused
- `bomber` - Slow, ordnance-heavy
- `gunship` - Tanky, high firepower
- `support` - Buffs, coordination, command
- `capital` - Huge ships (epic format only)


## Testing

Run tests before committing:
```bash
npm test -- --run
```

All tests must pass. Current: 4159 unit/balance/sim tests + 374 e2e tests (`npm run test:skill`: 24 gate tests).

Piloting gates (src/simulation/skill — the game's own AI from src/arcade/ai, BotPilot + SquadCommand,
flying the real engine through the player's inputs): fast smoke versions run in the unit suite (tests/unit/simulation/skill); the full
gates run with `npm run test:skill` (`SKILL_PAIRS=all` for the whole fighter matrix). Gate 1: expert
beats novice >= 85% in any fighter pair (novice ship up to +30% points). Gate 2: coordinated average
squad beats equal points of solo experts >= 70%. Never move the thresholds — tune the levers.


## Development Workflow

1. Create a todo list for complex tasks
2. Implement incrementally, testing as you go
3. Run type checking: `npx tsc --noEmit`
4. Run tests: `npm test -- --run`
5. Commit completed phases
6. Update CLAUDE.md if adding major systems


## Art Generation

All Stable Diffusion generation **must** go through the shared queue server. Do NOT call Forge directly.


### SD Queue Server (port 8010)

**Endpoint**: `http://127.0.0.1:8010`

Submit a job:
```
POST /jobs
{
  "project":  "shattered-stars",
  "endpoint": "/sdapi/v1/txt2img",
  "priority": 5,
  "payload":  { ...Forge txt2img payload... }
}
→ { "job_id": "abc123" }
```

Poll for completion:
```
GET /jobs/{job_id}
→ { "status": "pending|running|succeeded|failed",
    "result": { "images": ["base64..."], "info": "..." } }
```

When `status == "succeeded"`, consume `result.images[0]` (base64 PNG).
When `status == "failed"`, read `result.error`.

**Script**: `scripts/sd_queue.py` wraps this API with a local file-based job
tracker so multiple scripts can batch-submit without stepping on each other.
Use `submit_and_start_worker(jobs)` from other scripts.


### Model / LoRA

- Checkpoint: `dreamshaper_8.safetensors` (default; loaded at session start)
- Portrait LoRA: `concept_art` @ 0.60
- Pass checkpoint overrides in `payload.override_settings.sd_model_checkpoint`


### Output directories

- `public/assets/portraits/<faction>/` — pilot portrait PNGs (512×768)
- `public/assets/ships/<faction>/` — ship sprite PNGs
- `public/sprites/effects/` — weapon effects, explosions
- `public/sprites/ui/` — interface elements


### ComfyUI (remote, RTX 5070)

A second art-generation node runs ComfyUI on another PC on the LAN, behind a
Caddy reverse proxy with HTTP basic auth.

- **URL**: `http://192.168.4.21:8188`
- **Auth**: HTTP basic (user/password) — credentials are in `comfyui.config`
  at the repo root (gitignored, not checked in; ask the user if it's missing).
- Treat this the same as Forge: prefer routing through a shared queue if/when
  one exists for it. Until then, calls go directly to the endpoint above.


## Music Generation — Harmonia

**Harmonia** is the local music production service for this project. It is running and fully configured.

| Service | Port | Project ID | Config |
|---|---|---|---|
| Harmonia | 8002 | `shattered_stars` | `C:/Users/eu01244715/workspace/harmonia/projects/shattered_stars/` |
| ACE-Step | 8001 | — | `C:/Users/eu01244715/workspace/ACE-Step/harmonia_adapter.py` |

**Music structure:** Faction-driven. Six contexts: `hegemony`, `confederation`, `synthetic`, `corsairs`, `ascendant`, `void_tide`. Each has tactical + combat + boss tracks. Two cross-faction motifs: `motif_void_tide_cell` (3-note Phrygian descent) and `motif_nexus_broadcast` (electronic activation signal).

**Key routes:**
```
GET  http://localhost:8002/projects/shattered_stars/assets/status        # audit
POST http://localhost:8002/projects/shattered_stars/generate/ace-step    # generate a track
POST http://localhost:8002/projects/shattered_stars/prompts/composition  # get a paste-ready prompt
GET  http://localhost:8002/projects/shattered_stars/assets/file/{id}     # fetch audio file
```

**ACE-Step request shape:**
```json
{ "era_id": "hegemony", "mood": "combat", "seed": 42, "duration": 120 }
```

**Track IDs:** `heg_tactical`, `heg_combat`, `heg_boss`, `heg_victory`, `heg_defeat`, `conf_tactical`, `conf_combat`, `conf_boss`, `conf_victory`, `conf_defeat`, `syn_tactical`, `syn_combat`, `syn_boss`, `syn_awakening`, `cors_tactical`, `cors_combat`, `cors_boss`, `cors_heist`, `asc_tactical`, `asc_combat`, `asc_boss`, `asc_prophecy`, `void_encounter`, `void_nexus_discovery`, `void_campaign_credits`.

**Faction-specific notes:**
- `synthetic`: synthesizer/electronic only — no acoustic instruments. Chromatic, metric-shifting.
- `ascendant`: non-Western instruments only (duduk, erhu, oud). 432hz, vast reverb, minimum notes.
- `void_tide`: no melody, no harmony, subsonic only. The absence of music is intentional.

**Full manual:** `C:/Users/eu01244715/workspace/harmonia/docs/specs/Harmonia_-_Music_Generation_Manual.md`

---

## Known Issues

_(Epic format ships as of 2026-03-28; huge ships gated to Epic/Campaign in squad builder)_

Surfaced by the verify loop (`npm run verify:loop`) — tracked SHOULD findings, not gameplay-state defects:
- **Scene re-entry texture re-add** (INV-6b): forcing a scene restart re-adds runtime ship
  PNG textures → Phaser logs `Texture key already in use`. Real fix = idempotent scene
  texture registration. Tracked; MUST NOT be resolved by weakening a MUST invariant.
- **Missing encyclopedia art** (INV-6c): RESOLVED (2026-08-25). `synth_gestalt_art.png`
  was generated (Forge :7860 + `python scripts/generate_ship_art.py --id synth_gestalt`
  → `python scripts/direct_forge_worker.py`); verify loop reports `INV-6c asset gaps none`.
  Full runbook for starting Forge and regenerating any asset: [docs/ASSET_GENERATION.md](docs/ASSET_GENERATION.md).


## Next Steps

- Survival balance sweep (threat, elites, relic values) with the headless simulator (ADR-0004 initial values)
- Combat pace: ~0.5 dmg/s vs 70-95 HP fighters makes some nodes slow; revisit with duel_tempo_report
- Gamepad rebinding; Survival/Campaign telemetry one-liners; default-difficulty setting consumer
- Ally repair auras outside Skirmish; Scenario mode online (Lobby) and a main-menu entry
- Professionalization P1-5 / P2 items (docs/PROFESSIONALIZATION_PLAN.md)
- Vercel/GitHub Pages publish (user-directed when ready)


## Routing (sentinel navigation)

The one door routes to scoped slices — do not scan the whole tree. Run `npm run sentinel`
for live status + next action. Full concern→file index: [docs/spec-map.md](docs/spec-map.md).

- **Movement / telemetry fidelity** → docs/specs/telemetry-xwing-reference.md, ADR-0001,
  src/systems/MovementSystem.ts, src/simulation/XWingReference.ts. Gate: `npm run analyze:telemetry`.
- **Progression / XP / unlocks** → docs/specs/progression.md, ADR-0002,
  src/systems/PlayerProfile.ts, src/data/ProgressionData.ts, src/systems/CampaignSaveManager.ts.
- **Verify loop** → docs/specs/verify-loop.md, scripts/verify_loop.ts, scripts/vqa_helpers.ts.
- **Squad building** → src/systems/SquadBuilder.ts, src/scenes/SquadBuilderScene.ts, ShipPickerScene.ts.
- **Settings / rebinding / accessibility / Flight School / local telemetry** →
  docs/specs/player-preferences.md, src/systems/SettingsStorage.ts, src/input/KeyBindings.ts,
  src/ui/theme/signalPalettes.ts, src/tutorial/, src/telemetry/telemetry.ts.
- **Bound prompts** (unit of work) → DEVELOPMENT_PROMPTS.md.

## Known Pitfalls

Technology traps in this repo — what goes wrong, the wrong pattern, the right one.

- **`npx tsx` fetches remotely when tsx is not installed.** `tsx` is a declared dep but
  can be absent from `node_modules` after a partial install; then every `npx tsx`
  (scripts, hooks, tests/integration/p2p_server.test.ts) hits the registry and hangs
  ~40s, making the coverage hook fail. → Run `npm install`; confirm `node_modules/.bin/tsx`
  exists before running tsx-based scripts.
- **Coverage pre-commit hook runs the FULL suite under `--coverage`** only when `src/`
  files are staged. A single slow/flaky suite (e.g. the p2p subprocess test) blocks the
  commit even though unit tests pass. → Keep integration subprocess startup fast; never
  bypass with `--no-verify`.
- **Git identity is not set globally.** Commits succeed with a fallback author; set
  `git config user.email/name` if authorship matters.
