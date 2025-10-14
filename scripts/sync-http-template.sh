#!/bin/bash

# sync-http-template.sh
# Syncs files from src/http to src/cli/templates/http and rewrites imports

set -e

# Define source and destination directories
# Note: This script is run from packages/core
SRC_DIR="./src/http"
DEST_DIR="./src/cli/templates/http"

# Files to sync (add or modify as needed)
FILES_TO_SYNC=(
  "index.ts"
  # "cache/memory-cache.ts"
  # "middleware/example.ts"
)

echo "Starting sync from $SRC_DIR to $DEST_DIR..."

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Function to rewrite imports in TypeScript files
rewrite_imports() {
  local file="$1"
  local temp_file="${file}.tmp"

  # Use sed to replace relative imports with absolute package imports
  # Matches: import ... from any number of "../" or "./"
  # Replaces with: import ... from "@rnaga/wp-mcp/..."
  # Excludes: imports to _wp/settings
  sed -E '/_wp\/settings/! s|from "(\.\./)+([^"]+)"|from "@rnaga/wp-mcp/\2"|g; /_wp\/settings/! s|from '"'"'(\.\./)+([^'"'"']+)'"'"'|from "@rnaga/wp-mcp/\2"|g' "$file" > "$temp_file"
  mv "$temp_file" "$file"
}

# Sync each file
for file in "${FILES_TO_SYNC[@]}"; do
  src_file="$SRC_DIR/$file"
  dest_file="$DEST_DIR/$file"

  if [ ! -f "$src_file" ]; then
    echo "Warning: Source file not found: $src_file"
    continue
  fi

  # Create destination subdirectories if needed
  dest_dir=$(dirname "$dest_file")
  mkdir -p "$dest_dir"

  # Copy the file
  cp "$src_file" "$dest_file"
  echo "Copied: $file"

  # If it's a TypeScript file, rewrite imports
  if [[ "$file" == *.ts ]]; then
    rewrite_imports "$dest_file"
    echo "Rewrote imports in: $file"
  fi
done

echo "Sync complete!"
