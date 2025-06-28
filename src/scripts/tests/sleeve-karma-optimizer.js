/**
 * Sleeve Karma Optimization Model
 *
 * This models the optimization problem of maximizing karma gain rate for sleeves
 * considering the tradeoffs between shock recovery, training combat stats, and committing crimes.
 */

// Game Constants (based on actual game code)
const CYCLES_PER_SECOND = 1000 / 200; // 200ms per cycle = 5 cycles per second
const NATURAL_SHOCK_DECAY_PER_CYCLE = 0.0001; // From sleeve.process()
const SHOCK_RECOVERY_DECAY_PER_CYCLE = 0.0002; // From SleeveRecoveryWork.process()
const TRAINING_RATE_BASE = 10.0; // 10 stat points per second at gym (before shock penalty)
const INTELLIGENCE_LEVEL = 100; // Your current intelligence level
const MAX_SKILL_LEVEL = 975; // CONSTANTS.MaxSkillLevel from game code

// Helper functions for game mechanics
function calculateIntelligenceBonus(intelligence, weight = 1) {
    return 1 + (Math.pow(intelligence, 0.8) / 600) * weight;
}

function getShockDecayRate(isRecovering = false, intelligence = INTELLIGENCE_LEVEL) {
    const baseRate = isRecovering ? SHOCK_RECOVERY_DECAY_PER_CYCLE : NATURAL_SHOCK_DECAY_PER_CYCLE;
    return baseRate * calculateIntelligenceBonus(intelligence, 0.75) * CYCLES_PER_SECOND;
}

/**
 * Convert experience points to skill level using the game's formula
 * @param {number} exp - Experience points
 * @param {number} mult - Stat multiplier (default 1)
 * @returns {number} Skill level
 */
function calculateSkill(exp, mult = 1) {
    const value = Math.floor(mult * (32 * Math.log(exp + 534.6) - 200));
    return Math.max(value, 1); // clampNumber equivalent
}

/**
 * Convert skill level back to experience (inverse of calculateSkill)
 * @param {number} level - Skill level
 * @param {number} mult - Stat multiplier (default 1)
 * @returns {number} Experience points needed for this level
 */
function calculateExpFromLevel(level, mult = 1) {
    // Solve: level = mult * (32 * ln(exp + 534.6) - 200)
    // level/mult = 32 * ln(exp + 534.6) - 200
    // (level/mult + 200)/32 = ln(exp + 534.6)
    // exp = e^((level/mult + 200)/32) - 534.6
    return Math.exp((level / mult + 200) / 32) - 534.6;
}

// Crime Stats (updated with actual game data)
const CRIME_STATS = {
    Homicide: {
        difficulty: 1,
        strength_success_weight: 2,
        defense_success_weight: 2,
        dexterity_success_weight: 0.5,
        agility_success_weight: 0.5,
        karma_gain: -3, // Karma gained per successful homicide
        time: 3, // seconds
        // Experience gains per successful crime
        strength_exp: 2,
        defense_exp: 2,
        dexterity_exp: 2,
        agility_exp: 2,
    },
    Mug: {
        difficulty: 0.2,
        strength_success_weight: 1.5,
        defense_success_weight: 0.5,
        dexterity_success_weight: 1.5,
        agility_success_weight: 0.5,
        karma_gain: -0.25,
        time: 4, // seconds
        // Experience gains per successful crime
        strength_exp: 3,
        defense_exp: 3,
        dexterity_exp: 3,
        agility_exp: 3,
    },
};

/**
 * Calculate crime success chance based on sleeve stats
 * Formula: chance = (weighted_stats) / (975 * difficulty)
 * @param {Object} stats - {strength, defense, dexterity, agility}
 * @param {number} shock - Current shock percentage (0-100)
 * @param {string} crimeName - Name of the crime
 * @returns {number} Success probability (0-1)
 */
