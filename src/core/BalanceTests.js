import { prestigeSystem } from './PrestigeSystem.js';

/**
 * Validates the fix for the stored time carryover exploit.
 */
function testStoredTimeCarryover() {
    console.log("Running test: Stored Time Carryover Fix...");

    const mockState = {
        resources: {
            forms: 1000000,
            time: 100000, // Large amount of time
            paradox: 50,
            policyDebt: 100
        },
        stats: {
            totalForms: 1000000,
            clicks: 100,
            startTime: Date.now(),
            lastTick: Date.now(),
            celebratedMilestones: []
        },
        meta: {
            metaAuthority: 10,
            totalMetaAuthority: 10,
            resets: 1
        },
        departments: { 'lro': 10 },
        ownedUpgrades: [],
        ownedThresholdUpgrades: []
    };

    const newState = prestigeSystem.generateResetState(mockState, 5, 13000000);

    const expectedTime = Math.min(3600, 100000 * 0.1); // Should be 3600
    if (newState.resources.time === expectedTime) {
        console.log("✅ PASS: Stored time correctly capped at 3600.");
    } else {
        console.error(`❌ FAIL: Expected time ${expectedTime}, got ${newState.resources.time}`);
    }

    if (newState.resources.paradox === 0 && newState.resources.forms === 0) {
        console.log("✅ PASS: Forms and Paradox correctly reset.");
    } else {
        console.error("❌ FAIL: Resources did not reset correctly.");
    }
}

// Run tests
try {
    testStoredTimeCarryover();
} catch (e) {
    console.error("Test execution failed:", e);
}
