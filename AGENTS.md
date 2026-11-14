# AGENTS.md — working on ascii-life

Instructions for any AI coding agent (Claude Code, Codex, Cursor, others) asked to add a creature,
tune a scene, or embed the engine somewhere.

## What this is

`ascii-life.js` is a single-file engine that draws living creatures on a grid of square tiles with
ASCII glyphs inside them. No dependencies, no build step, ES5 syntax, Canvas 2D for the creatures
and one small WebGL shader for water. It must keep running on an old TV browser (Chromium 85).

```
ascii-life.js      engine + five scenes (butterfly, koi, jellyfish, dragonfly, frog)
index.html          demo: scene tabs, tweak panel, RU/EN switch
tools/render.js     headless screenshot / video renderer — use it to look at your work
skill/ascii-life/  the same knowledge packaged as an agent skill
```

## The one rule that matters

**Look at what you made.** Every change to shape, motion or light must be checked with
`tools/render.js` before you report it done:

```sh
node tools/render.js '{"scene":"koi"}' /tmp/koi.png          # then open the PNG and judge it
node tools/render.js '{"scene":"koi"}' /tmp/koi.mp4 300      # 5 s of motion
```

This project was built over many rounds of feedback, and every round done without looking produced
something the user had to reject: creatures that collapsed into a row of pixels, glyphs that
shouted over the tiles, water light that looked like oil stains. Numbers picked blind are wrong.

## How a frame is built

1. **Mask.** The scene draws its creatures with ordinary vector paths into a tiny canvas where
   one pixel is one cell. Pixel alpha becomes the cell's coverage, RGB its colour.
2. **Owner map.** A second tiny canvas records which creature owns each cell. Glyphs and tile
   mottling are hashed in the owner's body coordinates, so texture travels with the body instead
   of flickering on the screen grid. The same map fades distant creatures into the background.
3. **Trail field.** Water scenes run a wave simulation on a grid twice as fine as the cells;
   creatures, clicks and jumps disturb it. Air scenes run a diffusing, decaying haze instead.
4. **Light layer.** Water is one fragment shader: pond bottom, refraction and caustics from the
   simulated waves only, shadow from the chosen lighting mood, sparkles. Calm water is flat and
   bends no light. Haze is drawn as a soft glow at grid resolution.
5. **Cells.** Coverage ≥ 0.28 → a filled tile plus a glyph drawn as a darker shade of the same
   tile. Lower coverage → glyph only, in the scene's ink colour.
6. **Post.** Bloom and blur from a quarter-size copy of the frame.

## Adding a creature

A scene is one entry in `AsciiLife.scenes`:

```js
AsciiLife.scenes.moth = {
  label: 'Moth', dot: '#c9b48a',        // tab label and swatch
  count: 10, palette: 'dusk',           // defaults
  scale: 1.6, minDepth: 0.4,            // cells per drawing unit; floor for far creatures
  reach: 7,                             // body radius in drawing units (owner map, culling)
  palettes: { dusk: { a: '#b89a6a', b: '#f0dfb8', c: '#3a2c18', ink: '#d6c090' } },
  // water: { mood: 'sun', bottom: [10, 40, 56] },   // add to make it a pond scene
  tapDefault: 'scare',
  taps: { scare: function (e, x, y) { /* react to a click at cell (x, y) */ } },
  spawn: function (e) { e.items = H.baseSpawn(e, H.countOf(e, this.count)); },
  update: function (e, dt) { /* move every item of e.items */ },
  draw: function (e, g) { /* draw every item into the mask context g */ }
};
```

`H` is `AsciiLife.helpers`. What you get:

| Helper | Use |
|---|---|
| `baseSpawn(e, n, fn)` | n creatures with position, heading `a`, depth `z`, phases `o1 o2 ph`, sorted far to near |
| `steer(e, c, dt, radius, wander, maxW, resp)` | turning with inertia; flees or follows the pointer inside `radius` |
| `separate(e, c, dt, r, push)` | neighbours at similar depth push apart |
| `wrap(e, c, margin)` / `ext(e, units)` | re-enter from the opposite edge; margin in cells |
| `near(e, c, radius)` | pointer proximity 0..1, sets `e._pa` to the escape angle |
| `scare(e, x, y, radius, fn)` | call `fn(c, awayAngle, closeness)` for creatures near a point |
| `shed(e, x, y, amt, dt)` / `splash(e, x, y, amt)` | disturb the trail field (wake, puff, splash) |
| `place(g, x, y, a, s)` | set the transform: draw in creature units, +x is forward |
| `ell`, `dot`, `fan` | filled ellipse, circle, fin-shaped fan |

Engine state a scene may read: `e.cols`, `e.rows`, `e.unit` (cols / 150), `e.t`, `e.rnd()`
(seeded), `e.o` (options), `e.pal` (active palette), `e.pointer`, and per creature `c.s`
(current scale in cells per unit, set by the engine each frame).

## Rules learned the hard way

**Shape**
- A near creature should span 15–28 cells. Below ~8 cells it reads as noise. Set `scale` and
  `minDepth` accordingly; never let depth shrink a creature to a strip.
- Detail smaller than 0.6 of a cell disappears. Build the body from 3–5 tones (edge, base,
  highlight, marks), not one flat fill.
- Brightness is carried by alpha: fins and wings at 0.6–0.75 alpha become dimmer tiles; anything
  under 0.28 becomes glyph-only. Use that on purpose for whiskers, tentacles, antennae.
- Attach appendages to the body. A fin is a fan growing from a root on the body outline, not an
  ellipse parked beside it.

**Motion**
- Everything is `dt`-based and scaled by `e.unit`; never count frames.
- Turn with `steer` (angular inertia). Instant heading changes look robotic on a large body.
- Think in body lengths per second. When you scale a creature up, scale its speed, its pointer
  radius (`c.s * k`) and its wrap margin with it.
- Long bodies want bones: a chain of nodes dragged behind the head with a bend limit per joint
  (see `koiChain`), with the swimming wave added on top.

**Light**
- Glyphs inside tiles are the tile's own colour, darker. White or contrasting glyphs look harsh.
- Water bends light only where a creature made a wave. No ambient shimmer, no fake reflections.
- A wave starts where the water was pushed: the rim of a lily pad, not the centre of the frog.
- Floating objects calm the water under them (`e.calm`).

**Code**
- ES5 only: `var`, `function`, no arrow functions, classes, template strings, `let`/`const`.
  One file, no imports, no build.
- No per-cell trigonometry in the render loop. Precompute per row/column or move it to the shader.
- Randomness through `e.rnd()` so a seed reproduces a scene.
- Options go in `DEFAULTS` with a one-line comment, and get a control in `index.html`
  (both `TEXT.ru` and `TEXT.en`).

## Embedding

```html
<div id="stage" style="width:100%;height:100vh"></div>
<script src="ascii-life.js"></script>
<script>
  var life = new AsciiLife(document.getElementById('stage'), { scene: 'koi' }).start();
  // life.set({ palette: 'showa', count: 8 });  life.tap(clientX, clientY);  life.destroy();
</script>
```

- As a backdrop under UI: `background: 'transparent'`, `grid: false`; pointer and click handling
  listen on `window`, so the canvas can sit behind content.
- On weak devices: `maxDpr: 1`, `fps: 24`, `waterScale: 0.5`, and `fx: false`, `bloom: 0` if needed.
- As a screensaver in a host app: create it when the host shows the saver, call `destroy()` when it
  hides. The engine re-measures its container, so it may be created before it is in the DOM.

## Reporting

Say what you changed, what you looked at (attach or describe the render), and what you did not
verify. Do not call a blind change finished.
