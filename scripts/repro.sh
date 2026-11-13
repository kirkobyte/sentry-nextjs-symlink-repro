#!/usr/bin/env bash
# Builds the app with webpack and with Rspack, in the project directory and in a symlink farm
# of it, and reports which routes @sentry/nextjs wrapped in each build.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
farm="${FARM_DIR:-$root/../sentry-symlink-repro-farm}"

node "$root/scripts/make-symlink-farm.mjs" "$farm" >/dev/null

results=()
for dir in "$root" "$farm"; do
  for bundler in webpack rspack; do
    rm -rf "$dir/.next"
    log="$dir/.build-$bundler.log"
    if [ "$bundler" = webpack ]; then
      (cd "$dir" && npx next build --webpack) >"$log" 2>&1
    else
      (cd "$dir" && BUNDLER=rspack npx next build) >"$log" 2>&1
    fi
    status=$?
    if [ $status -ne 0 ]; then
      results+=("$(basename "$dir") $bundler BUILD_FAILED (see $log)")
      continue
    fi
    results+=("$(basename "$dir") $bundler $(node "$root/scripts/check.mjs" "$dir")")
  done
done

printf '%s\n' "${results[@]}"
