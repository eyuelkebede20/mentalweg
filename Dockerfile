FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Install backend dependencies
RUN npm ci

# Copy backend code
COPY tsconfig.json ./
COPY src/ ./src/

# Copy and build public-app
COPY public-app/package.json public-app/package-lock.json ./public-app/
RUN cd public-app && npm ci
COPY public-app/ ./public-app/
RUN cd public-app && npm run build

# Copy and build admin app
COPY admin/package.json admin/package-lock.json ./admin/
RUN cd admin && npm ci
COPY admin/ ./admin/
RUN cd admin && npm run build

# Build backend
RUN npm run build

# Setup environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
