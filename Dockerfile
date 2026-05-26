# Production multi-stage Dockerfile for Leaflet.
# Stage 1 (deps):    install all dependencies
# Stage 2 (build):   compile the SvelteKit app with adapter-node
# Stage 3 (runtime): copy built output only - minimal final image

# ---- Stage 1: deps ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- Stage 3: runtime ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache git ca-certificates
RUN corepack enable

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules

# Create data directories
RUN mkdir -p /app/data/notes /app/data/screenshots

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "build"]
