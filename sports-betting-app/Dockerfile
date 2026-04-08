FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build the Vite frontend
RUN npm run build

EXPOSE 3000

# Production: Express serves the built frontend + Socket.io
CMD ["node", "server.js"]
