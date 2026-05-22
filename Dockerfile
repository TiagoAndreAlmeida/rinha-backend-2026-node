# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependências necessárias para o build
RUN apk add --no-cache python3 make g++ zlib-dev

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar TODAS as dependências
RUN npm ci

# Copiar código e arquivos de dados
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY resources ./resources

# Executar pré-processamento (gera os binários da VP-Tree)
# Isso acontece uma única vez durante o build da imagem
RUN npm run preprocess

# Compilar TypeScript
RUN npm run build

# Limpar devDependencies
RUN npm prune --production

# Stage 2: Runner
FROM node:22-alpine AS runner

RUN apk add --no-cache tini

WORKDIR /app

# Variável de ambiente de produção
ENV NODE_ENV=production

# Copiar arquivos compilados e dependências de produção
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copiar todos os recursos (binários gerados + arquivos JSON)
COPY --from=builder /app/resources/vectors.bin ./resources/vectors.bin
COPY --from=builder /app/resources/labels.bin ./resources/labels.bin
COPY --from=builder /app/resources/tree.bin ./resources/tree.bin
COPY --from=builder /app/resources/mcc_risk.json ./resources/mcc_risk.json
COPY --from=builder /app/resources/normalization.json ./resources/normalization.json

# Expor a porta interna da API
EXPOSE 3000

# Usar usuário node para segurança
USER node

# Tini para gestão correta de sinais
ENTRYPOINT ["/sbin/tini", "--"]

# Comando de inicialização com heap reduzido para sobrar RAM para o dataset (mmap/cache)
CMD ["node", "--max-old-space-size=40", "--min-semi-space-size=2", "dist/index.js"]
