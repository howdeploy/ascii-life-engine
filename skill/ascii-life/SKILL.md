---
name: ascii-life
description: Build or tune living ASCII animations with the ascii-life engine — creatures drawn as tiles with glyphs on a grid (butterflies, koi, jellyfish, dragonflies, frogs, or a new animal), with pointer and click reactions, water physics and a tweak panel. Use when asked for an ASCII animal animation, an animated ASCII background or hero, a screensaver of swimming or flying creatures, a new creature for ascii-life, or a pre-rendered clip of one.
---

# ascii-life

A single-file engine (`ascii-life.js`, ES5, no dependencies) that simulates creatures and renders
them as a grid of coloured tiles with ASCII glyphs. Creatures are drawn with vector paths into a
canvas where one pixel is one cell, so a new animal is ordinary Canvas 2D drawing code.

## Before you start

1. Find the engine: `ascii-life.js` in the project, or copy it from the ascii-life repository.
   It is the only file a page needs.
2. Read `AGENTS.md` next to it if present. It holds the full scene contract and helper list.
3. Decide which job this is and follow that section only.

## Job A — put an existing scene on a page

```html
<div id="stage" style="width:100%;height:100vh"></div>
<script src="ascii-life.js"></script>
<script>
  var life = new AsciiLife(document.getElementById('stage'), {
    scene: 'koi',            // butterfly | koi | jellyfish | dragonfly | frog
    palette: null,           // scene palette name; koi palettes are breeds
    count: null,             // null = scene default
    pointer: 'flee',         // flee | attract | none
    tapAction: null,         // scene action name, 'splash', 'none'
    waterMood: null          // leaves | clouds | sun | moon (pond scenes)
  }).start();
</script>
```

- Backdrop under content: `background: 'transparent', grid: false`.
- Weak device or TV: `maxDpr: 1, fps: 24, waterScale: 0.5`; drop `fx` and `bloom` if still slow.
- Change anything live with `life.set({...})`; clean up with `life.destroy()`.
- Let the user tune by eye: open `index.html`, move sliders, press Copy, paste the JSON as options.

## Job B — add a new creature

Add one entry to `AsciiLife.scenes` (in the engine file or in a separate script loaded after it).
Copy the closest existing scene and change it:

| New creature | Start from |
|---|---|
| flies, flaps | `butterfly` |
| long swimming body | `koi` (bone chain) |
| pulses, drifts | `jellyfish` |
| hovers and darts | `dragonfly` |
| sits and leaps between spots | `frog` |

Each scene needs `spawn(e)`, `update(e, dt)`, `draw(e, g)`, palettes with an `ink` colour, and
`scale`, `minDepth`, `reach`. Optional: `taps` + `tapDefault` for click actions, `water` for a pond.

Drawing rules:
- Call `place(g, c.x, c.y, c.a, c.s)`, then draw in creature units with +x pointing forward.
- A near creature spans 15–28 cells. Build it from 3–5 tones. Detail under 0.6 cell is lost.
- Alpha is brightness: 0.6–0.75 for fins and wings, under 0.28 turns into glyph-only cells.
- Appendages grow from a root on the body outline (`fan` helper), never float beside it.

Motion rules:
- `dt`-based, scaled by `e.unit`. Turn with `steer` (inertia). Keep neighbours apart with `separate`.
- Speed, pointer radius and wrap margin scale with the creature (`c.s`, `ext(e, units)`).
- Water is disturbed only by what touches it: `shed` for a wake, `splash` for an impact,
  `e.calm` under floating objects.

Code rules: ES5 only, no dependencies, randomness through `e.rnd()`.

## Job C — render a clip or a still

```sh
node tools/render.js '{"scene":"frog","count":5}' out.png            # still after 4 s
node tools/render.js settings.json clip.mp4 600 240                   # 10 s at 60 fps, 4 s warm-up
```

Time is stepped by hand at exactly 1/60 s, so the clip is identical on any machine. For a montage,
render one clip per scene and join them with ffmpeg (`xfade` for crossfades). For a seamless loop,
render extra frames and crossfade the tail into the head.

## Always verify by looking

After any change to shape, motion or light, render a still (and a short clip for motion), open it,
and judge it against the request. Fix what is wrong before reporting. Blind changes to this engine
have a poor record: tiny unreadable creatures, harsh glyphs, light that looked like oil stains.

Checklist before you say it is done:
- The creature is recognisable in a still at normal size and at its smallest depth.
- Parts are attached and move with the body; nothing pops or teleports on screen.
- Glyphs sit quietly inside tiles; the background stays dark and calm.
- On pond scenes, waves start where something touched the water.
- No console errors in the render output.
- You stated what you verified and what you did not.
