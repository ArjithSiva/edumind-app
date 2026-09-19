# Multi-stage build: compile the Vite app, then serve the static output.
# Same rationale as server/Dockerfile — a hedge for an unknown platform's
# import pipeline. If EnterPro auto-detects Vite/static sites natively (like
# Vercel does), prefer that path and ignore this file.
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# VITE_API_URL must be supplied as a build ARG, since Vite bakes it in at
# build time — an env var set only at container runtime has no effect.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-slim AS serve
WORKDIR /app
RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

EXPOSE 3000
# -s enables SPA fallback so /quiz, /planner, etc. all resolve to index.html
# on a hard refresh, same job vercel.json's rewrite rule does on Vercel.
CMD ["serve", "-s", "dist", "-l", "3000"]
