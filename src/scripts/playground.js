import { NS } from "@ns";
import { findStatsForCrimeSuccessChance } from "./automate-tasks.js";

/** @param {NS} ns **/
export async function main(ns) {
    const numGymHashesBought = 10;
    const withPlayerHomicide = true;
    const useCurrentStats = false;

    let bestTime = Infinity;
    let bestConfig = null;
    const results = [];

    const test = ns.formulas.work.gymGains(ns.sleeve.getSleeve(0), "str", "Powerhouse Gym").strExp * 0.1405 * 5; // 5 ticks per second

    const test2 = 1 + (ns.sleeve.getNumSleeves() - 1) * ((100 - ns.sleeve.getSleeve(0).shock) / 100);
    // ns.sleeve.getNumSleeves();
    ns.print(test);
    ns.print(test2);
    ns.print(test * test2);

    const startingShockValue = useCurrentStats ? ns.sleeve.getSleeve(0).shock : 100;
    const startingCrimeChance = useCurrentStats
        ? ns.formulas.work.crimeSuccessChance(ns.sleeve.getSleeve(0), "Homicide")
        : 0.2;
    const currentGymUpgradesBought = ns.hacknet.getHashUpgradeLevel("Improve Gym Training");

    // Test shock values from 0.97 to 0.9
    for (let shockValue = startingShockValue; shockValue >= Math.max(startingShockValue - 10, 0); shockValue -= 1) {
        // Test crime success chances from 0.2 to 0.5 in 0.01 increments
        for (
            let minCrimeSuccessChance = startingCrimeChance;
            minCrimeSuccessChance <= Math.min(startingCrimeChance + 0.4, 1);
            minCrimeSuccessChance += 0.01
        ) {
            // 1. Shock value
            const shockReductionRate = 0.0003 * 5 * 1.16; // Per second, 5 ticks per second, with 16% int bonus at 0.75 mult
            const shockReductionTime = (startingShockValue - shockValue) / shockReductionRate;

            // 2. Exp gain rate
            let baselineExpGainRate =
                ns.formulas.work.gymGains(ns.sleeve.getSleeve(0), "str", "Powerhouse Gym").strExp * 5;

            if (!useCurrentStats) {
                const gymUpgradeBonus = 1 + currentGymUpgradesBought * 0.2;
                baselineExpGainRate = (baselineExpGainRate / gymUpgradeBonus) * (1 + numGymHashesBought * 0.2);
            }

            // Note: syncBonusFromOtherSleeves will be calculated dynamically in the training equation
            // since it changes over time as shock decreases
            const numSleeves = ns.sleeve.getNumSleeves();
            const syncBonusFromOtherSleeves = 1 + (numSleeves - 1) * ((100 - shockValue) / 100);

            // Current exp gain rate at the start of training (for display purposes)
            const initialExpGainRate =
                baselineExpGainRate * syncBonusFromOtherSleeves * (Math.min(100, 100 - shockValue) / 100);
            const expGainRate = initialExpGainRate;

            // 3. Player stats
            const player = ns.sleeve.getSleeve(0);
            if (!useCurrentStats) {
                player.skills.strength = 0;
                player.skills.defense = 0;
                player.skills.dexterity = 0;
                player.skills.agility = 0;
            }
            const stats = findStatsForCrimeSuccessChance(ns, "Homicide", minCrimeSuccessChance, player);

            // 4. Calculate the time to reach the minimum crime success chance
            // Using quadratic equation to account for continuous shock reduction during training

            let timeTraining = 0;
            let maxExpGainRate = expGainRate;
            let shockReductionDuringExpTraining = 0;

            // 4.5 Shock reduction during exp training
            if (expGainRate > 0 && stats.totalExpRequired > 0) {
                const standardShockReductionRate = shockReductionRate / 3;

                // Enhanced equation accounting for both efficiency and sync bonus changes over time
                // exp_rate(t) = baseline * sync(t) * efficiency(t)
                // where:
                // sync(t) = 1 + (numSleeves - 1) * (100 - shockValue + r*t)/100
                // efficiency(t) = (100 - shockValue + r*t)/100
                //
                // This expands to:
                // exp_rate(t) = baseline * [(100 - shockValue + r*t)/100] * [1 + (numSleeves - 1) * (100 - shockValue + r*t)/100]
                //             = baseline * [(100 - shockValue + r*t)/100] + baseline * [(numSleeves - 1) * (100 - shockValue + r*t)²/10000]

                const baseEfficiency = (100 - shockValue) / 100;
                const r = standardShockReductionRate;

                // Coefficients for the expanded polynomial integration
                // ∫₀ᵀ [baseline * (baseEff + r*t/100) + baseline * (numSleeves-1) * (baseEff + r*t/100)²/100] dt = totalExpRequired

                // Linear terms: baseline * baseEff + baseline * (numSleeves-1) * baseEff²/100
                const linearCoeff =
                    baselineExpGainRate * (baseEfficiency + (numSleeves - 1) * baseEfficiency * baseEfficiency);

                // Quadratic terms: baseline * r/100 + baseline * (numSleeves-1) * 2 * baseEff * r / 10000
                const quadraticCoeff =
                    baselineExpGainRate * (r / 100 + ((numSleeves - 1) * 2 * baseEfficiency * r) / 10000);

                // Cubic terms: baseline * (numSleeves-1) * r² / 1000000
                const cubicCoeff = (baselineExpGainRate * (numSleeves - 1) * r * r) / 1000000;

                // We now have: cubicCoeff * T³/3 + quadraticCoeff * T²/2 + linearCoeff * T = totalExpRequired
                // Rearranging: (cubicCoeff/3) * T³ + (quadraticCoeff/2) * T² + linearCoeff * T - totalExpRequired = 0

                const a = cubicCoeff / 3;
                const b = quadraticCoeff / 2;
                const c = linearCoeff;
                const d = -stats.totalExpRequired;

                // For cubic equations, we'll use an iterative approach (Newton's method) for simplicity
                // Starting estimate based on linear approximation
                let T = stats.totalExpRequired / (linearCoeff || 1);

                // Newton's method iterations
                for (let i = 0; i < 10; i++) {
                    const f = a * T * T * T + b * T * T + c * T + d;
                    const fprime = 3 * a * T * T + 2 * b * T + c;

                    if (Math.abs(fprime) < 1e-10) break; // Avoid division by zero

                    const newT = T - f / fprime;
                    if (Math.abs(newT - T) < 1e-6) break; // Convergence check

                    T = Math.max(0, newT); // Ensure positive time
                }

                timeTraining = T;

                // Calculate actual shock reduction and final exp rate
                shockReductionDuringExpTraining = standardShockReductionRate * timeTraining;
                const finalShockValue = Math.max(0, shockValue - shockReductionDuringExpTraining);
                const finalSyncBonus = 1 + (numSleeves - 1) * ((100 - finalShockValue) / 100);
                maxExpGainRate = baselineExpGainRate * finalSyncBonus * ((100 - finalShockValue) / 100);

                // Fallback check: if Newton's method failed or gave unreasonable results
                if (timeTraining <= 0 || timeTraining > 1e6 || !isFinite(timeTraining)) {
                    // Fallback to quadratic approximation (ignoring sync bonus changes)
                    const simpleA =
                        (baselineExpGainRate * standardShockReductionRate * syncBonusFromOtherSleeves) / 200;
                    const simpleB = (baselineExpGainRate * syncBonusFromOtherSleeves * (100 - shockValue)) / 100;
                    const simpleC = -stats.totalExpRequired;

                    const discriminant = simpleB * simpleB - 4 * simpleA * simpleC;

                    if (discriminant >= 0 && simpleA !== 0) {
                        timeTraining = (-simpleB + Math.sqrt(discriminant)) / (2 * simpleA);
                        shockReductionDuringExpTraining = standardShockReductionRate * timeTraining;
                        const fallbackFinalShock = Math.max(0, shockValue - shockReductionDuringExpTraining);
                        const fallbackFinalSync = 1 + (numSleeves - 1) * ((100 - fallbackFinalShock) / 100);
                        maxExpGainRate = baselineExpGainRate * fallbackFinalSync * ((100 - fallbackFinalShock) / 100);
                    } else {
                        // Final fallback to simple linear
                        timeTraining = stats.totalExpRequired / Math.max(expGainRate, 1);
                        shockReductionDuringExpTraining = standardShockReductionRate * timeTraining;
                        maxExpGainRate = expGainRate;
                    }
                }
            } else {
                timeTraining = expGainRate > 0 ? stats.totalExpRequired / Math.max(expGainRate, 1) : Infinity;
            }

            // 5. Time to reach -54K karma
            const playerHomicideKarmaRate = withPlayerHomicide ? 1 : 0;
            const karmaRate = minCrimeSuccessChance * ns.sleeve.getNumSleeves() + playerHomicideKarmaRate;
            const startingKarma = useCurrentStats ? -ns.heart.break() : 0;
            const playerKarmaDuringTraining = playerHomicideKarmaRate * timeTraining;
            const timeToReachKarma = (54000 - startingKarma - playerKarmaDuringTraining) / karmaRate;

            // 6. Total time
            const totalTime = shockReductionTime + timeTraining + timeToReachKarma;

            const config = {
                stats: stats,
                shockValue: shockValue.toFixed(2),
                crimeChance: minCrimeSuccessChance.toFixed(2),
                totalTime: totalTime.toFixed(2),
                shockTime: shockReductionTime.toFixed(2),
                expTime: timeTraining.toFixed(2),
                trainingExpGainRate: expGainRate.toFixed(2),
                shockReductionDuringExpTraining: shockReductionDuringExpTraining.toFixed(2),
                finalExpGainRate: maxExpGainRate.toFixed(2),
                syncBonusFromOtherSleeves,
                karmaTime: timeToReachKarma.toFixed(2),
            };

            results.push(config);

            if (totalTime < bestTime) {
                bestTime = totalTime;
                bestConfig = config;
            }
        }
    }

    // Print all results
    // ns.print("All configurations:");
    // ns.print("Shock | Crime | Total | Shock | Exp | Karma");
    // ns.print("------|-------|-------|-------|-----|------");

    // results.forEach((config) => {
    //     ns.print(
    //         `${config.shockValue} | ${config.crimeChance} | ${config.totalTime} | ${config.shockTime} | ${config.expTime} | ${config.karmaTime}`,
    //     );
    // });

    // Print best configuration
    ns.print("\n=== BEST CONFIGURATION ===");
    ns.print(JSON.stringify(bestConfig.stats, null, 2));
    ns.print(`Shock Value: ${bestConfig.shockValue}`);
    ns.print(`Crime Success Chance: ${bestConfig.crimeChance}`);
    ns.print(`Total Time: ${bestConfig.totalTime} seconds`);
    ns.print(`Breakdown:`);
    ns.print(`  - Shock reduction: ${bestConfig.shockTime} seconds`);
    ns.print(`  - Combat training: ${bestConfig.expTime} seconds`);
    ns.print(`  - Training exp gain rate: ${bestConfig.trainingExpGainRate}`);
    ns.print(`  - Shock reduction during exp training: ${bestConfig.shockReductionDuringExpTraining}`);
    ns.print(`  - Final exp gain rate: ${bestConfig.finalExpGainRate}`);
    ns.print(`  - Sync bonus from other sleeves: ${bestConfig.syncBonusFromOtherSleeves}`);
    ns.print(`  - Karma farming: ${bestConfig.karmaTime} seconds`);
}

export const MaxFavor = 35331;
// This is the nearest representable value of log(1.02), which is the base of our power.
// It is *not* the same as Math.log(1.02), since "1.02" lacks sufficient precision.
const log1point02 = 0.019802627296179712;

export function favorToRep(f) {
    // expm1 is e^x - 1, which is more accurate for small x than doing it the obvious way.
    return 25000 * Math.expm1(log1point02 * f);
}

export function repToFavor(r) {
    // log1p is log(x + 1), which is more accurate for small x than doing it the obvious way.
    return Math.log1p(r / 25000) / log1point02;
}

export function calculateFavorAfterResetting(favor, playerReputation) {
    return repToFavor(favorToRep(favor) + playerReputation);
}
