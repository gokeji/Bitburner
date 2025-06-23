import { NS } from "@ns";

const hackScript = "/kamu/hack.js";
const growScript = "/kamu/grow.js";
const weakenScript = "/kamu/weaken.js";

const HACK_SCRIPT_RAM_USAGE = 1.7;
const GROW_SCRIPT_RAM_USAGE = 1.75;
const WEAKEN_SCRIPT_RAM_USAGE = 1.75;

var hackPercentage = 0.5;
const SCRIPT_DELAY = 20; // ms delay between scripts
const DELAY_BETWEEN_BATCHES = 20; // ms delay between batches
const HOME_SERVER_RESERVED_RAM = 30; // GB reserved for home server

let PREP_MONEY_THRESHOLD = 1.0; // Prep servers until it's at least this much money
let SECURITY_LEVEL_THRESHOLD = 0; // Prep servers to be within minSecurityLevel + this amount

var executableServers = [];
var hackableServers = [];
var ignoreServers = ["b-05"];

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    // // Overview of all servers and their throughput
    // const { prioritiesMap, highestThroughputServer } = calculateTargetServerPriorities(ns, getTotalAvailableRam(ns));
    // const sortedServers = Array.from(prioritiesMap.entries()).sort((a, b) => b[1].priority - a[1].priority);
    // for (const [server, stats] of sortedServers) {
    //     ns.print(
    //         `${server.padEnd(20)}: ${ns.formatRam(stats.ramNeededPerBatch).padStart(9)} ${`$${ns.formatNumber(stats.throughput)}/s`.padStart(12)} ${ns.formatNumber(stats.actualBatchLimit).padStart(8)}/${ns.formatNumber(stats.theoreticalBatchLimit).padStart(8)} ${convertMsToTime(stats.weakenTime).padStart(6)}`,
    //     );
    // }

    // Main loop
    while (true) {
        // Get all servers
        executableServers = getServers(ns, "executableOnly");
        hackableServers = getServers(ns, "hackableOnly");

        // Get the total amount of RAM available
        const totalRamAvailable = getTotalAvailableRam(ns);
        ns.print(`Total RAM Available: ${ns.formatRam(totalRamAvailable)}`);

        const { prioritiesMap, highestThroughputServer } = calculateTargetServerPriorities(
            ns,
            getTotalAvailableRam(ns),
        );

        // Send throughput data to port 4 for get_stats.js
        var throughputPortHandle = ns.getPortHandle(4);
        throughputPortHandle.clear(); // Clear old data
        for (let [server, stats] of prioritiesMap.entries()) {
            throughputPortHandle.write(JSON.stringify({ server: server, throughput: stats.throughput }));
        }

        // Start allocating batches to servers until we run out of RAM
        var totalRamUsed = 0;

        while (totalRamUsed < totalRamAvailable) {
            // Find the server with the highest priority that has enough RAM available
            const { prioritiesMap, highestThroughputServer } = calculateTargetServerPriorities(
                ns,
                totalRamAvailable - totalRamUsed,
            );

            const serverInfo = ns.getServer(highestThroughputServer);
            const securityLevel = serverInfo.hackDifficulty;
            const minSecurityLevel = serverInfo.minDifficulty;
            const currentMoney = serverInfo.moneyAvailable;
            const maxMoney = serverInfo.moneyMax;

            if (
                currentMoney < maxMoney * PREP_MONEY_THRESHOLD ||
                securityLevel > minSecurityLevel + SECURITY_LEVEL_THRESHOLD
            ) {
                totalRamUsed += prepServer(ns, highestThroughputServer);
                continue;
            } else {
                ns.print(`Server is already prepped, skipping prep`);
            }

            // Schedule a batch of hacks
            scheduleBatchHackCycles(
                ns,
                highestThroughputServer,
                prioritiesMap.get(highestThroughputServer).actualBatchLimit,
            );

            totalRamUsed += prioritiesMap.get(highestThroughputServer).ramNeededPerBatch;
        }

        ns.sleep(1000);
    }
}

function convertMsToTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
 * Gets the total available RAM across all executable servers.
 * @param {NS} ns - The Netscript API.
 * @returns {number} - Total available RAM in GB.
 */
