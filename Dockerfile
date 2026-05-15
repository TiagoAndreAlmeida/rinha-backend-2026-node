# Estágio 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Adiciona suporte a bibliotecas nativas e ferramentas de build
RUN apk add --no-cache libc6-compat

# Copiar apenas os arquivos de dependências para aproveitar o cache
COPY package.json package-lock.json* ./

# Instalar TODAS as dependências
RUN npm ci

# Copiar o código fonte, configurações e arquivos de dados
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY resources ./resources

# Executar o pré-processamento dos dados (gera dataset.bin)
RUN npm run preprocess

# Compilar TypeScript
RUN npm run build

# Remove dependências de desenvolvimento para economizar espaço e RAM
RUN npm prune --production

# Estágio 2: Runtime (Final)
FROM node:20-alpine AS runner

# Adiciona tini para lidar corretamente com sinais de processo
RUN apk add --no-cache tini

WORKDIR /app

# Definir variável de ambiente para produção
ENV NODE_ENV=production

# Copiar apenas os arquivos necessários com a propriedade correta do usuário node
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
# Copiar os datasets binários gerados no build
COPY --from=builder --chown=node:node /app/resources/vectors.bin ./resources/vectors.bin
COPY --from=builder --chown=node:node /app/resources/labels.bin ./resources/labels.bin

# Expor a porta exigida pela Rinha
EXPOSE 9999

# Rodar como usuário não-root por segurança
USER node

# Inicia via tini para gestão correta de processos
ENTRYPOINT ["/sbin/tini", "--"]

# Comando para iniciar o servidor
CMD ["node", "dist/index.js"]
