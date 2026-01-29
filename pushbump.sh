#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to display error messages and exit
error_exit() {
  echo "Error: $1" >&2
  exit 1
}

# Check if package.json exists
if [ ! -f "package.json" ]; then
  error_exit "package.json not found in current directory"
fi

# Extract current version from package.json
if command -v jq &> /dev/null; then
  # Use jq if available (more reliable)
  current_version=$(jq -r '.version' package.json)
else
  # Fallback to grep method
  current_version=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
fi

if [ -z "$current_version" ]; then
  error_exit "Could not extract version from package.json"
fi

echo "Current version: $current_version"

# Split version into major, minor, patch components
IFS='.' read -r major minor patch <<< "$current_version"

new_patch=$((patch + 1))
new_version="$major.$minor.$new_patch" # Reset patch to 0 when bumping minor

echo "New version: $new_version"

# Update package.json with new version
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS/BSD sed
  sed -i '' "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" package.json || error_exit "Failed to update version in package.json"
else
  # GNU sed (Linux)
  sed -i "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" package.json || error_exit "Failed to update version in package.json"
fi

# Git operations
echo "Committing changes..."
git add package.json || error_exit "Failed to add package.json to git"
git commit

echo "Pushing commit..."
git push || error_exit "Failed to push commit"

echo "Creating tag v$new_version..."
git tag -a "v$new_version" -m "Version $new_version" || error_exit "Failed to create tag"

echo "Pushing tag..."
git push origin "v$new_version" || error_exit "Failed to push tag"

echo "Successfully bumped version to $new_version, committed, pushed, tagged, and pushed tag."
