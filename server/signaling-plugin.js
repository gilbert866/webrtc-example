/**
 * Vite Plugin that integrates the WebRTC signaling WebSocket server
 * directly into Vite's dev server HTTP instance.
 *
 * This provides zero-configuration development: running `npm run dev`
 * starts both the frontend client and the WebRTC signaling server simultaneously!
 */

import { WebSocketServer } from 'ws';
import { SignalingServerHandler } from './signaling-handler.js';

export function signalingPlugin() {
  const handler = new SignalingServerHandler();
  handler.startHeartbeat();

  return {
    name: 'webrtc-signaling-plugin',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      wss.on('connection', (ws, req) => {
        handler.handleConnection(ws, req);
      });

      // Hook into Vite's internal HTTP server upgrade event
      server.httpServer?.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (url.pathname === '/ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      console.log('\x1b[36m%s\x1b[0m', '⚡ [WebRTC Signaling Server] Ready on ws://localhost:5173/ws');
    }
  };
}
