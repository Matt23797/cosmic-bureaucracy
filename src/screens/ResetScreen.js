import { store, Actions } from '../core/store.js';
import { prestigeSystem } from '../core/PrestigeSystem.js';
import { GameConstants } from '../core/Constants.js';
import { Utils } from '../core/Utils.js';
import content from '../config/content.json';

export class ResetScreen {
  constructor() {
    this.container = null;
    this.unsubscribe = null;
    this.refs = {};
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'screen';

    this.renderStaticStructure();

    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = store.subscribe((state) => {
      if (document.contains(this.container)) {
        this.update();
      }
    });

    this.update();
    return this.container;
  }

  renderStaticStructure() {
    this.container.innerHTML = `
      <h2 class="outfit">Administrative Reorg</h2>
      <p>Hardship builds character. Resets build Meta-Authority.</p>
      
      <div class="stats-mini" style="margin-top: 20px; display: flex; justify-content: space-between;">
        <div class="stat-item">
            <div id="ma-display" data-label="Meta-Authority">0</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">Available</div>
        </div>
        <div class="stat-item">
            <div id="bonus-display" data-label="Bonus">+0%</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">Efficiency</div>
        </div>
        <div class="stat-item">
            <div id="total-forms-run" data-label="Total Run">0</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">Earned (Run)</div>
        </div>
      </div>

      <div class="prestige-card" style="background: var(--bg-card); margin-top: 20px; padding: 30px; border-radius: 16px; border: 1px solid var(--accent-purple);">
        <h3 class="outfit" style="color: var(--accent-purple); margin-bottom: 10px;">Reality Audit</h3>
        <p id="reset-description" style="font-size: 0.85rem; margin-bottom: 20px;">
            Reset your timeline to gain <strong id="pending-ma-val" style="color: #fff">0</strong> Meta-Authority.
            <br><span style="color: var(--text-secondary); font-size: 0.75rem;">(Requires 1.00e7 Forms for +1)</span>
        </p>
        
        <button id="btn-reality-audit" class="buy-btn" style="background: var(--accent-purple); color: white;">
          INITIATE AUDIT
        </button>
      </div>

      <div id="meta-market-section" style="display: none;">
        <h2 class="outfit screen-title" style="margin-bottom: 20px; margin-top: 40px;">Meta-Market</h2>
        <div class="market-paths" style="display: flex; flex-direction: column; gap: 30px;">
            <div class="market-path" data-path="administrative">
                <h3 class="outfit" style="color: var(--accent-purple); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">ADMINISTRATIVE</h3>
                <div class="upgrade-list" style="margin-top: 15px;"></div>
            </div>
            <div class="market-path" data-path="logistics">
                <h3 class="outfit" style="color: var(--accent-blue, #3b82f6); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">LOGISTICS</h3>
                <div class="upgrade-list" style="margin-top: 15px;"></div>
            </div>
            <div class="market-path" data-path="temporal">
                <h3 class="outfit" style="color: var(--accent-cyan); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">TEMPORAL</h3>
                <div class="upgrade-list" style="margin-top: 15px;"></div>
            </div>
        </div>
      </div>
    `;

    this.refs = {
      maDisplay: this.container.querySelector('#ma-display'),
      bonusDisplay: this.container.querySelector('#bonus-display'),
      pendingMA: this.container.querySelector('#pending-ma-val'),
      auditBtn: this.container.querySelector('#btn-reality-audit'),
      marketSection: this.container.querySelector('#meta-market-section'),
      pathContainers: {
        administrative: this.container.querySelector('[data-path="administrative"] .upgrade-list'),
        logistics: this.container.querySelector('[data-path="logistics"] .upgrade-list'),
        temporal: this.container.querySelector('[data-path="temporal"] .upgrade-list')
      },
      totalFormsRun: this.container.querySelector('#total-forms-run')
    };

    this.refs.auditBtn.addEventListener('click', () => {
      const state = store.getState();
      const { pendingMA, nextThreshold } = prestigeSystem.calculatePendingMA(state);

      if (pendingMA > 0) {
        const confirmed = confirm(`Are you sure you want to reset? You will lose all Forms (Current), Departments, and Upgrades, but gain ${pendingMA} Meta-Authority.`);
        if (confirmed) {
          store.dispatch(Actions.PERFORM_RESET, { earnedMA: pendingMA, nextThreshold });
        }
      }
    });
  }

