# Motor Factory Twin

A living 3D miniature of an electric-motor factory, viewed from an elevated "mountain" camera.
Raw materials arrive by truck, become a 7.5 kW induction motor through machining, assembly,
inspection and testing, are packed and palletised, and leave on an outbound truck — all at the
same time, in one continuous scene.

Built with React, TypeScript, Vite, Three.js, React Three Fiber, drei, Zustand and Recharts.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run typecheck    # TypeScript, no output files
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ locally
```

## Deploy

`npm run build` produces a fully static site in `dist/` with relative asset paths
(`base: './'` in `vite.config.ts`), so it works from any folder or sub-path:

- **Netlify / Cloudflare Pages / Vercel:** build command `npm run build`, output directory `dist`.
- **GitHub Pages:** push the contents of `dist/` to the `gh-pages` branch (or use an Actions workflow that runs `npm ci && npm run build` and uploads `dist`).
- **Any web server / S3 bucket:** copy `dist/` as-is.

No server, API keys or external assets are needed at runtime.

## Using it

### Camera — eye view, game-style controls

Every control is a drag, a click, the wheel or a key:

| Input | What it does |
| --- | --- |
| Click | Walk there at eye level; click a machine to stop in front of it, facing it |
| Left-drag | Rotate and move in one drag: left/right turns you, up/down walks you forward/back |
| Right-drag | Look around freely (up, down, all the way round) where you stand |
| Middle-drag / Shift-drag | Slide — drag the floor and the view slides with it |
| Wheel | Fly toward whatever is under the pointer; wheel back to rise over the whole factory |
| W A S D / arrows, Q / E | Walk and step sideways / turn, go down / up |
| Touch | One finger turns and walks like left-drag; two fingers slide and pinch to fly in or out |
| Double-click | Go close to a station or motor |

Nothing tilts or moves on its own. The lens blends from a 35° "model" view high up to a 65°
eye-level view near the floor, and a **● LIVE** tag shows the area you are standing in.
**⌂ Factory overview** brings the whole factory back, and **● Live cams** jumps to eye-level views of receiving,
machining, assembly, the test cells, packing and the dispatch dock. The minimap (bottom right)
shows where you are; click it to move there, or drag on it to slide the view around. The camera never goes below the floor, runs on
real time, and never affects production.

### Simulation

| Action | How |
| --- | --- |
| Play / Pause / Reset / speed | Top bar (0.5×, 1×, 2×, 4×) |
| Show / hide workers, labels, routes, quality lights, metrics | Toggle chips in the top bar |

Labels get more detailed as you zoom in: zone names at overview, station names at area
level, live operation and counts close up. Down on the floor only labels within 40 m show. Product serial tags appear when zoomed in with
**Product labels** on.

Selecting a test station opens its parameters (voltage, load, chamber temperature,
humidity, thermal cycles, spray time, bearing rating, tolerances…), the latest measured
values with their limits, a **Re-test with these settings** preview, and **Restart run with
these settings**. Selecting a motor shows its location, current station, elapsed time,
completed operations, every inspection and any failed tests, and highlights its route
through the factory. The rest of the factory keeps running throughout.

## How the simulation works

- **Deterministic engine** (`src/sim/engine.ts`): fixed 50 ms steps, seeded random numbers
  (`mulberry32`). The same seed and settings always give the same run. Reset fast-forwards
  15 simulated minutes so the line is already full when you look at it.
- **Products are a state machine on physical lanes.** A motor sits at a distance along a
  conveyor polyline, queues behind the motor ahead (1.7 m spacing), stops at each station
  in order, and can only change lanes at the diverter (to rework), the merge (back to
  inspection) or the scrap branch. After the line, it travels on pallets carried by
  forklifts and trucks. Nothing teleports.
- **Logistics:** the inbound truck brings eight raw pallets (six motor kits each), a forklift
  feeds the line, the palletiser stacks four cartons per pallet, a second forklift puts
  pallets into the pass-through finished-goods rack (8 bays × 2 levels), and a third loads
  every stored pallet onto the outbound truck, which leaves when its eight pallet positions
  (32 motors) are full. Every packed pallet you see is a real simulated one.
- **Milk run:** two tugger trains loop the aisle behind the line, carrying part bins from the
  feeder cells and the parts supermarket to the stations' flow racks.
- **Quality:** each motor gets built-in variation (and roughly one in eight a specific
  defect). Tests compute measurements from those attributes and the station's test
  conditions. Failures go to rework, which repairs what can be repaired; a motor that fails
  twice is scrapped.
- **Pause** freezes simulated time, and every animation (belts, robots, workers, AGV,
  vehicles) is driven by simulated time, so everything stops together. The camera runs on
  real time and never affects production.

### Test calculations — illustrative only

The calculations in `src/sim/quality.ts` follow the shape of real relationships so results
respond sensibly to the inputs, but they are **illustrative models with example limits**.
They are not validated engineering models and make no claim of compliance with any standard
or of real-world lifetime.

| Station | Measurements |
| --- | --- |
| Visual | Defect score vs. reject threshold |
| Dimensional | Bore deviation (+0.35 µm per % CNC tool wear) vs. tolerance; shaft run-out |
| Electrical | Line current `√(I_load² + I_mag²)`, applied voltage, speed from slip `∝ load·(400/V)²`, shaft torque `9550·P/n`, winding imbalance (+ wire-tension effect) |
| Environmental | Winding temperature `ambient + 80 K·(I/In)²/cooling`; insulation resistance falling with humidity and temperature; Coffin–Manson thermal-cycling damage; spray ingress index |
| Endurance | Vibration velocity (ISO 10816-style zones); speed under load; bearing `L10h = 10⁶/(60·n)·(C/P)³` vs. required hours |

## Project layout

```
src/
  config/layout.ts          Factory layout: zones, conveyor lanes, stations, docks, forklift corridors
  sim/
    engine.ts               Simulation engine: product state machine, stations, pallets, forklifts, trucks
    quality.ts              Product variation, test calculations, rework repairs
    params.ts               Editable simulation parameters
    metrics.ts              KPIs from the engine state
    describe.ts             Human-readable product locations and build stages
    path.ts, random.ts      Polyline geometry, seeded RNG
    runtime.ts              Read-only per-station view used by animated models
    engineInstance.ts       The shared engine
  state/uiStore.ts          Zustand store: playback, selection, toggles, camera requests
  scene/
    FactoryScene.tsx        Canvas, lights, simulation driver, scene assembly
    camera/                 Single camera rig (overview fit, dive-in blend, transitions) and live cams
    environment/            Site, building shell, floor markings
    transport/              Conveyors, vehicles, live trucks/forklifts/pallets/AGV/walkers
    stations/               Station shell (select/focus/highlight/stack light) and all machine models
    actors/                 Robot arm (2-link IK programs), worker
    products/               Motor components and the instanced product renderer
    props/                  Instanced racks and furniture, feeder cells, benches, offices
    overlays/               Labels, flow routes, selected-product path
  ui/                       Toolbar, live-cam picker, controls help and LIVE tag, minimap, metrics, station and product panels
```

## Performance notes

On slower graphics hardware open the app with `?lowgfx=1` (for example
`http://localhost:5173/?lowgfx=1`) to turn off shadows and high-DPI rendering.


Repeated geometry is shared (unit boxes/cylinders scaled per mesh), static furniture is
batched into one `InstancedMesh` per material, and every motor component is a single
`InstancedMesh` with a fixed slot per product. The simulation and the 3D loop never cause
React re-renders; panels refresh four times a second.
