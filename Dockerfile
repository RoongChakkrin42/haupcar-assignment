# One image definition for the monorepo; pick a target: api or web.
FROM node:26-slim AS base
RUN npm install -g pnpm@10.34.9
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @haupcar/api build && pnpm --filter @haupcar/web build
# Production-only node_modules for the API (includes the built @haupcar/shared).
RUN pnpm --filter @haupcar/api deploy --prod --legacy /out/api

FROM node:26-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/api ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
ENV UPLOAD_DIR=/data/uploads PORT=3000
EXPOSE 3000
CMD ["node", "dist/src/main.js"]

FROM nginx:1.29-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
