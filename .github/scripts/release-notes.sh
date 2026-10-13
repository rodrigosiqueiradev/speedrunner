#!/usr/bin/env bash
# Prints Markdown release notes for a tag: the tag's own message, if it is an annotated tag, then
# every change merged since the previous version tag. Usage: release-notes.sh v0.2.0
set -euo pipefail

tag="$1"
prev=$(git describe --tags --abbrev=0 --match 'v*' "$tag^" 2> /dev/null || true)

echo "## What's new in $tag"
echo

# `git tag -a v0.2.0` opens an editor for a message; anything written there goes on top.
if [ "$(git cat-file -t "$tag")" = tag ]; then
  message=$(git tag -l --format='%(contents:subject)%0a%0a%(contents:body)' "$tag" | sed '/-----BEGIN/,$d')
  if [ -n "$(echo "$message" | tr -d '[:space:]')" ]; then
    echo "$message"
    echo
  fi
fi

if [ -n "$prev" ]; then
  echo "Changes since $prev:"
  range="$prev..$tag"
else
  echo "Changes in this first release:"
  range="$tag"
fi
echo

# One line per change on the main line of history. A merged pull request is listed by its title,
# which GitHub puts on the first line of the merge commit's body.
git log --first-parent --format='%s%x1f%b%x1e' "$range" | while IFS= read -r -d $'\x1e' entry; do
  entry=${entry#$'\n'}
  subject=${entry%%$'\x1f'*}
  body=${entry#*$'\x1f'}
  if [[ $subject == "Merge pull request #"* ]]; then
    title=$(echo "$body" | sed -n '/[^[:space:]]/{p;q}')
    echo "- ${title:-$subject}"
  else
    echo "- $subject"
  fi
done

cat << 'NOTES'

## Downloads

- **Windows:** `Speedrunner-windows.exe`. Run it from anywhere. If SmartScreen warns you, choose
  **More info**, then **Run anyway**.
- **Linux:** `Speedrunner-linux.AppImage`. Make it executable with `chmod +x Speedrunner-linux.AppImage`,
  then run it.
- **macOS:** `Speedrunner-macos.zip`. Extract it and open `Speedrunner.app`. If macOS blocks it,
  go to System Settings > Privacy & Security and choose **Open Anyway**.
NOTES
