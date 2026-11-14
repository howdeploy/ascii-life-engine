#!/usr/bin/env node
/*
 * Headless renderer for ascii-life: one screenshot or a frame-exact video.
 * Agents use it to look at what they built instead of guessing.
 *
 *   node tools/render.js '{"scene":"koi"}' shot.png            # one frame after 4 s of simulation
 *   node tools/render.js '{"scene":"koi"}' shot.png 0 720      # ... after 12 s
 *   node tools/render.js options.json clip.mp4 600             # 10 s of video at 60 fps
 *
 * Arguments: <options JSON | path to .json> <out.png | out.mp4> [frames=0] [warmupFrames=240]
 * Environment: WIDTH, HEIGHT (default 1920x1080), CHROME (browser binary),
 *              PLAYWRIGHT (path to the playwright-core module if it is not resolvable).
 * Needs: playwright-core, a Chromium-based browser, and ffmpeg for video.
 *
 * Time is stepped by hand, exactly 1/60 s per frame, so output does not depend on machine speed.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let chromium;
try {
  chromium = require(process.env.PLAYWRIGHT || 'playwright-core').chromium;
} catch (err) {
  console.error('playwright-core not found. Run `npm i playwright-core` or set PLAYWRIGHT=/path/to/playwright-core');
  process.exit(1);
}

const [optArg, out, framesArg, warmArg] = process.argv.slice(2);
if (!optArg || !out) {
  console.error('usage: node tools/render.js <options JSON | file.json> <out.png | out.mp4> [frames] [warmupFrames]');
  process.exit(1);
}
const opts = JSON.parse(fs.existsSync(optArg) ? fs.readFileSync(optArg, 'utf8') : optArg);
const frames = +(framesArg || 0);
const warm = warmArg === undefined ? 240 : +warmArg;
const width = +(process.env.WIDTH || 1920), height = +(process.env.HEIGHT || 1080);
const engine = path.resolve(__dirname, '..', 'ascii-life.js');
const html = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#06070a;overflow:hidden}' +
  '#stage{position:absolute;left:0;top:0;width:100%;height:100%}</style><div id="stage"></div>';

(async () => {
  const launch = { headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] };
  if (process.env.CHROME) launch.executablePath = process.env.CHROME;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
  await page.setContent(html);
  await page.addScriptTag({ path: engine });
  await page.evaluate(o => {
    window.requestAnimationFrame = () => 0; // frames are advanced manually
    window.life = new AsciiLife(document.getElementById('stage'), o);
    life.running = true; life._last = 0; window.T = 0;
    window.step = n => { for (let i = 0; i < n; i++) { T += 1000 / 60; life._frame(T); } };
  }, Object.assign({ fps: 60 }, opts));
  await page.evaluate(n => step(n), warm);
  const info = await page.evaluate(() => ({
    scene: life.o.scene, grid: life.cols + 'x' + life.rows, activeCells: life.stats.cells,
    creatures: life.items.length, webgl: !!life.gl
  }));
  console.log(JSON.stringify(info));
  if (/\.png$/i.test(out)) {
    await page.screenshot({ path: out });
  } else {
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '60', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < frames; f++) {
      await page.evaluate(() => step(1));
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  if (problems.length) console.log('PAGE ERRORS: ' + problems.join(' | '));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
