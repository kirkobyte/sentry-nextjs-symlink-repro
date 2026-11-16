// Fails unless @sentry/nextjs wrapped every route of //app in a `.next` build output.
//
// Sentry's wrapping loader templates embed the route of each wrapped module in the server
// output: componentRoute:"/about" for server components, parameterizedRoute:"/api/hello" for
// route handlers. Unwrapped modules don't contain them.
//
// Usage: node check_wrapped.mjs path/to/.next
import fs from 'node:fs';
import path from 'node:path';

const nextDir = path.resolve(process.argv[2]);
const EXPECTED = [
  'componentRoute:"/"',
  'componentRoute:"/about"',
  'parameterizedRoute:"/api/hello"',
];

const found = new Set();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.js')) {
      for (const m of fs
        .readFileSync(p, 'utf8')
        .matchAll(/(componentRoute|parameterizedRoute):"[^"]*"/g)) {
        found.add(m[0]);
      }
    }
  }
}
walk(path.join(nextDir, 'server', 'app'));

const bundler =
  fs.readFileSync(path.join(nextDir, 'trace'), 'utf8').match(/"bundler":"([a-z]+)"/)?.[1] ??
  'unknown';
const missing = EXPECTED.filter((e) => !found.has(e));

console.log(`bundler: ${bundler}`);
console.log(`wrapped: ${[...found].sort().join(', ') || '(none)'}`);
if (missing.length > 0) {
  console.log(`NOT WRAPPED: ${missing.join(', ')}`);
  process.exitCode = 1;
}
