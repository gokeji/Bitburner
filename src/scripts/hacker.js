import { NS } from "@ns";

const hackScript = "/kamu/hack.js";
const growScript = "/kamu/grow.js";
const weakenScript = "/kamu/weaken.js";

// Backdoor script hooked in (requires singularity functions SF4.1)
const singularityFunctionsAvailable = true;
const backdoorScript = "/kamu/backdoor.js";

// Solve Contract Script hooked in
const solveContractsScript = "/kamu/solve-contracts.js";

const HACK_SCRIPT_RAM_USAGE = 1.7;
const GROW_SCRIPT_RAM_USAGE = 1.75;
const WEAKEN_SCRIPT_RAM_USAGE = 1.75;
const CORRECTIVE_GROW_WEAK_MULTIPLIER = 1.1; // Use extra grow and weak threads to correct for out of sync HGW batches

let hackPercentage = 0.9;
export const SCRIPT_DELAY = 100; // ms delay between scripts
const DELAY_BETWEEN_BATCHES = 100; // ms delay between batches
const TICK_DELAY = 5000; // ms delay between ticks
// Batch scheduling: Each batch takes (20*3 + 20) = 80ms to schedule
// In 2000ms tick, we can fit exactly 25 batches (2000/80 = 25)
// All 25 batches complete before next tick starts
const MAX_BATCHES_PER_TICK = Math.floor(TICK_DELAY / (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES)); // max batches to schedule per tick

const HOME_SERVER_RESERVED_RAM = 30; // GB reserved for home server

let PREP_MONEY_THRESHOLD = 1.0; // Prep servers until it's at least this much money
let SECURITY_LEVEL_THRESHOLD = 0; // Prep servers to be within minSecurityLevel + this amount

let executableServers = [];
let hackableServers = [];
let ignoreServers = [];

let tickCounter = 0;

// Global priorities map that persists across the scheduling loop
let globalPrioritiesMap = new Map();

// automatically backdoor these servers. Requires singularity functions.
let backdoorServers = new Set([
    "CSEC",
    "I.I.I.I",
    "avmnite-02h",
    "run4theh111z",
    "clarkinc",
    "nwo",
    "omnitek",
    "fulcrumtech",
    "fulcrumassets",
    "w0r1d_d43m0n",
]);

/**
 * Global server RAM tracking
 * @type {Map<string, number>}
 */
