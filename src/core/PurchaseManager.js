import { store } from './store.js';
import { prestigeSystem } from './PrestigeSystem.js';

/**
 * Handles all economic transactions and purchase validations.
 * Decouples purchase logic from the main GameEngine loop.
 */
export class PurchaseManager {
    /**
     * Attempts to purchase a department.
     * @param {Object} params - Purchase parameters { id, cost, amount }
     */
    buyDepartment({ id, cost, amount }) {
        const state = store.getState();
        if (state.resources.forms >= cost) {
            const nextResources = { ...state.resources };
            nextResources.forms -= cost;

            const nextDepts = { ...state.departments };
            nextDepts[id] = (state.departments[id] || 0) + amount;

            store.setState({
                resources: nextResources,
                departments: nextDepts
            });
            return true;
        }
        return false;
    }

    /**
     * Attempts to purchase a threshold upgrade.
     * @param {Object} params - { id, cost }
     */
    buyThresholdUpgrade({ id, cost }) {
        const state = store.getState();
        if (state.resources.forms >= cost) {
            store.setState({
                resources: { ...state.resources, forms: state.resources.forms - cost },
                ownedThresholdUpgrades: [...(state.ownedThresholdUpgrades || []), id]
            });
            return true;
        }
        return false;
    }

    /**
     * Attempts to purchase a strategic upgrade.
     * @param {Object} upgrade - The upgrade definition
     */
    buyStrategicUpgrade(upgrade) {
        const state = store.getState();
        if (state.resources.forms >= upgrade.cost) {
            store.setState({
                resources: { ...state.resources, forms: state.resources.forms - upgrade.cost },
                ownedUpgrades: [...(state.ownedUpgrades || []), upgrade.id]
            });
            return true;
        }
        return false;
    }

    /**
     * Attempts to purchase a meta-authority upgrade.
     * @param {Object} upgrade - The meta-upgrade definition
     */
    buyMetaUpgrade(upgrade) {
        const state = store.getState();
        if (state.meta.metaAuthority >= upgrade.cost) {
            store.setState({
                meta: {
                    ...state.meta,
                    metaAuthority: state.meta.metaAuthority - upgrade.cost,
                    ownedUpgrades: [...(state.meta.ownedUpgrades || []), upgrade.id]
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Handles the reset logic and generation of new state.
     */
    performReset({ earnedMA, nextThreshold }) {
        const state = store.getState();
        const newState = prestigeSystem.generateResetState(state, earnedMA, nextThreshold);
        store.setState(newState);
    }
}

export const purchaseManager = new PurchaseManager();
