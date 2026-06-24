FROM node:22-alpine AS builder

WORKDIR /app

# Copy root config
COPY package.json package-lock.json tsconfig.base.json ./

# Copy workspace manifests
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

# Eliminar web del workspace antes de npm ci (web no está en el build context)
# y Railway/Nixpacks escanea workspaces
RUN node -e "const p=require('./package.json'); p.workspaces=p.workspaces.filter(w=>w!=='packages/web'); require('fs').writeFileSync('/app/package.json', JSON.stringify(p,null,2))"

# Install ALL dependencies (including devDeps for build)
RUN npm ci

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Build shared first → creates packages/shared/dist/
RUN npx tsc -b packages/shared

# Generate Prisma client
RUN npx prisma generate --schema=packages/api/prisma/schema.prisma

# Build API (shared dist/ already exists)
RUN npx tsc -b packages/api

# ------ Runtime stage ------
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy built artifacts and runtime deps
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

CMD ["node", "packages/api/dist/index.js"]
