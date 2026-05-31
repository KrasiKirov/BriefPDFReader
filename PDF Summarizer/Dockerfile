# Backend container for BriefPDF Reader (deploy target: Railway/Render/Fly).
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only, using the lockfile for reproducibility.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the backend source (frontend is deployed separately as a static site).
COPY backend ./backend

ENV NODE_ENV=production
# The platform injects PORT; config.js falls back to 5000 locally.
EXPOSE 5000

CMD ["node", "backend/server.js"]