function getTotalAvailableRam(ns) {
    return (
        executableServers.reduce((acc, server) => {
            if (ignoreServers.includes(server)) {
                return acc;
            }
            const serverInfo = ns.getServer(server);
            return acc + serverInfo.maxRam - serverInfo.ramUsed;
        }, 0) - HOME_SERVER_RESERVED_RAM
    );
}

/**
 * Calculates the priority of each server based on throughput (money per second).
 * @param {NS} ns - The Netscript API.
 * @param {number} availableRam - The amount of RAM available for allocation.
 * @param {string[]} excludeServers - Array of server names to exclude from calculations.
 * @returns {{prioritiesMap: Map<string, {priority: number, ramNeededPerBatch: number, throughput: number, weakenTime: number, hackThreads: number, growthThreads: number, weakenThreadsNeeded: number, hackChance: number}>, highestThroughputServer: string}}
 */
function calculateTargetServerPriorities(ns, availableRam, excludeServers = []) {
    ns.print(`Available RAM for allocation: ${ns.formatRam(availableRam)}`);

    const servers = hackableServers.filter((server) => !excludeServers.includes(server));
    const prioritiesMap = new Map();
    var highestThroughputServer = null;

    for (const server of servers) {
        const serverInfo = ns.getServer(server);
        const maxMoney = serverInfo.moneyMax;

        const { hackChance, hackThreads, growthThreads, weakenThreadsNeeded, weakenTime } = getServerHackStats(
            ns,
            server,
            true, // Set to true to use formulas API with optimal conditions
        );

        const theoreticalBatchLimit = weakenTime / (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES);
        const ramNeededPerBatch =
            hackThreads * HACK_SCRIPT_RAM_USAGE +
            growthThreads * GROW_SCRIPT_RAM_USAGE +
            weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;

        // Calculate actual throughput (money per second)
        const moneyPerBatch = hackPercentage * maxMoney * hackChance;
        const actualBatchLimit = Math.min(availableRam / ramNeededPerBatch, theoreticalBatchLimit);
        const throughput = (actualBatchLimit * moneyPerBatch) / (weakenTime / 1000); // money per second

        prioritiesMap.set(server, {
            priority: throughput,
            ramNeededPerBatch: ramNeededPerBatch,
            throughput: throughput,
            weakenTime: weakenTime,
            hackThreads: hackThreads,
            growthThreads: growthThreads,
            weakenThreadsNeeded: weakenThreadsNeeded,
            hackChance: hackChance,
            actualBatchLimit: actualBatchLimit,
            theoreticalBatchLimit: theoreticalBatchLimit,
        });

        if (highestThroughputServer === null || throughput > highestThroughputServer.throughput) {
            highestThroughputServer = server;
        }
    }

    return { prioritiesMap, highestThroughputServer };
}

/**
 * Gets all servers that are accessible to the player.
 * @param {NS} ns - The Netscript API.
 * @param {"hackableOnly" | "executableOnly" | "all"} getServerOptions - Whether to include all servers or just the ones that are accessible.
 * @returns {string[]} - List of server names.
 */
function getServers(ns, getServerOptions) {
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

    // Move home server to end of list so leftover free RAM can be used for "home" server
    result.push(result.shift());
    return result;
}

/**
 * Prepares the target server for hacking, get it to the min security level and grow it to max money.
 * Do a WGW batch of 3 scripts, weaken, grow, weaken.
 * Or if already at min security level, just do GW batch of 2 scripts, grow, weaken.
 * @param {NS} ns - The Netscript API.
 * @param {string} target - The target server to prep.
 * @returns {number} - Total RAM used to prep the server.
 */
