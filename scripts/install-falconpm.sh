#!/usr/bin/env bash
#
# install-falconpm.sh — wire the FalconPM customization layer into HERMES_HOME.
#
# Hermes loads its identity (SOUL.md), memory (memories/MEMORY.md), and skills
# (skills/) from HERMES_HOME (default: ~/.hermes), NOT from this repo. This
# script symlinks the repo's FalconPM artifacts into HERMES_HOME so that:
#   - edits made in the repo are immediately live (symlinks, not copies)
#   - `git pull` updates the running agent with no re-install
#
# Idempotent: safe to run repeatedly. Re-points existing symlinks; refuses to
# clobber a real (non-symlink) file without --force.

set -euo pipefail

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

# Repo root = parent of this script's directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# HERMES_HOME: honor the env var, else platform default (~/.hermes on macOS/Linux).
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"

echo "FalconPM installer"
echo "  repo:        $REPO_ROOT"
echo "  HERMES_HOME: $HERMES_HOME"
echo

# link SRC DEST — symlink DEST -> SRC, creating parent dirs, backing up real files.
link() {
  local src="$1" dest="$2"
  if [[ ! -e "$src" ]]; then
    echo "  SKIP  $dest  (source missing: $src)"
    return 1
  fi
  mkdir -p "$(dirname "$dest")"
  if [[ -L "$dest" ]]; then
    rm -f "$dest"                       # re-point stale/existing symlink
  elif [[ -e "$dest" ]]; then
    if [[ "$FORCE" == "1" ]]; then
      mv "$dest" "$dest.bak.$(date +%s)"
      echo "  backed up existing real file -> $dest.bak.*"
    else
      echo "  SKIP  $dest  (real file present; re-run with --force to replace)"
      return 1
    fi
  fi
  ln -s "$src" "$dest"
  echo "  LINK  $dest -> $src"
}

# link_tree SRC_DIR DEST_DIR — mirror a directory as REAL dirs with symlinked
# files. Required for skills: Hermes discovers them via rglob("SKILL.md"), and
# rglob does NOT descend into a symlinked *directory* — so the dir must be real
# and the files inside it must be the symlinks.
link_tree() {
  local src_dir="$1" dest_dir="$2"
  if [[ ! -d "$src_dir" ]]; then
    echo "  SKIP  $dest_dir  (source dir missing: $src_dir)"
    return 1
  fi
  local f rel
  while IFS= read -r -d '' f; do
    rel="${f#"$src_dir"/}"
    link "$f" "$dest_dir/$rel"
  done < <(find "$src_dir" -type f -print0)
}

link "$REPO_ROOT/SOUL.md"   "$HERMES_HOME/SOUL.md"
link "$REPO_ROOT/MEMORY.md" "$HERMES_HOME/memories/MEMORY.md"
link_tree "$REPO_ROOT/skills/productivity/d2c-growth-experiment-planner" \
          "$HERMES_HOME/skills/d2c-growth-experiment-planner"

echo
echo "Done. Verify with:"
echo "  ls -la \"$HERMES_HOME/SOUL.md\" \"$HERMES_HOME/memories/MEMORY.md\" \"$HERMES_HOME/skills/d2c-growth-experiment-planner\""
