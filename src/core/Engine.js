import { store, Actions } from './store.js';
import { policyEngine } from './PolicyEngine.js';
import { auditSystem } from './AuditSystem.js';
import { resourceManager } from './ResourceManager.js';
import { uiManager } from './UIManager.js';
import { purchaseManager } from './PurchaseManager.js';
import { prestigeSystem } from './PrestigeSystem.js';
import { GameConstants } from './Constants.js';
import { StateSelectors } from './StateSelectors.js';
import content from '../config/content.json' assert { type: 'json' };

/**
 * Core game loop and resource coordinator.
 * Manages the main tick cycle, offline progress, and high-level activities.
 */
export class GameEngine {
    constructor() {
        this.tickRate = GameConstants.TICK_RATE_MS;
        this.interval = null;
        store.setActionHandler(this.handleAction.bind(this));
    }

    /**
     * Initializes the game loop and processes offline time.
     */
    start() {
        const state = store.getState();
        const now = Date.now();
        const lastTick = state.stats.lastTick || now;
        let offlineTime = now - lastTick;

        if (offlineTime > GameConstants.MAX_OFFLINE_TIME_MS) {
            offlineTime = GameConstants.MAX_OFFLINE_TIME_MS;
        }

        if (offlineTime > (GameConstants.TICK_RATE_MS || 1000)) {
            this.handleOfflineProgress(offlineTime);
        }

        this.interval = setInterval(() => this.tick(), this.tickRate);
    }

    /**
     * Main simulation step. Runs at the specified tick rate.
     */
    tick() {
        const state = store.getState();
        const now = Date.now();

        const nextResources = { ...state.resources };
        const nextStats = { ...state.stats };

        const rates = resourceManager.calculateRates(state);

        const tickDivisor = (GameConstants.MS_PER_SECOND / this.tickRate);
        const friction = policyEngine.calculateFriction(state);
        const frictionMult = 1 - friction;

        let formsGain = (rates.forms / tickDivisor) * frictionMult;
        let timeGain = (rates.time / tickDivisor) * frictionMult;
        let paradoxGain = rates.paradox / tickDivisor;
        let debtGain = rates.debt / tickDivisor;

        const glitchChance = (nextResources.paradox / 100) * GameConstants.GLITCH_CHANCE_MULT;
        if (Math.random() < glitchChance) {
            const glitchMultiplier = GameConstants.GLITCH_MIN_MULT + Math.random() * (GameConstants.GLITCH_MAX_MULT - GameConstants.GLITCH_MIN_MULT);
            formsGain *= glitchMultiplier;
        }

        const sequesterRate = policyEngine.getSequesterRate(nextResources.paradox);
        if (sequesterRate > 0) {
            const eaten = formsGain * sequesterRate;
            formsGain -= eaten;
            nextResources.sequesteredForms = (nextResources.sequesteredForms || 0) + eaten;
        }

        paradoxGain += policyEngine.getParadoxFriction(nextResources.paradox) / tickDivisor;

        if (nextResources.paradox < GameConstants.PARADOX_DECAY_THRESHOLD && nextResources.paradox > 0) {
            const decay = GameConstants.PARADOX_DECAY_RATE / tickDivisor;
            paradoxGain -= decay;
        }

        nextResources.forms += formsGain;
        nextResources.time += timeGain;
        nextResources.paradox = Math.max(0, nextResources.paradox + paradoxGain);
        nextResources.policyDebt = (nextResources.policyDebt || 0) + debtGain;

        nextStats.totalForms += formsGain;
        nextStats.currentRate = rates.forms * frictionMult * (1 - sequesterRate);
        nextStats.lastTick = now;

        store.setState({
            resources: nextResources,
            stats: nextStats
        });

        auditSystem.tick(nextResources.paradox > 0 ? { ...state, resources: nextResources, stats: nextStats } : state);

        if (!this.lastSync || now - this.lastSync > GameConstants.AUTOSAVE_INTERVAL_MS) {
            store.sync();
            this.lastSync = now;
        }
    }

    /**
     * Routes actions to their respective handlers.
     * @param {string} type - Action type from Actions enum
     * @param {any} payload - Optional data for the action
     */
    handleAction(type, payload) {
        switch (type) {
            case Actions.CLICK_PROCESS:
                this.processFormManual();
                break;
            case Actions.BUY_DEPARTMENT:
                purchaseManager.buyDepartment(payload);
                break;
            case Actions.BUY_UPGRADE:
                purchaseManager.buyUpgrade(payload);
                break;
            case Actions.BUY_THRESHOLD_UPGRADE:
                purchaseManager.buyThresholdUpgrade(payload);
                break;
            case Actions.BUY_META_UPGRADE:
                purchaseManager.buyMetaUpgrade(payload);
                break;
            case Actions.ACTIVATE_PHILOSOPHY:
                this.activatePhilosophy(payload);
                break;
            case Actions.BURN_BACKLOG:
                this.burnBacklog();
                break;
            case Actions.PERFORM_RESET:
                this.performReset();
                break;
            case Actions.ACTIVATE_OVERDRIVE:
                this.activateOverdrive();
                break;
            case Actions.ACTIVATE_PARADOX_BURST:
                this.activateParadoxBurst(payload);
                break;
            case Actions.CLAIM_GLITCH:
                this.claimGlitch(payload);
                break;
            default:
                console.warn(`Engine: Unknown action type "${type}"`);
        }
    }

