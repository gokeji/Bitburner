import { NS } from "@ns";

const hackScript = "/kamu/hack.js";
const growScript = "/kamu/grow.js";
const weakenScript = "/kamu/weaken.js";

var hackPercentage = 0.5;
let SCRIPT_DELAY = 20; // ms delay between scripts
let DELAY_BETWEEN_BATCHES = 20; // ms delay between batches

let PREP_MONEY_THRESHOLD = 1.0; // Prep servers until it's at least this much money
let SECURITY_LEVEL_THRESHOLD = 0; // Prep servers to be within minSecurityLevel + this amount

/**
 * Map of server name to priority value.
 * @type {Map<string, number>}
 */
let serverPriorityMap = new Map();

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    // Test printing all the hack grow and weaken stats for n00dles as a test
    const target = "n00dles";

    // Get the current stats

    const serverInfo = ns.getServer(target);
    const securityLevel = serverInfo.hackDifficulty;
    const minSecurityLevel = serverInfo.minDifficulty;
    const currentMoney = serverInfo.moneyAvailable;
    const maxMoney = serverInfo.moneyMax;

    ns.print("\n\n\n\n\n\n");
    ns.print(`${target}`);
    ns.print(`Security Level: ${securityLevel}`);
    ns.print(`Min Security Level: ${minSecurityLevel}`);
    ns.print(`Current Money: ${currentMoney}`);
    ns.print(`Max Money: ${maxMoney}`);

    const executableServers = get_servers(ns, "executableOnly");
    const totalRamAvailable = executableServers.reduce((acc, server) => acc + ns.getServerMaxRam(server), 0);
    ns.print(`Total RAM Available: ${ns.formatNumber(totalRamAvailable)}`);

    calculateTargetServerPriorities(ns);
    const sortedServers = Array.from(serverPriorityMap.entries()).sort((a, b) => b[1] - a[1]);
    for (const [server, priority] of sortedServers) {
        const { weakenTime, hackThreads, growthThreads, weakenThreadsNeeded } = getServerHackStats(ns, server, true);
        const theoreticalBatchLimit = weakenTime / (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES);
        const ramNeededPerBatch = hackThreads * 1.7 + growthThreads * 1.75 + weakenThreadsNeeded * 1.75;
        const batchLimitByRam = ns.formatNumber(totalRamAvailable / ramNeededPerBatch);

        ns.print(
            `${server.padEnd(20)}: ${ns.formatNumber(priority).padStart(10)} ${ns.formatNumber(ramNeededPerBatch).padStart(9)}G ${batchLimitByRam.padStart(8)} / ${ns.formatNumber(theoreticalBatchLimit).padEnd(8)} ${(weakenTime / 1000).toFixed(2)}s`,
        );
    }

    // if (currentMoney < maxMoney * PREP_MONEY_THRESHOLD || securityLevel > minSecurityLevel + SECURITY_LEVEL_THRESHOLD) {
    //     prepServer(ns, target);

    //     ns.sleep(10000);
    // } else {
    //     ns.print(`Server is already prepped, skipping prep`);
    // }

    // scheduleBatchHackCycles(ns, target, 10);

    return;
}

/**
 * Calculates the hack stats given current security, hacking to hackingPercentage, and growing back to 100% money.
 * @param {NS} ns
 * @param {string} server
 * @param {boolean} useFormulas - If true, use formulas API with optimal server conditions (min security, max money)
 * @returns {Object} - Object containing hack stats
 */
