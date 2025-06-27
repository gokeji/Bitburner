import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
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
    const MINIMUM_SCRIPT_RAM_USAGE = 1.75;
    const CORRECTIVE_GROW_WEAK_MULTIPLIER = 1; // Use extra grow and weak threads to correct for out of sync HGW batches

    let hackPercentage = 0.5;
    const BASE_SCRIPT_DELAY = 20; // ms delay between scripts, will be added to dynamically
    const DELAY_BETWEEN_BATCHES = 20; // ms delay between batches
    const TICK_DELAY = 800; // ms delay between ticks

    const HOME_SERVER_RESERVED_RAM = 640; // GB reserved for home server
    let MAX_WEAKEN_TIME = 10 * 60 * 1000; // ms max weaken time (Max 10 minutes)

    let PREP_MONEY_THRESHOLD = 1.0; // Prep servers until it's at least this much money
    let SECURITY_LEVEL_THRESHOLD = 0; // Prep servers to be within minSecurityLevel + this amount

    let executableServers = [];
    let hackableServers = [];
    let ignoreServers = [];

    let tickCounter = 0;

    // Global priorities map that persists across the scheduling loop
    let globalPrioritiesMap = new Map();
    let previousGlobalPrioritiesMap = new Map();
    const recoveringServers = new Set(); // In-memory state for servers in active recovery
    let serverBatchTimings = new Map(); // Stores the original batch timings for each server

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

    let maxRamAvailable = 0;
    let totalFreeRam = 0;

    ns.disableLog("ALL");

    if (ns.args.length > 0) {
        ignoreServers = ns.args;
    }

    // Global counters for server success tracking
    let totalServersAttempted = 0;
    let totalServersNotDiscarded = 0;

    // Main loop
    while (true) {
        tickCounter++;

        // Clear terminal and start new tick
        ns.print(`\n=== Tick ${tickCounter} ===`);

        // Get all servers
        executableServers = getServers(ns, "executableOnly");
        hackableServers = getServers(ns, "hackableOnly").filter((server) => {
            const serverInfo = ns.getServer(server);
            const optimalServer = {
                ...serverInfo,
                hackDifficulty: serverInfo.minDifficulty,
                moneyAvailable: serverInfo.moneyMax,
            };
            const player = ns.getPlayer();
            const weakenTime = ns.formulas.hacking.weakenTime(optimalServer, player);
            return weakenTime < MAX_WEAKEN_TIME;
        });

        maxRamAvailable = executableServers.reduce((acc, server) => acc + ns.getServerMaxRam(server), 0);
        totalFreeRam = getTotalFreeRam(ns);
        ns.print(`Total RAM Available: ${ns.formatRam(totalFreeRam)}`);

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

        // Calculate global priorities map once per tick (without excluding any servers)
        globalPrioritiesMap = calculateTargetServerPriorities(ns);

        // Check for weakenTime desync by comparing with the previous tick
        let outOfSyncServers = 0;
        let totalPercentChange = 0;
        let totalMsChange = 0;
        let outOfSyncChanges = [];

        for (const [server, currentStats] of globalPrioritiesMap.entries()) {
            if (previousGlobalPrioritiesMap.has(server)) {
                const previousStats = previousGlobalPrioritiesMap.get(server);
                // Use a small tolerance for floating point comparisons
                if (Math.abs(currentStats.weakenTime - previousStats.weakenTime) > 0.001) {
                    outOfSyncServers++;
                    const msChange = currentStats.weakenTime - previousStats.weakenTime;
                    const percentChange =
                        previousStats.weakenTime !== 0 ? (msChange / previousStats.weakenTime) * 100 : 0;
                    totalMsChange += msChange;
                    totalPercentChange += percentChange;

                    // Store the change data for this server
                    outOfSyncChanges.push({
                        server: server,
                        msChange: msChange,
                        percentChange: percentChange,
                        priority: currentStats.throughput,
                    });
                }
            }
        }

        // Just logging server desync
        if (outOfSyncServers > 0) {
            const avgPercentChange = totalPercentChange / outOfSyncServers;
            const avgMsChange = totalMsChange / outOfSyncServers;

            const warnMessage = `WARN: ${outOfSyncServers} servers are out of sync. Avg weakenTime change: ${ns.formatNumber(avgMsChange, 2)}ms (${ns.formatNumber(avgPercentChange, 2)}%). Player Level: ${ns.getPlayer().skills.hacking}. HackingMult: ${ns.getPlayer().mults.hacking_speed}.`;

            ns.print(warnMessage);

            // Sort by priority (throughput) and show top 3
            outOfSyncChanges.sort((a, b) => b.priority - a.priority);
            const topThreeChanges = outOfSyncChanges.slice(0, 3);

            for (let i = 0; i < topThreeChanges.length; i++) {
                const change = topThreeChanges[i];
                const changeMessage = `Top ${i + 1} Priority Server: ${change.server} - ${ns.formatNumber(change.msChange, 2)}ms change (${ns.formatNumber(change.percentChange, 2)}%)`;
                ns.print(changeMessage);
            }
        }

        // Update the previous state for the next tick's comparison
        previousGlobalPrioritiesMap = new Map(globalPrioritiesMap);

        const runningScriptInfo = getRunningScriptInfo(ns);

        // Send throughput data to port 4 for get_stats.js
        var throughputPortHandle = ns.getPortHandle(4);
        throughputPortHandle.clear(); // Clear old data
        for (let [server, stats] of globalPrioritiesMap.entries()) {
            throughputPortHandle.write(JSON.stringify({ server: server, profit: stats.throughput }));
        }

        const serversByThroughput = Array.from(globalPrioritiesMap.entries())
            .sort((a, b) => b[1].throughput - a[1].throughput)
            .map(([server]) => server);

        let totalRamUsed = 0;
        let serverIndex = 0;
        let successfullyProcessedServers = []; // Track servers that have been successfully processed this tick

        // Distribute available RAM based on server priority
        const serverRamAllocation = new Map();
        let ramToDistribute = maxRamAvailable; // Use total network RAM

        for (const server of serversByThroughput) {
            if (ramToDistribute <= 0) break;
            const serverStats = globalPrioritiesMap.get(server);
            if (!serverStats) continue;

            const ramToAllocate = Math.min(ramToDistribute, serverStats.ramForMaxThroughput);
            serverRamAllocation.set(server, ramToAllocate);
            ramToDistribute -= ramToAllocate;
        }

        while (serverIndex < serversByThroughput.length) {
            const currentServer = serversByThroughput[serverIndex];
            serverIndex++; // Increment server index

            const currentServerScripts = runningScriptInfo.get(currentServer) || {
                ramUsed: 0,
                isPrep: false,
                hasHack: false,
                hasGrow: false,
                hasWeaken: false,
            };
            let isHgw = currentServerScripts.hasHack && currentServerScripts.hasGrow && currentServerScripts.hasWeaken;
            let isPrep =
                currentServerScripts.isPrep ||
                (!currentServerScripts.hasHack && (currentServerScripts.hasGrow || currentServerScripts.hasWeaken));
            let isTargeted = isHgw || isPrep;

            const serverStats = globalPrioritiesMap.get(currentServer);
            if (!serverStats) {
                ns.print(`ERROR: No server stats found for ${currentServer}`);
                continue;
            }

            const serverInfo = ns.getServer(currentServer);

            // --- Stale Recovery Check ---
            if (isPrep) {
                const isFullyPrepped =
                    serverInfo.moneyAvailable >= serverInfo.moneyMax &&
                    serverInfo.hackDifficulty <= serverInfo.minDifficulty + SECURITY_LEVEL_THRESHOLD;

                if (isFullyPrepped) {
                    const message = `INFO: ${currentServer} is fully prepped with lingering G/W scripts. Clearing them to start HGW.`;
                    ns.print(message);
                    killAllScriptsForTarget(ns, currentServer, ["grow", "weaken"]);
                    recoveringServers.delete(currentServer); // Server is no longer in recovery
                    // Invalidate the state for this tick, as the server is now truly idle.
                    isPrep = false;
                    isTargeted = false;
                    isHgw = false;
                }
            }

            if (isHgw) {
                // --- New Security Drift Check ---
                // Only check if the server is not currently being batched
                const maxSecurityIncrease = serverStats.maxSecurityIncreasePerBatch;
                // Allow for some buffer. A single batch shouldn't raise it past min + maxIncrease.
                // A healthy stream of batches should hover around minSecurity. If it gets this high, something is wrong.
                const securityThreshold = serverInfo.minDifficulty + maxSecurityIncrease * 1.5;

                if (serverInfo.hackDifficulty > securityThreshold) {
                    const message = `WARN: Security on ${currentServer} (${ns.formatNumber(
                        serverInfo.hackDifficulty,
                        2,
                    )}) breached threshold (${ns.formatNumber(securityThreshold, 2)}). Recovering.`;
                    ns.print(message);
                    killAllScriptsForTarget(ns, currentServer, ["hack"]);
                    recoveringServers.add(currentServer); // Tag server for fast-path recovery check

                    if (serverBatchTimings.has(currentServer)) {
                        serverBatchTimings.delete(currentServer);
                        ns.print(`INFO: ${currentServer} entering prep. Clearing stored batch timings.`);
                    }
                    continue; // Skip processing this server for HGW/prep this tick
                }
            }

            // Continue to next server if it's already being prepped
            if (isPrep) {
                // ns.print(`INFO: Server ${currentServer} is already being prepped`);
                continue;
            }

            if (
                (serverInfo.moneyAvailable < serverInfo.moneyMax * PREP_MONEY_THRESHOLD ||
                    serverInfo.hackDifficulty > serverInfo.minDifficulty + SECURITY_LEVEL_THRESHOLD) &&
                !isTargeted // Do not prep if it has HGW scripts running on it or prep scripts
            ) {
                const prepRamUsed = prepServer(ns, currentServer, successfullyProcessedServers.length + 1);
                if (prepRamUsed !== false) {
                    totalRamUsed += prepRamUsed;
                    successfullyProcessedServers.push(currentServer);
                }
                continue; // Move on to next server
            }

            totalServersAttempted++;
            if (serverStats.ramForMaxThroughput === 0) {
                ns.print(`WARN: ${currentServer} is not prepped, skipping batch hack`);
                continue;
            }
            totalServersNotDiscarded++;

            // Calculate available RAM for this server from its allocation
            const serverTotalBudget = serverRamAllocation.get(currentServer) || 0;
            const ramUsedByServer = currentServerScripts.ramUsed;
            const remainingRamForSustainedThroughput = Math.max(0, serverTotalBudget - ramUsedByServer);

            // Calculate maximum batches we can afford with available RAM
            const { timePerBatch, batchLimitForSustainedThroughput, ramNeededPerBatch } = serverStats;
            const targetBatchesForSustainedThroughput = Math.floor(
                remainingRamForSustainedThroughput / ramNeededPerBatch,
            );
            const maxBatchesThisTick = Math.floor(TICK_DELAY / timePerBatch);

            const batchesToSchedule = Math.min(
                batchLimitForSustainedThroughput,
                maxBatchesThisTick,
                targetBatchesForSustainedThroughput,
            );

            if (batchesToSchedule > 0) {
                let timeDriftDelay = 0;
                if (serverBatchTimings.has(currentServer)) {
                    const originalTimings = serverBatchTimings.get(currentServer);
                    timeDriftDelay = originalTimings.originalWeakenTime - serverStats.weakenTime;

                    if (timeDriftDelay < 0) {
                        timeDriftDelay = 0;
                    }
                }

                // Schedule batches for the highest priority server
                const ramUsedForBatches = scheduleBatchHackCycles(
                    ns,
                    currentServer,
                    batchesToSchedule,
                    successfullyProcessedServers.length + 1,
                    serverStats,
                    timeDriftDelay,
                );

                // Ensure we made progress to avoid infinite loop
                if (ramUsedForBatches > 0) {
                    successfullyProcessedServers.push(currentServer);
                    totalRamUsed += ramUsedForBatches;

                    if (!serverBatchTimings.has(currentServer)) {
                        const { weakenTime, growthTime, hackTime } = serverStats;
                        serverBatchTimings.set(currentServer, {
                            originalWeakenTime: weakenTime,
                            originalGrowthTime: growthTime,
                            originalHackTime: hackTime,
                        });
                    }
                }
            } else {
                // ns.print(
                //     `INFO: HGW - ${currentServer} Failed. Need ${ns.formatRam(serverStats.ramNeededPerBatch)} ram.`,
                // );
            }

            continue; // Move on to next server
        }

        if (successfullyProcessedServers.length === 0) {
            ns.print("INFO: No servers could be processed this tick");
        }

        const totalRamUsedAfterTick = maxRamAvailable - totalFreeRam + totalRamUsed;
        const freeRamAfterTick = maxRamAvailable - totalRamUsedAfterTick;
        const ramUtilization = totalRamUsedAfterTick / maxRamAvailable;

        const serverSuccessRate = totalServersAttempted > 0 ? totalServersNotDiscarded / totalServersAttempted : 1;

        ns.print(
            `INFO: RAM: ${ns.formatPercent(ramUtilization)} - ${ns.formatRam(freeRamAfterTick)} free | Batch Success: ${ns.formatPercent(serverSuccessRate)}`,
        );

        // XP farming: Use all remaining RAM for weaken scripts
        // xpFarm(ns);

        await ns.sleep(TICK_DELAY);
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
                        {
                            ...calcServer,
                            moneyAvailable: currentMoneyAfterHack,
                            hackDifficulty: currentSecurityAfterHack,
                        },
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
            totalSecurityIncrease: weakenTarget,
        };
    }

    /**
     * Gets the total available RAM across all executable servers.
     * Updates the global server RAM cache on every call.
     * @param {NS} ns - The Netscript API.
     * @returns {number} - Total available RAM in GB.
     */
    function getTotalFreeRam(ns) {
        // Calculate total from the cache
        let totalRam = 0;
        serverRamCache.clear();

        // Initialize available RAM for each server
        for (const server of executableServers) {
            const serverInfo = ns.getServer(server);
            let availableRam = serverInfo.maxRam - serverInfo.ramUsed;
            if (server === "home") {
                availableRam = Math.max(availableRam - HOME_SERVER_RESERVED_RAM, 0);
            }
            if (availableRam > MINIMUM_SCRIPT_RAM_USAGE) {
                serverRamCache.set(server, availableRam);
                totalRam += availableRam;
            }
        }

        return totalRam;
    }

    /**
     * Scans all running scripts on all executable servers once per tick to gather information about each target.
     * @param {NS} ns - The Netscript API.
     * @returns {Map<string, {ramUsed: number, hasHack: boolean, hasGrow: boolean, hasWeaken: boolean, isPrep: boolean}>}
     */
    function getRunningScriptInfo(ns) {
        const scriptInfoByTarget = new Map();

        const hackScriptName = hackScript.substring(1);
        const growScriptName = growScript.substring(1);
        const weakenScriptName = weakenScript.substring(1);

        for (const server of executableServers) {
            const runningScripts = ns.ps(server);

            for (const script of runningScripts) {
                if (script.args.length > 0) {
                    const target = script.args[0];

                    if (!scriptInfoByTarget.has(target)) {
                        scriptInfoByTarget.set(target, {
                            ramUsed: 0,
                            hasHack: false,
                            hasGrow: false,
                            hasWeaken: false,
                            isPrep: false,
                        });
                    }

                    const info = scriptInfoByTarget.get(target);
                    const scriptRam = ns.getScriptRam(script.filename, server);
                    if (scriptRam > 0) {
                        info.ramUsed += scriptRam * script.threads;
                    }

                    if (script.args.includes("prep")) {
                        info.isPrep = true;
                    }

                    if (script.args.includes("hgw")) {
                        if (script.filename === hackScriptName) info.hasHack = true;
                        else if (script.filename === growScriptName) info.hasGrow = true;
                        else if (script.filename === weakenScriptName) info.hasWeaken = true;
                    }
                }
            }
        }
        return scriptInfoByTarget;
    }

    /**
     * Calculates the priority of each server based on throughput (money per second).
     * Sets throughput to 0 for servers that need prep (wrong security/money), which prevents
     * RAM allocation and allows proper accounting in the main loop.
     * @param {NS} ns - The Netscript API.
     * @returns {Map<string, {priority: number, ramNeededPerBatch: number, throughput: number, weakenTime: number, hackThreads: number, growthThreads: number, weakenThreadsNeeded: number, hackChance: number}>} - Map of server names to their calculated priorities.
     */
    function calculateTargetServerPriorities(ns) {
        const prioritiesMap = new Map();

        for (const server of hackableServers) {
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
                totalSecurityIncrease,
            } = getServerHackStats(
                ns,
                server,
                true, // Set to true to use formulas API with optimal conditions
            );

            // This is a guard against invalid batches that might have 0 threads for very high security servers
            if (hackThreads <= 0 || growthThreads <= 0 || weakenThreadsNeeded <= 0) {
                continue;
            }

            const timePerBatch = BASE_SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES;
            const theoreticalBatchLimit = weakenTime / timePerBatch;

            const ramNeededPerBatch =
                hackThreads * HACK_SCRIPT_RAM_USAGE +
                growthThreads * GROW_SCRIPT_RAM_USAGE +
                weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;

            let ramForMaxThroughput = theoreticalBatchLimit * ramNeededPerBatch;
            let throughput = 0; // Default to 0 for servers that can't be batched

            // Calculate batch limits (needed for server stats regardless of readiness)
            const batchLimitForSustainedThroughput = Math.min(
                maxRamAvailable / ramNeededPerBatch,
                theoreticalBatchLimit,
            );

            // Check if server is properly prepped for batching
            const isServerReady =
                serverInfo.hackDifficulty <= serverInfo.minDifficulty + SECURITY_LEVEL_THRESHOLD &&
                serverInfo.moneyAvailable >= serverInfo.moneyMax * PREP_MONEY_THRESHOLD;

            if (isServerReady) {
                // Calculate actual throughput (money per second) using ACTUAL hack percentage
                const moneyPerBatch = actualHackPercentage * maxMoney * hackChance;
                throughput = (batchLimitForSustainedThroughput * moneyPerBatch) / (weakenTime / 1000); // money per second
            } else {
                // Server needs prep, set RAM allocation to 0 to prevent wasted allocation
                ramForMaxThroughput = 0;
            }

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
                batchLimitForSustainedThroughput: batchLimitForSustainedThroughput,
                maxSecurityIncreasePerBatch: totalSecurityIncrease,
                timePerBatch: timePerBatch,
                ramForMaxThroughput: ramForMaxThroughput,
            });
        }

        return prioritiesMap;
    }

    /**
     * Attempts to nuke a server if we don't have root access yet
     * @param {NS} ns - The Netscript API
     * @param {string} server - Server name to nuke
     */
    function nukeServerIfNeeded(ns, server) {
        if (ns.hasRootAccess(server) || server.startsWith("hacknet-node")) {
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
            if (ignoreServers.includes(server)) return false;
            return true;
        };

        const isExecutable = (server) => {
            if (!ns.hasRootAccess(server)) return false;
            if (ignoreServers.includes(server)) return false;
            return true;
        };

        // BFS traversal of the server network
        while (toScan.length > 0) {
            const server = toScan.shift(); // Process next server in queue

            // Handle nuking and backdooring for the current server
            nukeServerIfNeeded(ns, server);
            backdoorIfNeeded(ns, server);

            if (getServerOptions === "all" && !ignoreServers.includes(server)) {
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

        // Build operations array for the new allocation function
        const operations = [];
        if (needsInitialWeaken) {
            operations.push({ type: "weaken", threads: initialWeakenThreads, id: "initial_weaken" });
        }
        if (needsGrow) {
            operations.push({ type: "grow", threads: growthThreads });
            operations.push({ type: "weaken", threads: finalWeakenThreads, id: "final_weaken" });
        }

        // Find servers for prep operations with proper RAM accounting
        const allocation = allocateServersForOperations(ns, operations);

        if (!allocation.success) {
            const isPartial = allocation.scalingFactor < 1;
            ns.print(
                `INFO: ${isPartial ? "Partial " : ""}PREP - ${target} Failed. Need ${ns.formatRam(allocation.scaledTotalRamRequired)} ram.`,
            );
            return false;
        } else {
            ns.print(`SUCCESS ${serverIndex}. ${target}: PREP ${ns.formatRam(allocation.totalRamUsed)}`);
        }

        // Update the server RAM cache - this is handled by allocateServersForOperations

        let totalRamUsed = 0;

        if (needsInitialWeaken) {
            if (allocation.initial_weaken) {
                // Execute weaken on potentially multiple servers
                for (const [server, threads] of allocation.initial_weaken) {
                    executeWeaken(ns, server, target, threads, 0, true, weakenTime);
                }
                totalRamUsed += initialWeakenRam;
            } else {
                ns.print(`ERROR: Allocations were malformed for PREP ${target} - initial_weaken`);
            }
        }

        if (needsGrow) {
            if (allocation.grow && allocation.final_weaken) {
                // Execute grow on single server (as enforced by the allocation function)
                const growDelay = needsInitialWeaken ? weakenTime - growthTime + BASE_SCRIPT_DELAY : 0;
                for (const [server, threads] of allocation.grow) {
                    executeGrow(ns, server, target, threads, growDelay, false, true, growthTime);
                }
                totalRamUsed += growRam;

                // Execute final weaken on potentially multiple servers
                const finalWeakenDelay = needsInitialWeaken ? 2 * BASE_SCRIPT_DELAY : 0;
                for (const [server, threads] of allocation.final_weaken) {
                    executeWeaken(ns, server, target, threads, finalWeakenDelay, true, weakenTime);
                }
                totalRamUsed += finalWeakenRam;
            } else {
                ns.print(`ERROR: Allocations were malformed for PREP ${target} - grow and final_weaken`);
            }
        }

        return totalRamUsed;
    }

    /**
     *
     * @param {NS} ns
     * @param {string} target
     * @param {number} batches
     * @param {number} serverIndex
     * @param {Object} serverStats
     * @returns {number} - Total RAM used to schedule the batch hacks.
     */
    function scheduleBatchHackCycles(ns, target, batches, serverIndex, serverStats, timeDriftDelay = 0) {
        let totalRamUsed = 0;
        let successfulBatches = 0;

        // Ensure we only attempt whole batches to avoid floating point precision issues
        const totalBatches = Math.floor(batches);
        const { timePerBatch } = serverStats;

        const weakenTimeCompletionTarget = 0 * BASE_SCRIPT_DELAY; // Target the midpoint of the 400ms H-G-W window
        const weakenTimeFinishOffset = (timeDriftDelay + serverStats.weakenTime) % timePerBatch;
        const weakenTimeSyncDelay =
            (timePerBatch + (weakenTimeCompletionTarget - weakenTimeFinishOffset)) % timePerBatch;

        for (let i = 0; i < totalBatches; i++) {
            const batchResult = runBatchHack(ns, target, timePerBatch * i + weakenTimeSyncDelay, serverStats);
            if (!batchResult.success) {
                break;
            }
            totalRamUsed += batchResult.ramUsed;
            successfulBatches++;
        }

        // Display batch scheduling results
        if (successfulBatches > 0) {
            ns.print(
                `SUCCESS ${serverIndex}. ${target}: HGW ${successfulBatches}/${totalBatches} batches, ${ns.formatRam(totalRamUsed)} (${serverStats.hackThreads}H ${serverStats.growthThreads}G ${serverStats.weakenThreadsNeeded}W per batch)`,
            );
        }

        return totalRamUsed;
    }

    /**
     * Runs a batch of 3 scripts, weaken, grow, weaken.
     * Hack to a predetermined percentage of max money, grow back to 100% money, and then weaken to min security level. Offset the timing so that hack finishes just slightly before grow, and grow finishes just slightly before weaken.
     * Scripts should finish within BASE_SCRIPT_DELAY ms of each other.
     * @param {NS} ns - The Netscript API.
     * @param {string} target - The target server to hack.
     * @param {number} extraDelay - Extra delay to add to the scripts.
     * @param {Object} serverStats - Pre-calculated server stats from prioritiesMap
     * @returns {{success: boolean, ramUsed: number}} - Success status and RAM used for this batch
     */
    function runBatchHack(ns, target, extraDelay, serverStats) {
        // Use pre-calculated values from serverStats instead of recalculating
        const { hackThreads, growthThreads, weakenThreadsNeeded, weakenTime, growthTime, hackTime } = serverStats;

        // CRITICAL FIX: Use original timing calculations from serverStats
        // DO NOT recalculate timing as server security changes between batches

        // Build operations array for the new allocation function
        const operations = [
            { type: "hack", threads: hackThreads },
            { type: "grow", threads: growthThreads },
            { type: "weaken", threads: weakenThreadsNeeded },
        ];

        // Find servers for all three operations with proper RAM accounting
        const allocation = allocateServersForOperations(ns, operations);

        // If not enough RAM to run H G and W, return failure
        if (!allocation.success) {
            ns.print(
                `INFO: No servers found for batch hack ${target}, need ${ns.formatRam(allocation.scaledTotalRamRequired)} ram`,
            );
            return { success: false, ramUsed: 0 }; // Not enough RAM to run H G and W
        }

        // Calculate delays
        const hackDelay = weakenTime + extraDelay - 2 * BASE_SCRIPT_DELAY - hackTime;
        const growDelay = weakenTime + extraDelay - BASE_SCRIPT_DELAY - growthTime;
        const weakenDelay = extraDelay;

        // Validate delays are not negative (which would cause timing issues)
        if (hackDelay < 0 || growDelay < 0 || weakenDelay < 0) {
            ns.print(`ERROR: Negative delays detected! H=${hackDelay}, G=${growDelay}, W=${weakenDelay}`);
            ns.print(
                `Times: hackTime=${hackTime}, growthTime=${growthTime}, weakenTime=${weakenTime}, extraDelay=${extraDelay}`,
            );
            return { success: false, ramUsed: 0 };
        }

        if (allocation.hack && allocation.grow && allocation.weaken) {
            // Execute hack operations (can be split across multiple servers)
            for (const [server, threads] of allocation.hack) {
                executeHack(ns, server, target, threads, hackDelay, false, false, hackTime);
            }

            for (const [server, threads] of allocation.grow) {
                executeGrow(ns, server, target, threads, growDelay, false, false, growthTime);
            }

            // Execute weaken operations (can be split across multiple servers)
            for (const [server, threads] of allocation.weaken) {
                executeWeaken(ns, server, target, threads, weakenDelay, false, weakenTime);
            }
        } else {
            ns.print(`ERROR: Allocations were malformed for BATCH ${target}`);
        }

        return { success: true, ramUsed: allocation.totalRamUsed };
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
            ns.print(`WARN Failed to execute weaken script on ${target}`);
            ns.print(
                `WARN Host: ${host}, Target: ${target}, Threads: ${threads}, SleepTime: ${sleepTime}, IsPrep: ${isPrep}, WeakenTime: ${weakenTime}`,
            );
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
            ns.print(`WARN Failed to execute grow script on ${target}`);
            ns.print(
                `WARN Host: ${host}, Target: ${target}, Threads: ${threads}, SleepTime: ${sleepTime}, StockArg: ${stockArg}, IsPrep: ${isPrep}, GrowTime: ${growTime}`,
            );
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
            ns.print(`WARN Failed to execute hack script on ${target}`);
            ns.print(
                `WARN Host: ${host}, Target: ${target}, Threads: ${threads}, SleepTime: ${sleepTime}, StockArg: ${stockArg}, IsPrep: ${isPrep}, HackTime: ${hackTime}`,
            );
        }
    }

    /**
     * XP farming function that launches a separate script to handle XP farming independently.
     * This ensures the main loop is not blocked by XP farming operations.
     * @param {NS} ns - The Netscript API.
     */
    function xpFarm(ns) {
        const xpTarget = "foodnstuff";
        const xpFarmScript = "/scripts/xp-farm.js";

        // Check if target server exists and we have root access
        if (!ns.serverExists(xpTarget) || !ns.hasRootAccess(xpTarget)) {
            return;
        }

        const weakenTime = ns.getWeakenTime(xpTarget);
        const weakenCycles = Math.max(1, Math.floor(TICK_DELAY / (weakenTime + BASE_SCRIPT_DELAY))); // Kick off at least 1 weaken cycle

        // Collect server/thread pairs for all available RAM
        const serverThreadPairs = [];
        let totalThreads = 0;

        for (const server of executableServers) {
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
                const remainingRamUsed = totalThreads * WEAKEN_SCRIPT_RAM_USAGE;
                ns.print(
                    `SUCCESS XP Farm: Launched script with ${weakenCycles} cycles, ${ns.formatRam(remainingRamUsed)} across ${serverThreadPairs.length / 2} servers`,
                );
            } else {
                ns.print(`WARN: XP Farm: Failed to launch script`);
            }
        }
    }

    /**
     * Allocates RAM for a single operation across available servers.
     *
     * @param {Array<[string, number]>} sortedServers - Array of [serverName, availableRam] sorted by core count (highest first)
     * @param {Map<string, number>} serverRamAvailable - Map of server names to available RAM (for updates)
     * @param {number} ramPerThread - RAM cost per thread for this operation type
     * @param {number} totalThreadsNeeded - Total number of threads needed
     * @returns {{allocations: Map<string, number>, totalRamUsed: number} | false} -
     *   Returns allocation map and total RAM used, or false if allocation failed
     */
    function allocateRamForOperation(
        sortedServers,
        serverRamAvailable,
        ramPerThread,
        totalThreadsNeeded,
        preferHigherCoreCount = true,
    ) {
        const allocations = new Map();
        let totalRamUsed = 0;
        let remainingThreads = totalThreadsNeeded;

        const serversToIterate = preferHigherCoreCount ? sortedServers : [...sortedServers].reverse();

        // Single loop handles both splittable and non-splittable operations
        for (const server of serversToIterate) {
            // FIX: Get the most current available RAM from the map, not the stale value from the sorted array
            const availableRam = serverRamAvailable.get(server) || 0;
            if (remainingThreads <= 0) break;

            const threadsCanAllocate = Math.floor(availableRam / ramPerThread);

            if (threadsCanAllocate >= remainingThreads) {
                // Server has enough RAM for all remaining needs
                const ramUsed = remainingThreads * ramPerThread;
                allocations.set(server, remainingThreads);

                // Update available RAM in the map
                serverRamAvailable.set(server, availableRam - ramUsed);
                totalRamUsed += ramUsed;
                remainingThreads = 0;
                break; // We're done
            } else {
                // Server doesn't have enough RAM for all needs
                // Can split, so take what we can and continue
                if (threadsCanAllocate > 0) {
                    const ramUsed = threadsCanAllocate * ramPerThread;
                    allocations.set(server, threadsCanAllocate);

                    // Update available RAM in the map
                    serverRamAvailable.set(server, availableRam - ramUsed);
                    totalRamUsed += ramUsed;
                    remainingThreads -= threadsCanAllocate;
                }
                // Continue to next server for remaining threads
            }
        }

        if (remainingThreads > 0) {
            return false; // Cannot allocate all remaining threads
        }

        return { allocations, totalRamUsed };
    }

    /**
     * Allocates servers for any combination of HGW operations and updates global RAM cache.
     * This function can handle both batch operations and prep operations with flexible allocation.
     * If there isn't enough total RAM for all operations, it will scale down all operations proportionally.
     *
     * @param {NS} ns - The Netscript API.
     * @param {Array<{type: 'hack'|'grow'|'weaken', threads: number, id?: string}>} operations - Array of operations needed.
     *   Each operation should specify:
     *   - type: 'hack', 'grow', or 'weaken'
     *   - threads: number of threads needed
     *   - id: optional identifier to distinguish multiple operations of the same type (e.g., 'initial_weaken', 'final_weaken')
     *
     * @returns {Object} - Returns allocation result.
     *   Success format: {
     *     hack: Map<string, number>,     // serverName -> threads (can be split across multiple servers)
     *     grow: Map<string, number>,     // serverName -> threads (single server only)
     *     weaken: Map<string, number>,   // serverName -> threads (can be split across multiple servers)
     *     initial_weaken: Map<string, number>, // if id='initial_weaken'
     *     final_weaken: Map<string, number>,   // if id='final_weaken'
     *     // ... other operations with custom ids
     *     totalRamUsed: number,
     *     scalingFactor: number          // Factor by which operations were scaled (1.0 = no scaling)
     *   }
     *
     * Key behaviors:
     * 1. If insufficient total RAM, scales down all operations proportionally
     * 2. Grow operations must be allocated to a single server (cannot be split)
     * 3. Hack and weaken operations can be split across multiple servers
     * 4. Grow operations are allocated first to ensure they get priority
     * 5. Remaining operations are allocated to remaining servers
     * 6. Updates global serverRamCache and removes servers with insufficient RAM (< 1.75GB)
     */
    function allocateServersForOperations(ns, operations) {
        let scalingFactor = 1.0;

        function getTotalRamRequired(operations) {
            return operations.reduce((total, op) => {
                let ramPerThread;
                switch (op.type) {
                    case "hack":
                        ramPerThread = HACK_SCRIPT_RAM_USAGE;
                        break;
                    case "grow":
                        ramPerThread = GROW_SCRIPT_RAM_USAGE;
                        break;
                    case "weaken":
                        ramPerThread = WEAKEN_SCRIPT_RAM_USAGE;
                        break;
                    default:
                        return total;
                }
                return total + op.threads * ramPerThread;
            }, 0);
        }

        // Calculate total RAM required for all operations
        const totalRamRequired = getTotalRamRequired(operations);

        // Calculate scaling factor
        if (totalRamRequired > totalFreeRam) {
            scalingFactor = totalFreeRam / totalRamRequired;
        }

        // Scale down operations if necessary
        const scaledOperations = operations.map((op) => ({
            ...op,
            threads: Math.max(1, Math.ceil(op.threads * scalingFactor)),
        }));

        const scaledTotalRamRequired = getTotalRamRequired(scaledOperations);

        // Result object to store allocations
        const result = {
            success: true,
            totalRamUsed: 0,
            scalingFactor: scalingFactor,
            totalRamRequired: totalRamRequired,
            scaledTotalRamRequired: scaledTotalRamRequired,
        };

        // Validate input
        if (!operations || operations.length === 0) {
            result.success = false;
            return result;
        }

        // Create a copy of server RAM availability to track allocations
        const serverRamAvailable = new Map(serverRamCache);

        // Sort servers by available core count (highest first) - do this once and reuse
        const sortedServersByCoreCount = Array.from(serverRamAvailable.keys()).sort(
            (a, b) => ns.getServer(a).cpuCores - ns.getServer(b).cpuCores,
        );

        // Separate operations by type
        const growOperations = scaledOperations.filter((op) => op.type === "grow");
        const hackOperations = scaledOperations.filter((op) => op.type === "hack");
        const weakenOperations = scaledOperations.filter((op) => op.type === "weaken");

        // Step 1: Allocate grow operations first (must be on single servers)
        for (const growOp of growOperations) {
            const opKey = growOp.id || "grow";
            const preferHigherCoreCount = true;
            const allocation = allocateRamForOperation(
                sortedServersByCoreCount,
                serverRamAvailable,
                GROW_SCRIPT_RAM_USAGE,
                growOp.threads,
                preferHigherCoreCount,
            );

            if (!allocation) {
                result.success = false;
                return result; // Cannot allocate grow operation
            }

            result[opKey] = allocation.allocations;
            result.totalRamUsed += allocation.totalRamUsed;
        }

        // Step 2: Allocate hack operations (can be split across multiple servers)
        for (const hackOp of hackOperations) {
            const opKey = hackOp.id || "hack";
            const allocation = allocateRamForOperation(
                sortedServersByCoreCount,
                serverRamAvailable,
                HACK_SCRIPT_RAM_USAGE,
                hackOp.threads,
                false,
            );

            if (!allocation) {
                result.success = false;
                return result; // Cannot allocate hack operation
            }

            result[opKey] = allocation.allocations;
            result.totalRamUsed += allocation.totalRamUsed;
        }

        // Step 3: Allocate weaken operations (can be split across multiple servers)
        for (const weakenOp of weakenOperations) {
            const opKey = weakenOp.id || "weaken";
            const preferHigherCoreCount = true;
            const allocation = allocateRamForOperation(
                sortedServersByCoreCount,
                serverRamAvailable,
                WEAKEN_SCRIPT_RAM_USAGE,
                weakenOp.threads,
                preferHigherCoreCount,
            );

            if (!allocation) {
                result.success = false;
                return result; // Cannot allocate weaken operation
            }

            result[opKey] = allocation.allocations;
            result.totalRamUsed += allocation.totalRamUsed;
        }

        // Allocation is successful, so we can update the global serverRamCache
        // Only update servers that have actually been modified during allocation

        for (const [server, updatedRam] of serverRamAvailable) {
            const originalRam = serverRamCache.get(server);

            // Only update if the RAM amount has changed
            if (originalRam !== updatedRam) {
                if (updatedRam < MINIMUM_SCRIPT_RAM_USAGE) {
                    // Remove servers with insufficient RAM
                    serverRamCache.delete(server);
                } else {
                    // Update the global cache with the new available RAM
                    serverRamCache.set(server, updatedRam);
                }
            }
        }

        return result;
    }

    /**
     * Finds and kills all instances of the HGW script running against a specific target.
     * @param {NS} ns - The Netscript API.
     * @param {string} target - The server target whose HGW scripts should be killed.
     * @param {("hack" | "grow" | "weaken")[]} typesToKill - The types of scripts to kill.
     */
    function killAllScriptsForTarget(ns, target, typesToKill) {
        let killedCount = 0;

        // Get script name without the leading '/' for matching with ps() result
        const hackScriptName = hackScript.startsWith("/") ? hackScript.substring(1) : hackScript;
        const growScriptName = growScript.startsWith("/") ? growScript.substring(1) : growScript;
        const weakenScriptName = weakenScript.startsWith("/") ? weakenScript.substring(1) : weakenScript;

        let killedCountByType = {
            [hackScriptName]: 0,
            [growScriptName]: 0,
            [weakenScriptName]: 0,
        };

        const scriptsToKill = typesToKill.map((type) => {
            if (type === "hack") return hackScriptName;
            if (type === "grow") return growScriptName;
            if (type === "weaken") return weakenScriptName;
        });

        for (const server of executableServers) {
            ns.ps(server)
                .filter((script) => script.args[0] === target)
                .filter((script) => scriptsToKill.includes(script.filename))
                .forEach((script) => {
                    if (ns.kill(script.pid)) {
                        killedCount++;
                        killedCountByType[script.filename]++;
                    }
                });
        }
        if (killedCount > 0) {
            const hackKilled = killedCountByType[hackScriptName];
            const growKilled = killedCountByType[growScriptName];
            const weakenKilled = killedCountByType[weakenScriptName];

            const message = `RECOVERY: Killed ${killedCount} HGW scripts targeting ${target} (${hackKilled}H, ${growKilled}G, ${weakenKilled}W)`;
            ns.print(message);
        }
    }
}
