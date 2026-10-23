# Back4App Containers deployment for BUNKER's Node.js WebSocket relay
# IMPORTANT: If the GitHub repository root is this project folder, these paths are correct.
FROM node:22-alpine
WORKDIR /app
COPY multiplayer_server/package.json ./package.json
RUN npm install --omit=dev
COPY multiplayer_server/server.js ./server.js
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
