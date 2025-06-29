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
