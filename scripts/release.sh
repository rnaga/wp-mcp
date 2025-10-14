# release.sh
#
# This script automates the process of publishing a package to either GitHub Packages or the npm registry.
# It supports two release targets: "beta" and "prod".
#
# Usage:
#   ./release.sh <TARGET> [VERSION_TYPE]
#
# Arguments:
#   TARGET: Specifies the release target. Must be either "beta" or "prod".
#           - "beta": Publishes a pre-release version to GitHub Packages.
#           - "prod": Publishes a production version to both GitHub Packages and the npm registry.
#   VERSION_TYPE: Specifies the type of version bump for production releases. Must be one of "patch", "minor", or "major".
#                 Defaults to "patch" if not provided.
#
# Behavior:
#   - For "beta":
#       - Bumps the version with a pre-release identifier (e.g., 1.0.0-beta.0).
#       - Publishes the package to GitHub Packages.
#   - For "prod":
#       - Validates the VERSION_TYPE argument.
#       - Bumps the version based on VERSION_TYPE (e.g., patch, minor, major).
#       - Publishes the package to both GitHub Packages and the npm registry.
#
# Notes:
#   - The dist directory is used as the staging area for publishing.
#   - The script ensures proper validation of input arguments to prevent accidental misconfigurations.

TARGET=$1 # "beta" or "prod"
VERSION_TYPE=$2 # "patch", "minor", or "major"

# Validate TARGET input
if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
  echo "Error: TARGET must be either 'beta' or 'prod'."
  exit 1
fi

GITHUB_REGISTRY="https://npm.pkg.github.com"
NPM_REGISTRY="https://registry.npmjs.org"

# Copy README.md to dist
cp ./README.md ./dist/

# If beta is specified, then we will bump the version with a pre-release identifier
# This will create a version like 1.0.0-beta.0 and *-
# and publish to GitHub Packages only
if [ "$TARGET" = "beta" ]; then
    # bump version with pre-release identifier 
    # This will create a version like 1.0.0-beta.0 and *-beta.1, etc.
    npm version prerelease --preid beta --no-git-tag-version
    # Prepare dist directory
    cp package.json ./dist/

    # publish to GitHub Packages
    cd ./dist/ 
    npm publish --registry "$GITHUB_REGISTRY" --tag beta # --dry-run
    exit 0
fi

# for prod release
# Set VERSION_TYPE to patch by default if not passed
if [ "$TARGET" = "prod" ] && [ -z "$VERSION_TYPE" ]; then
  VERSION_TYPE="patch"
fi

# Validate VERSION_TYPE input
if [ "$TARGET" = "prod" ] && [ "$VERSION_TYPE" != "patch" ] && [ "$VERSION_TYPE" != "minor" ] && [ "$VERSION_TYPE" != "major" ]; then
  echo "Error: VERSION_TYPE must be 'patch', 'minor', or 'major' when TARGET is 'prod'."
  exit 1
fi

# Bump version based on VERSION_TYPE
npm version $VERSION_TYPE --no-git-tag-version

# Copy package.json to dist 
cp package.json ./dist/

# Move to dist directory
# This is where the package will be published from
cd ./dist/

# publish to gitHub Packages
npm publish --registry "$GITHUB_REGISTRY"  # --dry-run

# publish to npm registry
npm publish --registry "$NPM_REGISTRY" --access public --dry-run
