FROM node:20-bookworm-slim AS deps

WORKDIR /app/frontend
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
  && npm config set replace-registry-host npmjs \
  && npm ci --include=dev --no-audit --no-fund --fetch-retries=3 --fetch-timeout=60000 \
  && test -x node_modules/.bin/vite

FROM deps AS build

ENV NODE_OPTIONS=--max-old-space-size=512
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
COPY . .
RUN npm run build

FROM deps AS dev

WORKDIR /app/frontend
EXPOSE 80

FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY run.sh /run.sh
RUN chmod +x /run.sh
EXPOSE 80
CMD ["/run.sh"]
