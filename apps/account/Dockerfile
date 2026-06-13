# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy EVERY workspace manifest before installing. `bun install --frozen-lockfile`
# resolves the whole workspace graph against the committed bun.lock, so the full
# set of workspaces the lockfile knows about must be present — a partial subset
# makes bun recompute the lockfile and fail with either "Workspace dependency ...
# not found" or "lockfile had changes, but lockfile is frozen". Keep this list in
# sync with the `workspaces` globs in the root package.json.
COPY package.json bun.lock ./
COPY apps/account/package.json ./apps/account/
COPY apps/dentalemon/package.json ./apps/dentalemon/
COPY apps/sample-workspace/package.json ./apps/sample-workspace/
COPY packages/ceph-math/package.json ./packages/ceph-math/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/sdk-ts/package.json ./packages/sdk-ts/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json ./packages/ui/
COPY services/api-ts/package.json ./services/api-ts/
COPY services/api-ts-embedded/package.json ./services/api-ts-embedded/
COPY specs/api/package.json ./specs/api/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy all source files
COPY . .

# Build the account app
WORKDIR /app/apps/account
RUN bun run build

# Production stage using Caddy to serve the SPA
FROM caddy:2.8-alpine

# Copy the dist folder to Caddy's default serve directory
COPY --from=builder /app/apps/account/dist /srv

# Copy Caddy configuration
COPY apps/account/Caddyfile /etc/caddy/Caddyfile

# Copy and set up entrypoint script
COPY apps/account/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set environment variables for runtime configuration
ENV PORT=80
ENV API_URL="http://localhost:7213"
ENV ONESIGNAL_APP_ID=""

# Expose port
EXPOSE 80

# Use entrypoint to generate config.json before starting Caddy
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