  update() {
    const state = store.getState();
    const totalForms = state.stats.totalForms || 0;

    const totalMA = state.meta?.totalMetaAuthority || 0;
    const currentMA = state.meta?.metaAuthority || 0;

    const { pendingMA } = prestigeSystem.calculatePendingMA(state);

    const isUnlocked = state.stats.totalForms >= (state.meta.nextMaThreshold || 10000000) || (state.meta && state.meta.resets > 0);
    const canPrestige = pendingMA > 0;

    this.refs.maDisplay.innerText = Utils.formatNumber(currentMA);
    const bonusPct = (totalMA * GameConstants.META_AUTHORITY_PROD_BONUS * 100).toFixed(0);
    this.refs.bonusDisplay.innerText = `+${bonusPct}%`;
    this.refs.pendingMA.innerText = pendingMA;
    if (this.refs.totalFormsRun) {
      this.refs.totalFormsRun.innerText = Utils.formatNumber(totalForms);
    }

    this.refs.auditBtn.disabled = !canPrestige;
    this.refs.auditBtn.style.opacity = canPrestige ? '1' : '0.5';
    this.refs.auditBtn.style.cursor = canPrestige ? 'pointer' : 'not-allowed';
    this.refs.auditBtn.innerText = isUnlocked ? `INITIATE AUDIT (+${pendingMA})` : `LOCKED (${Utils.formatNumber(state.meta.nextMaThreshold)} Forms)`;

    if (totalMA > 0) {
      this.refs.marketSection.style.display = 'block';
      this.updateShop(currentMA);
    } else {
      this.refs.marketSection.style.display = 'none';
    }
  }

  updateShop(currentMA) {
    const upgrades = content.metaUpgrades;
    const owned = store.getState().meta?.ownedUpgrades || [];

    Object.keys(this.refs.pathContainers).forEach(path => {
      const container = this.refs.pathContainers[path];
      const pathUpgrades = upgrades.filter(u => u.path === path && !owned.includes(u.id));

      // Only show if requirements are met
      const visible = pathUpgrades.filter(u => {
        if (!u.requires) return true;
        return u.requires.every(reqId => owned.includes(reqId));
      });

      container.innerHTML = '';
      if (visible.length === 0) {
        const allInPathOwned = upgrades.filter(u => u.path === path).every(u => owned.includes(u.id));
        container.innerHTML = allInPathOwned
          ? `<p style="color: var(--text-secondary); font-size: 0.8rem; font-style: italic;">Path complete.</p>`
          : `<p style="color: var(--text-secondary); font-size: 0.8rem; font-style: italic;">Next protocol locked.</p>`;
      } else {
        visible.forEach(upgrade => {
          container.appendChild(this.renderMetaUpgradeCard(upgrade, currentMA));
        });
      }
    });
  }

  renderMetaUpgradeCard(upgrade, currentMA) {
    const canAfford = currentMA >= upgrade.cost;
    const card = document.createElement('div');
    card.className = 'meta-upgrade-card';
    card.style.background = 'var(--bg-card)';
    card.style.padding = '20px';
    card.style.borderRadius = '16px';
    card.style.border = '1px solid var(--accent-cyan)';
    card.style.marginBottom = '16px';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="outfit" style="color: var(--accent-cyan); font-size: 1.1rem;">${upgrade.name}</h3>
          <span style="font-size: 0.8rem; background: rgba(0,242,255,0.1); color: var(--accent-cyan); padding: 4px 8px; border-radius: 8px;">${upgrade.cost} MA</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary);">${upgrade.description}</p>
      <button class="buy-btn" style="background: var(--accent-cyan); color: #000; margin-top: 10px;">
          PURCHASE
      </button>
    `;

    const btn = card.querySelector('.buy-btn');
    btn.addEventListener('click', () => this.buyMetaUpgrade(upgrade));

    // Initial state
    btn.disabled = !canAfford;
    btn.style.opacity = canAfford ? '1' : '0.5';
    btn.style.cursor = canAfford ? 'pointer' : 'not-allowed';

    return card;
  }

  buyMetaUpgrade(upgrade) {
    const state = store.getState();
    if (state.meta.metaAuthority >= upgrade.cost) {
      store.dispatch(Actions.BUY_META_UPGRADE, upgrade);
    }
  }
}
