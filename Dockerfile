# Non testé dans le bac à sable de développement (Docker Hub y est bloqué,
# impossible d'y tirer `node:22-slim` ni de lancer un build) — écrit à
# partir de la documentation Node/npm, à vérifier avec
# `docker compose up --build` sur votre machine avant tout déploiement.
FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm install --no-save typescript @types/node @types/express @types/bcryptjs @types/cookie-parser \
  && npx tsc -p tsconfig.json \
  && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--experimental-sqlite", "dist/server.js"]
