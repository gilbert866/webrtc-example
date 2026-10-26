/**
 * Standalone WebRTC Signaling Server for production or independent testing.
 * Run with: node server/standalone.js
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { SignalingServerHandler } from './signaling-handler.js';

const PORT = process.env.PORT || 3001;
const handler = new SignalingServerHandler();
handler.startHeartbeat();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', activeRooms: handler.rooms.size, totalConnections: handler.connections.size }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebRTC Signaling Server is running.\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  handler.handleConnection(ws, req);
});

server.listen(PORT, () => {
  console.log(`\x1b[32m✔ WebRTC Standalone Signaling Server listening on http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36m✔ WebSocket endpoint: ws://localhost:${PORT}\x1b[0m`);
});
