import { GameConstants } from './Constants.js';
import content from '../config/content.json' assert { type: 'json' };

/**
 * Logic engine for calculating complex game rules and mechanics logic.
 * Primarily handles synergies, friction curves, and sequester rates.
 * Now also handles effect resolution previously in EffectResolver.
 */
export class PolicyEngine {
    constructor() {
        this.content = content;
        this.effectHandlers = {
            'self_mult': (bonuses, upgrade, dept) => {
                const current = bonuses.deptMultipliers[dept.id] || 1;
                bonuses.deptMultipliers[dept.id] = current * upgrade.effect.value;
            },
            'boost_other': (bonuses, upgrade, dept, deptCount) => {
                const target = upgrade.effect.target;
                const boostValue = deptCount * upgrade.effect.value;
                bonuses.deptBoosts[target] = (bonuses.deptBoosts[target] || 0) + boostValue;
            },
            'click_bonus': (bonuses, upgrade, dept, deptCount) => {
                bonuses.clickBonus += deptCount * upgrade.effect.value;
            },
            'global_mult': (bonuses, upgrade, dept) => {
                bonuses.globalMult *= upgrade.effect.value;
            },
            'time_bonus': (bonuses, upgrade, dept, deptCount) => {
                bonuses.timeBonus += deptCount * upgrade.effect.value;
            },
            'paradox_reduction': (bonuses, upgrade, dept, deptCount) => {
                bonuses.paradoxReduction += deptCount * upgrade.effect.value;
            }
        };
    }

    /**
     * Applies an upgrade effect to a bonuses object.
     * @param {Object} bonuses - The bonuses object being built
     * @param {Object} upgrade - The upgrade definition from content.json
     * @param {Object} dept - The department the upgrade belongs to
     * @param {number} deptCount - Current count of that department
     */
    applyEffect(bonuses, upgrade, dept, deptCount) {
        const handler = this.effectHandlers[upgrade.effect.type];
        if (handler) {
            handler(bonuses, upgrade, dept, deptCount);
        } else {
            console.warn(`PolicyEngine: Unknown effect type "${upgrade.effect.type}"`);
        }
    }

    /**
     * Calculates the synergy multiplier based on department tags and active philosophy.
     * @param {Object} state - Current game state
     * @returns {number} synergyMult - Global production multiplier
     */
    calculateSynergies(state) {
        let synergyMult = 1.0;
        const activePhil = state.activePhilosophy;
        const ownedUpgrades = state.ownedUpgrades || [];

        const isOptimization = activePhil === 'optimization';
        const isExpansionBoosted = activePhil === 'expansion' && ownedUpgrades.includes('exp_1');

        if (!isOptimization && !isExpansionBoosted) return synergyMult;

        const tagCounts = {};
        this.content.departments.forEach(dept => {
            const count = state.departments[dept.id] || 0;
            if (count > 0 && dept.tags) {
                dept.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        let baseBonus = GameConstants.SYNERGY_BASE_BONUS;
        if (isExpansionBoosted) baseBonus = GameConstants.SYNERGY_UPGRADE_BONUS;
        if (isOptimization && ownedUpgrades.includes('opt_1')) baseBonus = GameConstants.SYNERGY_UPGRADE_BONUS;

        Object.values(tagCounts).forEach(count => {
            if (count > 1) {
                synergyMult += (count - 1) * baseBonus;
            }
        });

        return synergyMult;
    }

    /**
     * Calculates administrative friction based on Debt and Paradox buildup.
     * @param {Object} state - Current game state
     * @returns {number} friction - Value representing production penalty
     */
    calculateFriction(state) {
        const debt = state.resources.policyDebt || 0;
        const paradox = state.resources.paradox || 0;
        const ownedUpgrades = state.meta?.ownedUpgrades || [];

        let friction = 0;

        const debtTolerance = ownedUpgrades.includes('meta_debt_1') ? 0.1 : 0;
        const threshold = (state.stats.totalForms || 0) * debtTolerance;
        if (debt > threshold) {
            friction += (debt - threshold) / GameConstants.DEBT_FRICTION_DIVISOR;
        }

        if (paradox > GameConstants.PARADOX_FRICTION_THRESHOLD) {
            let pFric = (paradox - GameConstants.PARADOX_FRICTION_THRESHOLD) / GameConstants.PARADOX_FRICTION_DIVISOR;
            if (ownedUpgrades.includes('meta_rank_4')) pFric *= 0.75;
            if (ownedUpgrades.includes('comp_2')) pFric *= 0.5;
            friction += pFric;
        }

        let maxFric = GameConstants.MAX_FRICTION_DEFAULT;
        if (ownedUpgrades.includes('emer_2')) maxFric = GameConstants.MAX_FRICTION_EMERGENCY;

        return Math.min(maxFric, friction);
    }

    /**
     * Calculates the rate at which forms are stolen by parasites.
     * @param {number} paradox - Current paradox resource
     * @returns {number} sequesterRate - Percentage of production eaten
     */
    getSequesterRate(paradox) {
        if (paradox <= GameConstants.SEQUESTER_THRESHOLD) return 0;
        return Math.min(GameConstants.SEQUESTER_CAP, (paradox / GameConstants.SEQUESTER_THRESHOLD) * GameConstants.SEQUESTER_BASE_RATE);
    }

    /**
     * Calculates internal paradox buildup (Administrative Decay).
     */
    getParadoxFriction(paradox) {
        if (paradox <= GameConstants.PARADOX_FRICTION_THRESHOLD) return 0;
        return (paradox / GameConstants.PARADOX_FRICTION_THRESHOLD);
    }
}

export const policyEngine = new PolicyEngine();
