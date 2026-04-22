# Build stage
ARG NPM_REGISTRY=https://registry.npmmirror.com

FROM node:20-alpine AS builder

ARG NPM_REGISTRY

WORKDIR /app
COPY package*.json ./
RUN npm ci --registry="${NPM_REGISTRY}"
COPY . .
RUN npm run build

# Production stage - serve with nginx
FROM nginx:1.25-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
