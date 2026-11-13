// Lists the routes @sentry/nextjs wrapped in a build's server output.
// The wrapping loader's templates embed the route as componentRoute:"..." (server components)
// and parameterizedRoute:"..." (route handlers); unwrapped modules don't contain them.
//
// Usage: node scripts/check.mjs [projectDir]
import fs from 'node:fs';
import path from 'node:path';

const projectDir = path.resolve(process.argv[2] ?? '.');
const serverAppDir = path.join(projectDir, '.next', 'server', 'app');
const EXPECTED = ['componentRoute:"/"', 'componentRoute:"/about"', 'parameterizedRoute:"/api/hello"'];

const found = new Set();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.js')) {
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/(componentRoute|parameterizedRoute):"[^"]*"/g)) {
        found.add(m[0]);
      }
    }
  }
}
walk(serverAppDir);

const trace = fs.readFileSync(path.join(projectDir, '.next', 'trace'), 'utf8');
const bundler = trace.match(/"bundler":"([a-z]+)"/)?.[1] ?? 'unknown';
const missing = EXPECTED.filter((e) => !found.has(e));
console.log(
  JSON.stringify({ projectDir, bundler, wrapped: [...found].sort(), missing, ok: missing.length === 0 }),
);
process.exitCode = missing.length === 0 ? 0 : 1;
