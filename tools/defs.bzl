"""Builds //app with Next.js under Bazel and checks what @sentry/nextjs wrapped."""

load("@aspect_rules_js//contrib/nextjs:defs.bzl", "nextjs_build")
load("@aspect_rules_js//js:defs.bzl", "js_test")
load("@bazel_lib//lib:copy_file.bzl", "copy_file")

_APP_FILES = [
    "next.config.mjs",
    "src/app/layout.js",
    "src/app/page.js",
    "src/app/about/page.js",
    "src/app/api/hello/route.js",
]

def sentry_next_app(bundler, node_fs_patches = True):
    """Builds //app in the calling package and tests that Sentry wrapped its routes.

    Creates `:next` (the `.next` build output) and `:sentry_wrapped_test`.

    Args:
        bundler: "webpack" (`next build --webpack`) or "rspack" (next-rspack).
        node_fs_patches: Keep rules_js's Node.js fs patches on (the default). They make
            `fs.realpath` stay inside the sandbox instead of following each input's symlink to
            the real file. Only code that resolves through Node's fs is affected.
    """

    # Copy the shared sources into this package. Like any generated file, each copy is a real
    # file in bazel-out, and the sandbox for `next build` symlinks it in.
    for f in _APP_FILES:
        copy_file(
            name = "copy_" + f.replace("/", "_").replace(".", "_"),
            src = "//app:" + f,
            out = f,
        )

    env = {}
    args = []
    if bundler == "webpack":
        # Next 16 defaults to Turbopack.
        args = ["--webpack"]
    elif bundler == "rspack":
        # Read by next.config.mjs. withRspack requires `next build` without a bundler flag.
        env["BUNDLER"] = "rspack"
    else:
        fail("bundler must be webpack or rspack, not %s" % bundler)
    if not node_fs_patches:
        env["JS_BINARY__PATCH_NODE_FS"] = "0"

    nextjs_build(
        name = "next",
        config = "next.config.mjs",
        srcs = [f for f in _APP_FILES if f != "next.config.mjs"],
        data = [
            "//:package_json",
            "//:node_modules/@sentry/nextjs",
            "//:node_modules/next",
            "//:node_modules/next-rspack",
            "//:node_modules/react",
            "//:node_modules/react-dom",
        ],
        next_js_binary = "//:next_js_binary",
        args = args,
        env = env,
    )

    js_test(
        name = "sentry_wrapped_test",
        entry_point = "//tools:check_wrapped",
        data = [":next"],
        args = ["$(rootpath :next)"],
    )
