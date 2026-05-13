import http, { IncomingMessage, ServerResponse } from 'node:http';

const PORT = 9999;

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const { method, url } = req;

    if (method === 'GET' && url === '/ready') {
        res.writeHead(200);
        return res.end();
    }

    if (method === 'POST' && url === '/fraud-score') {
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
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
