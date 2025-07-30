// MARK: - Sleeve

/**
 * @param {number} intelligence
 * @returns {number}
 */
export function sleeveShockReductionPerSecond(intelligence) {
    return 0.0002 * calculateIntelligenceBonus(intelligence, 0.75) * 5;
}

// MARK: - Intelligence

/**
 * @param {number} intelligence
 * @param {number} weight
 * @returns {number}
 */
export function calculateIntelligenceBonus(intelligence, weight = 1) {
    return 1 + (weight * Math.pow(intelligence, 0.8)) / 600;
}

// MARK: - Skill
/**
 * Given an experience amount and stat multiplier, calculates the
 * stat level. Stat-agnostic (same formula for every stat)
 * @param {number} exp
 * @param {number} mult
 * @returns {number}
 */
export function calculateSkill(exp, mult = 1) {
    const value = Math.floor(mult * (32 * Math.log(exp + 534.6) - 200));
    return clampNumber(value, 1);
}

/**
 * @param {number} skill
 * @param {number} mult
 * @returns {number}
 */
export function calculateExp(skill, mult = 1) {
    const value = Math.exp((skill / mult + 200) / 32) - 534.6;
    return clampNumber(value, 0);
}

/**
 * @param {number} exp
 * @param {number} mult
 * @returns {currentSkill: number, nextSkill: number, baseExperience: number, experience: number, nextExperience: number, currentExperience: number, remainingExperience: number, progress: number}
 */
export function calculateSkillProgress(exp, mult = 1) {
    const currentSkill = calculateSkill(exp, mult);
    const nextSkill = currentSkill + 1;

    const baseExperience = calculateExp(currentSkill, mult);
    const nextExperience = calculateExp(nextSkill, mult);

    const normalize = (value) => ((value - baseExperience) * 100) / (nextExperience - baseExperience);

    const rawProgress = nextExperience - baseExperience !== 0 ? normalize(exp) : 99.99;
    const progress = clampNumber(rawProgress, 0, 100);

    const currentExperience = clampNumber(exp - baseExperience, 0);
    const remainingExperience = clampNumber(nextExperience - exp, 0);

    return {
        currentSkill,
        nextSkill,
        baseExperience,
        experience: exp,
        nextExperience,
        currentExperience,
        remainingExperience,
        progress,
    };
}