function calculateCrimeChance(stats, shock, crimeName) {
    const crime = CRIME_STATS[crimeName];
    if (!crime) return 0;

    // Shock reduces effective stats
    const shockMultiplier = (100 - shock) / 100;
    const effectiveStats = {
        strength: stats.strength * shockMultiplier,
        defense: stats.defense * shockMultiplier,
        dexterity: stats.dexterity * shockMultiplier,
        agility: stats.agility * shockMultiplier,
    };

    let chance =
        (crime.strength_success_weight || 0) * effectiveStats.strength +
        (crime.defense_success_weight || 0) * effectiveStats.defense +
        (crime.dexterity_success_weight || 0) * effectiveStats.dexterity +
        (crime.agility_success_weight || 0) * effectiveStats.agility;

    // Add intelligence bonus (simplified - assuming no crime success multipliers)
    chance += 0.025 * INTELLIGENCE_LEVEL; // CONSTANTS.IntelligenceCrimeWeight = 0.025

    chance /= MAX_SKILL_LEVEL;
    chance /= crime.difficulty;
    chance *= calculateIntelligenceBonus(INTELLIGENCE_LEVEL, 1);

    return Math.min(chance, 1);
}

/**
 * Calculate karma gain rate for a given crime
 * Formula: karma_rate = |karma_gain| * success_chance / time_per_attempt
 * @param {Object} stats - Current sleeve stats
 * @param {number} shock - Current shock percentage
 * @param {string} crimeName - Name of the crime
 * @returns {number} Karma gained per second
 */
function calculateKarmaRate(stats, shock, crimeName) {
    const crime = CRIME_STATS[crimeName];
    const successChance = calculateCrimeChance(stats, shock, crimeName);
    return (Math.abs(crime.karma_gain) * successChance) / crime.time;
}

/**
 * State representation for optimization
 * Now tracks both experience and levels
 */
class SleeveState {
    constructor(
        shock,
        strength,
        defense,
        dexterity,
        agility,
        time = 0,
        strengthExp = null,
        defenseExp = null,
        dexterityExp = null,
        agilityExp = null,
    ) {
        this.shock = Math.max(0, Math.min(100, shock));
        this.strength = Math.max(1, strength);
        this.defense = Math.max(1, defense);
        this.dexterity = Math.max(1, dexterity);
        this.agility = Math.max(1, agility);
        this.time = time;

        // Track experience - if not provided, calculate from levels
        this.strengthExp = strengthExp !== null ? strengthExp : calculateExpFromLevel(this.strength);
        this.defenseExp = defenseExp !== null ? defenseExp : calculateExpFromLevel(this.defense);
        this.dexterityExp = dexterityExp !== null ? dexterityExp : calculateExpFromLevel(this.dexterity);
        this.agilityExp = agilityExp !== null ? agilityExp : calculateExpFromLevel(this.agility);
    }

    toString() {
        return `S${this.shock.toFixed(1)}_St${this.strength}_D${this.defense}_Dx${this.dexterity}_A${this.agility}`;
    }

    clone() {
        return new SleeveState(
            this.shock,
            this.strength,
            this.defense,
            this.dexterity,
            this.agility,
            this.time,
            this.strengthExp,
            this.defenseExp,
            this.dexterityExp,
            this.agilityExp,
        );
    }

    /**
     * Update stat levels from current experience
     */
    updateLevelsFromExp() {
        this.strength = calculateSkill(this.strengthExp);
        this.defense = calculateSkill(this.defenseExp);
        this.dexterity = calculateSkill(this.dexterityExp);
        this.agility = calculateSkill(this.agilityExp);
    }
}

/**
 * Possible actions a sleeve can take
 */
const ACTIONS = {
    SHOCK_RECOVERY: "shock_recovery",
    TRAIN_STRENGTH: "train_strength",
    TRAIN_DEFENSE: "train_defense",
    TRAIN_DEXTERITY: "train_dexterity",
    TRAIN_AGILITY: "train_agility",
    CRIME_HOMICIDE: "crime_homicide",
    CRIME_MUG: "crime_mug",
};

