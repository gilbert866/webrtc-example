/**
 * Application Entrypoint.
 * Bootstraps design system stylesheets and initializes the WebRTCApplication.
 */

import './shared/styles/tokens.css';
import './shared/styles/base.css';
import './shared/styles/components.css';
import './shared/styles/layout.css';

import { WebRTCApplication } from './app/app.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    const app = new WebRTCApplication(root);
    app.init().catch((err) => {
      console.error('[WebRTCApplication] Initialization error:', err);
    });
  }
});
