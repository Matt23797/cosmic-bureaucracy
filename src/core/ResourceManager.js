import { policyEngine } from './PolicyEngine.js';
import { GameConstants } from './Constants.js';
import content from '../config/content.json' assert { type: 'json' };

/**
 * Pure logic class for resource calculation.
 * Contains no state; accepts state as input and returns calculated values.
 */
export class ResourceManager {
    constructor() {
        this.cache = {
            stateId: null,
            rates: null
        };
    }

    /**
     * Aggregates production from all sources.
     * @param {Object} state - Current game state
     * @returns {Object} rates - { forms, time, paradox, debt }
     */
    calculateRates(state) {
        // Simple cache key: sum of department counts + totalMA + paradox + activePhil
        const stateId = `${Object.values(state.departments).reduce((a, b) => a + b, 0)}-${state.meta?.totalMetaAuthority}-${state.resources.paradox}-${state.activePhilosophy}-${state.ownedUpgrades.length}-${state.resources.overdriveUntil > Date.now()}`;

        if (this.cache.stateId === stateId) {
            return this.cache.rates;
        }

        let rates = { forms: 0, time: 0, paradox: 0, debt: 0 };
        const activePhil = state.activePhilosophy;
        const ownedUpgrades = state.ownedUpgrades || [];

        const thresholdBonuses = this.calculateThresholdBonuses(state);

        content.departments.forEach(dept => {
            const count = state.departments[dept.id] || 0;
            if (count <= 0) return;

            if (dept.output.forms) {
                let deptOutput = dept.output.forms * count;
                const selfMult = thresholdBonuses.deptMultipliers[dept.id] || 1;
                deptOutput *= selfMult;
                const boostPercent = thresholdBonuses.deptBoosts[dept.id] || 0;
                deptOutput *= (1 + boostPercent);
                rates.forms += deptOutput;
            }

            if (dept.output.time) rates.time += dept.output.time * count;
            if (dept.output.paradox) rates.paradox += dept.output.paradox * count;
        });

        // Calculate Global Multipliers
        const globalMult = this.calculateGlobalMultipliers(state, thresholdBonuses);
        rates.forms *= globalMult;

        // Handle Emergency Debt Side Effect specifically (since it depends on pre-multiplied forms?)
        // Wait, previous logic was: rates.forms *= emerMult; rates.debt += rates.forms * debtMult;
        // So debt generation depends on the output AFTER Emergency mult is applied but BEFORE others?
        // Actually, let's keep the Debt logic separate or include it here.
        // Re-evaluating: The simplest way is to use the global multiplier, but add Debt separately if needed.

        if (activePhil === 'emergency') {
            let debtMult = GameConstants.EMERGENCY_DEBT_MULT;
            if (ownedUpgrades.includes('emer_1')) debtMult *= GameConstants.EMERGENCY_UPGRADE_DEBT_MULT;
            rates.debt += rates.forms * debtMult;
        }

        rates.time += thresholdBonuses.timeBonus;
        rates.paradox *= (1 - thresholdBonuses.paradoxReduction);

        return rates;
    }

    /**
     * Calculates the total global multiplier applied to forms production.
     * @param {Object} state - Current game state
     * @param {Object} thresholdBonuses - Pre-calculated threshold bonuses
     * @returns {number} multiplier
     */
    calculateGlobalMultipliers(state, thresholdBonuses) {
        let mult = 1.0;
        const activePhil = state.activePhilosophy;
        const ownedUpgrades = state.ownedUpgrades || [];

        // Synergies
        mult *= policyEngine.calculateSynergies(state);

        // Philosophy: Compliance
        if (activePhil === 'compliance' && state.resources.paradox === 0) {
            let complianceMult = GameConstants.COMPLIANCE_BASE_MULT;
            if (ownedUpgrades.includes('comp_1')) complianceMult *= GameConstants.COMPLIANCE_UPGRADE_MULT;
            mult *= complianceMult;
        }

        // Philosophy: Expansion
        if (activePhil === 'expansion') {
            const uniqueDepts = Object.keys(state.departments).length;
            mult *= (1 + uniqueDepts * GameConstants.EXPANSION_UNIQUE_DEPT_BONUS);
        }

        // Philosophy: Emergency
        if (activePhil === 'emergency') {
            let emerMult = GameConstants.EMERGENCY_PROD_MULT;
            if (ownedUpgrades.includes('emer_1')) {
                emerMult *= GameConstants.EMERGENCY_UPGRADE_PROD_MULT;
            }
            mult *= emerMult;
        }

        // Meta-Authority
        const totalMA = (state.meta && state.meta.totalMetaAuthority) || 0;
        if (totalMA > 0) mult *= (1 + (totalMA * GameConstants.META_AUTHORITY_PROD_BONUS));

        // Meta Upgrades
        const metaUpgrades = state.meta?.ownedUpgrades || [];
        if (metaUpgrades.includes('meta_eff_1')) mult *= GameConstants.META_EFFICIENCY_MULT;

        // Global Threshold Bonuses
        mult *= thresholdBonuses.globalMult;

        // Overdrive
        if (state.resources.overdriveUntil && Date.now() < state.resources.overdriveUntil) {
            mult *= GameConstants.OVERDRIVE_MULT;
        }

        // Paradox Burst
        if (state.paradoxBurst?.active && Date.now() < state.paradoxBurst.expiresAt) {
            mult *= state.paradoxBurst.multiplier;
        }

        return mult;
    }

