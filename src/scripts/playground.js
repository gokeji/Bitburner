import { NS } from "@ns";
import { findStatsForCrimeSuccessChance } from "./automate-tasks.js";

/** @param {NS} ns **/
export async function main(ns) {
    const numGymHashesBought = 10;
    const withPlayerHomicide = true;

    let bestTime = Infinity;
    let bestConfig = null;
    const results = [];

    // Test shock values from 0.97 to 0.9
    for (let shockValue = 0.97; shockValue >= 0.9; shockValue -= 0.01) {
        // Test crime success chances from 0.2 to 0.5 in 0.01 increments
        for (let minCrimeSuccessChance = 0.2; minCrimeSuccessChance <= 0.5; minCrimeSuccessChance += 0.01) {
            // 1. Shock value
            const shockReductionRate = 0.0003 * 5 * 1.16; // Per second, 5 ticks per second, with 16% int bonus at 0.75 mult
            const shockReductionTime = ((1 - shockValue) * 100) / shockReductionRate;

            // 2. Exp gain rate
            const baselineExpGainRate =
                ns.formulas.work.gymGains(ns.sleeve.getSleeve(0), "str", "Powerhouse Gym").strExp * 0.2;
            const expGainRate = baselineExpGainRate * numGymHashesBought * (1 - shockValue) * 5 * 8; // Per second, 5 ticks per second (bonus time is faster)

            // 3. Player stats
            const player = ns.sleeve.getSleeve(0);
            player.skills.strength = 0;
            player.skills.defense = 0;
            player.skills.dexterity = 0;
            player.skills.agility = 0;
            const stats = findStatsForCrimeSuccessChance(ns, "Homicide", minCrimeSuccessChance, player);

            // 4. Calculate the time to reach the minimum crime success chance
            const timeTraining = stats.totalExpRequired / expGainRate;

            // 4.5 Shock reduction during exp training
            const standardShockReductionRate = shockReductionRate / 3;
            const shockReductionDuringExpTraining = standardShockReductionRate * timeTraining;
            const maxExpGainRate =
                baselineExpGainRate *
                numGymHashesBought *
                (1 - shockValue + shockReductionDuringExpTraining / 100) *
                5 *
                8;
            const adjustedTimeTraining = stats.totalExpRequired / ((expGainRate + maxExpGainRate) / 2);

            // 5. Time to reach -54K karma
            const karmaRate = minCrimeSuccessChance * 8 + (withPlayerHomicide ? 1 : 0);
            const timeToReachKarma = 54000 / karmaRate;

            // 6. Total time
            const totalTime = shockReductionTime + adjustedTimeTraining + timeToReachKarma;

            const config = {
                shockValue: shockValue.toFixed(2),
                crimeChance: minCrimeSuccessChance.toFixed(2),
                totalTime: totalTime.toFixed(2),
                shockTime: shockReductionTime.toFixed(2),
                expTime: adjustedTimeTraining.toFixed(2),
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
    ns.print("All configurations:");
    ns.print("Shock | Crime | Total | Shock | Exp | Karma");
    ns.print("------|-------|-------|-------|-----|------");

    results.forEach((config) => {
        ns.print(
            `${config.shockValue} | ${config.crimeChance} | ${config.totalTime} | ${config.shockTime} | ${config.expTime} | ${config.karmaTime}`,
        );
    });

    // Print best configuration
    ns.print("\n=== BEST CONFIGURATION ===");
    ns.print(`Shock Value: ${bestConfig.shockValue}`);
    ns.print(`Crime Success Chance: ${bestConfig.crimeChance}`);
    ns.print(`Total Time: ${bestConfig.totalTime} seconds`);
    ns.print(`Breakdown:`);
    ns.print(`  - Shock reduction: ${bestConfig.shockTime} seconds`);
    ns.print(`  - Exp training: ${bestConfig.expTime} seconds`);
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
