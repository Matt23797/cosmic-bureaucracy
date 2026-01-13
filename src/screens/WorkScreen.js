import { store, Actions } from '../core/store.js';
import { Utils } from '../core/Utils.js';
import { StateSelectors } from '../core/StateSelectors.js';
import { resourceManager } from '../core/ResourceManager.js';
import { ToastComponent } from '../components/ToastComponent.js';

export class WorkScreen {
  constructor() {
    this.unsubscribe = null;
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  render() {
    const div = document.createElement('div');
    div.className = 'screen work-screen';

    div.innerHTML = `
      <div class="work-container">
        <h2 class="outfit">Central Processing</h2>
        <p class="subtitle">Process cosmic forms to maintain reality.</p>
        
        <div class="main-tap-area">
          <button id="process-btn" class="process-button">
            <span class="btn-ripple"></span>
            <span class="icon"><img src="/assets/icons/resources/forms.svg" class="icon-svg" /></span>
            <span class="label">PROCESS FORM</span>
          </button>
        </div>

        <div class="chrono-actions" style="margin-top: 20px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button id="warp-btn" class="buy-btn" style="width: auto; padding: 10px 20px; display: none;">
             TIME WARP (1h)
          </button>
          <button id="burst-btn" class="burst-btn" style="display: none;">
             PARADOX BURST
          </button>
        </div>

        <div class="emergency-actions" style="margin-top: 16px; display: flex; justify-content: center;">
          <button id="burn-btn" class="burn-btn" style="display: none;">
             BURN BACKLOG
          </button>
        </div>

        <div id="burst-hint" class="description" style="margin-top: 10px; font-size: 0.75rem; color: var(--accent-pink); display: none;">
          Accumulate Paradox to trigger a BURST and multiply production.
        </div>

        <div id="burst-indicator" class="burst-indicator" style="display: none;">
          <span class="burst-text">⚡ BURST ACTIVE ⚡</span>
          <span id="burst-timer" class="burst-timer"></span>
        </div>
      </div>
    `;

    const processBtn = div.querySelector('#process-btn');
    processBtn.addEventListener('click', (e) => {
      const amount = resourceManager.calculateClickPower(store.getState());
      store.dispatch(Actions.CLICK_PROCESS);
      this.createTapEffect(processBtn);
      this.spawnFloatingNumber(e, amount);
    });

    const warpBtn = div.querySelector('#warp-btn');
    warpBtn.addEventListener('click', () => {
      if (StateSelectors.canTimeWarp(store.getState())) {
        store.dispatch(Actions.ACTIVATE_OVERDRIVE);
        ToastComponent.show("Reality accelerated! 1 hour of production gained.", "success");
      } else {
        ToastComponent.show("Not enough Stored Time (Requires 1 hour).", "warning");
      }
    });

    const burnBtn = div.querySelector('#burn-btn');
    burnBtn.addEventListener('click', () => {
      if (confirm("Reset all Paradox to zero? This will stabilize reality.")) {
        store.dispatch(Actions.BURN_BACKLOG);
        ToastComponent.show("Paradox purged. Reality stabilized.", "info");
      }
    });

    const burstBtn = div.querySelector('#burst-btn');
    const burstIndicator = div.querySelector('#burst-indicator');
    const burstTimer = div.querySelector('#burst-timer');

    burstBtn.addEventListener('click', () => {
      const state = store.getState();
      const isOnCooldown = StateSelectors.isBurstOnCooldown(state);
      const tier = StateSelectors.getBurstTier(state);

      if (isOnCooldown) {
        ToastComponent.show('Paradox Burst is on cooldown!', 'warning');
      } else if (!tier) {
        ToastComponent.show(`Need at least 50 Paradox to burst!`, 'warning');
      } else {
        // Find the tier index for the selected tier
        const tierIndex = StateSelectors.getBurstTierIndex(state);
        store.dispatch(Actions.ACTIVATE_PARADOX_BURST, { tier: tierIndex });
        burstBtn.classList.add('burst-activated');
        ToastComponent.show(`PARADOX BURST ACTIVATED (${tier.multiplier}x)`, 'success');
        setTimeout(() => burstBtn.classList.remove('burst-activated'), 500);
      }
    });

    // Clean up old subscription if it exists
    if (this.unsubscribe) this.unsubscribe();

    // Update dynamic visibility
    this.unsubscribe = store.subscribe((state) => {
      if (!document.contains(div)) return;

      const canWarp = StateSelectors.canTimeWarp(state);
      warpBtn.style.display = state.resources.time > 0 ? 'block' : 'none';
      warpBtn.disabled = !canWarp;
      warpBtn.style.opacity = canWarp ? '1' : '0.5';

      burnBtn.style.display = StateSelectors.canBurnBacklog(state) ? 'block' : 'none';

      const tier = StateSelectors.getBurstTier(state);
      const isOnCooldown = StateSelectors.isBurstOnCooldown(state);
      const isActive = StateSelectors.isBurstActive(state);
      const burstState = state.paradoxBurst || {};

      burstBtn.style.display = (state.resources.paradox > 0 || tier || isOnCooldown || isActive) ? 'block' : 'none';
      burstBtn.disabled = !tier || isOnCooldown;

      const burstHint = div.querySelector('#burst-hint');
      if (burstHint) {
        burstHint.style.display = (state.resources.paradox > 0 && !tier && !isActive && !isOnCooldown) ? 'block' : 'none';
      }

      if (isOnCooldown && !isActive) {
        const remaining = Math.ceil((burstState.cooldownUntil - Date.now()) / 1000);
        burstBtn.innerText = `BURST (${remaining}s)`;
        burstBtn.style.opacity = '0.5';
      } else if (tier) {
        burstBtn.innerText = `BURST (${tier.multiplier}x)`;
        burstBtn.style.opacity = '1';
      } else {
        burstBtn.innerText = 'BURST';
        burstBtn.style.opacity = '0.5';
      }

      // Active burst indicator
      if (isActive) {
        burstIndicator.style.display = 'block';
        const remaining = Math.ceil((burstState.expiresAt - Date.now()) / 1000);
        burstTimer.innerText = `${burstState.multiplier}x for ${remaining}s`;
      } else {
        burstIndicator.style.display = 'none';
      }

      const rateVal = div.querySelector('#forms-sec-val');
      if (rateVal) {
        rateVal.innerText = Utils.formatNumber(state.stats?.currentRate || 0);
      }
    });

    return div;
  }

  createTapEffect(element) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    element.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  spawnFloatingNumber(e, value) {
    const float = document.createElement('div');
    float.className = 'floating-number';
    float.innerText = `+${Utils.formatNumber(value)}`;

    // Position at cursor
    float.style.left = `${e.clientX}px`;
    float.style.top = `${e.clientY}px`;

    document.body.appendChild(float);
    setTimeout(() => float.remove(), 800);
  }

}
