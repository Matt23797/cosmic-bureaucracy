import { store } from './store.js';

/**
 * Manages resource tooltips and hover logic.
 */
export class TooltipSystem {
    constructor() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'resource-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }

    init() {
        const pills = document.querySelectorAll('.resource-pill');
        pills.forEach(pill => {
            const valueEl = pill.querySelector('.value');
            if (!valueEl) return;

            const resourceType = valueEl.id?.replace('-display', '') || '';

            pill.addEventListener('mouseenter', (e) => this.showTooltip(e, resourceType));
            pill.addEventListener('mouseleave', () => this.hideTooltip());
            pill.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.showTooltip(e, resourceType);
                setTimeout(() => this.hideTooltip(), 3000);
            });
        });
    }

    showTooltip(e, resourceType) {
        const state = store.getState();
        let content = '';

        switch (resourceType) {
            case 'forms':
                const rate = state.stats.currentRate || 0;
                content = `<strong>Forms</strong><br>${this.formatNumber(rate)}/sec from departments`;
                break;
            case 'meta-authority':
                const current = state.meta?.metaAuthority || 0;
                const total = state.meta?.totalMetaAuthority || 0;
                const bonusPerMA = 5; // Updated from Constants logic (0.05)
                content = `<strong>Meta-Authority</strong><br>Prestige currency. Spend at the Authority tab.<br><em>+${(total * bonusPerMA).toFixed(0)}% production from ${total} lifetime MA</em>`;
                break;
            case 'stored-time':
                const time = state.resources.time || 0;
                const overdriveUntil = state.resources.overdriveUntil || 0;
                const isOverdrive = overdriveUntil > Date.now();
                const canWarp = time >= 3600;

                if (isOverdrive) {
                    const remaining = Math.ceil((overdriveUntil - Date.now()) / 1000);
                    content = `<strong>Overdrive Active!</strong><br>x2 overall production speed.<br>${remaining}s remaining.`;
                } else {
                    content = `<strong>Stored Time</strong><br>${canWarp ? 'Overdrive ready!' : `${Math.floor(3600 - time)}s until Overdrive`}<br>Triggers 5m of x2 production.`;
                }
                break;
            case 'paradox':
                const paradox = state.resources.paradox || 0;
                const friction = paradox > 1000 ? `${((paradox - 1000) / 10000 * 100).toFixed(1)}% friction` : 'No friction yet';
                content = `<strong>Paradox</strong><br>${friction}`;
                break;
            case 'debt':
                content = `<strong>Policy Debt</strong><br>Accumulates from Emergency Powers`;
                break;
            default:
                return;
        }

        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';

        const rect = e.target.closest('.resource-pill').getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        let left = rect.left + rect.width / 2;
        const minLeft = tooltipRect.width / 2 + 8;
        if (left < minLeft) left = minLeft;
        const maxLeft = window.innerWidth - tooltipRect.width / 2 - 8;
        if (left > maxLeft) left = maxLeft;

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${rect.bottom + 8}px`;
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    formatNumber(num) {
        return Utils.formatNumber(num);
    }
}
