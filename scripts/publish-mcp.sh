#!/bin/bash
# publish-mcp.sh
#
# This script automates the process of publishing an MCP server to the Model Context Protocol registry.
# It validates the server.json against the official schema and publishes using the mcp-publisher CLI.
#
# Prerequisites:
#   - mcp-publisher CLI must be installed (https://github.com/modelcontextprotocol/registry)
#     Install with: brew install mcp-publisher
#     Or download from: https://github.com/modelcontextprotocol/registry/releases
#   - You must be authenticated with the registry using one of:
#     - mcp-publisher login github (for io.github.* namespaces)
#     - mcp-publisher login dns (for custom domain namespaces)
#
# Usage:
#   ./scripts/publish-mcp.sh [OPTIONS]
#
# Options:
#   --dry-run           Validate and check everything without actually publishing
#   --skip-validation   Skip JSON schema validation step
#   --no-version-bump   Skip automatic version increment
#
# The script will:
#   1. Automatically increment the patch version in server.json and package.json (unless --no-version-bump)
#      Example: 1.0.0 → 1.0.1, 1.2.3 → 1.2.4
#   2. Validate server.json against the MCP schema (unless --skip-validation is used)
#   3. Check if you're authenticated with the registry
#   4. Publish the server to the MCP registry (unless --dry-run is used)
#
# Note: This script does NOT publish to npm. Use ./scripts/release.sh for npm publishing.

set -e  # Exit on error

SKIP_VALIDATION=false
DRY_RUN=false
NO_VERSION_BUMP=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-version-bump)
      NO_VERSION_BUMP=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--dry-run] [--skip-validation] [--no-version-bump]"
      exit 1
      ;;
  esac
