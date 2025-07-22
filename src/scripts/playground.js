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

            const syncBonusFromOtherSleeves = 1 + (ns.sleeve.getNumSleeves() - 1) * ((100 - shockValue) / 100);
            baselineExpGainRate *= syncBonusFromOtherSleeves;
            //  * // 5 ticks per second
            // ns.sleeve.getNumSleeves(); // 8 sleeves syncing exp
            const expGainRate = baselineExpGainRate * (Math.min(100, 100 - shockValue) / 100); // Per second, 5 ticks per second (bonus time is faster)

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
            let timeTraining = stats.totalExpRequired / expGainRate;

            // 4.5 Shock reduction during exp training
            if (expGainRate > 0) {
                const standardShockReductionRate = shockReductionRate / 3;
                const shockReductionDuringExpTraining = standardShockReductionRate * timeTraining;
                const maxExpGainRate =
                    baselineExpGainRate * (Math.min(100, 100 - shockValue + shockReductionDuringExpTraining) / 100);
                timeTraining = stats.totalExpRequired / ((expGainRate + maxExpGainRate) / 2);
            }

            // 5. Time to reach -54K karma
            const playerHomicideKarmaRate = withPlayerHomicide ? 1 : 0;
            const karmaRate = minCrimeSuccessChance * ns.sleeve.getNumSleeves() + playerHomicideKarmaRate;
            const startingKarma = useCurrentStats ? -ns.heart.break() : 0;
            const playerKarmaDuringTraining = 0; //playerHomicideKarmaRate * timeTraining;
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
                syncBonusFromOtherSleeves,
                trainingExpGainRate: expGainRate.toFixed(2),
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
