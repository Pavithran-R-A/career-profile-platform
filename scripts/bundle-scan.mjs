#!/usr/bin/env node
/**
 * Bundle scanner: reports production client asset sizes after `pnpm build`.
 * Informational (exit 0) unless --budget <kB> is passed, in which case it
 * fails when the largest eager (non-lazy) chunk exceeds the budget.
 */

import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(root, '..', 'dist', 'client', 'assets');

const budgetArg = process.argv.indexOf('--budget');
const budgetKb = budgetArg > -1 ? Number(process.argv[budgetArg + 1]) : null;

let files;
try {
  files = readdirSync(assetsDir)
    .filter((name) => /\.(js|css|png|svg|woff2?)$/.test(name))
    .map((name) => ({ name, bytes: statSync(join(assetsDir, name)).size }));
} catch {
  console.error(`No assets found in ${assetsDir} — run \`pnpm build\` first.`);
  process.exit(1);
}

const bySize = [...files].sort((a, b) => b.bytes - a.bytes);
const fmt = (n) => `${(n / 1024).toFixed(n >= 100 * 1024 ? 0 : 1)} kB`;

console.log(`Bundle scan: ${assetsDir}`);
console.log('');
console.log('Largest assets:');
for (const f of bySize.slice(0, 15)) {
  console.log(`  ${fmt(f.bytes).padStart(10)}  ${f.name}`);
}

const total = files.reduce((sum, f) => sum + f.bytes, 0);
const js = files.filter((f) => f.name.endsWith('.js')).reduce((s, f) => s + f.bytes, 0);
const css = files.filter((f) => f.name.endsWith('.css')).reduce((s, f) => s + f.bytes, 0);
const other = total - js - css;
console.log('');
console.log(
  `Total: ${fmt(total)}  (js ${fmt(js)} · css ${fmt(css)} · other ${fmt(other)})`
);

const heavy = bySize.filter((f) => f.bytes > 500 * 1024);
if (heavy.length > 0) {
  console.log('');
  console.log(
    'Chunks over 500 kB (acceptable only when lazy-loaded, e.g. the PDF stack on the ATS route):'
  );
  for (const f of heavy) {
    console.log(`  ${fmt(f.bytes)}  ${f.name}`);
  }
}

if (budgetKb !== null && Number.isFinite(budgetKb)) {
  const eager = bySize.find((f) => f.name.startsWith('index-') && f.name.endsWith('.js'));
  if (eager) {
    const kb = eager.bytes / 1024;
    console.log('');
    console.log(`Eager entry chunk: ${fmt(eager.bytes)} (${eager.name})`);
    if (kb > budgetKb) {
      console.error(`FAIL: eager chunk exceeds budget of ${budgetKb} kB.`);
      process.exit(1);
    }
    console.log(`OK: within budget of ${budgetKb} kB.`);
  }
}
