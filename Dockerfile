FROM node:22-alpine AS builder

WORKDIR /app

# Copy root config
COPY package.json package-lock.json tsconfig.base.json ./

# Copy workspace configs
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

# Install ALL dependencies (including devDeps for build)
RUN npm ci

# Copy source
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Build shared first
RUN npm run build --workspace=@warframe/shared

# Generate Prisma client
RUN npx prisma generate --schema=packages/api/prisma/schema.prisma

# Build API
RUN npm run build --workspace=@warframe/api

# ------ Runtime stage ------
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Run Prisma migrations before starting the API
CMD ["node", "packages/api/dist/index.js"]
