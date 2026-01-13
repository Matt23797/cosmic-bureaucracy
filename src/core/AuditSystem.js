import { store } from './store.js';
import { Utils } from './Utils.js';
import { ToastComponent } from '../components/ToastComponent.js';

/**
 * Manages the lifecycle and logic of Audit Entities (parasites).
 * Spawns entities based on sequestered forms and handles their destruction/rewards.
 */
export class AuditSystem {
    constructor() {
        this.nextId = 1;
    }

    /**
     * Checks for spawn conditions and automated entity destruction.
     * @param {Object} state - Current game state
     */
    tick(state) {
        const sequestered = state.resources.sequesteredForms || 0;
        const totalForms = state.stats.totalForms || 1;
        const threshold = Math.max(50000, totalForms * 0.05);
        const currentEntities = state.auditEntities || [];

        if (sequestered >= threshold && currentEntities.length < 5) {
            this.spawnEntity();
        }

        if (state.meta?.ownedUpgrades?.includes('meta_rank_2') && currentEntities.length > 0) {
            if (Math.random() < 0.01) {
                this.popEntity(currentEntities[0].id);
            }
        }
    }

    /**
     * Creates a new audit entity at a normalized position (0.0 to 1.0).
     */
    spawnEntity() {
        const id = `entity-${this.nextId++}`;
        const x = 0.1 + Math.random() * 0.8;
        const y = 0.2 + Math.random() * 0.6;

        const currentEntities = store.getState().auditEntities || [];
        store.setState({
            auditEntities: [...currentEntities, { id, x, y }]
        });
    }

    /**
     * Destroys an entity and rewards the player with recovered forms.
     * @param {string} id - The ID of the entity to pop
     * @returns {number|null} The bonus amount granted, or null if entity not found
     */
    popEntity(id) {
        const state = store.getState();
        const entity = state.auditEntities.find(e => e.id === id);
        if (!entity) return null;

        let bonusAmount = (state.resources.sequesteredForms || 0) * 1.25;

        if (state.meta?.ownedUpgrades?.includes('meta_rank_1')) {
            bonusAmount *= 1.5;
        }

        store.setState({
            resources: {
                ...state.resources,
                forms: state.resources.forms + bonusAmount,
                sequesteredForms: 0
            },
            auditEntities: state.auditEntities.filter(e => e.id !== id)
        });

        ToastComponent.show(`Recovered ${Utils.formatNumber(bonusAmount)} forms from the glitch!`, "success");

        return bonusAmount;
    }
}

export const auditSystem = new AuditSystem();
