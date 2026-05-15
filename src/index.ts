import http, { IncomingMessage, ServerResponse } from 'node:http';
import { state } from './state.js';
import { loadData } from './data-loader.js';

const PORT = 9999;

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

    // Endpoint principal de detecção (será implementado na Etapa 2)
    if (method === 'POST' && url === '/fraud-score') {
        if (!state.isReady) {
            res.writeHead(503);
            return res.end(JSON.stringify({ error: 'System not ready' }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            approved: true,
            fraud_score: 0.0
        }));
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
});
