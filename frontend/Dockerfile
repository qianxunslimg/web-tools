FROM node:20-alpine AS deps

WORKDIR /app/frontend
COPY package.json package-lock.json ./
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY} \
  && npm ci --no-audit --no-fund

FROM deps AS build

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