    /**
     * Handles manual form processing (clicking/tapping).
     */
    processFormManual() {
        const state = store.getState();
        const clickPower = resourceManager.calculateClickPower(state);

        const nextResources = { ...state.resources };
        const nextStats = { ...state.stats };

        nextResources.forms += clickPower;
        nextStats.totalForms += clickPower;
        nextStats.clicks = (nextStats.clicks || 0) + 1;

        store.setState({ resources: nextResources, stats: nextStats });
    }

    /**
     * Processes production that occurred while the player was offline.
     * @param {number} offlineTimeMs - Time offline in milliseconds
     */
    handleOfflineProgress(offlineTimeMs) {
        const state = store.getState();
        const rates = resourceManager.calculateRates(state);

        const activePhil = state.activePhilosophy;
        let efficiency = GameConstants.OFFLINE_EFFICIENCY_DEFAULT;
        if (activePhil === 'compliance') {
            efficiency = GameConstants.OFFLINE_EFFICIENCY_COMPLIANCE;
        }

        const offlineSeconds = offlineTimeMs / GameConstants.MS_PER_SECOND;
        const offlineGain = rates.forms * offlineSeconds * efficiency;

        if (offlineGain > 0) {
            const nextResources = { ...state.resources };
            const nextStats = { ...state.stats };
            nextResources.forms += offlineGain;
            nextStats.totalForms += offlineGain;
            store.setState({ resources: nextResources, stats: nextStats });

        }
    }

    /**
     * Activates a philosophy doctrine.
     * @param {Object} payload - { id: string }
     */
    activatePhilosophy(payload) {
        const state = store.getState();
        if (state.activePhilosophy) return;

        const phil = content.philosophies.find(p => p.id === payload.id);
        if (!phil) return;

        if (state.resources.forms < phil.activationCost) return;

        store.setState({
            activePhilosophy: payload.id,
            resources: { ...state.resources, forms: state.resources.forms - phil.activationCost }
        });
    }

    /**
     * Burns accumulated paradox to stabilize reality.
     * Only works when paradox exceeds the decay threshold.
     */
    burnBacklog() {
        const state = store.getState();
        const paradox = state.resources.paradox || 0;

        if (paradox <= GameConstants.PARADOX_DECAY_THRESHOLD) return;

        // Burn all paradox above threshold
        store.setState({
            resources: {
                ...state.resources,
                paradox: 0
            }
        });
    }

    /**
     * Activates Overdrive mode using stored time.
     */
    activateOverdrive() {
        const state = store.getState();
        const time = state.resources.time || 0;

        if (time < GameConstants.TIME_WARP_COST) return;

        const overdriveEnd = Date.now() + GameConstants.OVERDRIVE_DURATION_MS;

        store.setState({
            resources: {
                ...state.resources,
                time: time - GameConstants.TIME_WARP_COST,
                overdriveUntil: overdriveEnd
            }
        });

    }

    /**
     * Activates a Paradox Burst.
     * @param {Object} payload - { tier: number }
     */
    activateParadoxBurst(payload) {
        const state = store.getState();
        const paradox = state.resources.paradox || 0;
        const tier = GameConstants.PARADOX_BURST_TIERS[payload.tier];

        if (!tier || paradox < tier.cost) return;

        const lastBurst = state.paradoxBurst?.lastUsed || 0;
        if (Date.now() - lastBurst < GameConstants.PARADOX_BURST_COOLDOWN_MS) return;

        store.setState({
            resources: {
                ...state.resources,
                paradox: paradox - tier.cost
            },
            paradoxBurst: {
                active: true,
                multiplier: tier.multiplier,
                expiresAt: Date.now() + GameConstants.PARADOX_BURST_DURATION_MS,
                lastUsed: Date.now()
            }
        });

    }

    /**
     * Claims a glitch entity for forms bonus.
     * @param {Object} payload - { id: string }
     */
    claimGlitch(payload) {
        auditSystem.claimGlitch(payload.id);
    }

    /**
     * Performs a Reality Audit (prestige reset).
     */
    performReset() {
        const state = store.getState();
        const { pendingMA, nextThreshold } = StateSelectors.getPendingMetaAuthority(state);

        if (pendingMA <= 0) return;

        const resetState = prestigeSystem.generateResetState(state, pendingMA, nextThreshold);

        store.setState(resetState);
        store.sync();
        uiManager.switchScreen('work');
    }
}

export const engine = new GameEngine();