function getServerHackStats(ns, server, useFormulas = false) {
    const cpuCores = 1;

    const serverInfo = ns.getServer(server);
    const securityLevel = serverInfo.hackDifficulty;
    const minSecurityLevel = serverInfo.minDifficulty;
    const currentMoney = serverInfo.moneyAvailable;
    const maxMoney = serverInfo.moneyMax;

    let calcServer, player;

    if (useFormulas) {
        // Create optimal server state for formulas API calculations
        calcServer = {
            ...serverInfo,
            hackDifficulty: serverInfo.minDifficulty,
            moneyAvailable: serverInfo.moneyMax,
        };
        player = ns.getPlayer();
    }

    const weakenAmount = ns.weakenAnalyze(1, cpuCores);

    let weakenTime, growthTime, hackTime, hackChance, hackPercentageFromOneThread, growthFactor;

    if (useFormulas) {
        // Use formulas API with optimal server conditions
        weakenTime = ns.formulas.hacking.weakenTime(calcServer, player);
        growthTime = ns.formulas.hacking.growTime(calcServer, player);
        hackTime = ns.formulas.hacking.hackTime(calcServer, player);
        hackChance = ns.formulas.hacking.hackChance(calcServer, player);
        hackPercentageFromOneThread = ns.formulas.hacking.hackPercent(calcServer, player);
        growthFactor = ns.getServerGrowth(server); // No formulas equivalent
    } else {
        // Use existing ns functions with current server state
        weakenTime = ns.getWeakenTime(server);
        growthTime = ns.getGrowTime(server);
        hackTime = ns.getHackTime(server);
        hackChance = ns.hackAnalyzeChance(server);
        hackPercentageFromOneThread = ns.hackAnalyze(server);
        growthFactor = ns.getServerGrowth(server);
    }

    const hackThreads = Math.ceil(hackPercentage / hackPercentageFromOneThread);
    const hackSecurityChange = ns.hackAnalyzeSecurity(hackThreads, server);

    let growthThreads;
    if (useFormulas) {
        // Use formulas API to calculate threads needed to grow from hackPercentage back to 100%
        const targetMoney = maxMoney;
        const currentMoneyAfterHack = maxMoney * (1 - hackPercentage);
        growthThreads = Math.ceil(
            ns.formulas.hacking.growThreads(
                { ...calcServer, moneyAvailable: currentMoneyAfterHack },
                player,
                targetMoney,
                cpuCores,
            ),
        );
    } else {
        growthThreads = Math.ceil(ns.growthAnalyze(server, 1 / hackPercentage, cpuCores));
    }

    const growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, server, cpuCores);

    const weakenTarget = hackSecurityChange + growthSecurityChange;
    const weakenThreadsNeeded = Math.ceil(weakenTarget / weakenAmount);

    return {
        securityLevel,
        minSecurityLevel,
        currentMoney,
        maxMoney,
        hackChance,
        hackPercentageFromOneThread,
        hackThreads,
        hackSecurityChange,
        hackTime,
        weakenTime,
        weakenThreadsNeeded,
        growthThreads,
        growthSecurityChange,
        growthFactor,
        weakenAmount,
        growthTime,
    };
}

/**
 * Calculates the priority of each server based on the money and security level.
 * @param {NS} ns - The Netscript API.
 * @returns {void}
 */
function calculateTargetServerPriorities(ns) {
    const servers = get_servers(ns, "hackableOnly");
    for (const server of servers) {
        const serverInfo = ns.getServer(server);
        const maxMoney = serverInfo.moneyMax;

        const { hackChance, hackThreads, growthThreads, weakenThreadsNeeded, weakenTime } = getServerHackStats(
            ns,
            server,
            true, // Set to true to use formulas API with optimal conditions
        );

        var profitPerRam =
            (hackPercentage * maxMoney * hackChance) / (hackThreads + growthThreads + weakenThreadsNeeded);

        serverPriorityMap.set(server, profitPerRam);
    }
}

/**
 * Gets all servers that are accessible to the player.
 * @param {NS} ns - The Netscript API.
 * @param {"hackableOnly" | "executableOnly" | "all"} getServerOptions - Whether to include all servers or just the ones that are accessible.
 * @returns {string[]} - List of server names.
 */
function get_servers(ns, getServerOptions) {
    /*
	Scans and iterates through all servers.
	If all is false, only servers with root access and have money are returned.
	*/
    var servers = ["home"];
    var result = [];

    const isHackable = (server) => {
        if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) return false;
        if (ns.getServerMaxMoney(server) === 0) return false;
        return true;
    };

    const isExecutable = (server) => {
        if (!ns.hasRootAccess(server)) return false;
        return true;
    };

    var i = 0;
    while (i < servers.length) {
        var server = servers[i];
        var s = ns.scan(server);
        for (var j in s) {
            var con = s[j];
            if (servers.indexOf(con) < 0) {
                servers.push(con);
                if (getServerOptions === "all") {
                    result.push(con);
                    continue;
                }
                if (getServerOptions === "hackableOnly" && isHackable(con)) {
                    result.push(con);
                    continue;
                }
                if (getServerOptions === "executableOnly" && isExecutable(con)) {
                    result.push(con);
                }
            }
        }
        i += 1;
    }
    return result;
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
    const needsInitialWeaken = securityLevel > minSecurityLevel + SECURITY_LEVEL_THRESHOLD;
    const needsGrow = currentMoney < maxMoney * PREP_MONEY_THRESHOLD;

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

    if (needsGrow) {
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
}

function scheduleBatchHackCycles(ns, target, cycles) {
    for (let i = 0; i < cycles; i++) {
        ns.print(`+++++ Batch ${i + 1} +++++`);
        runBatchHack(ns, target, (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES) * i);
    }
}

/**
 * Runs a batch of 3 scripts, weaken, grow, weaken.
 * Hack to a predetermined percentage of max money, grow back to 100% money, and then weaken to min security level. Offset the timing so that hack finishes just slightly before grow, and grow finishes just slightly before weaken.
 * Scripts should finish within SCRIPT_DELAY ms of each other.
 * @param {NS} ns - The Netscript API.
 * @param {string} target - The target server to hack.
 * @param {number} extraDelay - Extra delay to add to the scripts.
 * @returns {void}
 */
