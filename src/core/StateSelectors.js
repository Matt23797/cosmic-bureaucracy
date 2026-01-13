import { GameConstants } from './Constants.js';

/**
 * Selectors for deriving complex state and validation rules.
 * Centralizes logic that would otherwise leak into UI components.
 */
export const StateSelectors = {
    /**
     * Checks if the player can perform a Time Warp.
     */
    canTimeWarp(state) {
        return (state.resources.time || 0) >= GameConstants.TIME_WARP_COST;
    },

    /**
     * Checks if the player can Burn the Backlog.
     */
    canBurnBacklog(state) {
        return (state.resources.paradox || 0) > GameConstants.PARADOX_DECAY_THRESHOLD;
    },

    /**
     * Checks if the Paradox Burst is currently active.
     */
    isBurstActive(state) {
        if (!state.paradoxBurst?.active) return false;
        return Date.now() < state.paradoxBurst.expiresAt;
    },

    /**
     * Checks if the Paradox Burst is on cooldown.
     */
    isBurstOnCooldown(state) {
        if (!state.paradoxBurst?.cooldownUntil) return false;
        return Date.now() < state.paradoxBurst.cooldownUntil;
    },

    /**
     * Gets the current burst configuration based on paradox.
     */
    getBurstTier(state) {
        const paradox = state.resources.paradox || 0;
        // Sort tiers descending to find highest applicable
        return [...GameConstants.PARADOX_BURST_TIERS]
            .sort((a, b) => b.cost - a.cost)
            .find(tier => paradox >= tier.cost) || null;
    },

    /**
     * Gets the index of the highest affordable burst tier.
     */
    getBurstTierIndex(state) {
        const paradox = state.resources.paradox || 0;
        const tiers = GameConstants.PARADOX_BURST_TIERS;
        for (let i = tiers.length - 1; i >= 0; i--) {
            if (paradox >= tiers[i].cost) return i;
        }
        return 0;
    },

    /**
     * Calculates pending Meta-Authority from the current run.
     * Mirrors PrestigeSystem.calculatePendingMA logic.
     */
    getPendingMetaAuthority(state) {
        const currentForms = state.resources.forms || 0;
        const totalForms = state.stats.totalForms || 0;
        const bestForms = Math.max(currentForms, totalForms);

        let pendingMA = 0;
        let nextThreshold = state.meta?.nextMaThreshold || GameConstants.PRESTIGE_BASE_THRESHOLD;
        let tempTotal = bestForms;

        while (tempTotal >= nextThreshold) {
            pendingMA++;
            tempTotal -= nextThreshold;
            nextThreshold *= GameConstants.PRESTIGE_THRESHOLD_MULT;
        }

        return { pendingMA, nextThreshold };
    }
};
