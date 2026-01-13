import { store } from '../core/store.js';

export class SettingsScreen {
  constructor() {
    this.container = null;
    this.unsubscribe = null;
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'screen settings-screen';

    this.container.innerHTML = `
      <h2 class="outfit screen-title">Configuration</h2>
      <p class="screen-subtitle">Adjust the bureaucratic parameters of your reality.</p>

      <div class="settings-section" style="margin-top: 40px;">
        <h3 class="outfit" style="color: var(--accent-pink); margin-bottom: 20px;">Danger Zone</h3>
        <div class="settings-card" style="background: rgba(255, 0, 0, 0.05); border: 1px solid rgba(255, 0, 0, 0.2); padding: 20px; border-radius: 12px;">
          <h4 class="outfit" style="margin-bottom: 8px;">Hard Reset</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">
            This will permanently delete all your progress, including Meta-Authority, upgrades, and stats.
            This action cannot be undone.
          </p>
          <button id="btn-hard-reset" class="buy-btn" style="background: var(--accent-pink); color: white;">
            WIPE ALL DATA
          </button>
        </div>
      </div>

      <div class="settings-info" style="margin-top: 60px; text-align: center; opacity: 0.5; font-size: 0.75rem;">
        <p>Cosmic Bureaucracy v1.1.0-beta</p>
        <p>System ID: ${store.deviceId || 'Unknown'}</p>
      </div>
    `;

    const resetBtn = this.container.querySelector('#btn-hard-reset');
    resetBtn.addEventListener('click', () => this.handleHardReset());

    return this.container;
  }

  handleHardReset() {
    const confirm1 = confirm("Are you ABSOLUTELY sure? This will destroy your entire bureaucratic legacy.");
    if (confirm1) {
      const confirm2 = confirm("FINAL WARNING: This is irreversible. Wipe everything?");
      if (confirm2) {
        this.performHardReset();
      }
    }
  }

  performHardReset() {
    // Clear all local storage keys to ensure a clean slate
    localStorage.removeItem('cosmic_bureaucracy_save');
    localStorage.removeItem('cosmic_device_id');

    // Reload the application to re-initialize the store from scratch
    window.location.reload();
  }
}