function runBatchHack(ns, target, extraDelay) {
    const cpuCores = 1; // TODO: - Add way to optimize cpuCores

    const serverInfo = ns.getServer(target);
    const maxMoney = serverInfo.moneyMax;

    const weakenAmount = ns.weakenAnalyze(1, cpuCores);
    const weakenTime = ns.getWeakenTime(target);
    const growthTime = ns.getGrowTime(target);

    const hackChance = ns.hackAnalyzeChance(target);
    const hackPercentageFromOneThread = ns.hackAnalyze(target);
    const hackThreads = Math.ceil(hackPercentage / hackPercentageFromOneThread);
    const hackSecurityChange = ns.hackAnalyzeSecurity(hackThreads, target);
    const hackTime = ns.getHackTime(target);

    const growthThreads = Math.ceil(ns.growthAnalyze(target, 1 / hackPercentage, cpuCores));
    const growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores);
    const growthFactor = ns.getServerGrowth(target);

    const weakenTarget = hackSecurityChange + growthSecurityChange;
    const weakenThreadsNeeded = Math.ceil(weakenTarget / weakenAmount);

    ns.print(`=== Hacking 50% of max money ===`);
    ns.print(`Hack Chance: ${hackChance}`);
    ns.print(`Hack Percentage From One Thread: ${hackPercentageFromOneThread}`);
    ns.print(`Hack Amount: ${hackPercentage * maxMoney}`);
    ns.print(`Hack Threads: ${hackThreads}`);
    ns.print(`Hack Security Change: ${hackSecurityChange}`);
    ns.print(`Hack Time: ${hackTime}ms`);
    executeHack(ns, "home", target, hackThreads, weakenTime - hackTime - SCRIPT_DELAY * 2 + extraDelay, false);

    ns.print(`=== Growing 2X back to 100% ===`);
    ns.print(`Growth Threads: ${growthThreads}`);
    ns.print(`Growth Security Change: ${growthSecurityChange}`);
    ns.print(`Growth Time: ${growthTime}ms`);
    ns.print(`Growth Factor: ${growthFactor}`);
    executeGrow(ns, "home", target, growthThreads, weakenTime - growthTime - SCRIPT_DELAY + extraDelay, true);

    ns.print(`=== Weakening to min security level ===`);
    ns.print(`Weaken Target: ${weakenTarget}`);
    ns.print(`Weaken Threads Needed: ${weakenThreadsNeeded}`);
    ns.print(`Weaken Amount: ${weakenAmount}`);
    ns.print(`Weaken Time: ${weakenTime}ms`);
    executeWeaken(ns, "home", target, weakenThreadsNeeded, extraDelay);
}

/**
 * Executes the weaken script on the target server.
 * @param {NS} ns - The Netscript API.
 * @param {string} host
 * @param {string} target
 * @param {number} threads
 * @param {number} sleepTime
 */
function executeWeaken(ns, host, target, threads, sleepTime) {
    if (sleepTime < 0) {
        ns.print(`WARN Sleep time is negative for weaken script on ${target}`);
    }
    const pid = ns.exec(weakenScript, host, threads, target, sleepTime);
    if (!pid) {
        ns.tprint(`WARN Failed to execute weaken script on ${target}`);
    } else {
        ns.print(`SUCCESS Weakened ${target} with ${threads} threads`);
    }
}

/**
 * Executes the grow script on the target server.
 * @param {NS} ns - The Netscript API.
 * @param {string} host
 * @param {string} target
 * @param {number} threads
 * @param {number} sleepTime
 * @param {boolean} stockArg - Whether to influence stock or not.
 */
function executeGrow(ns, host, target, threads, sleepTime, stockArg) {
    if (sleepTime < 0) {
        ns.print(`WARN Sleep time is negative for grow script on ${target}`);
    }
    const pid = ns.exec(growScript, host, threads, target, sleepTime, stockArg);
    if (!pid) {
        ns.tprint(`WARN Failed to execute grow script on ${target}`);
    } else {
        ns.print(`SUCCESS Grew ${target} with ${threads} threads`);
    }
}

/**
 * Executes the hack script on the target server.
 * @param {NS} ns - The Netscript API.
 * @param {string} host
 * @param {string} target
 * @param {number} threads
 * @param {number} sleepTime
 * @param {boolean} stockArg - Whether to influence stock or not.
 */
function executeHack(ns, host, target, threads, sleepTime, stockArg) {
    if (sleepTime < 0) {
        ns.print(`WARN Sleep time is negative for hack script on ${target}`);
    }
    const pid = ns.exec(hackScript, host, threads, target, sleepTime);
    if (!pid) {
        ns.tprint(`WARN Failed to execute hack script on ${target}`);
    } else {
        ns.print(`SUCCESS Hacked ${target} with ${threads} threads`);
    }
}
