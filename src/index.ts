import http, { IncomingMessage, ServerResponse } from 'node:http';
import { state } from './state.js';
import { loadData } from './data-loader.js';
import { vectorize } from './vectorizer.js';
import { findKNN } from './knn.js';

const PORT = Number(process.env.PORT) || 3000;

// Inicia o carregamento de dados imediatamente
loadData();

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const { method, url } = req;

    // Endpoint de prontidão exigido pela Rinha
    if (method === 'GET' && url === '/ready') {
        if (state.isReady) {
            res.writeHead(200);
            return res.end('OK');
        } else {
            res.writeHead(503);
            return res.end('Not Ready');
        }
    }

    // Endpoint principal de detecção
    if (method === 'POST' && url === '/fraud-score') {
        if (!state.isReady) {
            res.writeHead(503);
            return res.end(JSON.stringify({ error: 'System not ready' }));
        }

        let bodySize = 0;
        const chunks: Buffer[] = [];
        
        req.on('data', (chunk) => {
            bodySize += chunk.length;
            if (bodySize > 10240) { // Limite de 10KB
                req.destroy();
            } else {
                chunks.push(chunk);
            }
        });

        req.on('end', () => {
            try {
                if (req.destroyed) throw new Error('Payload too large');

                const body = Buffer.concat(chunks).toString();
                const payload = JSON.parse(body);
                
                // 1. Vetorização
                const queryVector = vectorize(payload);
                
                // 2. Busca KNN (k=5)
                const fraudCount = findKNN(queryVector, 5);
                
                // 3. Decisão
                const fraudScore = fraudCount / 5;
                const approved = fraudScore < 0.6;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    approved,
                    fraud_score: fraudScore
                }));
            } catch (error) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    approved: true,
                    fraud_score: 0.0
                }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

// Limita conexões simultâneas para não estourar a CPU 0.47
server.maxConnections = 200;
server.keepAliveTimeout = 65000; // Alinhado com o Nginx

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
});
