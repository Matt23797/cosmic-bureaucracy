import { GameConstants } from './Constants.js';

/**
 * Logic engine for the Prestige (Reality Audit) system.
 * Calculates pending Meta-Authority and handles the reset state transition.
 */
export class PrestigeSystem {
    /**
     * Calculates pending Meta-Authority based on the best form count of the current run.
     * @param {Object} state - Current game state
     * @returns {Object} { pendingMA, nextThreshold }
     */
    calculatePendingMA(state) {
        const currentForms = state.resources.forms || 0;
        const totalForms = state.stats.totalForms || 0;
        const bestForms = Math.max(currentForms, totalForms);

        let pendingMA = 0;
        let nextThreshold = state.meta.nextMaThreshold || GameConstants.PRESTIGE_BASE_THRESHOLD;
        let tempTotal = bestForms;

        while (tempTotal >= nextThreshold) {
            pendingMA++;
            tempTotal -= nextThreshold;
            nextThreshold *= GameConstants.PRESTIGE_THRESHOLD_MULT;
        }

        return { pendingMA, nextThreshold };
    }

    /**
     * Generates the initial state for a new Reality Audit (Prestige).
     * @param {Object} state - Current game state
     * @param {number} earnedMA - Meta-Authority gained from the reset
     * @param {number} nextThreshold - Final threshold calculated for the next run
     * @returns {Object} newState partial
     */
    generateResetState(state, earnedMA, nextThreshold) {
        const currentMA = state.meta?.metaAuthority || 0;
        const newTotalMA = (state.meta?.totalMetaAuthority || 0) + earnedMA;

        return {
            resources: {
                forms: 0,
                time: Math.min(3600, (state.resources.time || 0) * 0.1),
                paradox: 0,
                policyDebt: 0
            },
            stats: {
                totalForms: 0,
                clicks: 0,
                startTime: Date.now(),
                lastTick: Date.now(),
                celebratedMilestones: []
            },
            departments: {},
            ownedUpgrades: [],
            ownedThresholdUpgrades: [],
            activePhilosophy: null,
            unlocks: {
                departments: true,
                philosophy: true,
                resets: true
            },
            meta: {
                ...state.meta,
                metaAuthority: currentMA + earnedMA,
                totalMetaAuthority: newTotalMA,
                resets: (state.meta?.resets || 0) + 1,
                nextMaThreshold: nextThreshold
            },
            auditEntities: []
        };
    }
}

export const prestigeSystem = new PrestigeSystem();
