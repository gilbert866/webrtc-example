import { defineConfig } from 'vite';
import { signalingPlugin } from './server/signaling-plugin.js';

export default defineConfig({
  plugins: [signalingPlugin()],
  server: {
    host: true, // Listen on all network addresses (LAN access for mobile/secondary devices)
    port: 5173
  }
});
