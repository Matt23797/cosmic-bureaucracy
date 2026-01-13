import content from '../config/content.json';
import { DepartmentCard } from '../components/DepartmentCard.js';
import { store } from '../core/store.js';

export class DepartmentScreen {
    constructor() {
        this.container = null;
        this.unsubscribe = null;
        this.buyAmount = 1; // 1, 10, 100, 'MAX'
        this.currentCategory = 'standard';
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
        this.container.className = 'screen departments-screen';

        this.renderStaticStructure();
        this.initCards();

        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = store.subscribe((state) => {
            if (document.contains(this.container)) {
                this.update();
            }
        });

        return this.container;
    }

    renderStaticStructure() {
        this.container.innerHTML = `
          <h2 class="outfit screen-title">Departments</h2>
          <p class="screen-subtitle">Automate your cosmic production.</p>
          
          <div class="category-tabs" style="display: flex; gap: 8px; margin-bottom: 16px; justify-content: center;">
            <button class="tab-btn ${this.currentCategory === 'standard' ? 'active' : ''}" data-cat="standard">STANDARD PROTOCOLS</button>
            <button class="tab-btn forbidden-tab ${this.currentCategory === 'forbidden' ? 'active' : ''}" data-cat="forbidden">RESTRICTED DOSSIERS</button>
          </div>

          <div id="clearance-indicator" style="text-align: center; margin-bottom: 16px; font-size: 0.65rem; color: var(--text-secondary); letter-spacing: 2px;">
            CLEARANCE LEVEL: <span id="clearance-val" style="color: var(--accent-cyan); font-weight: 800;">BASE</span>
          </div>

          <div class="buy-controls">
            <span class="label">BUY AMOUNT:</span>
            ${[1, 10, 100, 'MAX'].map(amt => `
                <button class="buy-amt-btn ${String(this.buyAmount) === String(amt) ? 'active' : ''}" data-amt="${amt}">${amt}</button>
            `).join('')}
          </div>

          <div class="dept-list"></div>
        `;

        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentCategory = e.target.getAttribute('data-cat');
                this.container.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-cat') === this.currentCategory);
                });
                this.initCards();
            });
        });

        this.container.querySelectorAll('.buy-amt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.target.getAttribute('data-amt');
                this.buyAmount = val === 'MAX' ? 'MAX' : parseInt(val);

                this.container.querySelectorAll('.buy-amt-btn').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-amt') === val);
                });

                // Update all cards with new buy amount
                this.cards.forEach(card => {
                    card.buyAmount = this.buyAmount;
                    card.update();
                });
            });
        });
    }

    initCards() {
        const deptList = this.container.querySelector('.dept-list');
        deptList.innerHTML = '';

        // Filter by category
        const filteredDepts = content.departments.filter(d => (d.category || 'standard') === this.currentCategory);

        this.cards = filteredDepts.map(dept => {
            const card = new DepartmentCard(dept, this.buyAmount);
            deptList.appendChild(card.render());
            return card;
        });
    }

    update() {
        // Update department cards
        this.cards.forEach(card => card.update());

        // Update Clearance Level
        const state = store.getState();
        const totalOwned = Object.values(state.departments || {}).reduce((a, b) => a + b, 0);
        const clearanceVal = this.container.querySelector('#clearance-val');

        if (clearanceVal) {
            let level = "BASE";
            let color = "var(--accent-cyan)";
            if (totalOwned >= 1000) { level = "OVERSEER"; color = "var(--accent-purple)"; }
            else if (totalOwned >= 500) { level = "DIRECTOR"; color = "var(--accent-pink)"; }
            else if (totalOwned >= 100) { level = "MANAGER"; color = "var(--accent-blue)"; }
            else if (totalOwned >= 10) { level = "AGENT"; }

            clearanceVal.innerText = level;
            clearanceVal.style.color = color;
        }
    }
}
