import { Utils } from './Utils.js';
import { store } from './store.js';
import { auditSystem } from './AuditSystem.js';
import { TooltipSystem } from './TooltipSystem.js';
import { NotificationSystem } from './NotificationSystem.js';
import { TutorialModal } from '../components/TutorialModal.js';
import { ToastComponent } from '../components/ToastComponent.js';
import { OfflineModal } from '../components/OfflineModal.js';
import { ObjectiveTracker } from '../components/ObjectiveTracker.js';
import { StateSelectors } from './StateSelectors.js';

export class UIManager {
    constructor() {
        this.currentScreen = 'work';
        this.screens = {};
        this.init();
    }

    init() {
        this.displayValues = {
            forms: 0,
            metaAuthority: 0,
            time: 0,
            paradox: 0,
            policyDebt: 0
        };
        this.lastIntensity = -1;
        this.lastColor = '';

        this.entities = []; // For parasites
        this.tooltips = new TooltipSystem();
        this.notifications = new NotificationSystem();
        this.objectiveTracker = new ObjectiveTracker();

        // Inject Objective Tracker before screen container
        const screenContainer = document.getElementById('screen-container');
        if (screenContainer) {
            screenContainer.parentNode.insertBefore(this.objectiveTracker.render(), screenContainer);
        }

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const screenId = btn.getAttribute('data-screen');
                this.switchScreen(screenId);
            });
        });

        store.subscribe((state) => {
            try {
                this.updateGlobalDisplays(state);
                this.syncAuditEntities(state.auditEntities || []);
                this.notifications.checkMilestones(state);
                this.objectiveTracker.update(state);
                this.checkGlitchTutorial(state);
                if (state.tutorial?.active && state.tutorial.step === 0) {
                    this.showTutorialModal();
                }
                // Complete tutorial when player processes 5+ forms
                if (state.tutorial?.active && (state.stats?.totalForms || 0) >= 5) {
                    store.setState({
                        tutorial: { active: false, step: 1 }
                    });
                }
            } catch (e) {
                console.error("UIManager: Subscription error:", e);
            }
        });

        this.startTicker();
    }

    startTicker() {
        const tick = () => {
            const state = store.getState();

            // Smoother lerp for rolling numbers
            const lerp = (current, target) => {
                if (isNaN(current)) current = 0;
                if (target === undefined || isNaN(target)) return current;
                const diff = target - current;
                if (Math.abs(diff) < 0.1) return target;
                return current + diff * 0.15;
            };

            this.displayValues.forms = lerp(this.displayValues.forms, state.resources.forms);
            this.displayValues.metaAuthority = lerp(this.displayValues.metaAuthority, state.meta?.metaAuthority || 0);
            this.displayValues.time = lerp(this.displayValues.time, state.resources.time || 0);
            this.displayValues.paradox = lerp(this.displayValues.paradox, state.resources.paradox || 0);
            this.displayValues.policyDebt = lerp(this.displayValues.policyDebt, state.resources.policyDebt || 0);

            this.renderTickerDisplays();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    renderTickerDisplays() {
        const d = (id) => document.getElementById(id);

        if (d('forms-display')) d('forms-display').innerText = Utils.formatNumber(this.displayValues.forms);
        if (d('meta-authority-display')) d('meta-authority-display').innerText = Utils.formatNumber(this.displayValues.metaAuthority);
        if (d('stored-time-display')) d('stored-time-display').innerText = Utils.formatNumber(this.displayValues.time);

        if (d('paradox-display')) {
            d('paradox-display').innerText = Utils.formatNumber(this.displayValues.paradox);
            const pill = d('paradox-pill');
            if (this.displayValues.paradox > 0) {
                pill.style.display = 'flex';
                if (this.displayValues.paradox > 500) {
                    pill.style.transform = `translate(${(Math.random() - 0.5) * 2}px, ${(Math.random() - 0.5) * 2}px)`;
                    pill.style.borderColor = 'var(--accent-pink)';
                } else {
                    pill.style.transform = 'none';
                    pill.style.borderColor = 'var(--border-glow)';
                }
            } else {
                pill.style.display = 'none';
            }
        }

        if (d('debt-display')) {
            d('debt-display').innerText = Utils.formatNumber(this.displayValues.policyDebt);
            const pill = d('debt-pill');
            if (this.displayValues.policyDebt > 0) {
                pill.style.display = 'flex';
            } else {
                pill.style.display = 'none';
            }
        }

        // Update header rate
        const state = store.getState();
        const headerRate = d('header-rate-val');
        if (headerRate) {
            headerRate.innerText = Utils.formatNumber(state.stats?.currentRate || 0);
        }

        // Contextual Visibility
        this.updateContextualVisibility(state);

        // Dynamic Paradox Background
        this.updateDynamicBackground(state);
    }

    updateContextualVisibility(state) {
        const d = (id) => document.getElementById(id);

        // Always show forms

        // Show Meta-Authority if unlocked or > 0
        const maPill = d('meta-authority-display').closest('.resource-pill');
        if (maPill) {
            const hasMA = (state.meta?.totalMetaAuthority || 0) > 0;
            maPill.style.display = hasMA ? 'flex' : 'none';
        }

        // Show Time if > 0
        const timePill = d('time-pill');
        if (timePill) {
            timePill.style.display = (state.resources.time > 0) ? 'flex' : 'none';
        }
    }

    updateDynamicBackground(state) {
        const paradox = state.resources.paradox || 0;
        const root = document.documentElement;

        // Intensity 0 to 1 (capped at 100 Paradox for max effect)
        const intensity = Math.min(1, paradox / 100);
        const color = intensity > 0.5 ? 'rgba(219, 39, 119, 0.3)' : 'rgba(0, 242, 255, 0.15)';

        // Only update if changed significantly
        if (Math.abs(this.lastIntensity - intensity) > 0.005 || this.lastColor !== color) {
            root.style.setProperty('--paradox-intensity', intensity.toFixed(3));
            root.style.setProperty('--paradox-color', color);
            this.lastIntensity = intensity;
            this.lastColor = color;
        }

        // Update Black Holes
        this.syncBlackHoles(intensity);
    }

    syncBlackHoles(intensity) {
        const container = document.getElementById('black-holes');
        if (!container) return;

        // If intensity is 0, we can clear them to save resources, but only if they exist
        if (intensity <= 0 && container.children.length > 0) {
            container.innerHTML = '';
            return;
        }

        // Ensure 3 black holes exist if intensity > 0
        if (intensity > 0 && container.children.length === 0) {
            for (let i = 0; i < 3; i++) {
                const bh = document.createElement('div');
                bh.className = 'black-hole';
                bh.style.left = `${Math.random() * 80 + 10}%`;
                bh.style.top = `${Math.random() * 80 + 10}%`;
                bh.innerHTML = '<div class="event-horizon"></div>';
                container.appendChild(bh);
            }
        }
    }

    checkGlitchTutorial(state) {
        if (state.auditEntities?.length > 0 && !state.stats.hasSeenGlitch) {
            if (document.querySelector('.glitch-tutorial-modal')) return;
            const modal = document.createElement('div');
            modal.className = 'modal-overlay glitch-tutorial-modal';
            modal.innerHTML = `
                <div class="modal-content tutorial-modal">
                    <h2 class="outfit" style="color: var(--accent-pink);">!!! REALITY GLITCH DETECTED !!!</h2>
                    <p>Parasitic entities have manifested due to your **Sequestered Forms**.</p>
                    <p>These entities steal potential production. Locate and **POP** them to recover your lost forms with a bonus!</p>
                    <button class="buy-btn" id="close-glitch-tutorial">UNDERSTOOD</button>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#close-glitch-tutorial').addEventListener('click', () => {
                modal.remove();
            });

            const nextStats = { ...state.stats, hasSeenGlitch: true };
            store.setState({ stats: nextStats });
        }
    }

    syncAuditEntities(entitiesState) {
        // Remove entities that no longer exist in state
        const stateIds = new Set(entitiesState.map(e => e.id));
        this.entities = this.entities.filter(el => {
            if (!stateIds.has(el.id)) {
                el.classList.add('popping');
                setTimeout(() => el.remove(), 300);
                return false;
            }
            return true;
        });

        // Add new entities from state
        entitiesState.forEach(entityData => {
            const existing = document.getElementById(entityData.id);
            if (!existing) {
                this.renderAuditEntity(entityData);
            }
        });
    }

    renderAuditEntity(data) {
        const entity = document.createElement('div');
        entity.id = data.id;
        entity.className = 'audit-entity';
        entity.innerHTML = `
            <div class="entity-core"></div>
            <div class="entity-glitch"></div>
        `;

        entity.style.left = `${data.x * window.innerWidth}px`;
        entity.style.top = `${data.y * window.innerHeight}px`;

        entity.addEventListener('click', () => {
            auditSystem.popEntity(data.id);
        });

        document.body.appendChild(entity);
        this.entities.push(entity);
    }

    showTutorialModal() {
        if (document.querySelector('.modal-overlay')) return;
        const modal = new TutorialModal();
        document.body.appendChild(modal.render());
    }

    showOfflineModal(gains) {
        if (document.querySelector('.modal-overlay')) return;
        const modal = new OfflineModal(gains);
        document.body.appendChild(modal.render());
    }

    registerScreen(id, screenInstance) {
        this.screens[id] = screenInstance;
    }

    switchScreen(screenId) {
        if (this.currentScreen === screenId) return;

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-screen') === screenId);
        });

        this.currentScreen = screenId;
        this.renderCurrentScreen();
    }

    renderCurrentScreen() {
        const container = document.getElementById('screen-container');
        if (!container) return;

        Object.values(this.screens).forEach(screen => {
            if (screen.cleanup && typeof screen.cleanup === 'function') {
                screen.cleanup();
            }
        });

        container.innerHTML = '';

        if (this.screens[this.currentScreen]) {
            const screenElement = this.screens[this.currentScreen].render();
            container.appendChild(screenElement);
        }
    }

    updateGlobalDisplays(state) {
        const formsSecDisplay = document.getElementById('forms-sec-val');

        if (this.prevForms !== undefined && this.prevForms > state.resources.forms) {
            this.triggerPop('forms-display');
        }
        if (this.prevAuthority !== undefined && this.prevAuthority > state.resources.authority) {
            this.triggerPop('authority-display');
        }

        this.prevForms = state.resources.forms;
        this.prevAuthority = state.resources.authority;

        if (formsSecDisplay) {
            formsSecDisplay.innerText = (state.stats.currentRate || 0).toFixed(1);
        }
    }

    triggerPop(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const pill = el.closest('.resource-pill');
        if (pill) {
            pill.classList.remove('pop');
            void pill.offsetWidth; // Force reflow
            pill.classList.add('pop');
        }
    }

}

export const uiManager = new UIManager();
