import express from 'express';
import *as http from 'http';
import * as Websocket from 'ws';
import { WebSocketConnection } from './lib/ws';

const main = async () => {
    const app = express();
    const server = http.createServer(app);
    const websocket = new Websocket.Server({ server, path: '/ws' });

    WebSocketConnection(websocket);

    const port = 8082;

    server.listen(port, () => {
        console.log(`Server started on port ${port}`);
    });
}

export { main };