/**
 * Apply an action to a state for a given duration
 * @param {SleeveState} state - Current state
 * @param {string} action - Action to take
 * @param {number} duration - Time in seconds
 * @returns {SleeveState} New state after action
 */
function applyAction(state, action, duration) {
    const newState = state.clone();
    newState.time += duration;

    // Calculate shock decay based on action type
    let shockDecayRate;
    if (action === ACTIONS.SHOCK_RECOVERY) {
        shockDecayRate = getShockDecayRate(true); // Enhanced recovery rate
    } else {
        shockDecayRate = getShockDecayRate(false); // Natural decay rate
    }

    switch (action) {
        case ACTIONS.SHOCK_RECOVERY:
            newState.shock = Math.max(0, newState.shock - shockDecayRate * duration);
            break;

        case ACTIONS.TRAIN_STRENGTH: {
            newState.shock = Math.max(0, newState.shock - shockDecayRate * duration);
            const shockPenalty = (100 - state.shock) / 100; // Use initial shock for penalty calculation
            const expGained = TRAINING_RATE_BASE * shockPenalty * duration;
            newState.strengthExp += expGained;
            newState.strength = calculateSkill(newState.strengthExp);
            break;
        }

        case ACTIONS.TRAIN_DEFENSE: {
            newState.shock = Math.max(0, newState.shock - shockDecayRate * duration);
            const shockPenalty = (100 - state.shock) / 100;
            const expGained = TRAINING_RATE_BASE * shockPenalty * duration;
            newState.defenseExp += expGained;
            newState.defense = calculateSkill(newState.defenseExp);
            break;
        }

        case ACTIONS.TRAIN_DEXTERITY: {
            newState.shock = Math.max(0, newState.shock - shockDecayRate * duration);
            const shockPenalty = (100 - state.shock) / 100;
            const expGained = TRAINING_RATE_BASE * shockPenalty * duration;
            newState.dexterityExp += expGained;
            newState.dexterity = calculateSkill(newState.dexterityExp);
            break;
        }

        case ACTIONS.TRAIN_AGILITY: {
            newState.shock = Math.max(0, newState.shock - shockDecayRate * duration);
            const shockPenalty = (100 - state.shock) / 100;
            const expGained = TRAINING_RATE_BASE * shockPenalty * duration;
            newState.agilityExp += expGained;
            newState.agility = calculateSkill(newState.agilityExp);
            break;
        }

        case ACTIONS.CRIME_HOMICIDE:
        case ACTIONS.CRIME_MUG: {
            // Crime gives experience and natural shock decay
            newState.shock = Math.max(0, newState.shock - shockDecayRate * duration);

            // Calculate crime attempts and successes
            const crimeName = action === ACTIONS.CRIME_HOMICIDE ? "Homicide" : "Mug";
            const crime = CRIME_STATS[crimeName];
            const totalAttempts = duration / crime.time;
            const successChance = calculateCrimeChance(state, state.shock, crimeName);
            const successfulAttempts = totalAttempts * successChance;

            // Experience gained from successful crimes (affected by shock penalty)
            const shockPenalty = (100 - state.shock) / 100;
            const expPerStat = crime.strength_exp * successfulAttempts * shockPenalty;

            newState.strengthExp += expPerStat;
            newState.defenseExp += expPerStat;
            newState.dexterityExp += expPerStat;
            newState.agilityExp += expPerStat;

            // Update levels from experience
            newState.updateLevelsFromExp();
            break;
        }
    }

    return newState;
}

/**
 * Marginal Benefit Analysis
 * Calculate the marginal benefit of improving each stat by 1 point
 */
