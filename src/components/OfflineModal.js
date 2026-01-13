import { Utils } from '../core/Utils.js';

export class OfflineModal {
    constructor(gains) {
        this.gains = gains;
        this.element = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'modal-overlay';
        this.element.innerHTML = `
      <div class="tutorial-card offline-card">
        <h2 class="outfit" style="color: var(--accent-cyan);">Administrative Resumption</h2>
        <p class="description" style="margin: 15px 0;">
          While you were away from your station, your departments continued to process reality.
        </p>
        
        <div class="gains-list" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
          ${this.renderGain('Forms', this.gains.forms, '/assets/icons/resources/forms.svg')}
          ${this.renderGain('Stored Time', this.gains.time, '/assets/icons/resources/time.svg')}
        </div>

        <button id="offline-confirm-btn" class="buy-btn">RESUME DUTIES</button>
      </div>
    `;

        this.element.querySelector('#offline-confirm-btn').addEventListener('click', () => {
            this.element.remove();
        });

        return this.element;
    }

    renderGain(label, value, icon) {
        if (value <= 0) return '';
        return `
      <div class="gain-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
          <img src="${icon}" class="icon-svg" style="width: 16px; height: 16px;" />
          ${label}
        </span>
        <span style="font-weight: 700; color: var(--accent-cyan);">+${Utils.formatNumber(value)}</span>
      </div>
    `;
    }
}
