# Standard Node container build. Included because EnterPro's import flow is
# undocumented publicly — a Dockerfile is the safest common denominator for
# an unknown platform's "deploy from GitHub" pipeline. If EnterPro instead
# auto-detects Node via buildpacks (like Render does), it can likely ignore
# this file entirely and just run `npm install` / `npm start` as configured
# in the README's Render steps — try that path first if EnterPro offers it.
FROM node:20-slim AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 5000

# EnterPro (or any platform) should set MONGO_URI, JWT_SECRET, AI_PROVIDER,
# GROQ_API_KEY, and CLIENT_URL as environment variables at deploy time —
# see .env.example for the full list. Never bake secrets into this image.
CMD ["node", "src/server.js"]
