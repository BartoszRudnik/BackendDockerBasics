'use strict';

process.on('uncaughtException', (err) => {
    console.error(JSON.stringify({
        time: new Date().toISOString(),
        event: 'uncaught_exception',
        error: err.message,
        stack: err.stack,
    }));
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error(JSON.stringify({
        time: new Date().toISOString(),
        event: 'unhandled_rejection',
        reason: String(reason),
    }));
    process.exit(1);
});

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const APP_VERSION = process.env.APP_VERSION || 'dev';
const DATA_DIR = process.env.DATA_DIR || "/app/data";

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function requestHandler(req, res) {
    const { method, url } = req;

    console.log(JSON.stringify({
        time: new Date().toISOString(),
        method,
        url,
        pid: process.pid,
    }));

    if (method === 'POST' && url === '/upload') {
        let body = '';

        req.on('data', chunk => { body += chunk.toString(); });

        req.on('end', () => {
            const filename = `upload-${Date.now()}.txt`;
            const filepath = path.join(DATA_DIR, filename);

            fs.writeFile(filepath, body, (err) => {
                if (err) {
                    console.error(JSON.stringify({
                        time: new Date().toISOString(),
                        event: 'upload_error',
                        error: err.message,
                    }));
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Write failed' }));
                }

                console.log(JSON.stringify({
                    time: new Date().toISOString(),
                    event: 'file_saved',
                    file: filename,
                    size: Buffer.byteLength(body),
                }));

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ saved: filename }));
            });
        });
        return;
    }

    if (method === 'GET' && url === '/files') {
        fs.readdir(DATA_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Cannot read data dir' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files, data_dir: DATA_DIR }));
        });
        return;
    }

    if (method === 'GET' && url === '/health') {
        const body = JSON.stringify({
            status: 'ok',
            version: APP_VERSION,
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
        });
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        });
        return res.end(body);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: url }));
}

const server = http.createServer(requestHandler);

function shutdown(signal) {
    console.log(JSON.stringify({
        time: new Date().toISOString(),
        event: 'shutdown_initiated',
        signal,
    }));

    server.close(() => {
        console.log(JSON.stringify({ time: new Date().toISOString(), event: 'shutdown_complete' }));
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
    console.log(JSON.stringify({
        time: new Date().toISOString(),
        event: 'server_started',
        host: HOST,
        port: PORT,
        version: APP_VERSION,
        node: process.version,
    }));
});
// cache test
