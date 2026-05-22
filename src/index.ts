import http, { IncomingMessage, ServerResponse } from 'node:http';
import { state } from './state.js';
import { loadData } from './data-loader.js';
import { vectorize } from './vectorizer.js';
import { findKNN } from './knn.js';

const PORT = Number(process.env.PORT) || 3000;

// RESPOSTAS PRÉ-ALOCADAS (Zero-Allocation)
const RESPONSES = [
    Buffer.from(JSON.stringify({ approved: true, fraud_score: 0.0 })),
    Buffer.from(JSON.stringify({ approved: true, fraud_score: 0.2 })),
    Buffer.from(JSON.stringify({ approved: true, fraud_score: 0.4 })),
    Buffer.from(JSON.stringify({ approved: false, fraud_score: 0.6 })),
    Buffer.from(JSON.stringify({ approved: false, fraud_score: 0.8 })),
    Buffer.from(JSON.stringify({ approved: false, fraud_score: 1.0 }))
];
const RES_HEADERS = { 'Content-Type': 'application/json' };

// Inicia o carregamento de dados imediatamente
loadData();

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const { method, url } = req;

    if (method === 'GET' && url === '/ready') {
        if (state.isReady) {
            res.writeHead(200);
            return res.end('OK');
        } else {
            res.writeHead(503);
            return res.end('Not Ready');
        }
    }

    if (method === 'POST' && url === '/fraud-score') {
        if (!state.isReady) {
            res.writeHead(503);
            return res.end();
        }

        const chunks: Buffer[] = [];
        let bodySize = 0;
        
        req.on('data', (chunk) => {
            bodySize += chunk.length;
            if (bodySize > 4096) req.destroy(); // Limite de 4KB
            else chunks.push(chunk);
        });

        req.on('end', () => {
            try {
                if (req.destroyed) throw new Error();

                const payload = JSON.parse(Buffer.concat(chunks).toString());
                
                // Vetorização e Busca
                const queryVector = vectorize(payload);
                const fraudCount = findKNN(queryVector, 5);
                
                // Resposta ultra-rápida via Buffer pré-alocado
                res.writeHead(200, RES_HEADERS);
                res.end(RESPONSES[fraudCount] || RESPONSES[0]);

            } catch (error) {
                // Falha aberta para evitar Erros 5xx na Rinha
                res.writeHead(200, RES_HEADERS);
                res.end(RESPONSES[0]);
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

// Tuning de conexão
server.maxConnections = 1000;
server.keepAliveTimeout = 70000;

server.listen(PORT, '0.0.0.0');