    /**
     * Calculates the effective forms output for a specific department.
     * @param {Object} state - Current game state
     * @param {string} deptId - The department ID
     * @returns {number} Effective forms per second
     */
    getDepartmentUnitRate(state, deptId) {
        const dept = content.departments.find(d => d.id === deptId);
        if (!dept || !dept.output.forms) return 0;

        const count = state.departments[deptId] || 0;

        const thresholdBonuses = this.calculateThresholdBonuses(state);
        const globalMult = this.calculateGlobalMultipliers(state, thresholdBonuses);

        let baseRate = dept.output.forms;

        // Apply Dept-Specific Multipliers
        const selfMult = thresholdBonuses.deptMultipliers[deptId] || 1;
        baseRate *= selfMult;

        const boostPercent = thresholdBonuses.deptBoosts[deptId] || 0;
        baseRate *= (1 + boostPercent);

        // DEBUG: Trace where multipliers come from
        return baseRate * globalMult;
    }

    /**
     * Calculates combined bonuses from owned threshold upgrades.
     * @param {Object} state - Current game state
     * @returns {Object} bonuses
     */
    calculateThresholdBonuses(state) {
        const owned = state.ownedThresholdUpgrades || [];
        const depts = state.departments || {};

        let bonuses = {
            globalMult: 1,
            timeBonus: 0,
            paradoxReduction: 0,
            clickBonus: 0,
            deptMultipliers: {},
            deptBoosts: {}
        };

        if (owned.length === 0) return bonuses;

        content.departments.forEach(dept => {
            const upgrades = dept.thresholdUpgrades || [];
            const deptCount = depts[dept.id] || 0;

            upgrades.forEach(upgrade => {
                if (!owned.includes(upgrade.id)) return;
                if (deptCount < upgrade.threshold) return; // Threshold no longer met
                policyEngine.applyEffect(bonuses, upgrade, dept, deptCount);
            });
        });

        bonuses.paradoxReduction = Math.min(0.8, bonuses.paradoxReduction);
        return bonuses;
    }

    /**
     * Calculates click power based on current state.
     * @param {Object} state - Current game state
     * @returns {number} clickPower
     */
    calculateClickPower(state) {
        const activePhil = state.activePhilosophy;
        const friction = policyEngine.calculateFriction(state);
        const paradox = state.resources.paradox || 0;

        let clickPower = GameConstants.CLICK_POWER_BASE * (1 - friction);

        if (paradox >= 500) clickPower *= (1 + GameConstants.CLICK_PARADOX_500_BONUS);
        else if (paradox >= 200) clickPower *= (1 + GameConstants.CLICK_PARADOX_200_BONUS);

        if (activePhil === 'expansion') {
            const totalDepts = Object.values(state.departments).reduce((a, b) => a + b, 0);
            clickPower += totalDepts * GameConstants.CLICK_EXPANSION_DEPT_BONUS;
        }

        const glitchChance = (paradox / 100) * GameConstants.CLICK_GLITCH_CHANCE_MULT;
        if (Math.random() < glitchChance) clickPower *= GameConstants.CLICK_GLITCH_MULT;

        if (state.paradoxBurst?.active && Date.now() < state.paradoxBurst.expiresAt) {
            clickPower *= state.paradoxBurst.multiplier;
        }

        const metaUpgrades = state.meta?.ownedUpgrades || [];
        if (metaUpgrades.includes('meta_rank_3')) clickPower *= GameConstants.CLICK_META_RANK_3_MULT;

        const thresholdBonuses = this.calculateThresholdBonuses(state);
        if (thresholdBonuses.clickBonus > 0) {
            clickPower *= (1 + thresholdBonuses.clickBonus);
        }

        return clickPower;
    }
}

export const resourceManager = new ResourceManager();
