// Mirrors the project the way a Bazel sandbox lays out its inputs: every directory is a real
// directory and every file is a symlink to the original file. node_modules is linked as a
// whole to keep this fast; it doesn't affect the bug, which is about the app's own files.
//
// Usage: node scripts/make-symlink-farm.mjs [dest]   (default: ../sentry-symlink-repro-farm)
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(import.meta.dirname, '..');
const dest = path.resolve(process.argv[2] ?? path.join(src, '..', 'sentry-symlink-repro-farm'));
const SKIP = new Set(['.next', 'node_modules', '.git', 'bazel']);

fs.rmSync(dest, { recursive: true, force: true });

function mirror(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith('bazel-')) continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) mirror(a, b);
    else fs.symlinkSync(a, b);
  }
}

mirror(src, dest);
fs.symlinkSync(path.join(src, 'node_modules'), path.join(dest, 'node_modules'));
console.log(`symlink farm: ${dest} -> ${src}`);
