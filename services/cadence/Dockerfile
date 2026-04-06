# syntax=docker/dockerfile:1

# Build stage - compile Rust binary with cached dependencies
FROM rust:1.88 AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY benches ./benches

# Build with cache mounts for cargo registry and target directory
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --bin cadence && \
    cp target/release/cadence /cadence && \
    strip /cadence

# Runtime stage - minimal image with compiled binary
FROM debian:trixie-slim

RUN apt-get update && apt-get install -y ca-certificates wget && rm -rf /var/lib/apt/lists/*

COPY --from=builder /cadence /usr/local/bin/cadence
RUN chmod +x /usr/local/bin/cadence

WORKDIR /app

ENTRYPOINT ["cadence"]
