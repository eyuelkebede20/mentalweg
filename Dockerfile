# syntax=docker/dockerfile:1

# ===================================================================
# Stage 1: Build Public Landing & Booking App (Vite SPA)
# ===================================================================
FROM node:22-bookworm-slim AS build-public
WORKDIR /app/public-app

COPY public-app/package*.json ./
RUN npm ci

COPY public-app/ ./
RUN npm run build

# ===================================================================
# Stage 2: Build Admin Clinical CMS (Vite SPA)
# ===================================================================
FROM node:22-bookworm-slim AS build-admin
WORKDIR /app/admin

COPY admin/package*.json ./
RUN npm ci

COPY admin/ ./
RUN npm run build

# ===================================================================
# Stage 3: Build Server Dependencies & Native Addons
# ===================================================================
FROM node:22-bookworm-slim AS build-server
WORKDIR /app

# Install native compilation toolchain for better-sqlite3 and argon2
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# ===================================================================
# Stage 4: Production Runner Image
# ===================================================================
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# Create persistent storage mount point for SQLite database and uploads
RUN mkdir -p /data/uploads

# Copy production node_modules from build-server
COPY --from=build-server /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/
COPY drizzle/ ./drizzle/
COPY scripts/ ./scripts/
COPY verifier-api/ ./verifier-api/

# Copy compiled frontend distributions
COPY --from=build-public /app/public-app/dist ./public-app/dist
COPY --from=build-admin /app/admin/dist ./admin/dist

# Expose default HTTP port
EXPOSE 3000

# Start server (or embedded services if configured)
CMD ["npm", "start"]
