# Use Playwright base image to avoid system dependency issues
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app

# Copy package files from worker directory
COPY worker/package*.json ./
RUN npm ci --omit=dev

# Copy worker application code
COPY worker/*.js ./

# Set production environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start the queue processor
CMD ["node", "queue-processor.js"]