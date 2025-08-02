import { NS } from "@ns";
import { calculateBestSleeveStats } from "../sleeve.js";
import { findStatsForCrimeSuccessChance } from "./automate-tasks.js";
import { calculateMaxAffordableHyperdrives } from "./bb-int-farm.js";

/** @param {NS} ns **/
export async function main(ns) {
    ns.print(ns.formatNumber(calculateMaxAffordableHyperdrives(1.171e27 / 3, 1.022847e15)));
    // const evasiveSystemLevel = ns.bladeburner.getSkillLevel("Evasive System");

    // // Buy half of current level of Evasive System
    // const numToBuy = Math.floor(evasiveSystemLevel / 2);
    // ns.print(`Current Level: ${evasiveSystemLevel}`);
    // ns.print(`Num to buy: ${numToBuy}`);

    // // Buy half of current level of Evasive System
    // ns.bladeburner.upgradeSkill("Evasive System", numToBuy);

    // // Print new level
    // ns.print(`New Level: ${ns.bladeburner.getSkillLevel("Evasive System")}`);

    // const locations = ns.infiltration.getPossibleLocations();
    // for (const location of locations) {
    //     ns.print(location.name);
    // }
    // const infiltration = ns.infiltration.getInfiltration("AeroCorp");
    // ns.print(infiltration);

    // ns.print("INT: " + ns.getPlayer().skills.intelligence);
    // ns.print(`INT Exp: ${ns.getPlayer().exp.intelligence}`);
    // const gangEquipments = ns.gang.getEquipmentNames();
    // let numUpgrades = 0;
    // let numAugments = 0;

    // for (const equipment of gangEquipments) {
    //     const equipmentType = ns.gang.getEquipmentType(equipment);
    //     if (equipmentType !== "Augmentation") {
    //         numUpgrades++;
    //     } else {
    //         numAugments++;
    //     }
    // }

    // ns.print(`Num upgrades: ${numUpgrades}`);
    // ns.print(`Num augments: ${numAugments}`);

    // const earnRateThisNode = ns.getMoneySources().sinceStart.total / (ns.getTimeSinceLastAug() / 1000);

    // ns.print(`Earn rate this node: ${ns.formatNumber(earnRateThisNode)}`);
    // const { bestConfig } = calculateBestSleeveStats(ns, true, ns.hacknet.getHashUpgradeLevel("Improve Gym Training"));

    // // Print best configuration
    // ns.print("\n=== BEST CONFIGURATION ===");
    // ns.print(JSON.stringify(bestConfig.stats, null, 2));
    // ns.print(`Shock Value: ${bestConfig.shockValue}`);
    // ns.print(`Crime Success Chance: ${bestConfig.crimeChance}`);
    // ns.print(`Total Time: ${bestConfig.totalTime} seconds (${(bestConfig.totalTime / 3600).toFixed(2)} hours)`);
    // ns.print(`Breakdown:`);
    // ns.print(
    //     `  - Shock reduction: ${bestConfig.shockTime} seconds (${(bestConfig.shockTime / 3600).toFixed(2)} hours)`,
    // );
    // ns.print(`  - Combat training: ${bestConfig.expTime} seconds (${(bestConfig.expTime / 3600).toFixed(2)} hours)`);
    // ns.print(`  - Training exp gain rate: ${bestConfig.trainingExpGainRate}`);
    // ns.print(`  - Shock reduction during exp training: ${bestConfig.shockReductionDuringExpTraining}`);
    // ns.print(`  - Final exp gain rate: ${bestConfig.finalExpGainRate}`);
    // ns.print(`  - Sync bonus from other sleeves: ${bestConfig.syncBonusFromOtherSleeves}`);
    // ns.print(`  - Karma farming: ${bestConfig.karmaTime} seconds (${(bestConfig.karmaTime / 3600).toFixed(2)} hours)`);

    // ns.print(JSON.stringify(findStatsForCrimeSuccessChance(ns, "Homicide", 0.55, ns.sleeve.getSleeve(0)), null, 2));
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
