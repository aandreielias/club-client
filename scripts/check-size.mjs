// After `npm run build`: fails when what the browser loads at startup grows past the budget.
// Startup = the files index.html names plus the chunks they import statically (import() is lazy).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = { js: 180, css: 15 }; // gzip; pages and windows load lazily (ui/lazy.ts)

const html = readFileSync('dist/index.html', 'utf8');
const queue = [...html.matchAll(/(?:src|href)="[^"]*?assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const seen = new Set();
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  if (file.endsWith('.js'))
    for (const m of readFileSync(`dist/assets/${file}`, 'utf8').matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) queue.push(m[1]);
}

const kb = { js: 0, css: 0 };
for (const file of seen) {
  const size = gzipSync(readFileSync(`dist/assets/${file}`)).length / 1024;
  kb[file.endsWith('.js') ? 'js' : 'css'] += size;
  console.log(`${size.toFixed(0).padStart(5)} KB  ${file}`);
}
let failed = false;
for (const type of ['js', 'css']) {
  const over = kb[type] > BUDGET_KB[type];
  failed ||= over;
  console.log(`${over ? 'OVER' : 'ok  '} startup ${type}: ${kb[type].toFixed(0)} KB gzip (budget ${BUDGET_KB[type]} KB)`);
}
if (failed) process.exit(1);
