FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./

# Install production deps only
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Create data & uploads directories
RUN mkdir -p /data src/uploads

EXPOSE 8080

# Default PORT for Cloud Run; Cloud Run sets PORT automatically, but
# providing a default ensures local containers match the cloud runtime.
ENV PORT=8080

CMD ["node", "src/index.js"]