function calculateMarginalBenefits(state, crimeName = "Homicide") {
    const baseRate = calculateKarmaRate(state, state.shock, crimeName);
    const benefits = {};

    // Test each stat improvement
    ["strength", "defense", "dexterity", "agility"].forEach((stat) => {
        const testState = state.clone();
        testState[stat] += 1;
        const newRate = calculateKarmaRate(testState, testState.shock, crimeName);
        benefits[stat] = newRate - baseRate;
    });

    // Test shock recovery
    const testShock = Math.max(0, state.shock - 1);
    const shockBenefit = calculateKarmaRate(state, testShock, crimeName) - baseRate;
    benefits.shock_recovery = shockBenefit;

    return benefits;
}

/**
 * Optimal Training Order Algorithm
 * Determines which stats to train first based on marginal benefits
 */
function getOptimalTrainingOrder(state) {
    const benefits = calculateMarginalBenefits(state);

    // Sort stats by marginal benefit per training time
    const statBenefits = ["strength", "defense", "dexterity", "agility"]
        .map((stat) => ({
            stat,
            benefit: benefits[stat],
            benefitPerSecond: benefits[stat] / (1 / TRAINING_RATE_BASE), // Assuming 1 stat point per base rate
        }))
        .sort((a, b) => b.benefitPerSecond - a.benefitPerSecond);

    return statBenefits;
}

/**
 * Break-even Analysis
 * Calculate when it becomes more beneficial to do crime vs training/shock recovery
 */
function calculateBreakEvenPoints(state) {
    const currentKarmaRate = Math.max(
        calculateKarmaRate(state, state.shock, "Homicide"),
        calculateKarmaRate(state, state.shock, "Mug"),
    );

    // Time to break even on shock recovery
    let shockBreakEven = Infinity;
    if (state.shock > 0) {
        const timeToRecover = state.shock / getShockDecayRate(true);
        const improvedRate = Math.max(calculateKarmaRate(state, 0, "Homicide"), calculateKarmaRate(state, 0, "Mug"));
        const karmaLost = currentKarmaRate * timeToRecover;
        const karmaGainImprovement = improvedRate - currentKarmaRate;

        if (karmaGainImprovement > 0) {
            shockBreakEven = karmaLost / karmaGainImprovement;
        }
    }

    // Time to break even on training each stat
    const trainingBreakEven = {};
    ["strength", "defense", "dexterity", "agility"].forEach((stat) => {
        const currentStat = state[stat];
        const timeToTrain = 25 / ((TRAINING_RATE_BASE * (100 - state.shock)) / 100); // Time to gain 25 points
        const testState = state.clone();
        testState[stat] += 25;
        const improvedRate = Math.max(
            calculateKarmaRate(testState, testState.shock, "Homicide"),
            calculateKarmaRate(testState, testState.shock, "Mug"),
        );

        const karmaLost = currentKarmaRate * timeToTrain;
        const karmaGainImprovement = improvedRate - currentKarmaRate;

        if (karmaGainImprovement > 0) {
            trainingBreakEven[stat] = karmaLost / karmaGainImprovement;
        } else {
            trainingBreakEven[stat] = Infinity;
        }
    });

    return {
        shockRecovery: shockBreakEven,
        training: trainingBreakEven,
    };
}

/**
 * Analytical optimization for specific scenarios
 * Provides decision tree based on current state
 */
