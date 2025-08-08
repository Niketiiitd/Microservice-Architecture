FROM node:20-alpine

WORKDIR /app

# Copy package files first for better Docker caching
COPY package.json package-lock.json ./
COPY nx.json ./
COPY tsconfig.base.json ./
COPY apps/auth/package.json ./apps/auth/package.json

# Install npm@11 (or latest) to satisfy pdf2json and nx requirements
RUN npm install -g npm@11.4.2

# Install dependencies
RUN npm install

# Copy the rest of the monorepo
COPY . .

WORKDIR /app

RUN npx nx build auth

WORKDIR /app/apps/auth

EXPOSE 3001

CMD ["node", "dist/main.js"]