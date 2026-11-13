#!/usr/bin/env bash
# Applies or reverts the proposed @sentry/nextjs fix in node_modules.
# Usage: scripts/fix.sh apply|revert
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
patch_file="$root/patches/sentry-nextjs-11.1.0-symlinked-project.patch"
pkg="$root/node_modules/@sentry/nextjs"

case "${1:-}" in
  apply) patch -p1 -N -d "$pkg" <"$patch_file" ;;
  revert) patch -p1 -R -d "$pkg" <"$patch_file" ;;
  *)
    echo "usage: $0 apply|revert" >&2
    exit 2
    ;;
esac
