import { store, Actions } from '../core/store.js';
import { Utils } from '../core/Utils.js';
import { resourceManager } from '../core/ResourceManager.js';

export class DepartmentCard {
  constructor(dept, buyAmount = 1) {
    this.dept = dept;
    this.buyAmount = buyAmount;
    this.element = null;
    this.refs = {};
    this.expanded = false;
    this.lastUpgradeIds = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'dept-card';

    this.element.innerHTML = `
      <div class="dept-info">
        <h3 class="outfit"></h3>
        <p class="description"></p>
        <div class="dept-stats">
          <span class="owned"></span>
          <span class="output"></span>
          <span class="contribution" style="font-size: 0.7rem; color: var(--accent-cyan); opacity: 0.8;"></span>
        </div>
      </div>
      <div class="dept-actions">
        <button class="buy-btn">
          <span class="btn-label"></span>
        </button>
      </div>
      <div class="upgrade-chevron" style="display: none;">
        <span class="chevron-icon">▼</span>
        <span class="upgrade-count"></span>
      </div>
      <div class="threshold-upgrades" style="display: none;"></div>
    `;

    this.refs = {
      title: this.element.querySelector('h3'),
      description: this.element.querySelector('.description'),
      owned: this.element.querySelector('.owned'),
      output: this.element.querySelector('.output'),
      contribution: this.element.querySelector('.contribution'),
      buyBtn: this.element.querySelector('.buy-btn'),
      btnLabel: this.element.querySelector('.btn-label'),
      chevron: this.element.querySelector('.upgrade-chevron'),
      chevronIcon: this.element.querySelector('.chevron-icon'),
      upgradeCount: this.element.querySelector('.upgrade-count'),
      upgradesSection: this.element.querySelector('.threshold-upgrades')
    };

    this.refs.buyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const state = store.getState();
      const count = state.departments[this.dept.id] || 0;
      const { cost, amount } = this.calculateCost(count, state.resources.forms);
      this.buyDept(cost, amount);
    });

    this.refs.chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleUpgrades();
    });

    this.update();
    return this.element;
  }

  toggleUpgrades() {
    this.expanded = !this.expanded;
    this.refs.upgradesSection.style.display = this.expanded ? 'block' : 'none';
    this.refs.chevronIcon.innerText = this.expanded ? '▲' : '▼';
    if (this.expanded) {
      this.renderUpgrades();
    }
  }

  renderUpgrades() {
    const state = store.getState();
    const count = state.departments[this.dept.id] || 0;
    const owned = state.ownedThresholdUpgrades || [];
    const upgrades = this.dept.thresholdUpgrades || [];

    const available = upgrades.filter(u =>
      count >= u.threshold && !owned.includes(u.id)
    );

    // Store current available IDs to detect changes
    const currentIds = available.map(u => u.id).join(',');
    if (this.lastUpgradeIds === currentIds) {
      // Just update button states, don't rebuild
      this.updateUpgradeButtons();
      return;
    }
    this.lastUpgradeIds = currentIds;

    if (available.length === 0) {
      this.refs.upgradesSection.innerHTML = '<p class="no-upgrades">No upgrades available</p>';
      return;
    }

    this.refs.upgradesSection.innerHTML = available.map(u => `
      <div class="threshold-upgrade" data-id="${u.id}">
        <div class="upgrade-info">
          <span class="upgrade-name">${u.name}</span>
          <span class="upgrade-desc">${u.description}</span>
        </div>
        <button class="upgrade-buy-btn ${state.resources.forms >= u.cost ? 'affordable' : 'expensive'}" 
                data-id="${u.id}" data-cost="${u.cost}" ${state.resources.forms < u.cost ? 'disabled' : ''}>
          <img src="/assets/icons/resources/forms.svg" class="icon-svg" style="width:12px;height:12px;"/> ${this.formatNumber(u.cost)}
        </button>
      </div>
    `).join('');

    this.refs.upgradesSection.querySelectorAll('.upgrade-buy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.buyUpgrade(btn.dataset.id, parseInt(btn.dataset.cost));
      });
    });
  }

  updateUpgradeButtons() {
    const state = store.getState();
    this.refs.upgradesSection.querySelectorAll('.upgrade-buy-btn').forEach(btn => {
      const cost = parseInt(btn.dataset.cost);
      const canAfford = state.resources.forms >= cost;
      btn.disabled = !canAfford;
      btn.classList.toggle('affordable', canAfford);
      btn.classList.toggle('expensive', !canAfford);
    });
  }

  buyUpgrade(upgradeId, cost) {
    const state = store.getState();
    if (state.resources.forms >= cost) {
      store.dispatch(Actions.BUY_THRESHOLD_UPGRADE, { id: upgradeId, cost });
    }
  }

  update() {
    if (!this.element) return;

    const state = store.getState();
    const count = state.departments[this.dept.id] || 0;
    const { cost, amount } = this.calculateCost(count, state.resources.forms);
    const canAfford = state.resources.forms >= cost;
    const isAffordable = state.resources.forms >= this.dept.baseCost;

    const isMystery = count === 0 && !isAffordable;

    this.element.className = `dept-card ${canAfford ? 'affordable' : 'expensive'} ${isMystery ? 'locked' : ''}`;

    this.refs.title.innerText = isMystery ? '???' : this.dept.name;
    this.refs.description.innerText = isMystery ? 'Higher clearance level required.' : this.dept.description;

    if (isMystery) {
      this.refs.owned.innerText = '';
      this.refs.output.innerText = '';
      this.refs.buyBtn.disabled = true;
      this.refs.btnLabel.innerText = 'LOCKED';
      this.refs.chevron.style.display = 'none';
    } else {
      this.refs.owned.innerText = `Owned: ${count}`;

      const unitRate = resourceManager.getDepartmentUnitRate(state, this.dept.id);
      this.refs.output.innerHTML = `Output: +${this.formatNumber(unitRate)} <img src="/assets/icons/resources/forms.svg" class="icon-svg" style="width: 10px; height: 10px; display: inline-block;" />/s each`;

      // Use fresh calculated rates for accurate percentage
      const totalRates = resourceManager.calculateRates(state);
      const totalRate = totalRates.forms || 0;
      const totalDeptRate = unitRate * count;
      const percent = totalRate > 0 ? Math.min(100, ((totalDeptRate / totalRate) * 100)).toFixed(1) : 0;
      this.refs.contribution.innerText = percent > 0 ? `(${percent}% of total)` : '';

      this.refs.buyBtn.disabled = !canAfford;

      // Feasibility Highlighting & Predictor
      const forms = state.resources.forms;
      const progress = Math.min(100, Math.max(0, (forms / cost) * 100));
      this.refs.buyBtn.style.setProperty('--buy-progress', `${progress}%`);

      let btnText = `BUY x${amount} (<img src="/assets/icons/resources/forms.svg" class="icon-svg" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" /> ${this.formatNumber(cost)})`;

      if (!canAfford && totalRate > 0) {
        const remainingCost = cost - forms;
        const secondsLeft = Math.ceil(remainingCost / totalRate);
        if (secondsLeft < 3600) {
          btnText += `<br><span style="font-size: 0.65rem; opacity: 0.8; font-weight: 400;">Ready in ${this.formatTime(secondsLeft)}</span>`;
        }
      }
      this.refs.btnLabel.innerHTML = btnText;

      // Check for available upgrades
      const owned = state.ownedThresholdUpgrades || [];
      const upgrades = this.dept.thresholdUpgrades || [];
      const availableCount = upgrades.filter(u => count >= u.threshold && !owned.includes(u.id)).length;

      if (availableCount > 0) {
        this.refs.chevron.style.display = 'flex';
        this.refs.upgradeCount.innerText = `${availableCount} Upgrade${availableCount > 1 ? 's' : ''} Available`;
      } else {
        this.refs.chevron.style.display = 'none';
        this.refs.upgradesSection.style.display = 'none';
        this.expanded = false;
      }
    }

    if (this.expanded) {
      this.renderUpgrades();
    }
  }

  calculateCost(currentCount, currentForms) {
    const state = store.getState();
    const metaUpgrades = state.meta?.ownedUpgrades || [];
    let reductionMult = 1.0;

    if (metaUpgrades.includes('meta_cost_1')) {
      reductionMult = 0.95;
    }

    const rBase = this.dept.costScaling;
    let r = rBase;

    if (state.activePhilosophy === 'expansion' && (state.ownedUpgrades || []).includes('exp_2')) {
      r = 1 + (rBase - 1) * 0.9;
    }

    const b = this.dept.baseCost * reductionMult;
    let k = currentCount;
    let n = 1;

    if (this.buyAmount === 'MAX') {
      const num = (currentForms * (r - 1)) / (b * Math.pow(r, k)) + 1;
      if (num > 0) {
        n = Math.floor(Math.log(num) / Math.log(r));
      }
      if (n < 1) n = 1;
    } else {
      n = this.buyAmount;
    }

    const cost = Math.floor(
      b * Math.pow(r, k) * ((Math.pow(r, n) - 1) / (r - 1))
    );

    return { cost: cost, amount: n };
  }

  buyDept(cost, amount) {
    const state = store.getState();
    if (state.resources.forms >= cost) {
      store.dispatch(Actions.BUY_DEPARTMENT, { id: this.dept.id, cost, amount });
    }
  }

  formatNumber(num) {
    if (num < 1000) return num.toFixed(1);
    if (num < 1000000) return Math.floor(num).toLocaleString();
    return num.toExponential(2).replace('+', '');
  }

  formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
}

