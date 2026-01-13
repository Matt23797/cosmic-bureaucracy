import { store } from '../core/store.js';

export class PhilosophyCard {
  constructor(philosophy) {
    this.philosophy = philosophy;
    this.element = null;
    this.refs = {};
    this.unlockReq = 10000;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'philosophy-card';

    this.element.innerHTML = `
      <div class="philosophy-header">
        <div class="phi-icon">
          <img src="${this.philosophy.icon}" class="icon-svg" />
        </div>
        <div class="phi-info">
          <h3 class="outfit">${this.philosophy.name}</h3>
          <span class="gimmick-label">${this.philosophy.gimmick}</span>
        </div>
        <span class="active-badge" style="display: none;">ACTIVE</span>
      </div>
      <div class="philosophy-body">
        <p class="description">${this.philosophy.description}</p>
        <ul class="perks">
          ${this.philosophy.perks.map(perk => `<li>${perk}</li>`).join('')}
        </ul>
      </div>
      <div class="phi-actions">
      </div>
    `;

    this.refs = {
      badge: this.element.querySelector('.active-badge'),
      actions: this.element.querySelector('.phi-actions')
    };

    this.update();
    return this.element;
  }

  update() {
    if (!this.element) return;

    const state = store.getState();
    const isActive = state.activePhilosophy === this.philosophy.id;
    const totalForms = state.stats.totalForms || 0;
    const canUnlock = totalForms >= this.unlockReq;

    // Only lock other paths IF a philosophy is already active
    const hasCommited = !!state.activePhilosophy && (state.ownedUpgrades || []).length > 0;

    this.element.className = `philosophy-card ${isActive ? 'active' : ''} ${canUnlock ? '' : 'locked'}`;
    this.refs.badge.style.display = isActive ? 'block' : 'none';

    // Update Actions Area
    if (canUnlock) {
      if (!this.refs.activateBtn) {
        this.refs.actions.innerHTML = `
          <button class="activate-btn">ACTIVATE</button>
        `;
        this.refs.activateBtn = this.refs.actions.querySelector('.activate-btn');
        this.refs.activateBtn.addEventListener('click', () => this.activate());
      }

      this.refs.activateBtn.disabled = isActive || hasCommited;
      this.refs.activateBtn.innerText = isActive ? 'CURRENT PATH' : (hasCommited ? 'LOCKED BY PROTOCOL' : 'ACTIVATE');
    } else {
      // Show lock progress
      if (!this.refs.lockProgress) {
        this.refs.actions.innerHTML = `
          <div class="lock-indicator">
            <div class="lock-label">CLEARANCE PENDING</div>
            <div class="lock-progress-text"></div>
            <div class="lock-bar-bg"><div class="lock-bar-fill"></div></div>
          </div>
        `;
        this.refs.lockProgress = this.refs.actions.querySelector('.lock-progress-text');
        this.refs.lockBar = this.refs.actions.querySelector('.lock-bar-fill');
      }

      this.refs.lockProgress.innerText = `${this.formatNumber(totalForms)} / ${this.formatNumber(this.unlockReq)} Forms`;
      this.refs.lockBar.style.width = `${Math.min(100, (totalForms / this.unlockReq) * 100)}%`;
    }
  }

  activate() {
    store.setState({ activePhilosophy: this.philosophy.id });
  }

  formatNumber(num) {
    if (num < 100000) return Math.floor(num).toLocaleString();
    if (num < 1000000) return (num / 1000).toFixed(1) + 'k';
    return num.toExponential(2).replace('+', '');
  }
}
