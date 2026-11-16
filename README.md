# @sentry/nextjs: auto-instrumentation skipped under Bazel when the bundler follows symlinks

`withSentryConfig` wraps App Router server components and route handlers at build time. In a
Bazel sandbox it silently wraps none of them when the bundler resolves an input file to its
real path. That's what Rspack (`next-rspack`) always does, and what webpack does once rules_js's
Node.js fs patches are off. The build succeeds and nothing is logged.

This is a Bazel workspace using [rules_js](https://github.com/aspect-build/rules_js) and its
`nextjs_build` rule. It builds the same app (`app/`: two pages and a route handler) three ways
and tests whether Sentry wrapped its routes.

## Versions

- `@sentry/nextjs` 11.1.0
- `next` 16.3.3, `next-rspack` 16.3.3 (`@rspack/core` 2.0.4)
- Bazel 9.3.2, rules_js 3.6.0, Node 24.22.1, pnpm 11.23.0
- macOS arm64 (darwin-sandbox)

## Run it

```sh
bazel test //...
```

Use [Bazelisk](https://github.com/bazelbuild/bazelisk) as `bazel`; `.bazelversion` pins Bazel.
Each `:sentry_wrapped_test` runs `tools/check_wrapped.mjs` on its variant's `.next` output. The
check looks for the route strings Sentry's wrapper templates embed in the server output
(`componentRoute:"/about"`, `parameterizedRoute:"/api/hello"`).

## Result

| Target | Bundler | rules_js fs patches | Sentry wrapped |
| --- | --- | --- | --- |
| `//webpack:sentry_wrapped_test` | webpack | on (default) | `/`, `/about`, `/api/hello` (PASSED) |
| `//rspack:sentry_wrapped_test` | Rspack | off (Rspack doesn't build with them on, see `rspack/BUILD.bazel`) | nothing (FAILED) |
| `//webpack-without-fs-patches:sentry_wrapped_test` | webpack | off | nothing (FAILED) |

On the [`with-fix`](../../tree/with-fix) branch, which applies the patch below with pnpm's
`patchedDependencies`, all three pass.

## Cause

`nextjs_build` runs `next build` in a Bazel sandbox. Like every input, the app's source files are
symlinks there: `<sandbox>/execroot/_main/bazel-out/.../rspack/src/app/about/page.js` points to
the real file in the shared output tree,
`<output_base>/execroot/_main/bazel-out/.../rspack/src/app/about/page.js`.

`constructWebpackConfigFunction` (`build/cjs/config/webpack.js`) builds `appDirPath` from Next's
`dir`, which is inside the sandbox. It then wraps a module only if the module's path starts with
`appDirPath + path.sep`. Both bundlers resolve symlinks by default (`resolve.symlinks: true`),
so the module path is the real file, outside the sandbox, and no module matches. The wrapping
loader makes the same assumption when it computes routes with
`path.relative(appDir, this.resourcePath)`.

Plain webpack only works under Bazel because rules_js patches Node's `fs` so that `realpath`
stays inside the sandbox, and webpack's resolver goes through Node's `fs`. Rspack's resolver is
native and doesn't use Node's `fs`, so the patches can't help it. `//webpack-without-fs-patches`
shows webpack behaving the same once the patches are off.

Setting `resolve.symlinks: false` isn't a workaround with rules_js or pnpm. Packages then can't
find their own dependencies, because those are only linked next to each package's real
directory.

## Proposed fix

`patches/sentry-nextjs-11.1.0-symlinked-project.patch` finds the project's real directory by
resolving a file inside it (`package.json`, or the Next config). It maps module paths under that
directory back onto `dir` in the wrapping rules and in the wrapping loader's route computation.
It changes nothing when the two directories are the same.

Resolving both sides with `fs.realpathSync` wouldn't be enough on its own: in the sandbox the
project directory is a real directory, so `realpath(appDirPath)` doesn't change; only the files
are symlinks.

## Layout

- `app/`: the app's sources and `next.config.mjs`, shared by the three variants
- `tools/defs.bzl`: `sentry_next_app`, which copies `app/` into the calling package, builds it with
  rules_js's `nextjs_build`, and adds `:sentry_wrapped_test`
- `webpack/`, `rspack/`, `webpack-without-fs-patches/`: one variant each
- `patches/`: the proposed fix
