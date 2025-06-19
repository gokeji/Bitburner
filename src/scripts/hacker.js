import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    // Test printing all the hack grow and weaken stats for n00dles as a test
    const target = "n00dles";

    // Get the current stats

    const hackPercentage = 0.5;
    const cpuCores = 1;

    const serverInfo = ns.getServer(target);
    const securityLevel = serverInfo.hackDifficulty;
    const minSecurityLevel = serverInfo.minDifficulty;
    const currentMoney = serverInfo.moneyAvailable;
    const maxMoney = serverInfo.moneyMax;

    const weakenAmount = ns.weakenAnalyze(1, cpuCores);

    ns.print("\n\n\n\n\n\n");
    ns.print(`${target}`);
    ns.print(`Security Level: ${securityLevel}`);
    ns.print(`Min Security Level: ${minSecurityLevel}`);
    ns.print(`Current Money: ${currentMoney}`);
    ns.print(`Max Money: ${maxMoney}`);

    ns.print(`=== Prepping for hack ===`);
    ns.print(`=== Weaken to min security level ===`);
    ns.print(`Weaken Target: ${minSecurityLevel}`);
    ns.print(`Weaken Amount: ${weakenAmount}`);
    ns.print(`Weaken Threads Needed: ${Math.ceil((securityLevel - minSecurityLevel) / weakenAmount)}`);
    ns.print(`Weaken Time: ${ns.getWeakenTime(target)}ms`);

    ns.print(`=== Grow to max money ===`);
    const growthAmount = maxMoney / currentMoney;
    var growthThreads = Math.ceil(ns.growthAnalyze(target, growthAmount, cpuCores));
    var growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores);
    ns.print(`Grow Amount: ${growthAmount}`);
    ns.print(`Grow Threads Needed: ${growthThreads}`);
    ns.print(`Grow Time: ${ns.getGrowTime(target)}ms`);

    ns.print(`=== Weaken to min security level again after growing ===`);
    ns.print(`Weaken Threads Needed: ${Math.ceil(growthSecurityChange / weakenAmount)}`);
    ns.print(`Weaken Time: ${ns.getWeakenTime(target)}ms`);

    const hackChance = ns.hackAnalyzeChance(target);
    const hackPercentageFromOneThread = ns.hackAnalyze(target);
    const hackThreads = Math.ceil(hackPercentage / hackPercentageFromOneThread);
    const hackSecurityChange = ns.hackAnalyzeSecurity(hackThreads, target);
    const hackTime = ns.getHackTime(target);

    growthThreads = Math.ceil(ns.growthAnalyze(target, 1 / hackPercentage, cpuCores));
    growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores);
    const growthTime = ns.getGrowTime(target);
    const growthFactor = ns.getServerGrowth(target);

    const weakenTarget = hackSecurityChange + growthSecurityChange;
    const weakenThreadsNeeded = Math.ceil(weakenTarget / weakenAmount);
    const weakenTime = ns.getWeakenTime(target);

    ns.print(`=== Hacking 50% of max money ===`);
    ns.print(`Hack Chance: ${hackChance}`);
    ns.print(`Hack Percentage From One Thread: ${hackPercentageFromOneThread}`);
    ns.print(`Hack Amount: ${hackPercentage * maxMoney}`);
    ns.print(`Hack Threads: ${hackThreads}`);
    ns.print(`Hack Security Change: ${hackSecurityChange}`);
    ns.print(`Hack Time: ${hackTime}ms`);

    ns.print(`=== Growing 2X back to 100% ===`);
    ns.print(`Growth Threads: ${growthThreads}`);
    ns.print(`Growth Security Change: ${growthSecurityChange}`);
    ns.print(`Growth Time: ${growthTime}ms`);
    ns.print(`Growth Factor: ${growthFactor}`);

    ns.print(`=== Weakening to min security level ===`);
    ns.print(`Weaken Target: ${weakenTarget}`);
    ns.print(`Weaken Threads Needed: ${weakenThreadsNeeded}`);
    ns.print(`Weaken Amount: ${weakenAmount}`);
    ns.print(`Weaken Time: ${weakenTime}ms`);

    return;
}
