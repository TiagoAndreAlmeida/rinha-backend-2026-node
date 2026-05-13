# Estágio 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar apenas os arquivos de dependências para aproveitar o cache
COPY package.json package-lock.json* ./

# Instalar TODAS as dependências (incluindo as de desenvolvimento para o tsc)
RUN npm install

# Copiar o código fonte e as configurações
COPY tsconfig.json ./
COPY src ./src

# Compilar TypeScript
RUN npm run build

# Estágio 2: Runtime (Final)
FROM node:20-alpine AS runner

WORKDIR /app

# Definir variável de ambiente para produção
ENV NODE_ENV=production

# Copiar apenas os arquivos transpilados do estágio anterior
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Se tivéssemos dependências de produção, instalaríamos aqui:
# RUN npm install --omit=dev

# Expor a porta exigida pela Rinha
EXPOSE 9999

# Rodar como usuário não-root por segurança
USER node

# Comando para iniciar o servidor
CMD ["node", "dist/index.js"]