function prepServer(ns, target) {
    // TODO: - Add way to optimize cpuCores
    const cpuCores = 1;

    var totalRamUsed = 0;

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
        // ns.print(`=== Weaken to min security level ===`);
        // ns.print(`Weaken Target: ${minSecurityLevel}`);
        // ns.print(`Weaken Amount: ${weakenAmount}`);
        // ns.print(`Weaken Threads Needed: ${Math.ceil((securityLevel - minSecurityLevel) / weakenAmount)}`);
        // ns.print(`Weaken Time: ${weakenTime}ms`);
        const weakenThreadsNeeded = Math.ceil((securityLevel - minSecurityLevel) / weakenAmount);
        executeWeaken(ns, "home", target, weakenThreadsNeeded, 0);
        totalRamUsed += weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;
    } else {
        ns.print(`=== Server already at min security level, skipping initial weaken ===`);
    }

    if (needsGrow) {
        // ns.print(`=== Grow to max money ===`);
        const growthAmount = maxMoney / currentMoney;
        const growthThreads = Math.ceil(ns.growthAnalyze(target, growthAmount, cpuCores));
        const growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores);
        // ns.print(`Grow Amount: ${growthAmount}`);
        // ns.print(`Grow Threads Needed: ${growthThreads}`);
        // ns.print(`Grow Time: ${growthTime}ms`);

        // Adjust timing based on whether initial weaken was needed
        const growDelay = needsInitialWeaken ? weakenTime - growthTime + SCRIPT_DELAY : 0;
        executeGrow(ns, "home", target, growthThreads, growDelay);
        totalRamUsed += growthThreads * GROW_SCRIPT_RAM_USAGE;
        // ns.print(`=== Weaken to min security level again after growing ===`);
        const weakenThreadsNeeded = Math.ceil(growthSecurityChange / weakenAmount);
        // ns.print(`Weaken Threads Needed: ${weakenThreadsNeeded}`);
        // ns.print(`Weaken Time: ${weakenTime}ms`);

        // Adjust timing based on whether initial weaken was needed (2 scripts vs 3)
        const finalWeakenDelay = needsInitialWeaken ? 2 * SCRIPT_DELAY : SCRIPT_DELAY - (weakenTime - growthTime);
        executeWeaken(ns, "home", target, weakenThreadsNeeded, finalWeakenDelay);
        totalRamUsed += weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;
    }

    ns.print(`Total RAM Used to prep ${target}: ${ns.formatRam(totalRamUsed)}`);
    return totalRamUsed;
}

function scheduleBatchHackCycles(ns, target, batches) {
    for (let i = 0; i < batches; i++) {
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
    const hackHost = findExecutableServerWithAvailableRam(ns, hackThreads * HACK_SCRIPT_RAM_USAGE);
    executeHack(ns, hackHost, target, hackThreads, weakenTime - hackTime - SCRIPT_DELAY * 2 + extraDelay, false);

    ns.print(`=== Growing 2X back to 100% ===`);
    ns.print(`Growth Threads: ${growthThreads}`);
    ns.print(`Growth Security Change: ${growthSecurityChange}`);
    ns.print(`Growth Time: ${growthTime}ms`);
    ns.print(`Growth Factor: ${growthFactor}`);
    const growHost = findExecutableServerWithAvailableRam(ns, growthThreads * GROW_SCRIPT_RAM_USAGE);
    executeGrow(ns, growHost, target, growthThreads, weakenTime - growthTime - SCRIPT_DELAY + extraDelay, true);

    ns.print(`=== Weakening to min security level ===`);
    ns.print(`Weaken Target: ${weakenTarget}`);
    ns.print(`Weaken Threads Needed: ${weakenThreadsNeeded}`);
    ns.print(`Weaken Amount: ${weakenAmount}`);
    ns.print(`Weaken Time: ${weakenTime}ms`);
    const weakenHost = findExecutableServerWithAvailableRam(ns, weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE);
    executeWeaken(ns, weakenHost, target, weakenThreadsNeeded, extraDelay);
}

/**
 * Finds an executable server with enough available RAM to run a script.
 * @param {NS} ns - The Netscript API.
 * @param {number} ramNeeded - The amount of RAM needed to run the script.
 * @returns {string} - The name of the server with enough available RAM.
 */
function findExecutableServerWithAvailableRam(ns, ramNeeded) {
    for (const server of executableServers) {
        if (ignoreServers.includes(server)) {
            continue;
        }
        const serverInfo = ns.getServer(server);
        if (serverInfo.maxRam - serverInfo.ramUsed >= ramNeeded) {
            return server;
        }
    }
    return null;
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