let serverRamCache = new Map();

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    if (ns.args.length > 0) {
        ignoreServers = ns.args;
    }

    // Main loop
    while (true) {
        tickCounter++;

        // Clear terminal and start new tick
        ns.print(`\n=== Tick ${tickCounter} ===`);

        // Get all servers
        executableServers = getServers(ns, "executableOnly");
        hackableServers = getServers(ns, "hackableOnly").filter((server) => {
            return !ignoreServers.includes(server);
        });

        // Run contract solving script each tick
        runSolveContractsScript(ns);

        // Copy scripts to all executable servers
        const scriptsToCopy = [hackScript, growScript, weakenScript];
        for (const server of executableServers) {
            if (server !== "home") {
                // Don't copy to home since scripts are already there
                ns.scp(scriptsToCopy, server, "home");
            }
        }

        // Get the total amount of RAM available
        const totalRamAvailable = getTotalAvailableRam(ns);
        ns.print(`Total RAM Available: ${ns.formatRam(totalRamAvailable)}`);

        // Calculate global priorities map once per tick (without excluding any servers)
        const { prioritiesMap } = calculateTargetServerPriorities(ns);
        globalPrioritiesMap = prioritiesMap; // Store globally for RAM reservation calculations

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

        while (totalRamUsed < totalRamAvailable && serverIndex <= globalPrioritiesMap.size) {
            // Find the server with the highest priority that has enough RAM available
            // Exclude servers that have already been processed this tick
            const { prioritiesMap: currentPriorities, highestThroughputServer } = calculateTargetServerPriorities(
                ns,
                processedServers,
            );

            // Skip servers that are already being targeted
            const { isTargeted, isPrep, isHgw } = isServerBeingTargeted(ns, highestThroughputServer);

            const serverStats = currentPriorities.get(highestThroughputServer);
            if (!serverStats) {
                break; // No viable servers left
            }

            const serverInfo = ns.getServer(highestThroughputServer);
            const securityLevel = serverInfo.hackDifficulty;
            const minSecurityLevel = serverInfo.minDifficulty;
            const currentMoney = serverInfo.moneyAvailable;
            const maxMoney = serverInfo.moneyMax;

            // Continue to next server if it's already being prepped
            if (isPrep) {
                processedServers.push(highestThroughputServer);
                continue;
            }

            // TODO: - Do not weaken if we need to reserve for higher priority servers
            if (
                (currentMoney < maxMoney * PREP_MONEY_THRESHOLD ||
                    securityLevel > minSecurityLevel + SECURITY_LEVEL_THRESHOLD) &&
                !isTargeted // Do not prep if it has HGW scripts running on it or prep scripts
            ) {
                const prepRamUsed = prepServer(ns, highestThroughputServer, serverIndex);
                if (prepRamUsed === false) {
                    break; // Exit the inner loop and wait for next cycle
                }
                serverIndex++;
                totalRamUsed += prepRamUsed;
                processedServers.push(highestThroughputServer); // Add to processed list
                continue;
            }

            // Calculate available RAM for this server after reserving for higher priority servers
            const availableRamForServer = calculateAvailableRamForServer(
                ns,
                highestThroughputServer,
                totalRamAvailable - totalRamUsed,
            );

            // Calculate maximum batches we can afford with available RAM
            const maxAffordableBatches = Math.floor(availableRamForServer / serverStats.ramNeededPerBatch);
            const batchesToSchedule = Math.min(
                serverStats.actualBatchLimit,
                MAX_BATCHES_PER_TICK,
                maxAffordableBatches,
            );

            // Schedule batches for the highest priority server
            const ramUsedForBatches = scheduleBatchHackCycles(
                ns,
                highestThroughputServer,
                batchesToSchedule,
                serverIndex,
                serverStats,
            );

            // Ensure we made progress to avoid infinite loop
            if (ramUsedForBatches <= 0) {
                break;
            }

            serverIndex++;
            totalRamUsed += ramUsedForBatches;
            processedServers.push(highestThroughputServer); // Add to processed list
        }

        if (serverIndex === 1) {
            ns.print("No servers could be processed this tick");
        }

        // XP farming: Use all remaining RAM for weaken scripts on joesguns
        xpFarm(ns);

        await ns.sleep(TICK_DELAY);
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
    const actualHackPercentage = hackThreads * hackPercentageFromOneThread; // Actual amount we'll hack
    const hackSecurityChange = hackThreads * 0.002; // Use known constant instead of ns.hackAnalyzeSecurity

    let growthThreads;
    if (useFormulas) {
        // Use formulas API to calculate threads needed to grow from ACTUAL hack amount back to 100%
        const targetMoney = maxMoney;
        const currentMoneyAfterHack = maxMoney * (1 - actualHackPercentage); // Use actual hack amount
        const currentSecurityAfterHack = minSecurityLevel + hackSecurityChange;
        growthThreads = Math.ceil(
            CORRECTIVE_GROW_WEAK_MULTIPLIER *
                ns.formulas.hacking.growThreads(
                    { ...calcServer, moneyAvailable: currentMoneyAfterHack, hackDifficulty: currentSecurityAfterHack },
                    player,
                    targetMoney,
                    cpuCores,
                ),
        );
    } else {
        // Use actual hack amount for grow calculation
        const growthMultiplier = 1 / (1 - actualHackPercentage);
        growthThreads = Math.ceil(ns.growthAnalyze(server, growthMultiplier, cpuCores));
    }

    // Calculate grow security change based on the number of threads
    // ns.growthAnalyzeSecurity() returns 0 for servers at optimal state, so use the known constant
    const growthSecurityChange = growthThreads * 0.004;

    const weakenTarget = hackSecurityChange + growthSecurityChange;
    const weakenThreadsNeeded = Math.ceil((CORRECTIVE_GROW_WEAK_MULTIPLIER * weakenTarget) / weakenAmount);

    return {
        securityLevel,
        minSecurityLevel,
        currentMoney,
        maxMoney,
        hackChance,
        hackPercentageFromOneThread,
        hackThreads,
        actualHackPercentage,
        hackTime,
        weakenTime,
        weakenThreadsNeeded,
        growthThreads,
        growthFactor,
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
 * @returns {{isTargeted: boolean, isPrep: boolean, isHgw: boolean}} - Object indicating if server is targeted and for what operations.
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
                if (script.args.includes("prep")) {
                    return { isTargeted: true, isPrep: true, isHgw: false };
                } else if (script.args.includes("hgw")) {
                    return { isTargeted: true, isPrep: false, isHgw: true };
                }
            }
        }
    }

    return { isTargeted: false, isPrep: false, isHgw: false };
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

        const {
            hackChance,
            hackThreads,
            growthThreads,
            weakenThreadsNeeded,
            weakenTime,
            hackTime,
            growthTime,
            actualHackPercentage,
        } = getServerHackStats(
            ns,
            server,
            true, // Set to true to use formulas API with optimal conditions
        );

        const theoreticalBatchLimit = weakenTime / (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES);
        const ramNeededPerBatch =
            hackThreads * HACK_SCRIPT_RAM_USAGE +
            growthThreads * GROW_SCRIPT_RAM_USAGE +
            weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;

        // Calculate actual throughput (money per second) using ACTUAL hack percentage
        const moneyPerBatch = actualHackPercentage * maxMoney * hackChance;
        const actualBatchLimit = Math.min(maxRamAvailable / ramNeededPerBatch, theoreticalBatchLimit);
        const throughput = (actualBatchLimit * moneyPerBatch) / (weakenTime / 1000); // money per second

        prioritiesMap.set(server, {
            priority: throughput,
            ramNeededPerBatch: ramNeededPerBatch,
            throughput: throughput,
            weakenTime: weakenTime,
            hackTime: hackTime,
            growthTime: growthTime,
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
 * Attempts to nuke a server if we don't have root access yet
 * @param {NS} ns - The Netscript API
 * @param {string} server - Server name to nuke
 */
function nukeServerIfNeeded(ns, server) {
    if (ns.hasRootAccess(server) || server.startsWith("hacknet-node") || ignoreServers.includes(server)) {
        return;
    }

    var portOpened = 0;
    if (ns.fileExists("BruteSSH.exe")) {
        ns.brutessh(server);
        portOpened++;
    }
    if (ns.fileExists("FTPCrack.exe")) {
        ns.ftpcrack(server);
        portOpened++;
    }
    if (ns.fileExists("HTTPWorm.exe")) {
        ns.httpworm(server);
        portOpened++;
    }
    if (ns.fileExists("relaySMTP.exe")) {
        ns.relaysmtp(server);
        portOpened++;
    }
    if (ns.fileExists("SQLInject.exe")) {
        ns.sqlinject(server);
        portOpened++;
    }
    if (ns.getServerNumPortsRequired(server) <= portOpened) {
        ns.nuke(server);
    }
}

/**
 * Attempts to backdoor a faction server if needed
 * @param {NS} ns - The Netscript API
 * @param {string} server - Server name to backdoor
 */
function backdoorIfNeeded(ns, server) {
    if (!singularityFunctionsAvailable || !backdoorServers.has(server) || !ns.hasRootAccess(server)) {
        return;
    }

    if (ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel()) {
        // Check if backdoor is already installed
        if (ns.getServer(server).backdoorInstalled) {
            backdoorServers.delete(server);
        } else if (!ns.isRunning(backdoorScript, "home", server)) {
            const backdoorSuccess = ns.exec(backdoorScript, "home", 1, server);
            if (backdoorSuccess) {
                ns.print("INFO: Started backdoor script for " + server);
            }
        }
    }
}

/**
 * Attempts to run the contract solving script if not already running
 * @param {NS} ns - The Netscript API
 */
function runSolveContractsScript(ns) {
    if (!ns.isRunning(solveContractsScript, "home")) {
        const contractSuccess = ns.exec(solveContractsScript, "home");
        if (!contractSuccess) {
            ns.print("WARN: Failed to start contract solving script");
        }
    }
}

/**
 * Gets all servers that are accessible to the player.
 * Also handles nuking servers, backdooring faction servers, and solving contracts.
 * @param {NS} ns - The Netscript API.
 * @param {"hackableOnly" | "executableOnly" | "all"} getServerOptions - Whether to include all servers or just the ones that are accessible.
 * @returns {string[]} - List of server names.
 */
function getServers(ns, getServerOptions) {
    /*
	Scans and iterates through all servers using BFS to avoid infinite loops.
	Returns servers based on the specified filter criteria.
	*/
    const discovered = new Set(["home"]); // Track all discovered servers
    const toScan = ["home"]; // Queue of servers to scan
    const result = [];

    const isHackable = (server) => {
        if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) return false;
        if (ns.getServerMaxMoney(server) === 0) return false;
        if (server === "home") return false;
        return true;
    };

    const isExecutable = (server) => {
        if (!ns.hasRootAccess(server)) return false;
        return true;
    };

    // BFS traversal of the server network
    while (toScan.length > 0) {
        const server = toScan.shift(); // Process next server in queue

        // Handle nuking and backdooring for the current server
        nukeServerIfNeeded(ns, server);
        backdoorIfNeeded(ns, server);

        if (getServerOptions === "all") {
            result.push(server);
        } else if (getServerOptions === "hackableOnly" && isHackable(server)) {
            result.push(server);
        } else if (getServerOptions === "executableOnly" && isExecutable(server)) {
            result.push(server);
        }

        // Scan for connected servers and add new ones to the queue
        const connectedServers = ns.scan(server);
        for (const connectedServer of connectedServers) {
            if (!discovered.has(connectedServer)) {
                discovered.add(connectedServer);
                toScan.push(connectedServer);
            }
        }
    }

    // Move home server to end of list so leftover free RAM can be used for "home" server
    const homeIndex = result.indexOf("home");
    if (homeIndex > -1) {
        const homeServer = result.splice(homeIndex, 1)[0];
        result.push(homeServer);
    }

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
    const growthSecurityChange = growthThreads * 0.004;
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
        executeWeaken(ns, hosts.weakenHost, target, initialWeakenThreads, 0, true, weakenTime);
        totalRamUsed += initialWeakenRam;
    }

    if (needsGrow) {
        // Adjust timing based on whether initial weaken was needed
        const growDelay = needsInitialWeaken ? weakenTime - growthTime - SCRIPT_DELAY : 0;
        executeGrow(ns, hosts.growHost, target, growthThreads, growDelay, false, true, growthTime);
        totalRamUsed += growRam;

        // Adjust timing based on whether initial weaken was needed (2 scripts vs 3)
        const finalWeakenDelay = needsInitialWeaken ? 2 * SCRIPT_DELAY : 0;
        executeWeaken(ns, hosts.finalWeakenHost, target, finalWeakenThreads, finalWeakenDelay, true, weakenTime);
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
        const batchResult = runBatchHack(ns, target, (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES) * i, serverStats);
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
 * @param {Object} serverStats - Pre-calculated server stats from prioritiesMap
 * @returns {{success: boolean, ramUsed: number}} - Success status and RAM used for this batch
 */
function runBatchHack(ns, target, extraDelay, serverStats) {
    // Use pre-calculated values from serverStats instead of recalculating
    const hackThreads = serverStats.hackThreads;
    const growthThreads = serverStats.growthThreads;
    const weakenThreadsNeeded = serverStats.weakenThreadsNeeded;

    // CRITICAL FIX: Use original timing calculations from serverStats
    // DO NOT recalculate timing as server security changes between batches
    const weakenTime = serverStats.weakenTime;
    const growthTime = serverStats.growthTime;
    const hackTime = serverStats.hackTime;

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

        const hackDelay = weakenTime + extraDelay - 2 * SCRIPT_DELAY - hackTime;
        const growDelay = weakenTime + extraDelay - SCRIPT_DELAY - growthTime;
        const weakenDelay = extraDelay;

        // Validate delays are not negative (which would cause timing issues)
        if (hackDelay < 0 || growDelay < 0 || weakenDelay < 0) {
            ns.print(`ERROR: Negative delays detected! H=${hackDelay}, G=${growDelay}, W=${weakenDelay}`);
            ns.print(
                `Times: hackTime=${hackTime}, growthTime=${growthTime}, weakenTime=${weakenTime}, extraDelay=${extraDelay}`,
            );
            return { success: false, ramUsed: 0 };
        }

        executeHack(ns, hosts.hackHost, target, hackThreads, hackDelay, false, false, hackTime);
        executeGrow(ns, hosts.growHost, target, growthThreads, growDelay, false, false, growthTime);
        executeWeaken(ns, hosts.weakenHost, target, weakenThreadsNeeded, weakenDelay, false, weakenTime);

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
 * @param {boolean} isPrep - Whether the script is being executed for prep.
 * @param {number} weakenTime - The time the weaken script should finish at.
 */
function executeWeaken(ns, host, target, threads, sleepTime, isPrep = false, weakenTime = 0) {
    const pid = ns.exec(
        weakenScript,
        host,
        threads,
        target,
        sleepTime,
        isPrep ? "prep" : "hgw",
        tickCounter,
        weakenTime,
    );
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
 * @param {boolean} isPrep - Whether the script is being executed for prep.
 * @param {number} growTime - The time the grow script should finish at.
 */
function executeGrow(ns, host, target, threads, sleepTime, stockArg = false, isPrep = false, growTime = 0) {
    const pid = ns.exec(
        growScript,
        host,
        threads,
        target,
        sleepTime,
        stockArg,
        isPrep ? "prep" : "hgw",
        tickCounter,
        growTime,
    );
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
 * @param {boolean} isPrep - Whether the script is being executed for prep.
 * @param {number} hackTime - The time the hack script should finish at.
 */
function executeHack(ns, host, target, threads, sleepTime, stockArg = false, isPrep = false, hackTime = 0) {
    const pid = ns.exec(
        hackScript,
        host,
        threads,
        target,
        sleepTime,
        stockArg,
        isPrep ? "prep" : "hgw",
        tickCounter,
        hackTime,
    );
    if (!pid) {
        ns.tprint(`WARN Failed to execute hack script on ${target}`);
    }
}

/**
 * Calculates how much RAM should be reserved for higher priority servers during the target server's batch cycle.
 * This ensures higher priority servers can maintain continuous batch streams without being starved by lower priority allocations.
 * @param {NS} ns - The Netscript API.
 * @param {string} targetServer - The server we're considering scheduling batches for.
 * @returns {number} - Total RAM that should be reserved for higher priority servers (in GB).
 */
function calculateReservedRam(ns, targetServer) {
    ns.print(`Calculating reserved RAM for ${targetServer}. GlobalPrioritiesMap: ${globalPrioritiesMap.size}`);
    const targetStats = globalPrioritiesMap.get(targetServer);
    if (!targetStats) {
        return 0;
    }

    // Calculate the reservation period (target server's cycle duration)
    const reservationPeriod = targetStats.weakenTime + TICK_DELAY; // ms
    const ticksInReservationPeriod = Math.ceil(reservationPeriod / TICK_DELAY);

    // Get all servers sorted by priority (throughput) descending
    const sortedServers = Array.from(globalPrioritiesMap.entries()).sort((a, b) => b[1].throughput - a[1].throughput);

    let totalReservedRam = 0;

    // For each higher priority server, calculate how much RAM they'll need
    for (const [serverName, serverStats] of sortedServers) {
        // Stop when we reach the target server (all remaining servers have lower priority)
        if (serverName === targetServer) {
            break;
        }

        // Skip reserving RAM for servers that are currently being prepped
        // They cannot have additional batches scheduled while prep is running
        const { isPrep } = isServerBeingTargeted(ns, serverName);
        if (isPrep) {
            continue;
        }

        // Calculate how many batches this higher priority server could want during the reservation period
        // Each tick, they can schedule up to MAX_BATCHES_PER_TICK or their actualBatchLimit, whichever is lower
        const maxBatchesPerTick = Math.min(serverStats.actualBatchLimit, MAX_BATCHES_PER_TICK);
        const totalBatchesWanted = maxBatchesPerTick * ticksInReservationPeriod;

        // Calculate RAM needed for these batches
        const ramForThisServer = totalBatchesWanted * serverStats.ramNeededPerBatch;
        totalReservedRam += ramForThisServer;
    }

    return totalReservedRam;
}

/**
 * Calculates how much RAM is available for the target server after reserving RAM for higher priority servers.
 * @param {NS} ns - The Netscript API.
 * @param {string} targetServer - The server we're considering scheduling batches for.
 * @param {number} totalRamAvailable - Total RAM available across all servers.
 * @returns {number} - RAM available for the target server after reservations (in GB).
 */
function calculateAvailableRamForServer(ns, targetServer, totalRamAvailable) {
    const reservedRam = calculateReservedRam(ns, targetServer);
    const availableRam = Math.max(0, totalRamAvailable - reservedRam);

    return availableRam;
}

/**
 * XP farming function that launches a separate script to handle XP farming independently.
 * This ensures the main loop is not blocked by XP farming operations.
 * @param {NS} ns - The Netscript API.
 */
function xpFarm(ns) {
    const xpTarget = "joesguns";
    const xpFarmScript = "/scripts/xp-farm.js";

    // Check if joesguns exists and we have root access
    if (!ns.serverExists(xpTarget) || !ns.hasRootAccess(xpTarget)) {
        return;
    }

    const weakenTime = ns.getWeakenTime(xpTarget);
    const weakenCycles = Math.floor(TICK_DELAY / (weakenTime + SCRIPT_DELAY));

    // Collect server/thread pairs for all available RAM
    const serverThreadPairs = [];
    let totalThreads = 0;

    for (const server of executableServers) {
        if (ignoreServers.includes(server)) {
            continue;
        }

        // Use serverRamCache which reflects actual available RAM after all batch scheduling
        const availableRam = serverRamCache.get(server) || 0;
        const threadsAvailable = Math.floor(availableRam / WEAKEN_SCRIPT_RAM_USAGE);

        if (threadsAvailable > 0) {
            serverThreadPairs.push(server, threadsAvailable);
            totalThreads += threadsAvailable;

            // Update serverRamCache to reflect the RAM that will be used
            serverRamCache.set(server, availableRam - threadsAvailable * WEAKEN_SCRIPT_RAM_USAGE);
        }
    }

    if (serverThreadPairs.length > 0) {
        // Build arguments: target, cycles, weakenTime, server1, threads1, server2, threads2, ...
        const args = [xpTarget, weakenCycles, weakenTime, ...serverThreadPairs];

        // Launch the XP farm script on home
        const pid = ns.exec(xpFarmScript, "home", 1, ...args);

        if (pid) {
            ns.print(
                `XP Farm: Launched script with ${weakenCycles} cycles, ${totalThreads} threads across ${serverThreadPairs.length / 2} servers`,
            );
        } else {
            ns.print(`XP Farm: Failed to launch script`);
        }
    }
}