done

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# Function to increment patch version
increment_patch_version() {
  local version=$1
  local major minor patch

  # Parse version (supports X.Y.Z format)
  if [[ $version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    echo "$major.$minor.$((patch + 1))"
  elif [[ $version =~ ^([0-9]+)\.([0-9]+)$ ]]; then
    # If version is X.Y, treat it as X.Y.0 and increment to X.Y.1
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    echo "$major.$minor.1"
  else
    print_error "Invalid version format: $version (expected X.Y.Z or X.Y)"
    exit 1
  fi
}

# Print dry-run banner if in dry-run mode
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "========================================"
  echo "       DRY RUN MODE (NO PUBLISHING)     "
  echo "========================================"
  echo ""
fi

# Check if server.json exists
if [ ! -f "server.json" ]; then
  print_error "server.json not found in current directory"
  exit 1
fi

print_status "Found server.json"

# Check if package.json exists
if [ ! -f "package.json" ]; then
  print_error "package.json not found in current directory"
  exit 1
fi

print_status "Found package.json"

# Extract current version from server.json
CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' server.json | head -1 | cut -d'"' -f4)
SERVER_NAME=$(grep -o '"name": *"[^"]*"' server.json | head -1 | cut -d'"' -f4)

# Increment version unless --no-version-bump is set
if [ "$NO_VERSION_BUMP" = false ]; then
  echo ""
  echo "Incrementing patch version..."
  NEW_VERSION=$(increment_patch_version "$CURRENT_VERSION")

  print_info "Current version: $CURRENT_VERSION"
  print_info "New version: $NEW_VERSION"

  # Check if jq is available
  if ! command -v jq &> /dev/null; then
    print_error "jq is required for version updates but not found"
    echo ""
    echo "Install jq:"
    echo "  macOS: brew install jq"
    echo "  Linux: sudo apt-get install jq"
    echo ""
    exit 1
  fi

  # Update version in files (skip if dry-run)
  if [ "$DRY_RUN" = false ]; then
    # Create a temporary file for jq processing
    TMP_FILE=$(mktemp)

    # Update all version fields in server.json
    jq --arg v "$NEW_VERSION" '.version = $v | .packages[0].version = $v' server.json > "$TMP_FILE" && mv "$TMP_FILE" server.json

    # Update version in package.json
    jq --arg v "$NEW_VERSION" '.version = $v' package.json > "$TMP_FILE" && mv "$TMP_FILE" package.json

    print_status "Updated version to $NEW_VERSION in server.json and package.json"
  else
    print_info "Would update version to $NEW_VERSION (dry-run mode)"
  fi

  SERVER_VERSION="$NEW_VERSION"
else
  print_warning "Skipping version bump (--no-version-bump flag set)"
  SERVER_VERSION="$CURRENT_VERSION"
fi

print_info "Server: $SERVER_NAME"
print_info "Version: $SERVER_VERSION"

# Validate server.json against schema (unless skipped)
if [ "$SKIP_VALIDATION" = false ]; then
  echo ""
  echo "Validating server.json against MCP schema..."

  # Check if ajv-cli is available
  if ! command -v ajv &> /dev/null; then
    print_warning "ajv-cli not found, using npx to run validation"

    # Download schema and validate
    SCHEMA_URL="https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json"
    TEMP_SCHEMA="/tmp/mcp-server-schema-$$.json"

    curl -s "$SCHEMA_URL" -o "$TEMP_SCHEMA"

    if npx -y ajv-cli validate -s "$TEMP_SCHEMA" -d server.json --strict=false 2>&1 | grep -q "valid"; then
      print_status "server.json is valid"
      rm "$TEMP_SCHEMA"
    else
      print_error "server.json validation failed"
      npx -y ajv-cli validate -s "$TEMP_SCHEMA" -d server.json --strict=false
      rm "$TEMP_SCHEMA"
      exit 1
    fi
  else
    # Use installed ajv-cli
    SCHEMA_URL="https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json"
    TEMP_SCHEMA="/tmp/mcp-server-schema-$$.json"

    curl -s "$SCHEMA_URL" -o "$TEMP_SCHEMA"

    if ajv validate -s "$TEMP_SCHEMA" -d server.json --strict=false 2>&1 | grep -q "valid"; then
      print_status "server.json is valid"
      rm "$TEMP_SCHEMA"
    else
      print_error "server.json validation failed"
      ajv validate -s "$TEMP_SCHEMA" -d server.json --strict=false
      rm "$TEMP_SCHEMA"
      exit 1
    fi
  fi
else
  print_warning "Skipping schema validation"
fi

echo ""
echo "Checking mcp-publisher installation..."

# Check if mcp-publisher is installed
if ! command -v mcp-publisher &> /dev/null; then
  print_error "mcp-publisher is not installed"
  echo ""
  echo "Please install mcp-publisher using one of these methods:"
  echo ""
  echo "  macOS/Linux (Homebrew):"
  echo "    brew install mcp-publisher"
  echo ""
  echo "  macOS/Linux (Binary):"
  echo '    curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '"'"'[:upper:]'"'"' '"'"'[:lower:]'"'"')_$(uname -m | sed '"'"'s/x86_64/amd64/;s/aarch64/arm64/'"'"').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/'
  echo ""
  echo "  From source:"
  echo "    git clone https://github.com/modelcontextprotocol/registry"
  echo "    cd registry && make publisher"
  echo ""
  exit 1
fi

print_status "mcp-publisher is installed"

echo ""
echo "Checking authentication status..."

# Check if authenticated (this will fail if not logged in)
if ! mcp-publisher publish --help &> /dev/null; then
  print_error "Unable to verify mcp-publisher"
  exit 1
fi

print_status "mcp-publisher is ready"

# Check package.json has mcpName field
if [ -f "package.json" ]; then
  echo ""
  echo "Checking package.json configuration..."

  if grep -q '"mcpName"' package.json; then
    MCP_NAME=$(grep -o '"mcpName": *"[^"]*"' package.json | cut -d'"' -f4)
    print_status "Found mcpName in package.json: $MCP_NAME"

    # Verify it matches server.json
    if [ "$MCP_NAME" != "$SERVER_NAME" ]; then
      print_error "mcpName in package.json ($MCP_NAME) does not match name in server.json ($SERVER_NAME)"
      exit 1
    fi
    print_status "mcpName matches server.json name"
  else
    print_warning "mcpName field not found in package.json (required for NPM validation)"
  fi
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "========================================"
  echo "     DRY RUN CHECKS COMPLETE            "
  echo "========================================"
  echo ""
  print_status "All pre-flight checks passed!"
  echo ""
  echo "To publish for real, run without --dry-run:"
  echo "  ./scripts/publish-mcp.sh"
  echo ""
  exit 0
fi

echo ""
echo "Publishing to MCP registry..."
echo ""

# Publish to MCP registry
if mcp-publisher publish; then
  echo ""
  print_status "Successfully published to MCP registry!"
  echo ""
  echo "Your server should now be available in the registry at:"
  echo "  https://registry.modelcontextprotocol.io/"
  echo ""
  echo "You can verify by searching for your server:"
  echo "  curl \"https://registry.modelcontextprotocol.io/v0/servers?search=$SERVER_NAME\""
  echo ""
else
  echo ""
  print_error "Failed to publish to MCP registry"
  echo ""
  echo "Common issues:"
  echo "  1. Not authenticated - run: mcp-publisher login github"
  echo "  2. Package validation failed - ensure package.json includes 'mcpName' field"
  echo "  3. Namespace not authorized - verify your authentication matches the namespace"
  echo ""
  echo "For more help, see:"
  echo "  https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md"
  echo ""
  exit 1
fi
