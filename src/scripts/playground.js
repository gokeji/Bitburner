import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const serverInfo = ns.getServer("zb-institute");
    const calcServer = {
        ...serverInfo,
        minSecurityLevel: 1,
        maxMoney: 10e12,
    };
    const player = ns.getPlayer();
    const hackPercentageFromOneThread = ns.formulas.hacking.hackPercent(serverInfo, player);
    ns.print(`hackPercentageFromOneThread: ${hackPercentageFromOneThread}`);
    ns.print(`zb-institute max money: ${serverInfo.moneyMax}`);
    const threads = ns.hackAnalyzeThreads("zb-institute", serverInfo.moneyMax * 0.01);
    ns.print(`threads to hack 1% of max money: ${threads}`);
    const hackChance = ns.hackAnalyzeChance("zb-institute", serverInfo.moneyMax * 0.01);
    ns.print(`hackChance: ${hackChance}`);
    // while (true) {
    //     const daedalusFavor =
    //         ns.singularity.getFactionFavor("Daedalus") + ns.singularity.getFactionFavorGain("Daedalus");
    //     if (daedalusFavor >= 150) {
    //         ns.singularity.workForFaction("Illuminati", "hacking");
    //     }
    //     await ns.sleep(10000);
    // }
    // ns.print(ns.getServerMaxMoney("ecorp"));
    // const toPrint = ns.getPlayer().mults.hacking_money * ns.getBitNodeMultipliers().ScriptHackMoney;
    // ns.print(toPrint);
    // ns.print(favorToRep(34));
    // ns.print(repToFavor(300000));
    // ns.print(calculateFavorAfterResetting(34, 300000));
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
