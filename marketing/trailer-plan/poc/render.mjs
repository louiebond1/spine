import {bundle} from '@remotion/bundler'; import {renderMedia, renderStill, selectComposition} from '@remotion/renderer'; import path from 'path';
const [,, id, out, stills] = process.argv;
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const serveUrl = await bundle({entryPoint: path.resolve('src2/index.jsx'), publicDir: path.resolve('public')});
const composition = await selectComposition({serveUrl, id, browserExecutable});
const t0 = Date.now();
if (stills) { for (const fr of stills.split(',').map(Number)) await renderStill({composition, serveUrl, frame: fr, output: `${out}-${fr}.png`, browserExecutable}); }
else await renderMedia({composition, serveUrl, codec: 'h264', crf: 14, outputLocation: out, browserExecutable, concurrency: 4, logLevel: 'error'});
console.log(id, 'done in', (Date.now() - t0) / 1000, 's');
