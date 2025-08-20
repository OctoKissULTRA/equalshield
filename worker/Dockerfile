# Use Node 20 with Playwright pre-installed
FROM node:20-bullseye

# Install Playwright and browser dependencies
RUN npx playwright install --with-deps chromium

WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start the worker
CMD ["npm", "start"]