function analyticalOptimization(initialState) {
    const stats = {
        strength: initialState.strength,
        defense: initialState.defense,
        dexterity: initialState.dexterity,
        agility: initialState.agility,
    };

    // Calculate current crime success rates
    const currentHomicideChance = calculateCrimeChance(stats, initialState.shock, "Homicide");
    const currentMugChance = calculateCrimeChance(stats, initialState.shock, "Mug");
    const currentHomicideRate = calculateKarmaRate(stats, initialState.shock, "Homicide");
    const currentMugRate = calculateKarmaRate(stats, initialState.shock, "Mug");

    // Decision thresholds (can be tuned)
    const HOMICIDE_THRESHOLD = 0.25;
    const HIGH_SHOCK_THRESHOLD = 70;
    const MEDIUM_SHOCK_THRESHOLD = 30;
    const LOW_STAT_THRESHOLD = 25;

    const recommendations = [];

    // Decision tree logic
    if (initialState.shock > HIGH_SHOCK_THRESHOLD) {
        // Very high shock - always prioritize shock recovery
        recommendations.push({
            priority: 1,
            action: ACTIONS.SHOCK_RECOVERY,
            reason: `Shock is critically high (${initialState.shock.toFixed(1)}%)`,
            duration: Math.min(3600, initialState.shock / getShockDecayRate(true)), // Max 1 hour chunks
            expectedBenefit: `Karma rate will improve from ${(Math.max(currentHomicideRate, currentMugRate) * 3600).toFixed(1)}/hr to ${(Math.max(calculateKarmaRate(stats, Math.max(0, initialState.shock - 10), "Homicide"), calculateKarmaRate(stats, Math.max(0, initialState.shock - 10), "Mug")) * 3600).toFixed(1)}/hr`,
        });
    } else if (currentHomicideChance >= HOMICIDE_THRESHOLD) {
        // Good homicide chance - do crime
        recommendations.push({
            priority: 1,
            action: ACTIONS.CRIME_HOMICIDE,
            reason: `Homicide success rate is good (${(currentHomicideChance * 100).toFixed(1)}%)`,
            karmaRate: currentHomicideRate,
            expectedKarmaPerHour: currentHomicideRate * 3600,
        });

        // But also consider improvements
        if (initialState.shock > MEDIUM_SHOCK_THRESHOLD) {
            recommendations.push({
                priority: 2,
                action: ACTIONS.SHOCK_RECOVERY,
                reason: `Could improve karma rate by reducing shock`,
                duration: 1800, // 30 minute chunks
                expectedBenefit: `Would improve karma rate by ${((calculateKarmaRate(stats, Math.max(0, initialState.shock - 20), "Homicide") - currentHomicideRate) * 3600).toFixed(1)}/hr`,
            });
        }
    } else {
        // Poor homicide chance - need to improve
        const marginalBenefits = calculateMarginalBenefits(initialState);
        const trainingOrder = getOptimalTrainingOrder(initialState);
        const breakEvenPoints = calculateBreakEvenPoints(initialState);

        // Prioritize shock recovery if it has good break-even
        if (initialState.shock > MEDIUM_SHOCK_THRESHOLD && breakEvenPoints.shockRecovery < 7200) {
            // 2 hours
            recommendations.push({
                priority: 1,
                action: ACTIONS.SHOCK_RECOVERY,
                reason: `Shock recovery has good ROI (${(breakEvenPoints.shockRecovery / 3600).toFixed(1)} hours to break even)`,
                duration: Math.min(1800, initialState.shock / getShockDecayRate(true)),
                expectedBenefit: `Break-even time: ${(breakEvenPoints.shockRecovery / 3600).toFixed(1)} hours`,
            });
        }

        // Recommend training the most beneficial stat
        const bestStat = trainingOrder[0];
        if (bestStat && breakEvenPoints.training[bestStat.stat] < 14400) {
            // 4 hours
            recommendations.push({
                priority: 2,
                action: ACTIONS[`TRAIN_${bestStat.stat.toUpperCase()}`],
                reason: `${bestStat.stat} training has best marginal benefit (${bestStat.benefitPerSecond.toFixed(4)} karma/sec per training second)`,
                duration: 1800, // 30 minute chunks
                expectedBenefit: `Break-even time: ${(breakEvenPoints.training[bestStat.stat] / 3600).toFixed(1)} hours`,
            });
        }

        // Fall back to best available crime
        recommendations.push({
            priority: 3,
            action: currentMugRate > currentHomicideRate ? ACTIONS.CRIME_MUG : ACTIONS.CRIME_HOMICIDE,
            reason: `Continue with best available crime while improving stats`,
            karmaRate: Math.max(currentHomicideRate, currentMugRate),
            expectedKarmaPerHour: Math.max(currentHomicideRate, currentMugRate) * 3600,
        });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * Simulation function to test a strategy over time
 * @param {SleeveState} initialState
 * @param {Array} strategy - Array of {action, duration} objects
 * @returns {Object} Simulation results
 */
function simulateStrategy(initialState, strategy) {
    let currentState = initialState.clone();
    let totalKarma = 0;
    let actionResults = [];

    for (const step of strategy) {
        const startState = currentState.clone();
        const endState = applyAction(currentState, step.action, step.duration);

        // Calculate karma gained during this step
        let karmaGained = 0;
        if (step.action === ACTIONS.CRIME_HOMICIDE) {
            karmaGained = calculateKarmaRate(startState, startState.shock, "Homicide") * step.duration;
        } else if (step.action === ACTIONS.CRIME_MUG) {
            karmaGained = calculateKarmaRate(startState, startState.shock, "Mug") * step.duration;
        }

        totalKarma += karmaGained;
        actionResults.push({
            action: step.action,
            duration: step.duration,
            startState: startState,
            endState: endState,
            karmaGained: karmaGained,
        });

        currentState = endState;
    }

    return {
        totalTime: currentState.time,
        totalKarma: totalKarma,
        averageKarmaRate: totalKarma / currentState.time,
        finalState: currentState,
        actionResults: actionResults,
    };
}

// Export the optimization functions
export {
    SleeveState,
    ACTIONS,
    calculateCrimeChance,
    calculateKarmaRate,
    calculateMarginalBenefits,
    getOptimalTrainingOrder,
    calculateBreakEvenPoints,
    analyticalOptimization,
    simulateStrategy,
    applyAction,
    CRIME_STATS,
    calculateSkill,
    calculateExpFromLevel,
    calculateIntelligenceBonus,
    getShockDecayRate,
};

// Example usage and testing
if (typeof window === "undefined" && typeof module !== "undefined") {
    // Node.js environment - run examples
    console.log("=== Sleeve Karma Optimization Examples ===\n");

    // Example 1: High shock, low stats
    console.log("Example 1: New sleeve (high shock, low stats)");
    const newSleeve = new SleeveState(95, 5, 5, 5, 5);
    console.log(`Initial state: ${newSleeve.toString()}`);
    const newSleeveRecs = analyticalOptimization(newSleeve);
    newSleeveRecs.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec.action}: ${rec.reason}`);
        if (rec.expectedBenefit) console.log(`     ${rec.expectedBenefit}`);
    });

    // Example 2: Medium shock, medium stats
    console.log("\nExample 2: Developing sleeve (medium shock, medium stats)");
    const mediumSleeve = new SleeveState(40, 20, 20, 15, 15);
    console.log(`Initial state: ${mediumSleeve.toString()}`);
    const mediumSleeveRecs = analyticalOptimization(mediumSleeve);
    mediumSleeveRecs.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec.action}: ${rec.reason}`);
        if (rec.expectedBenefit) console.log(`     ${rec.expectedBenefit}`);
    });

    // Example 3: Low shock, high stats
    console.log("\nExample 3: Advanced sleeve (low shock, high stats)");
    const advancedSleeve = new SleeveState(10, 50, 50, 30, 30);
    console.log(`Initial state: ${advancedSleeve.toString()}`);
    const advancedSleeveRecs = analyticalOptimization(advancedSleeve);
    advancedSleeveRecs.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec.action}: ${rec.reason}`);
        if (rec.karmaRate) console.log(`     Karma rate: ${(rec.karmaRate * 3600).toFixed(1)}/hour`);
    });
}
