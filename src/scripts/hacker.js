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
const TICK_DELAY = 2000; // ms delay between ticks
const MAX_BATCHES_PER_TICK = Math.floor(TICK_DELAY / (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES)); // max batches to schedule per tick

const HOME_SERVER_RESERVED_RAM = 30; // GB reserved for home server

let PREP_MONEY_THRESHOLD = 1.0; // Prep servers until it's at least this much money
let SECURITY_LEVEL_THRESHOLD = 0; // Prep servers to be within minSecurityLevel + this amount

var executableServers = [];
var hackableServers = [];
var ignoreServers = ["b-05"];

/**
 * Global server RAM tracking
 * @type {Map<string, number>}
 */
var serverRamCache = new Map();

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    // Main loop
    let tickCounter = 0;
    while (true) {
        tickCounter++;

        // Clear terminal and start new tick
        ns.print(`\n=== Tick ${tickCounter} ===`);

        // Get all servers
        executableServers = getServers(ns, "executableOnly");
        hackableServers = getServers(ns, "hackableOnly");

        // Get the total amount of RAM available
        const totalRamAvailable = getTotalAvailableRam(ns);
        ns.print(`Total RAM Available: ${ns.formatRam(totalRamAvailable)}`);

        const { prioritiesMap } = calculateTargetServerPriorities(ns);

        // Send throughput data to port 4 for get_stats.js
        var throughputPortHandle = ns.getPortHandle(4);
        throughputPortHandle.clear(); // Clear old data
        for (let [server, stats] of prioritiesMap.entries()) {
            throughputPortHandle.write(JSON.stringify({ server: server, profit: stats.throughput }));
        }

        // Start allocating batches to servers until we run out of RAM
        var totalRamUsed = 0;
        let serverIndex = 1;
        const processedServers = []; // Track servers already processed this tick

        while (totalRamUsed < totalRamAvailable && serverIndex <= prioritiesMap.size) {
            // Find the server with the highest priority that has enough RAM available
            // Exclude servers that have already been processed this tick
            const { prioritiesMap: currentPriorities, highestThroughputServer } = calculateTargetServerPriorities(
                ns,
                processedServers,
            );

            // Skip servers that are already being targeted
            const isServerAlreadyTargeted = isServerBeingTargeted(ns, highestThroughputServer);

            const serverStats = currentPriorities.get(highestThroughputServer);
            if (!serverStats) {
                break; // No viable servers left
            }

            const serverInfo = ns.getServer(highestThroughputServer);
            const securityLevel = serverInfo.hackDifficulty;
            const minSecurityLevel = serverInfo.minDifficulty;
            const currentMoney = serverInfo.moneyAvailable;
            const maxMoney = serverInfo.moneyMax;

            if (
                currentMoney < maxMoney * PREP_MONEY_THRESHOLD ||
                securityLevel > minSecurityLevel + SECURITY_LEVEL_THRESHOLD
            ) {
                if (isServerAlreadyTargeted) {
                    processedServers.push(highestThroughputServer);
                    continue;
                }

                const prepRamUsed = prepServer(ns, highestThroughputServer, serverIndex);
                if (prepRamUsed === false) {
                    break; // Exit the inner loop and wait for next cycle
                } else {
                    serverIndex++;
                }
                totalRamUsed += prepRamUsed;
                processedServers.push(highestThroughputServer); // Add to processed list
                continue;
            }

            // Schedule all available batches for the highest priority server
            const ramUsedForBatches = scheduleBatchHackCycles(
                ns,
                highestThroughputServer,
                Math.min(serverStats.actualBatchLimit, MAX_BATCHES_PER_TICK),
                serverIndex,
                serverStats,
            );

            // Ensure we made progress to avoid infinite loop
            if (ramUsedForBatches <= 0) {
                break;
            } else {
                serverIndex++;
            }

            totalRamUsed += ramUsedForBatches;
            processedServers.push(highestThroughputServer); // Add to processed list
        }

        if (serverIndex === 1) {
            ns.print("No servers could be processed this tick");
        }

        await ns.sleep(1000);
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
 * Updates the global server RAM cache on every call.
 * @param {NS} ns - The Netscript API.
 * @returns {number} - Total available RAM in GB.
 */
function getTotalAvailableRam(ns) {
    // Calculate total from the cache
    let totalRam = 0;
    serverRamCache.clear();

    // Initialize available RAM for each server
    for (const server of executableServers) {
        if (ignoreServers.includes(server)) {
            continue;
        }
        const serverInfo = ns.getServer(server);
        const availableRam = serverInfo.maxRam - serverInfo.ramUsed;
        if (availableRam > 0) {
            serverRamCache.set(server, availableRam);
            totalRam += availableRam;
        }
    }

    return totalRam - HOME_SERVER_RESERVED_RAM;
}

/**
 * Checks if a server is already being targeted by running scripts (either prep or HGW batches).
 * @param {NS} ns - The Netscript API.
 * @param {string} target - The target server to check.
 * @returns {boolean} - True if the server is already being targeted, false otherwise.
 */
function isServerBeingTargeted(ns, target) {
    // Check all executable servers for running scripts targeting this server
    for (const server of executableServers) {
        const runningScripts = ns.ps(server);

        for (const script of runningScripts) {
            // Check if any of our hack/grow/weaken scripts are running with this target
            // Use more specific matching to avoid false positives
            if (
                (script.filename === hackScript ||
                    script.filename === growScript ||
                    script.filename === weakenScript ||
                    script.filename === "kamu/hack.js" ||
                    script.filename === "kamu/grow.js" ||
                    script.filename === "kamu/weaken.js") &&
                script.args.length > 0 &&
                script.args[0] === target
            ) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Calculates the priority of each server based on throughput (money per second).
 * @param {NS} ns - The Netscript API.
 * @param {number} availableRam - The amount of RAM available for allocation.
 * @param {string[]} excludeServers - Array of server names to exclude from calculations.
 * @returns {{prioritiesMap: Map<string, {priority: number, ramNeededPerBatch: number, throughput: number, weakenTime: number, hackThreads: number, growthThreads: number, weakenThreadsNeeded: number, hackChance: number}>, highestThroughputServer: string}}
 */
function calculateTargetServerPriorities(ns, excludeServers = []) {
    const maxRamAvailable = executableServers.reduce((acc, server) => acc + ns.getServerMaxRam(server), 0);
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
        const actualBatchLimit = Math.min(maxRamAvailable / ramNeededPerBatch, theoreticalBatchLimit);
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

        if (highestThroughputServer === null || throughput > prioritiesMap.get(highestThroughputServer).throughput) {
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
 * Finds executable servers with enough available RAM to run server prep operations.
 * @param {NS} ns - The Netscript API.
 * @param {number} weakenRamNeeded - RAM needed for weaken script.
 * @param {number} growRamNeeded - RAM needed for grow script (0 if not needed).
 * @param {number} finalWeakenRamNeeded - RAM needed for final weaken script (0 if not needed).
 * @returns {{weakenHost: string, growHost: string, finalWeakenHost: string} | false} - Host servers for each operation or false if not enough RAM.
 */
function findExecutableServersForServerPrep(ns, weakenRamNeeded, growRamNeeded, finalWeakenRamNeeded) {
    // Create a copy of server RAM availability to track allocations for this prep
    const serverRamAvailable = new Map(serverRamCache);

    // Try to allocate servers for weaken, grow, and final weaken
    let weakenHost = null;
    let growHost = null;
    let finalWeakenHost = null;

    // Find server for initial weaken (if needed)
    if (weakenRamNeeded > 0) {
        for (const [server, availableRam] of serverRamAvailable) {
            if (availableRam >= weakenRamNeeded) {
                weakenHost = server;
                serverRamAvailable.set(server, availableRam - weakenRamNeeded);
                break;
            }
        }

        if (!weakenHost) {
            return false;
        }
    }

    // Find server for grow (if needed)
    if (growRamNeeded > 0) {
        for (const [server, availableRam] of serverRamAvailable) {
            if (availableRam >= growRamNeeded) {
                growHost = server;
                serverRamAvailable.set(server, availableRam - growRamNeeded);
                break;
            }
        }

        if (!growHost) {
            return false;
        }
    }

    // Find server for final weaken (if needed)
    if (finalWeakenRamNeeded > 0) {
        for (const [server, availableRam] of serverRamAvailable) {
            if (availableRam >= finalWeakenRamNeeded) {
                finalWeakenHost = server;
                break;
            }
        }

        if (!finalWeakenHost) {
            return false;
        }
    }

    return {
        weakenHost: weakenHost,
        growHost: growHost,
        finalWeakenHost: finalWeakenHost,
    };
}

/**
 * Prepares the target server for hacking, get it to the min security level and grow it to max money.
 * Do a WGW batch of 3 scripts, weaken, grow, weaken.
 * Or if already at min security level, just do GW batch of 2 scripts, grow, weaken.
 * @param {NS} ns - The Netscript API.
 * @param {string} target - The target server to prep.
 * @returns {number | false} - Total RAM used to prep the server, or false if not enough RAM available.
 */
function prepServer(ns, target, serverIndex) {
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

    // Check if server is already at min security level
    const needsInitialWeaken = securityLevel > minSecurityLevel + SECURITY_LEVEL_THRESHOLD;
    const needsGrow = currentMoney < maxMoney * PREP_MONEY_THRESHOLD;

    // Calculate thread requirements
    const initialWeakenThreads = Math.ceil((securityLevel - minSecurityLevel) / weakenAmount);

    const growthAmount = maxMoney / currentMoney;
    const growthThreads = Math.ceil(ns.growthAnalyze(target, growthAmount, cpuCores));
    const growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores);
    const finalWeakenThreads = Math.ceil(growthSecurityChange / weakenAmount);

    // Calculate RAM requirements for prep operations
    const initialWeakenRam = initialWeakenThreads * WEAKEN_SCRIPT_RAM_USAGE;
    const growRam = growthThreads * GROW_SCRIPT_RAM_USAGE;
    const finalWeakenRam = finalWeakenThreads * WEAKEN_SCRIPT_RAM_USAGE;

    // Find servers for prep operations with proper RAM accounting
    const hosts = findExecutableServersForServerPrep(ns, initialWeakenRam, growRam, finalWeakenRam);

    if (!hosts) {
        return false;
    }

    // Display prep information
    const prepOperations = [];
    if (needsInitialWeaken) prepOperations.push(`${initialWeakenThreads}W`);
    if (needsGrow) prepOperations.push(`${growthThreads}G`);
    if (needsGrow) prepOperations.push(`${finalWeakenThreads}W`);

    const totalPrepRam = initialWeakenRam + growRam + finalWeakenRam;
    ns.print(`${serverIndex}. ${target}: PREP ${ns.formatRam(totalPrepRam)} for ${prepOperations.join(" + ")}`);

    // Update the server RAM cache to reflect the RAM that will be used
    if (initialWeakenRam > 0) {
        serverRamCache.set(hosts.weakenHost, serverRamCache.get(hosts.weakenHost) - initialWeakenRam);
    }
    if (growRam > 0) {
        serverRamCache.set(hosts.growHost, serverRamCache.get(hosts.growHost) - growRam);
    }
    if (finalWeakenRam > 0) {
        serverRamCache.set(hosts.finalWeakenHost, serverRamCache.get(hosts.finalWeakenHost) - finalWeakenRam);
    }

    var totalRamUsed = 0;

    if (needsInitialWeaken) {
        executeWeaken(ns, hosts.weakenHost, target, initialWeakenThreads, 0);
        totalRamUsed += initialWeakenRam;
    }

    if (needsGrow) {
        // Adjust timing based on whether initial weaken was needed
        const growDelay = needsInitialWeaken ? weakenTime - growthTime + SCRIPT_DELAY : 0;
        executeGrow(ns, hosts.growHost, target, growthThreads, growDelay);
        totalRamUsed += growRam;

        // Adjust timing based on whether initial weaken was needed (2 scripts vs 3)
        const finalWeakenDelay = needsInitialWeaken ? 2 * SCRIPT_DELAY : SCRIPT_DELAY - (weakenTime - growthTime);
        executeWeaken(ns, hosts.finalWeakenHost, target, finalWeakenThreads, finalWeakenDelay);
        totalRamUsed += finalWeakenRam;
    }

    return totalRamUsed;
}

function scheduleBatchHackCycles(ns, target, batches, serverIndex, serverStats) {
    let totalRamUsed = 0;
    let successfulBatches = 0;

    // Ensure we only attempt whole batches to avoid floating point precision issues
    const totalBatches = Math.floor(batches);

    for (let i = 0; i < totalBatches; i++) {
        const batchResult = runBatchHack(ns, target, (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES) * i);
        if (!batchResult.success) {
            break;
        }
        totalRamUsed += batchResult.ramUsed;
        successfulBatches++;
    }

    // Display batch scheduling results
    if (successfulBatches > 0) {
        ns.print(
            `${serverIndex}. ${target}: HGW ${successfulBatches}/${totalBatches} batches, ${ns.formatRam(totalRamUsed)} (${serverStats.hackThreads}H ${serverStats.growthThreads}G ${serverStats.weakenThreadsNeeded}W per batch)`,
        );
    }

    return totalRamUsed;
}

/**
 * Runs a batch of 3 scripts, weaken, grow, weaken.
 * Hack to a predetermined percentage of max money, grow back to 100% money, and then weaken to min security level. Offset the timing so that hack finishes just slightly before grow, and grow finishes just slightly before weaken.
 * Scripts should finish within SCRIPT_DELAY ms of each other.
 * @param {NS} ns - The Netscript API.
 * @param {string} target - The target server to hack.
 * @param {number} extraDelay - Extra delay to add to the scripts.
 * @returns {{success: boolean, ramUsed: number}} - Success status and RAM used for this batch
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

    // Find servers for all three operations with proper RAM accounting
    const hosts = findExecutableServersForBatch(
        ns,
        hackThreads * HACK_SCRIPT_RAM_USAGE,
        growthThreads * GROW_SCRIPT_RAM_USAGE,
        weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE,
    );

    // If not enough RAM to run H G and W, return failure
    if (hosts) {
        // Update the server RAM cache to reflect the RAM that will be used
        const hackRamUsed = hackThreads * HACK_SCRIPT_RAM_USAGE;
        const growRamUsed = growthThreads * GROW_SCRIPT_RAM_USAGE;
        const weakenRamUsed = weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;
        const totalRamUsed = hackRamUsed + growRamUsed + weakenRamUsed;

        serverRamCache.set(hosts.hackHost, serverRamCache.get(hosts.hackHost) - hackRamUsed);
        serverRamCache.set(hosts.growHost, serverRamCache.get(hosts.growHost) - growRamUsed);
        serverRamCache.set(hosts.weakenHost, serverRamCache.get(hosts.weakenHost) - weakenRamUsed);

        executeHack(ns, hosts.hackHost, target, hackThreads, weakenTime - hackTime - SCRIPT_DELAY * 2 + extraDelay);
        executeGrow(ns, hosts.growHost, target, growthThreads, weakenTime - growthTime - SCRIPT_DELAY + extraDelay);
        executeWeaken(ns, hosts.weakenHost, target, weakenThreadsNeeded, extraDelay);
        return { success: true, ramUsed: totalRamUsed };
    } else {
        return { success: false, ramUsed: 0 }; // Not enough RAM to run H G and W
    }
}

/**
 * Finds executable servers with enough available RAM to run hack, grow, and weaken scripts.
 * Ensures RAM is properly accounted for across all three operations.
 * @param {NS} ns - The Netscript API.
 * @param {number} hackRamNeeded - RAM needed for hack script.
 * @param {number} growRamNeeded - RAM needed for grow script.
 * @param {number} weakenRamNeeded - RAM needed for weaken script.
 * @returns {{hackHost: string, growHost: string, weakenHost: string} | false} - Host servers for each operation or false if not enough RAM.
 */
function findExecutableServersForBatch(ns, hackRamNeeded, growRamNeeded, weakenRamNeeded) {
    // Create a copy of server RAM availability to track allocations for this batch
    const serverRamAvailable = new Map(serverRamCache);

    // Try to allocate servers for hack, grow, and weaken
    let hackHost = null;
    let growHost = null;
    let weakenHost = null;

    // Find server for hack
    for (const [server, availableRam] of serverRamAvailable) {
        if (availableRam >= hackRamNeeded) {
            hackHost = server;
            serverRamAvailable.set(server, availableRam - hackRamNeeded);
            break;
        }
    }

    if (!hackHost) {
        return false;
    }

    // Find server for grow
    for (const [server, availableRam] of serverRamAvailable) {
        if (availableRam >= growRamNeeded) {
            growHost = server;
            serverRamAvailable.set(server, availableRam - growRamNeeded);
            break;
        }
    }

    if (!growHost) {
        return false;
    }

    // Find server for weaken
    for (const [server, availableRam] of serverRamAvailable) {
        if (availableRam >= weakenRamNeeded) {
            weakenHost = server;
            break;
        }
    }

    if (!weakenHost) {
        return false;
    }

    return {
        hackHost: hackHost,
        growHost: growHost,
        weakenHost: weakenHost,
    };
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
    const pid = ns.exec(weakenScript, host, threads, target, sleepTime);
    if (!pid) {
        ns.tprint(`WARN Failed to execute weaken script on ${target}`);
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
function executeGrow(ns, host, target, threads, sleepTime, stockArg = false) {
    const pid = ns.exec(growScript, host, threads, target, sleepTime, stockArg);
    if (!pid) {
        ns.tprint(`WARN Failed to execute grow script on ${target}`);
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
function executeHack(ns, host, target, threads, sleepTime, stockArg = false) {
    const pid = ns.exec(hackScript, host, threads, target, sleepTime);
    if (!pid) {
        ns.tprint(`WARN Failed to execute hack script on ${target}`);
    }
}
