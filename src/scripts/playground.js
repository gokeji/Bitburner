import { NS } from "@ns";
import { findStatsForCrimeSuccessChance } from "./automate-tasks.js";

/** @param {NS} ns **/
export async function main(ns) {
    const stats = findStatsForCrimeSuccessChance(ns, "Homicide", 1);
    ns.print(JSON.stringify(stats, null, 2));

    const newPlayer = ns.getPlayer();
    newPlayer.skills.strength = 105;
    newPlayer.skills.defense = 105;
    newPlayer.skills.dexterity = 47;
    newPlayer.skills.agility = 47;
    const successChance = ns.formulas.work.crimeSuccessChance(newPlayer, "Homicide");
    ns.print(successChance);
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