// Crime Stats (updated with actual game data)
export const CRIME_STATS = {
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
 * @param {string} crimeName - Name of the crime
 * @param {number} intelligence - Intelligence level (default: 0)
 * @returns {number} Success probability (0-1)
 */
export function calculateCrimeChance(stats, crimeName, intelligence = 0) {
    const crime = CRIME_STATS[crimeName];
    if (!crime) return 0;

    // Shock reduces effective stats
    // const shockMultiplier = (100 - shock) / 100;
    const effectiveStats = {
        strength: stats.strength,
        defense: stats.defense,
        dexterity: stats.dexterity,
        agility: stats.agility,
    };

    let chance =
        (crime.strength_success_weight || 0) * effectiveStats.strength +
        (crime.defense_success_weight || 0) * effectiveStats.defense +
        (crime.dexterity_success_weight || 0) * effectiveStats.dexterity +
        (crime.agility_success_weight || 0) * effectiveStats.agility;

    // Add intelligence bonus (simplified - assuming no crime success multipliers)
    chance += 0.025 * intelligence; // CONSTANTS.IntelligenceCrimeWeight = 0.025

    chance /= MAX_SKILL_LEVEL;
    chance /= crime.difficulty;
    chance *= calculateIntelligenceBonus(intelligence, 1);

    return Math.min(chance, 1);
}

/**
 * Clamps the value on a lower and an upper bound
 * @param {number} value Value to clamp
 * @param {number} min Lower bound, defaults to negative Number.MAX_VALUE
 * @param {number} max Upper bound, defaults to Number.MAX_VALUE
 * @returns {number} Clamped value
 */
export function clampNumber(value, min = -Number.MAX_VALUE, max = Number.MAX_VALUE) {
    if (isNaN(value)) {
        return min;
    }
    return Math.max(Math.min(value, max), min);
}

// Constants for crime calculations
const MAX_SKILL_LEVEL = 975; // Maximum skill level in Bitburner

/**
 * Helper function to easily calculate crime success rate
 * @param {number} str - Strength stat
 * @param {number} def - Defense stat
 * @param {number} dex - Dexterity stat
 * @param {number} agi - Agility stat
 * @param {string} crime - Crime name ('Homicide' or 'Mug')
 * @param {number} mult - Stat multiplier (default: 1)
 * @param {number} intelligence - Intelligence level (default: 1)
 * @returns {Object} Success rate and experience info
 */
export function crimeSuccess(str, def, dex, agi, crime = "Homicide", mult = 1, intelligence = 1) {
    const stats = { strength: str, defense: def, dexterity: dex, agility: agi };
    const chance = calculateCrimeChance(stats, crime, intelligence);
    return {
        successRate: (chance * 100).toFixed(2),
        strExp: calculateExp(str, mult),
        defExp: calculateExp(def, mult),
        dexExp: calculateExp(dex, mult),
        agiExp: calculateExp(agi, mult),
        totalExpRequired:
            calculateExp(str, mult) + calculateExp(def, mult) + calculateExp(dex, mult) + calculateExp(agi, mult),
    };
}

// MARK: - Bladeburner

const BladeburnerConstants = {
    DiffMultExponentialFactor: 0.28,
    DiffMultLinearFactor: 650,
    BaseStatGain: 1, // Base stat gain per second
    BaseIntGain: 0.003, // Base intelligence stat gain

    DifficultyToTimeFactor: 10, // Action Difficulty divided by this to get base action time
    /**
     * These factors are used to calculate action time.
     * They affect how much action time is reduced based on your agility and dexterity
     */
    EffAgiLinearFactor: 10e3,
    EffDexLinearFactor: 10e3,
    EffAgiExponentialFactor: 0.04,
    EffDexExponentialFactor: 0.035,
};

export function getBladeburnerIntGain(assassinationLevel, hyperdriveLevel, success = true) {
    const difficulty = getDifficulty(assassinationLevel);

    const action = {
        weights: {
            hacking: 0.1,
            strength: 0.1,
            defense: 0.1,
            dexterity: 0.3,
            agility: 0.3,
            charisma: 0,
            intelligence: 0.1,
        },
    };

    /**
     * Gain multiplier based on difficulty. If it changes then the
     * same variable calculated in completeAction() needs to change too
     */
    const difficultyMult =
        Math.pow(difficulty, BladeburnerConstants.DiffMultExponentialFactor) +
        difficulty / BladeburnerConstants.DiffMultLinearFactor;

    console.log("difficultyMult", difficultyMult);

    const effAgility = 800e6 * 1461;
    const effDexterity = 800e6 * 1461;

    const time = 1; //getActionTime(effAgility, effDexterity, difficulty, 0.1);
    const successMult = success ? 1 : 0.5;

    const unweightedGain = time * BladeburnerConstants.BaseStatGain * successMult * difficultyMult;
    const unweightedIntGain = time * BladeburnerConstants.BaseIntGain * successMult * difficultyMult;
    const skillMult = 1 + hyperdriveLevel * 0.1;

    return {
        hackExp: unweightedGain * action.weights.hacking * skillMult,
        strExp: unweightedGain * action.weights.strength * skillMult,
        defExp: unweightedGain * action.weights.defense * skillMult,
        dexExp: unweightedGain * action.weights.dexterity * skillMult,
        agiExp: unweightedGain * action.weights.agility * skillMult,
        chaExp: unweightedGain * action.weights.charisma * skillMult,
        intExp: unweightedIntGain * action.weights.intelligence * skillMult,
        money: 0,
        reputation: 0,
    };
}

export function getDifficulty(level) {
    const baseDifficulty = 1500;
    const difficultyFac = 1.06;
    const difficulty = baseDifficulty * Math.pow(difficultyFac, level - 1);
    if (isNaN(difficulty)) {
        throw new Error("Calculated NaN in Action.getDifficulty()");
    }
    return difficulty;
}

export function getDifficultyMult(difficulty) {
    /**
     * Gain multiplier based on difficulty. If it changes then the
     * same variable calculated in completeAction() needs to change too
     */
    const difficultyMult =
        Math.pow(difficulty, BladeburnerConstants.DiffMultExponentialFactor) +
        difficulty / BladeburnerConstants.DiffMultLinearFactor;

    return difficultyMult;
}

export function getActionTime(effAgility, effDexterity, difficulty, actionTimeMult) {
    let baseTime = difficulty / BladeburnerConstants.DifficultyToTimeFactor;
    const skillFac = actionTimeMult; // Always < 1

    const statFac =
        0.5 *
        (Math.pow(effAgility, BladeburnerConstants.EffAgiExponentialFactor) +
            Math.pow(effDexterity, BladeburnerConstants.EffDexExponentialFactor) +
            effAgility / BladeburnerConstants.EffAgiLinearFactor +
            effDexterity / BladeburnerConstants.EffDexLinearFactor); // Always > 1

    baseTime = Math.max(1, (baseTime * skillFac) / statFac);

    return Math.ceil(baseTime);
}

export function getSuccessesNeededForNextLevel(level) {
    const baseSuccessesPerLevel = 2.5;
    return Math.ceil(0.5 * level * (2 * baseSuccessesPerLevel + (level - 1)));
}

/**
 * Main function to make all exported functions available in Node.js console
 * Run with: node src/scripts/formulas.js
 */
async function main() {
    console.log("Bitburner Formulas Console (ES Module Version)");
    console.log("Available functions:");
    console.log("- sleeveShockReductionPerSecond(intelligence)");
    console.log("- calculateIntelligenceBonus(intelligence, weight = 1)");
    console.log("- calculateSkill(exp, mult = 1)");
    console.log("- calculateExp(skill, mult = 1)");
    console.log("- calculateSkillProgress(exp, mult = 1)");
    console.log("- calculateCrimeChance(stats, crimeName, intelligence = 0)");
    console.log(
        "- crimeSuccess(str, def, dex, agi, crime = 'Homicide', mult = 1, intelligence = 0) - Easy helper function",
    );
    console.log("- clampNumber(value, min = -Number.MAX_VALUE, max = Number.MAX_VALUE)");
    console.log("- getBladeburnerIntGain(assassinationLevel, hyperdriveLevel, success = true)");
    console.log("- getDifficulty(level)");
    console.log("- getActionTime(effAgility, effDexterity, difficulty, actionTimeMult)");
    console.log("\nEasy crime success calculation:");
    console.log("Example: crimeSuccess(100, 100, 100, 100, 'Homicide', 1, 200)");
    console.log("Available crimes: 'Homicide', 'Mug'");
    console.log("Parameters: strength, defense, dexterity, agility, crime, multiplier, intelligence");
    console.log("");

    // Start REPL for interactive use
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const repl = require("repl");
    const replServer = repl.start("formulas> ");

    // Add functions to REPL context
    replServer.context.sleeveShockReductionPerSecond = sleeveShockReductionPerSecond;
    replServer.context.calculateIntelligenceBonus = calculateIntelligenceBonus;
    replServer.context.calculateSkill = calculateSkill;
    replServer.context.calculateExp = calculateExp;
    replServer.context.calculateSkillProgress = calculateSkillProgress;
    replServer.context.calculateCrimeChance = calculateCrimeChance;
    replServer.context.crimeSuccess = crimeSuccess;
    replServer.context.clampNumber = clampNumber;
    replServer.context.CRIME_STATS = CRIME_STATS;
    replServer.context.getBladeburnerIntGain = getBladeburnerIntGain;
    replServer.context.getDifficulty = getDifficulty;
    replServer.context.getDifficultyMult = getDifficultyMult;
    replServer.context.getActionTime = getActionTime;
    replServer.context.getSuccessesNeededForNextLevel = getSuccessesNeededForNextLevel;
}

// Run main function if this file is executed directly (Node.js only)
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
