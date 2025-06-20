import { NS } from "@ns";

const hackScript = "/kamu/hack.js";
const growScript = "/kamu/grow.js";
const weakenScript = "/kamu/weaken.js";

var hackPercentage = 0.5;
let SCRIPT_DELAY = 1000; // 30ms delay between scripts

/** @param {NS} ns **/
export async function main(ns) {
    // Test printing all the hack grow and weaken stats for n00dles as a test
    const target = "n00dles";

    // Get the current stats

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

    const hackChance = ns.hackAnalyzeChance(target);
    const hackPercentageFromOneThread = ns.hackAnalyze(target);
    const hackThreads = Math.ceil(hackPercentage / hackPercentageFromOneThread);
    const hackSecurityChange = ns.hackAnalyzeSecurity(hackThreads, target);
    const hackTime = ns.getHackTime(target);

    const growthThreads = Math.ceil(ns.growthAnalyze(target, 1 / hackPercentage, cpuCores));
    const growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores);
    const growthTime = ns.getGrowTime(target);
    const growthFactor = ns.getServerGrowth(target);

    const weakenTarget = hackSecurityChange + growthSecurityChange;
    const weakenThreadsNeeded = Math.ceil(weakenTarget / weakenAmount);
    const weakenTime = ns.getWeakenTime(target);

    prepServer(ns, target);

    // ns.print(`=== Hacking 50% of max money ===`);
    // ns.print(`Hack Chance: ${hackChance}`);
    // ns.print(`Hack Percentage From One Thread: ${hackPercentageFromOneThread}`);
    // ns.print(`Hack Amount: ${hackPercentage * maxMoney}`);
    // ns.print(`Hack Threads: ${hackThreads}`);
    // ns.print(`Hack Security Change: ${hackSecurityChange}`);
    // ns.print(`Hack Time: ${hackTime}ms`);

    // ns.print(`=== Growing 2X back to 100% ===`);
    // ns.print(`Growth Threads: ${growthThreads}`);
    // ns.print(`Growth Security Change: ${growthSecurityChange}`);
    // ns.print(`Growth Time: ${growthTime}ms`);
    // ns.print(`Growth Factor: ${growthFactor}`);

    // ns.print(`=== Weakening to min security level ===`);
    // ns.print(`Weaken Target: ${weakenTarget}`);
    // ns.print(`Weaken Threads Needed: ${weakenThreadsNeeded}`);
    // ns.print(`Weaken Amount: ${weakenAmount}`);
    // ns.print(`Weaken Time: ${weakenTime}ms`);

    return;
}

/**
 * Prepares the target server for hacking, get it to the min security level and grow it to max money.
 * Do a WGW batch of 3 scripts, weaken, grow, weaken.
 * Or if already at min security level, just do GW batch of 2 scripts, grow, weaken.
 * @param {NS} ns - The Netscript API.
 * @param {string} target - The target server to prep.
 * @returns {void}
 */
function prepServer(ns, target) {
    // TODO: - Add way to optimize cpuCores
    const cpuCores = 1;

    const serverInfo = ns.getServer(target);
    const securityLevel = serverInfo.hackDifficulty;
    const minSecurityLevel = serverInfo.minDifficulty;
    const currentMoney = serverInfo.moneyAvailable;
    const maxMoney = serverInfo.moneyMax;

    const weakenAmount = ns.weakenAnalyze(1, cpuCores);
    const weakenTime = ns.getWeakenTime(target);
    const growthTime = ns.getGrowTime(target);

    ns.print(`=== Prepping for hack ===`);

    // Check if server is already at min security level
    const needsInitialWeaken = securityLevel > minSecurityLevel;

    if (needsInitialWeaken) {
        ns.print(`=== Weaken to min security level ===`);
        ns.print(`Weaken Target: ${minSecurityLevel}`);
        ns.print(`Weaken Amount: ${weakenAmount}`);
        ns.print(`Weaken Threads Needed: ${Math.ceil((securityLevel - minSecurityLevel) / weakenAmount)}`);
        ns.print(`Weaken Time: ${weakenTime}ms`);
        executeWeaken(ns, "home", target, Math.ceil((securityLevel - minSecurityLevel) / weakenAmount), 0);
    } else {
        ns.print(`=== Server already at min security level, skipping initial weaken ===`);
    }

    ns.print(`=== Grow to max money ===`);
    const growthAmount = maxMoney / currentMoney;
    const growthThreads = Math.ceil(ns.growthAnalyze(target, growthAmount, cpuCores));
    const growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores);
    ns.print(`Grow Amount: ${growthAmount}`);
    ns.print(`Grow Threads Needed: ${growthThreads}`);
    ns.print(`Grow Time: ${growthTime}ms`);

    // Adjust timing based on whether initial weaken was needed
    const growDelay = needsInitialWeaken ? weakenTime - growthTime + SCRIPT_DELAY : 0;
    executeGrow(ns, "home", target, growthThreads, growDelay);

    ns.print(`=== Weaken to min security level again after growing ===`);
    const weakenThreadsNeeded = Math.ceil(growthSecurityChange / weakenAmount);
    ns.print(`Weaken Threads Needed: ${weakenThreadsNeeded}`);
    ns.print(`Weaken Time: ${weakenTime}ms`);

    // Adjust timing based on whether initial weaken was needed (2 scripts vs 3)
    const finalWeakenDelay = needsInitialWeaken ? 2 * SCRIPT_DELAY : SCRIPT_DELAY - (weakenTime - growthTime);
    executeWeaken(ns, "home", target, weakenThreadsNeeded, finalWeakenDelay);
}

function executeWeaken(ns, host, target, threads, sleepTime) {
    const pid = ns.exec(weakenScript, host, threads, target, sleepTime);
    if (!pid) {
        ns.tprint(`WARN Failed to execute weaken script on ${target}`);
    } else {
        ns.print(`SUCCESS Weakened ${target} with ${threads} threads`);
    }
}

function executeGrow(ns, host, target, threads, sleepTime) {
    const pid = ns.exec(growScript, host, threads, target, sleepTime);
    if (!pid) {
        ns.tprint(`WARN Failed to execute grow script on ${target}`);
    } else {
        ns.print(`SUCCESS Grew ${target} with ${threads} threads`);
    }
}

function executeHack(ns, host, target, threads, sleepTime, stockArg) {
    const pid = ns.exec(hackScript, host, threads, target, sleepTime);
    if (!pid) {
        ns.tprint(`WARN Failed to execute hack script on ${target}`);
    } else {
        ns.print(`SUCCESS Hacked ${target} with ${threads} threads`);
    }
}
