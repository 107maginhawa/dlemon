# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy workspace files
COPY package.json bun.lock ./
COPY apps/dentalemon/package.json ./apps/dentalemon/
COPY packages/sdk-ts/package.json ./packages/sdk-ts/
COPY specs/api/package.json ./specs/api/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy all source files
COPY . .

# Build the dentalemon app
WORKDIR /app/apps/dentalemon
RUN bun run build

# Production stage using Caddy to serve the SPA
FROM caddy:2.8-alpine

# Copy the dist folder to Caddy's default serve directory
COPY --from=builder /app/apps/dentalemon/dist /srv

# Copy Caddy configuration
COPY apps/dentalemon/Caddyfile /etc/caddy/Caddyfile

# Copy and set up entrypoint script
COPY apps/dentalemon/docker-entrypoint.sh /docker-entrypoint.sh
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
