#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$(dirname "${BASH_SOURCE[0]}")"

REGISTRY="ghcr.io/mycurelabs"
IMAGE_NAME="cadence"
VERSION=$(grep -E '^version\s*=' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
PUSH=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --push) PUSH=true; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo "  --skip-build   Skip docker build (just push existing image)"
      echo "  --push         Push image to registry"
      exit 0
      ;;
    *) echo -e "${RED}Unknown: $1${NC}"; exit 1 ;;
  esac
done

IMAGE_VERSION="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
IMAGE_LATEST="${REGISTRY}/${IMAGE_NAME}:latest"

echo -e "${BLUE}Cadence Docker Build${NC} v${VERSION} (${GIT_SHA})"

if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}→ Building Docker image (multi-stage)...${NC}"

  # Build with BuildKit for cache mount support
  DOCKER_BUILDKIT=1 docker build \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.revision=${GIT_SHA}" \
    -t "${IMAGE_VERSION}" \
    -t "${IMAGE_LATEST}" \
    .

  echo -e "${GREEN}✓ ${IMAGE_VERSION}${NC}"
fi

if [ "$PUSH" = true ]; then
  echo -e "${YELLOW}→ Pushing...${NC}"
  docker push "${IMAGE_VERSION}"
  docker push "${IMAGE_LATEST}"
  echo -e "${GREEN}✓ Pushed${NC}"
fi
