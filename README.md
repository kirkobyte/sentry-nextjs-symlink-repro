# @sentry/nextjs: auto-instrumentation skipped when project files are symlinks

`withSentryConfig` wraps App Router server components and route handlers at build time. When the
project's files are symlinks to files elsewhere, it silently wraps none of them, with webpack
and with Rspack (`next-rspack`). The build succeeds and nothing is logged.

Build systems that lay out their inputs this way, such as a Bazel sandbox, run into this.
`scripts/make-symlink-farm.mjs` creates the same layout without Bazel: real directories, with
every file a symlink to the original.

## Versions

- `@sentry/nextjs` 11.1.0
- `next` 16.3.3, `next-rspack` 16.3.3 (`@rspack/core` 2.0.4)
- Node 24, macOS arm64

## Run it

```sh
npm install
npm run repro            # 4 builds: {project dir, symlink farm} x {webpack, rspack}
```

`scripts/check.mjs` looks for the route strings Sentry's wrapper templates embed in the server
output (`componentRoute:"/about"`, `parameterizedRoute:"/api/hello"`). The app has two pages
and one route handler, so a correct build reports all three.

## Result

| Project dir | webpack | Rspack |
| --- | --- | --- |
| The project itself | `/`, `/about`, `/api/hello` wrapped | `/`, `/about`, `/api/hello` wrapped |
| Symlink farm of it | nothing wrapped | nothing wrapped |

## Cause

`constructWebpackConfigFunction` (`build/cjs/config/webpack.js`) builds `appDirPath` from
Next's `dir` and wraps a module only if its path starts with `appDirPath + path.sep`.
Both bundlers resolve symlinks by default (`resolve.symlinks: true`), so each module's path is
the real file, outside `dir`:

```
appDirPath:   /tmp/sentry-symlink-repro-farm/src/app
resourcePath: /tmp/sentry-symlink-repro/src/app/about/page.js
```

The wrapping loader makes the same assumption when it computes routes with
`path.relative(appDir, this.resourcePath)`.

### Where this shows up: Bazel

rules_js runs `next build` in a sandbox where every input file is a symlink into Bazel's output
tree. With webpack the bug stays hidden there, because rules_js patches Node's `fs` so that
`realpath` stays inside the sandbox, and webpack resolves through Node's `fs`. Rspack's
resolver is native and doesn't use Node's `fs`, so switching a Bazel-built app to `next-rspack`
silently drops the instrumentation.

Setting `resolve.symlinks: false` isn't a workaround with pnpm or rules_js. Packages then can't
find their own dependencies, because those are only linked next to each package's real
directory.

## Proposed fix

`patches/sentry-nextjs-11.1.0-symlinked-project.patch` finds the project's real directory by
resolving a file inside it (`package.json`, or the Next config). It maps module paths under
that directory back onto `dir` in the wrapping rules and in the wrapping loader's route
computation. It changes nothing when the two directories are the same.

```sh
scripts/fix.sh apply     # patch node_modules/@sentry/nextjs
npm run repro            # all four builds now wrap /, /about and /api/hello
scripts/fix.sh revert
```

Resolving both sides with `fs.realpathSync` wouldn't be enough on its own: the project
directory is a real directory, so `realpath(appDirPath)` doesn't change; only the files are
symlinks.
