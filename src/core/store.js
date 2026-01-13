import { GameConstants } from './Constants.js';
import content from '../config/content.json';

/**
 * Reactive state management system with persistence and action dispatching.
 */
export class Store {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = [];
    this.deviceId = localStorage.getItem('cosmic_device_id') || null;
    this.apiBase = import.meta.env.DEV ? `http://${window.location.hostname}:3030` : '';
    this.saveTimeout = null;
  }

  /**
   * Initializes the store by loading local save and attempting server sync.
   */
  async init() {
    try {
      const rawSave = localStorage.getItem('cosmic_bureaucracy_save');
      if (rawSave) {
        const localSave = this.validateSave(JSON.parse(rawSave));
        if (localSave) {
          this.state = this.migrate(this.state, localSave);
        }
      }
    } catch (e) {
      console.warn('Store: Failed to load local save, starting fresh:', e.message);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GameConstants.NETWORK_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.apiBase}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        this.deviceId = data.deviceId;
        localStorage.setItem('cosmic_device_id', this.deviceId);

        if (data.saveData) {
          const serverMA = data.saveData.meta?.totalMetaAuthority || 0;
          const localMA = this.state.meta?.totalMetaAuthority || 0;
          const serverTotal = data.saveData.stats?.totalForms || 0;
          const localTotal = this.state.stats?.totalForms || 0;

          // Trust higher Meta-Authority (implies a reset happened)
          // Or if MA is equal, trust higher Total Forms (implies progress in current run)
          if (serverMA > localMA || (serverMA === localMA && serverTotal > localTotal)) {
            const validatedServerSave = this.validateSave(data.saveData);
            if (validatedServerSave) {
              this.state = this.migrate(this.state, validatedServerSave);
              this.saveLocal();
            }
          } else {
            this.sync();
          }
        } else {
          this.sync();
        }
      }
    } catch (e) {
      // Silently fail network auth
    }

    this.notify();
  }

  /**
   * Validates and sanitizes a save object to prevent corrupted/tampered data.
   * @param {Object} save - The raw save object to validate
   * @returns {Object|null} The sanitized save, or null if invalid
   */
  validateSave(save) {
    if (!save || typeof save !== 'object') return null;

    const clamp = (val, min, max) => {
      if (typeof val !== 'number' || !isFinite(val)) return min;
      return Math.max(min, Math.min(max, val));
    };

    // Clamp numeric resources to safe ranges
    if (save.resources && typeof save.resources === 'object') {
      save.resources.forms = clamp(save.resources.forms, 0, 1e308);
      save.resources.time = clamp(save.resources.time, 0, 1e12);
      save.resources.paradox = clamp(save.resources.paradox, 0, 1e6);
      save.resources.policyDebt = clamp(save.resources.policyDebt, 0, 1e12);
      save.resources.sequesteredForms = clamp(save.resources.sequesteredForms, 0, 1e308);
    }

    // Clamp stats
    if (save.stats && typeof save.stats === 'object') {
      save.stats.totalForms = clamp(save.stats.totalForms, 0, 1e308);
      save.stats.clicks = clamp(save.stats.clicks, 0, 1e15);
    }

    // Clamp meta values
    if (save.meta && typeof save.meta === 'object') {
      save.meta.metaAuthority = clamp(save.meta.metaAuthority, 0, 1e12);
      save.meta.totalMetaAuthority = clamp(save.meta.totalMetaAuthority, 0, 1e12);
      save.meta.resets = clamp(save.meta.resets, 0, 1e6);
    }

    // Ensure arrays are arrays
    if (!Array.isArray(save.ownedUpgrades)) save.ownedUpgrades = [];
    if (!Array.isArray(save.ownedThresholdUpgrades)) save.ownedThresholdUpgrades = [];
    if (!Array.isArray(save.auditEntities)) save.auditEntities = [];
    if (save.meta && !Array.isArray(save.meta.ownedUpgrades)) save.meta.ownedUpgrades = [];

    return save;
  }

  /**
   * Merges a saved state into the base state, ensuring nested objects are preserved.
   */
  migrate(base, save) {
    const newState = { ...base, ...save };
    newState.resources = { ...base.resources, ...(save.resources || {}) };
    newState.stats = { ...base.stats, ...(save.stats || {}) };
    newState.stats.celebratedMilestones = [...(base.stats.celebratedMilestones || []), ...(save.stats?.celebratedMilestones || [])];
    newState.stats.celebratedMilestones = [...new Set(newState.stats.celebratedMilestones)]; // Unique
    newState.meta = { ...base.meta, ...(save.meta || {}) };
    newState.tutorial = { ...base.tutorial, ...(save.tutorial || {}) };
    newState.ownedUpgrades = [...new Set([...(base.ownedUpgrades || []), ...(save.ownedUpgrades || [])])];
    newState.ownedThresholdUpgrades = save.ownedThresholdUpgrades || base.ownedThresholdUpgrades || [];

    // Sanitize Active Philosophy
    if (newState.activePhilosophy) {
      const validIds = content.philosophies.map(p => p.id);
      if (!validIds.includes(newState.activePhilosophy)) {
        newState.activePhilosophy = null;
      }
    }

    return newState;
  }

  /**
   * Gets the current state snapshot.
   */
  getState() {
    return this.state;
  }

  /**
   * Updates partial state and triggers listeners/persistence.
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.saveLocalDebounced();
    this.notify();
  }

  /**
   * Debounces local storage writes to improve performance.
   */
  saveLocalDebounced() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveLocal();
    }, GameConstants.SAVE_DEBOUNCE_MS);
  }

  /**
   * Writes current state to localStorage.
   */
  saveLocal() {
    localStorage.setItem('cosmic_bureaucracy_save', JSON.stringify(this.state));
  }

  /**
   * Syncs local state to the cloud server.
   */
  async sync() {
    if (!this.deviceId) return;
    try {
      await fetch(`${this.apiBase}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId, save: this.state })
      });
    } catch (e) {
      // Silently fail sync
    }
  }

  /**
   * Subscribes a callback to state changes. Returns an unsubscribe function.
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifies all subscribers of a state change.
   */
  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Dispatches an action to be handled by the engine or other systems.
   * Decouples UI intent from direct state mutation.
   * @param {string} type - Action type
   * @param {any} payload - Optional data
   */
  dispatch(type, payload) {
    if (this.onAction) {
      this.onAction(type, payload);
    }
  }

  /**
   * Registers a global action handler (usually the Engine).
   */
  setActionHandler(handler) {
    this.onAction = handler;
  }
}

/**
 * Valid action types for dispatching.
 */
export const Actions = {
  CLICK_PROCESS: 'CLICK_PROCESS',
  BUY_DEPARTMENT: 'BUY_DEPARTMENT',
  BUY_UPGRADE: 'BUY_UPGRADE',
  BUY_THRESHOLD_UPGRADE: 'BUY_THRESHOLD_UPGRADE',
  BUY_META_UPGRADE: 'BUY_META_UPGRADE',
  ACTIVATE_PHILOSOPHY: 'ACTIVATE_PHILOSOPHY',
  BURN_BACKLOG: 'BURN_BACKLOG',
  PERFORM_RESET: 'PERFORM_RESET',
  ACTIVATE_OVERDRIVE: 'ACTIVATE_OVERDRIVE',
  ACTIVATE_PARADOX_BURST: 'ACTIVATE_PARADOX_BURST',
  CLAIM_GLITCH: 'CLAIM_GLITCH'
};

/**
 * Generates the initial game state with fresh timestamps.
 */
export const getDefaultState = () => ({
  resources: {
    forms: 0,
    time: 0,
    paradox: 0,
    policyDebt: 0,
    overdriveUntil: 0
  },
  stats: {
    totalForms: 0,
    currentRate: 0,
    clicks: 0,
    startTime: Date.now(),
    lastTick: Date.now(),
    celebratedMilestones: [],
    hasSeenGlitch: false
  },
  departments: {},
  ownedUpgrades: [],
  ownedThresholdUpgrades: [],
  activePhilosophy: null,
  unlocks: {
    departments: false,
    philosophy: false,
    resets: false
  },
  meta: {
    metaAuthority: 0,
    totalMetaAuthority: 0,
    resets: 0,
    ownedUpgrades: [],
    nextMaThreshold: GameConstants.PRESTIGE_BASE_THRESHOLD
  },
  tutorial: {
    active: true,
    step: 0
  },
  auditEntities: []
});

export const store = new Store(getDefaultState());
