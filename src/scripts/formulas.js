// MARK: - Sleeve

/**
 * @param {number} intelligence
 * @returns {number}
 */
function sleeveShockReductionPerSecond(intelligence) {
    return 0.0002 * calculateIntelligenceBonus(intelligence, 0.75) * 5;
}

// MARK: - Intelligence

/**
 * @param {number} intelligence
 * @param {number} weight
 * @returns {number}
 */
function calculateIntelligenceBonus(intelligence, weight = 1) {
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
function calculateSkill(exp, mult = 1) {
    const value = Math.floor(mult * (32 * Math.log(exp + 534.6) - 200));
    return clampNumber(value, 1);
}

/**
 * @param {number} skill
 * @param {number} mult
 * @returns {number}
 */
function calculateExp(skill, mult = 1) {
    const value = Math.exp((skill / mult + 200) / 32) - 534.6;
    return clampNumber(value, 0);
}

/**
 * @param {number} exp
 * @param {number} mult
 * @returns {currentSkill: number, nextSkill: number, baseExperience: number, experience: number, nextExperience: number, currentExperience: number, remainingExperience: number, progress: number}
 */
function calculateSkillProgress(exp, mult = 1) {
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

/**
 * Clamps the value on a lower and an upper bound
 * @param {number} value Value to clamp
 * @param {number} min Lower bound, defaults to negative Number.MAX_VALUE
 * @param {number} max Upper bound, defaults to Number.MAX_VALUE
 * @returns {number} Clamped value
 */
function clampNumber(value, min = -Number.MAX_VALUE, max = Number.MAX_VALUE) {
    if (isNaN(value)) {
        return min;
    }
    return Math.max(Math.min(value, max), min);
}

// CommonJS exports
module.exports = {
    sleeveShockReductionPerSecond,
    calculateIntelligenceBonus,
    calculateSkill,
    calculateExp,
    calculateSkillProgress,
    clampNumber,
};

/**
 * Main function to make all exported functions available in Node.js console
 * Run with: node src/scripts/formulas-node.js
 */
function main() {
    console.log("Bitburner Formulas Console (Node.js Version)");
    console.log("Available functions:");
    console.log("- sleeveShockReductionPerSecond(intelligence)");
    console.log("- calculateIntelligenceBonus(intelligence, weight = 1)");
    console.log("- calculateSkill(exp, mult = 1)");
    console.log("- calculateExp(skill, mult = 1)");
    console.log("- calculateSkillProgress(exp, mult = 1)");
    console.log("- clampNumber(value, min = -Number.MAX_VALUE, max = Number.MAX_VALUE)");
    console.log("\nAll functions are available as global variables in this console.");
    console.log("Example: calculateSkill(1000) or calculateIntelligenceBonus(50, 0.8)");
    console.log("");

    // Make all functions available globally
    global.sleeveShockReductionPerSecond = sleeveShockReductionPerSecond;
    global.calculateIntelligenceBonus = calculateIntelligenceBonus;
    global.calculateSkill = calculateSkill;
    global.calculateExp = calculateExp;
    global.calculateSkillProgress = calculateSkillProgress;
    global.clampNumber = clampNumber;

    // Start REPL for interactive use
    const repl = require("repl");
    const replServer = repl.start("formulas> ");

    // Add functions to REPL context
    replServer.context.sleeveShockReductionPerSecond = sleeveShockReductionPerSecond;
    replServer.context.calculateIntelligenceBonus = calculateIntelligenceBonus;
    replServer.context.calculateSkill = calculateSkill;
    replServer.context.calculateExp = calculateExp;
    replServer.context.calculateSkillProgress = calculateSkillProgress;
    replServer.context.clampNumber = clampNumber;
}

// Run main function if this file is executed directly
if (require.main === module) {
    main();
}
