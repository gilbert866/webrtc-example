/**
 * Floating toast notification service.
 */

class ToastService {
  constructor() {
    this.container = null;
  }

  ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info', duration = 3500) {
    this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade-in`;

    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, duration);
  }

  info(msg) { this.show(msg, 'info'); }
  success(msg) { this.show(msg, 'success'); }
  warning(msg) { this.show(msg, 'warning'); }
  error(msg) { this.show(msg, 'error', 5000); }
}

export const toast = new ToastService();
