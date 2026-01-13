import content from '../config/content.json';
import { PhilosophyCard } from '../components/PhilosophyCard.js';
import { store, Actions } from '../core/store.js';

export class PhilosophyScreen {
    constructor() {
        this.container = null;
        this.unsubscribe = null;
        this.cards = [];
    }

    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'screen philosophy-screen';

        this.container.innerHTML = `
          <h2 class="outfit screen-title">Administrative Philosophy</h2>
          <p class="screen-subtitle">Select a doctrine to govern the universe.</p>
          <div class="philosophy-list"></div>

          <div id="policy-upgrades-section" style="display: none; margin-top: 40px; border-top: 1px solid var(--border-glow); padding-top: 30px;">
            <h2 class="outfit screen-title">Strategic Upgrades</h2>
            <p class="screen-subtitle" id="active-policy-title">Active Policy: None</p>
            <div class="upgrade-list"></div>
          </div>
        `;

        const list = this.container.querySelector('.philosophy-list');
        this.cards = content.philosophies.map(philo => {
            const card = new PhilosophyCard(philo);
            list.appendChild(card.render());
            return card;
        });

        this.cleanup();
        this.unsubscribe = store.subscribe(() => {
            if (document.contains(this.container)) {
                this.update();
            }
        });

        this.update();
        return this.container;
    }

    update() {
        const state = store.getState();
        this.cards.forEach(card => card.update());

        const upgradeSection = this.container.querySelector('#policy-upgrades-section');
        const upgradeList = this.container.querySelector('.upgrade-list');
        const activeTitle = this.container.querySelector('#active-policy-title');

        if (state.activePhilosophy) {
            upgradeSection.style.display = 'block';
            const phil = content.philosophies.find(p => p.id === state.activePhilosophy);
            if (phil) {
                activeTitle.innerText = `Active Policy: ${phil.name}`;
                this.updateUpgrades(state, upgradeList, phil);
            } else {
                upgradeSection.style.display = 'none';
                upgradeList.innerHTML = '';
            }
        } else {
            upgradeSection.style.display = 'none';
        }
    }

    updateUpgrades(state, listContainer, phil) {
        if (!phil || !phil.upgrades) return;

        const availableUpgrades = phil.upgrades.filter(u => !(state.ownedUpgrades || []).includes(u.id));

        if (availableUpgrades.length === 0) {
            listContainer.innerHTML = '<p class="description" style="text-align: center; opacity: 0.6; margin: 20px 0;">No further upgrades available for this doctrine.</p>';
            return;
        }

        if (listContainer.childElementCount !== availableUpgrades.length) {
            listContainer.innerHTML = '';
            availableUpgrades.forEach(upgrade => {
                listContainer.appendChild(this.renderUpgradeCard(upgrade));
            });
        } else {
            listContainer.querySelectorAll('.upgrade-card').forEach((card, i) => {
                const upgrade = availableUpgrades[i];
                if (upgrade) {
                    const btn = card.querySelector('.buy-btn');
                    const canAfford = state.resources.forms >= upgrade.cost;
                    btn.disabled = !canAfford;
                    card.className = `dept-card upgrade-card ${canAfford ? 'affordable' : 'expensive'}`;
                }
            });
        }
    }

    renderUpgradeCard(upgrade) {
        const div = document.createElement('div');
        div.className = 'dept-card upgrade-card';
        div.innerHTML = `
            <div class="dept-info">
                <h3 class="outfit">${upgrade.name}</h3>
                <p class="description">${upgrade.description}</p>
            </div>
            <div class="dept-actions">
                <button class="buy-btn">
                  PURCHASE (${this.formatNumber(upgrade.cost)} Forms)
                </button>
            </div>
        `;
        div.querySelector('button').addEventListener('click', () => {
            this.buyUpgrade(upgrade);
        });
        return div;
    }

    buyUpgrade(upgrade) {
        const state = store.getState();
        if (state.resources.forms >= upgrade.cost) {
            store.dispatch(Actions.BUY_STRATEGIC_UPGRADE, upgrade);
        }
    }

    formatNumber(num) {
        if (num < 1000000) return num.toLocaleString();
        return (num / 1000000).toFixed(1) + 'M';
    }
}
