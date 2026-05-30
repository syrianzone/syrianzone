#!/bin/bash

# Copyright 2025 Syrian Zone
# Licensed under the MIT License

# This script optimizes only changed images listed in the file passed as the first argument

CHANGED_LIST="$1"

if [ -z "$CHANGED_LIST" ] || [ ! -s "$CHANGED_LIST" ]; then
  echo "No changed images to process. Exiting."
  exit 0
fi

# Do NOT delete the images directory; keep old optimized images
mkdir -p images

OPTIMIZE_LIST=()

while IFS= read -r img_path; do
  # Remove the leading directory (syofficial/_unprocessed-images/)
  rel_path="${img_path#syofficial/_unprocessed-images/}"
  dest_dir="images/$(dirname "$rel_path")"
  mkdir -p "$dest_dir"
  cp "$img_path" "$dest_dir/"
  OPTIMIZE_LIST+=("$dest_dir/$(basename "$img_path")")
done < "$CHANGED_LIST"

# Remove non-image files like .DS_Store
find images -name ".DS_Store" -type f -delete

# Optimize only the newly copied images
if [ ${#OPTIMIZE_LIST[@]} -gt 0 ]; then
  mogrify -resize 250x250 -quality 85 -strip -interlace Plane "${OPTIMIZE_LIST[@]}"
fi
