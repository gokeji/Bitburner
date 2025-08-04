import { NS } from "@ns";
import { calculateBestSleeveStats } from "../sleeve.js";
import { findStatsForCrimeSuccessChance } from "./automate-tasks.js";

/** @param {NS} ns **/
export async function main(ns) {
    // const locations = ns.infiltration.getPossibleLocations();
    // for (const location of locations) {
    //     ns.print(location.name);
    // }
    // const infiltration = ns.infiltration.getInfiltration("AeroCorp");
    // ns.print(infiltration);

    const mockIntelligence = 3000;
    const { bestConfig } = calculateBestSleeveStats(
        ns,
        false,
        ns.hacknet.getHashUpgradeLevel("Improve Gym Training"),
        mockIntelligence,
    );

    // Print best configuration
    ns.print("\n=== BEST CONFIGURATION ===");
    ns.print(`Intelligence: ${mockIntelligence}`);
    ns.print(`Shock Value: ${bestConfig.shockValue}`);
    ns.print(`Crime Success Chance: ${bestConfig.crimeChance}`);
    ns.print(`Total Time: ${formatTime(bestConfig.totalTime)}`);
    ns.print(JSON.stringify(bestConfig.stats, null, 2));
    ns.print(`Breakdown:`);
    ns.print(`  - Shock reduction: ${formatTime(bestConfig.shockTime)}`);
    ns.print(`  - Combat training: ${formatTime(bestConfig.expTime)}`);
    ns.print(`  - Training exp gain rate: ${bestConfig.trainingExpGainRate}`);
    ns.print(`  - Shock reduction during exp training: ${bestConfig.shockReductionDuringExpTraining}`);
    ns.print(`  - Final exp gain rate: ${bestConfig.finalExpGainRate}`);
    ns.print(`  - Sync bonus from other sleeves: ${bestConfig.syncBonusFromOtherSleeves}`);
    ns.print(`  - Karma farming: ${formatTime(bestConfig.karmaTime)}`);

    // const sleeve = ns.sleeve.getSleeve(0);
    // sleeve.skills.strength = 0;
    // sleeve.skills.defense = 0;
    // sleeve.skills.dexterity = 0;
    // sleeve.skills.agility = 0;
    // sleeve.mults.agility = 1;
    // sleeve.mults.dexterity = 1;
    // sleeve.mults.defense = 1;
    // sleeve.mults.strength = 1;
    // ns.print(JSON.stringify(findStatsForCrimeSuccessChance(ns, "Homicide", 0.55, sleeve), null, 2));
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} h ${minutes} m (${(seconds / 3600).toFixed(2)}h)`;
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
