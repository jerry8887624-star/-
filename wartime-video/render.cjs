// 用法：node render.js preview t1 t2 ...  |  node render.js video out.mp4
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(__dirname, 'scene.html'));
  await page.evaluate(() => document.fonts.ready);
  const canvas = await page.$('canvas');
  if (mode === 'preview') {
    for (const t of args) {
      await page.evaluate(t => renderAt(t), Number(t));
      await canvas.screenshot({ path: `${process.env.OUT || '.'}/preview_${t}.png` });
    }
  } else {
    const fps = 30, total = await page.evaluate(() => TOTAL);
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', args[0]],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(total * fps);
    for (let f = 0; f < n; f++) {
      await page.evaluate(t => renderAt(t), f / fps);
      const buf = await canvas.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 300 === 0) console.error(`frame ${f}/${n}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
