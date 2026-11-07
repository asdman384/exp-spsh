#!/usr/bin/env node
// Cross-platform verification gate. Invoke local CLIs with Node directly so
// Windows needs neither a shell nor npm/npx PowerShell execution-policy changes.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const ng = join(root, 'node_modules/@angular/cli/bin/ng.js');
const tsc = join(root, 'node_modules/typescript/bin/tsc');
const layers = [
  { name: 'lint', title: 'ESLint + angular-eslint', cli: ng, args: ['lint'] },
  { name: 'typecheck', title: 'tsc -b, app + spec', cli: tsc, args: ['-b', 'tsconfig.app.json', 'tsconfig.spec.json'] },
  {
    name: 'build',
    title: 'type-check + production bundle',
    cli: ng,
    args: ['build', '--configuration=production', '--output-path=tmp/harness-dist'],
  },
  { name: 'test', title: 'headless Chromium', cli: ng, args: ['test', '--watch=false'] },
];
const selected = new Set();
let include;
const args = process.argv.slice(2);

function usageError(message) {
  console.error(`harness: ${message}`);
  process.exit(2);
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    console.log(`Verification harness for exp-spsh (Windows, Linux, macOS).

Usage:
  node scripts/harness.mjs              # all four layers (same as --all)
  node scripts/harness.mjs --all
  node scripts/harness.mjs --lint
  node scripts/harness.mjs --typecheck
  node scripts/harness.mjs --build
  node scripts/harness.mjs --test
  node scripts/harness.mjs --test --include src/shared/helpers/index.spec.ts
  npm run harness -- --test             # npm alias; pass flags after --

Layers run in order: lint, typecheck, build, test. Flags can be combined.
Build output: tmp/harness-dist (does not disturb npm run watch).
Paths/globs for --include are relative to the repository root; quote globs.
The working directory is always the repository root, wherever invoked.
Exit codes: 0 = passed, 1 = layer failure, 2 = invalid arguments or setup.`);
    process.exit(0);
  } else if (arg === '--all') {
    layers.forEach(({ name }) => selected.add(name));
  } else if (layers.some(({ name }) => arg === `--${name}`)) {
    selected.add(arg.slice(2));
  } else if (arg === '--include') {
    include = args[++i];
    if (!include || include.startsWith('--')) usageError('--include needs a path or glob');
  } else {
    usageError(`unknown argument '${arg}'`);
  }
}

if (selected.size === 0) layers.forEach(({ name }) => selected.add(name));
if (!existsSync(join(root, 'keys.json'))) {
  usageError('keys.json is missing -- copy keys.example.json and fill it in. Every build imports it directly.');
}
for (const { name, cli } of layers) {
  if (selected.has(name) && !existsSync(cli)) {
    usageError('local dependencies are missing -- run npm install (with scripts enabled).');
  }
}

let failed = false;
for (const layer of layers) {
  layer.status = 'skipped';
  if (!selected.has(layer.name)) continue;
  console.log(`=== harness: ${layer.name} (${layer.title}) ===`);
  const layerArgs = [...layer.args];
  if (layer.name === 'test' && include) {
    console.log(`--- restricted to: ${include}`);
    layerArgs.push('--include', include);
  }
  const result = spawnSync(process.execPath, [layer.cli, ...layerArgs], {
    cwd: root,
    stdio: 'inherit',
  });
  layer.status = result.status === 0 ? 'passed' : 'FAILED';
  if (result.error) console.error(`harness: ${result.error.message}`);
  if (result.signal) console.error(`harness: ${layer.name} terminated by ${result.signal}`);
  if (layer.status === 'FAILED') failed = true;
  console.log();
}

console.log('=== harness summary ===');
for (const { name, status } of layers) console.log(`  ${(name + ':').padEnd(11)}${status}`);
console.log(`harness: ${failed ? 'FAILED' : 'green'}`);
process.exitCode = failed ? 1 : 0;
