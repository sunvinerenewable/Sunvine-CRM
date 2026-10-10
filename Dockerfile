# Multi-stage build for React Vite Application
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage with unprivileged Nginx
FROM nginxinc/nginx-unprivileged:alpine

ENV PORT=8080
EXPOSE 8080

# Copy built static files to Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx template for dynamic PORT and SPA routing
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

CMD ["nginx", "-g", "daemon off;"]
