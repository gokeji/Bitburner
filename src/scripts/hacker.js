import { NS } from "@ns";
import { spendHashesOnUpgrade, logUpgradeSuccess } from "./hacknet-spend.js";

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

    // === Hacker Settings ===
    let hackPercentage = 0.5;
    let MAX_WEAKEN_TIME = 10 * 60 * 1000; // ms max weaken time (Max 10 minutes)
    const CORRECTIVE_GROW_WEAK_MULTIPLIER = 1.2; // Use extra grow and weak threads to correct for out of sync HGW batches
    const PRIORITY_SERVER_CORRECTIVE_MULTIPLIER = 1.6; // Higher correction for priority server receiving min security upgrades
    const PRIORITY_SERVER_HACK_PERCENTAGE = 0.95; // Higher hack percentage for priority server
    let PARTIAL_PREP_THRESHOLD = 0.4;
    let ALLOW_HASH_UPGRADES = true;

    let minMoneyProtectionThreshold = 1 - hackPercentage - 0.25;
    let priorityServerMinMoneyProtectionThreshold = 1 - PRIORITY_SERVER_HACK_PERCENTAGE - 0.25;
    const BASE_SCRIPT_DELAY = 20; // ms delay between scripts, will be added to dynamically
    const DELAY_BETWEEN_BATCHES = 20; // ms delay between batches
    const TICK_DELAY = 800; // ms delay between ticks

    const HOME_SERVER_RESERVED_RAM = 100; // GB reserved for home server
    const ALWAYS_XP_FARM = true;
    const ALLOW_PARTIAL_PREP = true;

    let PREP_MONEY_THRESHOLD = 0.95; // Prep servers until it's at least this much money
    let SECURITY_LEVEL_THRESHOLD = 3; // Prep servers to be within minSecurityLevel + this amount

    let executableServers = [];
    let hackableServers = [];
    let ignoreServers = [];

    let tickCounter = 0;

    // Global priorities map that persists across the scheduling loop
    let globalPrioritiesMap = new Map();
    let serverBatchTimings = new Map(); // Stores the original batch timings for each server
    let serverBaselineSecurityLevels = new Map(); // Stores the original min security levels for each server
    let serverPrepTimings = new Map();

    // Weaken drift protection - servers on hold due to excessive timing drift
    let serversOnHold = new Map(); // Map<string, number> - server name to resume timestamp

    // Track the priority server that receives min security upgrades
    let priorityServer = null;

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

    // Server list caching to avoid expensive BFS traversals
    const CACHE_EXPIRY_MS = 10000; // Cache server lists for 10 seconds
    let hackableServersCache = null;
    let hackableServersCacheTime = 0;
    let executableServersCache = null;
    let executableServersCacheTime = 0;

    let maxRamAvailable = 0;
    let totalFreeRam = 0;

    ns.disableLog("ALL");

    if (ns.args.length > 0) {
        ignoreServers = ns.args;
    }

    // Global counters for server success tracking
    let totalServersAttempted = 0;
    let totalServersNotDiscarded = 0;

    // Cache cleanup counter
    let cleanupCounter = 0;

    // === Main loop ===
    while (true) {
        tickCounter++;
        cleanupCounter++;

        // Clear terminal and start new tick
        ns.print(`\n=== Tick ${tickCounter} ===`);

        // Cleanup server caches every 30 seconds to prevent memory leaks
        if (cleanupCounter % Math.floor(30000 / TICK_DELAY) === 0) {
            cleanupServerCaches();
            // Also cleanup any expired holds that might have been missed
            processServersOnHold(ns);
        }

        // Get all servers
        executableServers = getServers(ns, "executableOnly");
        hackableServers = getServers(ns, "hackableOnly").filter((server) => {
            // return server === "sigma-cosmetics";
            return true;
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

        // Process servers on hold and check if any can resume
        processServersOnHold(ns);

        const runningScriptInfo = getRunningScriptInfo(ns);

        // Send throughput data to port 4 for get_stats.js
        var throughputPortHandle = ns.getPortHandle(4);
        throughputPortHandle.clear(); // Clear old data
        for (let [server, stats] of globalPrioritiesMap.entries()) {
            throughputPortHandle.write(JSON.stringify({ server: server, profit: stats.priority }));
        }

        const serversByThroughput = Array.from(globalPrioritiesMap.entries())
            .sort((a, b) => b[1].priority - a[1].priority)
            .map(([server]) => server);

        let totalRamUsed = 0;
        let serverIndex = 0;
        let successfullyProcessedServers = []; // Track servers that have been successfully processed this tick

        // Spend hashes on the highest priority server to upgrade max money
        const highestPriorityServer = serversByThroughput.find((server) => {
            return ns.getServerMaxMoney(server) < 10e12 || ns.getServerMinSecurityLevel(server) > 10;
        });

        // Mark the highest priority server as priority server if it's not already marked
        if (highestPriorityServer && priorityServer !== highestPriorityServer) {
            priorityServer = highestPriorityServer;
            ns.print(`INFO: ${highestPriorityServer} marked as priority server for enhanced corrections`);
        }
        const highestPriorityServerScriptInfo = runningScriptInfo.get(highestPriorityServer);
        if (
            highestPriorityServer &&
            highestPriorityServerScriptInfo &&
            highestPriorityServerScriptInfo.hasHack &&
            highestPriorityServerScriptInfo.hasGrow &&
            highestPriorityServerScriptInfo.hasWeaken &&
            ALLOW_HASH_UPGRADES
        ) {
            const highestPriorityServerInfo = ns.getServer(highestPriorityServer);
            if (highestPriorityServerInfo.moneyMax < 10e12 && PRIORITY_SERVER_CORRECTIVE_MULTIPLIER > 1.1) {
                const startingMoney = ns.getServerMaxMoney(highestPriorityServer);
                const { cost, success, level } = spendHashesOnUpgrade(
                    ns,
                    "Increase Maximum Money",
                    highestPriorityServer,
                );

                if (success) {
                    const endingMoney = ns.getServerMaxMoney(highestPriorityServer);
                    logUpgradeSuccess(
                        ns,
                        "Max Money",
                        `${highestPriorityServer} | ${ns.formatNumber(startingMoney)} -> ${ns.formatNumber(endingMoney)}`,
                        cost,
                    );
                }
            }
            if (
                highestPriorityServerInfo.hackDifficulty > 10 &&
                highestPriorityServerInfo.hackDifficulty === highestPriorityServerInfo.minDifficulty
            ) {
                const startingSecurity = ns.getServerMinSecurityLevel(highestPriorityServer);
                const { cost, success, level } = spendHashesOnUpgrade(
                    ns,
                    "Reduce Minimum Security",
                    highestPriorityServer,
                );

                if (success) {
                    const endingSecurity = ns.getServerMinSecurityLevel(highestPriorityServer);
                    logUpgradeSuccess(
                        ns,
                        "Min Security",
                        `${highestPriorityServer} | ${ns.formatNumber(startingSecurity)} -> ${ns.formatNumber(endingSecurity)}`,
                        cost,
                    );
                }
            }
        }

        // Distribute available RAM based on server priority
        let ramToDistribute = maxRamAvailable; // Use total network RAM

        while (ramToDistribute > 0 && serverIndex < serversByThroughput.length) {
            const currentServer = serversByThroughput[serverIndex];
            serverIndex++; // Increment server index

            // Skip servers that are on hold due to weaken drift
            if (serversOnHold.has(currentServer)) {
                const resumeTime = serversOnHold.get(currentServer);
                const timeLeft = Math.max(0, resumeTime - Date.now());
                // Only log occasionally to avoid spam
                if (tickCounter % 10 === 0) {
                    ns.print(
                        `INFO: ${currentServer} on hold for drift. Resume in ${ns.formatNumber(timeLeft / 1000, 1)}s`,
                    );
                }
                continue;
            }

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

            if (ns.getWeakenTime(currentServer) > MAX_WEAKEN_TIME) {
                continue;
            }

            const serverInfo = ns.getServer(currentServer);

            // --- Stale Recovery Check ---
            if (isPrep) {
                const isFullyPrepped =
                    serverInfo.moneyAvailable >= serverInfo.moneyMax &&
                    serverInfo.hackDifficulty <= serverInfo.minDifficulty;

                if (isFullyPrepped) {
                    const message = `INFO: ${currentServer} is fully prepped with lingering G/W scripts. Clearing them to start HGW.`;
                    ns.print(message);
                    killAllScriptsForTarget(ns, currentServer, ["grow", "weaken"]);
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
                const securityThreshold = Math.max(
                    serverInfo.minDifficulty + 15,
                    serverInfo.minDifficulty + serverStats.totalSecurityIncrease * 2,
                );

                const moneyProtectionThreshold =
                    priorityServer === currentServer
                        ? priorityServerMinMoneyProtectionThreshold
                        : minMoneyProtectionThreshold;

                if (
                    serverInfo.hackDifficulty > securityThreshold ||
                    serverInfo.moneyAvailable < serverInfo.moneyMax * moneyProtectionThreshold
                ) {
                    let message = "";
                    if (serverInfo.hackDifficulty > securityThreshold) {
                        message = `WARN: ${new Date().toLocaleTimeString()} Security on ${currentServer} (${ns.formatNumber(
                            serverInfo.hackDifficulty,
                            2,
                        )}) breached threshold (${ns.formatNumber(securityThreshold, 2)}). Recovering.`;
                    } else {
                        message = `WARN: ${new Date().toLocaleTimeString()} Money on ${currentServer} ($${ns.formatNumber(
                            serverInfo.moneyAvailable,
                        )}) below ${ns.formatPercent(moneyProtectionThreshold)} of max money. Recovering.`;
                    }
                    ns.print(message);
                    ns.tprint(message);
                    killAllScriptsForTarget(ns, currentServer, ["hack"]);

                    if (serverBatchTimings.has(currentServer)) {
                        serverBatchTimings.delete(currentServer);
                        ns.print(`INFO: ${currentServer} entering prep. Clearing stored batch timings.`);
                    }
                    if (serverBaselineSecurityLevels.has(currentServer)) {
                        serverBaselineSecurityLevels.delete(currentServer);
                    }
                    continue; // Skip processing this server for HGW/prep this tick
                }
            }

            // Continue to next server if it's already being prepped
            if (isPrep) {
                // If prep timing is worse than new prediction, kill threads and restart prep
                if (serverPrepTimings.has(currentServer)) {
                    const prepTiming = serverPrepTimings.get(currentServer);
                    const prepStats = getServerPrepStats(ns, currentServer);
                    const newWeakenTime = prepStats.weakenTime;

                    const currentFinishTime = prepTiming.startTime + prepTiming.weakenTime;
                    const newFinishTime = Date.now() + newWeakenTime;

                    if (currentFinishTime > newFinishTime) {
                        ns.print(
                            `INFO: ${currentServer} hack levels improved so much that we should re-prep since it'll be faster`,
                        );
                        // Hack levels improved so much that we should re-prep since it'll be faster
                        killAllScriptsForTarget(ns, currentServer, ["grow", "weaken"]);
                        isPrep = false;
                        isTargeted = false; // Update isTargeted so server can be prepped again
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            // This is a guard against invalid batches that might have 0 threads for very high security servers
            if (
                serverStats.hackThreads <= 0 ||
                serverStats.growthThreads <= 0 ||
                serverStats.weakenThreadsNeeded <= 0
            ) {
                continue;
            }

            if (
                (serverInfo.moneyAvailable < serverInfo.moneyMax ||
                    serverInfo.hackDifficulty > serverInfo.minDifficulty) &&
                !isTargeted // Do not prep if it has HGW scripts running on it or prep scripts
            ) {
                const prepRamUsed = prepServer(
                    ns,
                    currentServer,
                    successfullyProcessedServers.length + 1,
                    ALLOW_PARTIAL_PREP,
                );
                if (prepRamUsed !== false) {
                    totalRamUsed += prepRamUsed;
                    successfullyProcessedServers.push(currentServer);
                    ramToDistribute -= prepRamUsed;
                    // Store the actual weaken time at current server conditions when prep started
                    const currentPrepStats = getServerPrepStats(ns, currentServer);
                    serverPrepTimings.set(currentServer, {
                        weakenTime: currentPrepStats.weakenTime,
                        startTime: Date.now(),
                    });
                }
                continue; // Move on to next server
            }

            totalServersAttempted++;
            if (serverStats.ramForMaxThroughput === 0 && isTargeted) {
                ns.print(`WARN: ${currentServer} is not prepped, skipping batch hack`);
                continue;
            }
            totalServersNotDiscarded++;

            // Calculate available RAM for this server from its allocation
            const ramUsedByServer = currentServerScripts.ramUsed;
            const ramToAllocate = Math.min(ramToDistribute, serverStats.ramForMaxThroughput);
            const remainingRamForSustainedThroughput = Math.max(0, ramToAllocate - ramUsedByServer);

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

                if (ramUsedForBatches > 0) {
                    ramToDistribute -= ramUsedForBatches;
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

                    // always update baseline security level
                    const originalBaselineSecurity =
                        serverBaselineSecurityLevels.get(currentServer) ?? serverInfo.minDifficulty;
                    let baselineToUse = originalBaselineSecurity;
                    if (serverInfo.hackDifficulty < originalBaselineSecurity) {
                        ns.print(
                            `INFO: ${currentServer} new baseline security: ${ns.formatNumber(originalBaselineSecurity, 2)} -> ${ns.formatNumber(serverInfo.hackDifficulty, 2)}`,
                        );
                        baselineToUse = serverInfo.hackDifficulty;
                    }
                    serverBaselineSecurityLevels.set(currentServer, baselineToUse);
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

        const { avgPercentChange, avgMsChange, avgCurrentWeakenTime } = getWeakenTimeDrift(ns);
        const weakenTimeDriftMessage = `Weaken Time Drift: ${ns.formatNumber(avgMsChange, 2)}ms (${ns.formatPercent(avgPercentChange, 2)}) | Avg Weaken: ${ns.formatNumber(avgCurrentWeakenTime / 1000, 1)}s`;

        ns.print(
            `INFO: RAM: ${ns.formatPercent(ramUtilization)} - ${ns.formatRam(freeRamAfterTick)} free | Batch Success: ${ns.formatPercent(serverSuccessRate)} ${ns.formatNumber(totalServersNotDiscarded)}/${ns.formatNumber(totalServersAttempted)} | ${weakenTimeDriftMessage}`,
        );

        // XP farming: Use all remaining RAM for weaken scripts
        xpFarm(ns, ALWAYS_XP_FARM);

        await ns.sleep(TICK_DELAY);
    }

    /**
     * Calculates the hack stats given current security, hacking to hackingPercentage, and growing back to 100% money.
     * @param {NS} ns
     * @param {string} server
     * @param {boolean} useFormulas - If true, use formulas API with optimal server conditions (min security, max money)
     * @returns {Object} - Object containing hack stats
     */
    function getServerHackStats(
        ns,
        server,
        useFormulas = false,
        effectiveHackPercentage,
        effectiveCorrectiveMultiplier,
    ) {
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

        const hackThreads =
            hackPercentageFromOneThread === 0 ? 0 : Math.ceil(effectiveHackPercentage / hackPercentageFromOneThread);
        const actualHackPercentage = hackThreads * hackPercentageFromOneThread; // Actual amount we'll hack
        const hackSecurityChange = hackThreads * 0.002; // Use known constant instead of ns.hackAnalyzeSecurity

        let growthThreads;
        if (useFormulas) {
            // Use formulas API to calculate threads needed to grow from ACTUAL hack amount back to 100%
            const targetMoney = maxMoney;
            const currentMoneyAfterHack = maxMoney * (1 - actualHackPercentage); // Use actual hack amount
            const currentSecurityAfterHack = minSecurityLevel + hackSecurityChange;
            growthThreads = Math.ceil(
                effectiveCorrectiveMultiplier *
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
            const growthMultiplier = 1 / Math.max(1 - actualHackPercentage, 1);
            growthThreads = Math.ceil(
                effectiveCorrectiveMultiplier * ns.growthAnalyze(server, growthMultiplier, cpuCores),
            );
        }

        // Calculate grow security change based on the number of threads
        const growthSecurityChange = growthThreads * 0.004;

        const weakenTarget = hackSecurityChange + growthSecurityChange;
        const weakenThreadsNeeded = Math.ceil((effectiveCorrectiveMultiplier * weakenTarget) / weakenAmount);

        const timePerBatch = BASE_SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES;
        const theoreticalBatchLimit = weakenTime / timePerBatch;

        const ramNeededPerBatch =
            hackThreads * HACK_SCRIPT_RAM_USAGE +
            growthThreads * GROW_SCRIPT_RAM_USAGE +
            weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;
        const availableBatchLimit = maxRamAvailable / ramNeededPerBatch;

        const batchLimitForSustainedThroughput = Math.min(availableBatchLimit, theoreticalBatchLimit);

        // Calculate actual throughput (money per second) using ACTUAL hack percentage
        const moneyPerBatch =
            actualHackPercentage *
            maxMoney *
            hackChance *
            ns.getPlayer().mults.hacking_money *
            ns.getBitNodeMultipliers().ScriptHackMoney;
        const throughput = (theoreticalBatchLimit * moneyPerBatch) / (weakenTime / 1000); // money per second

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
            theoreticalBatchLimit,
            timePerBatch,
            batchLimitForSustainedThroughput,
            throughput,
            ramNeededPerBatch,
        };
    }

    /**
     * Gets the total available RAM across all executable servers.
     * Updates the global server RAM cache on every call.
     * If stanek is running, excludes home server RAM entirely.
     * @param {NS} ns - The Netscript API.
     * @returns {number} - Total available RAM in GB.
     */
    function getTotalFreeRam(ns) {
        // Calculate total from the cache
        let totalRam = 0;
        serverRamCache.clear();

        const stanekIsRunning = ns.scriptRunning("stanek.js", "home");
        if (stanekIsRunning && tickCounter % 10 === 0) {
            ns.print("INFO: Stanek is running - excluding home server RAM from hacking operations");
        }

        // Initialize available RAM for each server
        for (const server of executableServers) {
            const serverInfo = ns.getServer(server);
            let availableRam = serverInfo.maxRam - serverInfo.ramUsed;

            if (server === "home") {
                if (stanekIsRunning) {
                    // If stanek is running, don't use any home RAM for hacking
                    availableRam = 0;
                } else {
                    availableRam = Math.max(availableRam - HOME_SERVER_RESERVED_RAM, 0);
                }
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

        const hackScriptName = hackScript.startsWith("/") ? hackScript.substring(1) : hackScript;
        const growScriptName = growScript.startsWith("/") ? growScript.substring(1) : growScript;
        const weakenScriptName = weakenScript.startsWith("/") ? weakenScript.substring(1) : weakenScript;

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
     * Calculates the prep stats for a target server to determine what operations are needed.
     * @param {NS} ns - The Netscript API.
     * @param {string} target - The target server to analyze.
     * @returns {Object} - Object containing prep requirements and stats.
     */
    function getServerPrepStats(ns, target) {
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
        const needsInitialWeaken = securityLevel > minSecurityLevel;
        const needsGrow = currentMoney < maxMoney;

        // Use different corrective multiplier for priority server
        const effectiveCorrectiveMultiplier =
            target === priorityServer ? PRIORITY_SERVER_CORRECTIVE_MULTIPLIER : CORRECTIVE_GROW_WEAK_MULTIPLIER;

        // Calculate thread requirements
        const initialWeakenThreads = Math.ceil((securityLevel - minSecurityLevel) / weakenAmount);

        const growthAmount = maxMoney / Math.max(currentMoney, 1);
        const growthThreads = Math.ceil(
            effectiveCorrectiveMultiplier * ns.growthAnalyze(target, growthAmount, cpuCores),
        );
        const growthSecurityChange = growthThreads * 0.004;
        const finalWeakenThreads = Math.ceil((effectiveCorrectiveMultiplier * growthSecurityChange) / weakenAmount);

        // Calculate RAM requirements for prep operations
        const initialWeakenRam = initialWeakenThreads * WEAKEN_SCRIPT_RAM_USAGE;
        const growRam = growthThreads * GROW_SCRIPT_RAM_USAGE;
        const finalWeakenRam = finalWeakenThreads * WEAKEN_SCRIPT_RAM_USAGE;

        const totalRamRequired =
            (needsInitialWeaken ? initialWeakenRam : 0) + (needsGrow ? growRam + finalWeakenRam : 0);

        return {
            needsInitialWeaken,
            needsGrow,
            initialWeakenThreads,
            initialWeakenRam,
            growthThreads,
            growRam,
            finalWeakenThreads,
            finalWeakenRam,
            weakenTime,
            growthTime,
        };
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
                theoreticalBatchLimit,
                timePerBatch,
                batchLimitForSustainedThroughput,
                throughput,
                ramNeededPerBatch,
            } = getServerHackStats(
                ns,
                server,
                true, // Set to true to use formulas API with optimal conditions
                server === priorityServer ? PRIORITY_SERVER_HACK_PERCENTAGE : hackPercentage,
                server === priorityServer ? PRIORITY_SERVER_CORRECTIVE_MULTIPLIER : CORRECTIVE_GROW_WEAK_MULTIPLIER,
            );

            let ramForMaxThroughput = batchLimitForSustainedThroughput * ramNeededPerBatch;

            const { throughput: normalizedThroughput, ramNeededPerBatch: normalizedRamNeededPerBatch } =
                getServerHackStats(
                    ns,
                    server,
                    true, // Set to true to use formulas API with optimal conditions
                    hackPercentage,
                    CORRECTIVE_GROW_WEAK_MULTIPLIER,
                );

            // const percentageGap = (availableBatchLimit - theoreticalBatchLimit) / theoreticalBatchLimit;
            // const hackPercentageAdjustment = hackPercentage * Math.abs(percentageGap);
            // if (percentageGap < -0.4 && hackPercentage > 0.01) {
            //     hackPercentage = Math.max(hackPercentage - hackPercentageAdjustment / 5, 0.01);
            //     ns.print(`WARN: Reduced hack percentage to ${ns.formatPercent(hackPercentage)}`);
            //     minMoneyProtectionThreshold = (1 - hackPercentage) / 2 - 0.1;
            //     ns.print(`WARN: Min money protection threshold: ${ns.formatPercent(minMoneyProtectionThreshold)}`);
            // } else if (percentageGap > -0.3 && hackPercentage < 1) {
            //     hackPercentage = Math.min(hackPercentage + hackPercentageAdjustment * 1.2, 1);
            //     ns.print(`WARN: Increased hack percentage to ${ns.formatPercent(hackPercentage)}`);
            //     minMoneyProtectionThreshold = (1 - hackPercentage) / 2 - 0.1;
            //     ns.print(`WARN: Min money protection threshold: ${ns.formatPercent(minMoneyProtectionThreshold)}`);
            // }

            // if (server === "ecorp") {
            //     ns.print(`INFO: ${server} ${serverInfo.hackDifficulty} > ${serverBaselineSecurityLevels.get(server)}`);
            // }
            if (serverInfo.hackDifficulty > serverBaselineSecurityLevels.get(server)) {
                // Server needs prep, set RAM allocation to 0 to prevent wasted allocation
                ramForMaxThroughput = 0;
            }

            prioritiesMap.set(server, {
                priority: normalizedThroughput / normalizedRamNeededPerBatch / (weakenTime / 50000),
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
        if (ns.hasRootAccess(server) || server.startsWith("hacknet-server")) {
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
     * Uses caching to avoid expensive BFS traversals on every call.
     * @param {NS} ns - The Netscript API.
     * @param {"hackableOnly" | "executableOnly"} getServerOptions - Whether to include all servers or just the ones that are accessible.
     * @returns {string[]} - List of server names.
     */
    function getServers(ns, getServerOptions) {
        const now = Date.now();
        if (
            getServerOptions === "hackableOnly" &&
            hackableServersCache &&
            now - hackableServersCacheTime < CACHE_EXPIRY_MS
        ) {
            return hackableServersCache;
        }
        if (
            getServerOptions === "executableOnly" &&
            executableServersCache &&
            now - executableServersCacheTime < CACHE_EXPIRY_MS
        ) {
            return executableServersCache;
        }

        // Cache miss - perform BFS traversal
        const discovered = new Set(["home"]); // Track all discovered servers
        const toScan = ["home"]; // Queue of servers to scan
        const resultSet = new Set();

        const isHackable = (server) => {
            if (!ns.hasRootAccess(server)) return false;
            if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) return false;
            if (ns.getServerMaxMoney(server) === 0) return false;
            if (server === "home") return false;
            if (ignoreServers.includes(server)) return false;
            return true;
        };

        const isExecutable = (server) => {
            if (!ns.hasRootAccess(server)) return false;
            if (ns.getServerMaxRam(server) === 0) return false;
            if (ignoreServers.includes(server)) return false;
            if (server.startsWith("hacknet-server")) return false;
            return true;
        };

        // BFS traversal of the server network
        while (toScan.length > 0) {
            const server = toScan.shift(); // Process next server in queue

            // Handle nuking and backdooring for the current server
            nukeServerIfNeeded(ns, server);
            backdoorIfNeeded(ns, server);

            if (getServerOptions === "all" && !ignoreServers.includes(server)) {
                resultSet.add(server);
            } else if (getServerOptions === "hackableOnly" && isHackable(server)) {
                resultSet.add(server);
            } else if (getServerOptions === "executableOnly" && isExecutable(server)) {
                resultSet.add(server);
            }

            // Scan for connected servers and add new ones to the queue
            const connectedServers = ns.scan(server);
            for (const connectedServer of connectedServers) {
                if (!discovered.has(connectedServer)) {
                    toScan.push(connectedServer);
                    discovered.add(connectedServer);
                }
            }
        }

        // Move home server to end of list so leftover free RAM can be used for "home" server
        const result = Array.from(resultSet);
        const homeIndex = result.indexOf("home");
        if (homeIndex > -1) {
            const homeServer = result.splice(homeIndex, 1)[0];
            result.push(homeServer);
        }

        // Cache the results based on the requested type
        if (getServerOptions === "hackableOnly") {
            hackableServersCache = result;
            hackableServersCacheTime = now;
        } else if (getServerOptions === "executableOnly") {
            executableServersCache = result;
            executableServersCacheTime = now;
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
    function prepServer(ns, target, serverIndex, allowPartial = false) {
        const prepStats = getServerPrepStats(ns, target);
        const {
            needsInitialWeaken,
            needsGrow,
            initialWeakenThreads,
            growthThreads,
            finalWeakenThreads,
            initialWeakenRam,
            growRam,
            finalWeakenRam,
            weakenTime,
            growthTime,
        } = prepStats;

        let shouldGrow = needsGrow;

        // Check if any prep is actually needed
        if (!needsInitialWeaken && !needsGrow) {
            // Server doesn't need prep, return 0 without any success message
            return 0;
        }

        // Original logic for non-partial
        const operations = [];
        if (needsInitialWeaken) {
            operations.push({ type: "weaken", threads: initialWeakenThreads, id: "initial_weaken" });
        }
        if (shouldGrow) {
            operations.push({ type: "grow", threads: growthThreads });
            operations.push({ type: "weaken", threads: finalWeakenThreads, id: "final_weaken" });
        }

        // Find servers for prep operations with proper RAM accounting
        const allocation = allocateServersForOperations(ns, operations);

        let finalAllocation = allocation;
        if (!allocation.success && allowPartial) {
            // Try again with only weaken operations
            const weakenOnlyOperations = [{ type: "weaken", threads: initialWeakenThreads, id: "initial_weaken" }];
            const weakenOnlyAllocation = allocateServersForOperations(ns, weakenOnlyOperations);

            if (weakenOnlyAllocation.success) {
                finalAllocation = weakenOnlyAllocation;
                shouldGrow = false;
            }
        }

        if (!finalAllocation.success) {
            const isPartial = finalAllocation.scalingFactor < 1;
            const operationsDescription = finalAllocation.operations
                .map((op) => `${op.threads}${op.type.substring(0, 1).toUpperCase()}`)
                .join("-");
            ns.print(
                `INFO: ${isPartial ? `Partial ${ns.formatNumber(finalAllocation.scalingFactor, 5)}X ` : ""}PREP - ${target} Failed. Need ${operationsDescription} (${ns.formatRam(finalAllocation.scaledTotalRamRequired)} ram)`,
            );
            return false;
        }

        // Update the server RAM cache - this is handled by allocateServersForOperations

        let totalRamUsed = 0;

        if (needsInitialWeaken) {
            if (finalAllocation.initial_weaken) {
                // Execute weaken on potentially multiple servers
                for (const [server, threads] of finalAllocation.initial_weaken) {
                    executeWeaken(ns, server, target, threads, 0, true, weakenTime);
                }
                totalRamUsed += finalAllocation.scalingFactor * initialWeakenRam;
            } else {
                ns.print(`ERROR: Allocations were malformed for PREP ${target} - initial_weaken`);
            }
        }

        if (shouldGrow && finalAllocation.grow && finalAllocation.final_weaken) {
            // Execute grow on single server (as enforced by the allocation function)
            const growWeakenDiff = weakenTime - growthTime;
            const growDelay = needsInitialWeaken
                ? growWeakenDiff + BASE_SCRIPT_DELAY
                : Math.max(0, growWeakenDiff - BASE_SCRIPT_DELAY);
            if (growDelay < 0) {
                ns.tprint(`ERROR: Negative grow delay detected for PREP ${target} - growDelay=${growDelay}`);
                return false;
            }
            for (const [server, threads] of finalAllocation.grow) {
                executeGrow(ns, server, target, threads, growDelay, false, true, growthTime);
            }
            totalRamUsed += finalAllocation.scalingFactor * growRam;

            // Execute final weaken on potentially multiple servers
            const finalWeakenDelay = needsInitialWeaken
                ? 2 * BASE_SCRIPT_DELAY
                : Math.max(0, BASE_SCRIPT_DELAY - growWeakenDiff);
            for (const [server, threads] of finalAllocation.final_weaken) {
                executeWeaken(ns, server, target, threads, finalWeakenDelay, true, weakenTime);
            }
            totalRamUsed += finalAllocation.scalingFactor * finalWeakenRam;
        } else if (shouldGrow) {
            ns.print(`ERROR: Allocations were malformed for PREP ${target} - grow and final_weaken`);
        }

        // Only print success message if we actually used RAM for prep operations
        if (totalRamUsed > 0) {
            const priorityIndicator = target === priorityServer ? " [PRIORITY]" : "";
            ns.print(`SUCCESS ${serverIndex}. ${target}${priorityIndicator}: PREP ${ns.formatRam(totalRamUsed)}`);
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
            const priorityIndicator = target === priorityServer ? " [PRIORITY]" : "";
            ns.print(
                `SUCCESS ${serverIndex}. ${target}${priorityIndicator}: HGW ${successfulBatches}/${totalBatches} batches, ${ns.formatRam(totalRamUsed)} (${serverStats.hackThreads}H ${serverStats.growthThreads}G ${serverStats.weakenThreadsNeeded}W per batch)`,
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
            return { success: false, ramUsed: 0 }; // Not enough RAM to run H G and W
        }

        // Calculate delays
        const hackDelay = weakenTime + extraDelay - 2 * BASE_SCRIPT_DELAY - hackTime;
        const growDelay = weakenTime + extraDelay - BASE_SCRIPT_DELAY - growthTime;
        const weakenDelay = extraDelay;

        // Validate delays are not negative (which would cause timing issues)
        if (hackDelay < 0 || growDelay < 0 || weakenDelay < 0) {
            ns.tprint(`ERROR: Negative delays detected! H=${hackDelay}, G=${growDelay}, W=${weakenDelay}`);
            ns.tprint(
                `Times: hackTime=${hackTime}, growthTime=${growthTime}, weakenTime=${weakenTime}, extraDelay=${extraDelay}`,
            );
            return { success: false, ramUsed: 0 };
        }

        if (allocation.hack && allocation.grow && allocation.weaken) {
            // Execute hack operations
            for (const [server, threads] of allocation.hack) {
                executeHack(ns, server, target, threads, hackDelay, false, false, hackTime);
            }

            for (const [server, threads] of allocation.grow) {
                executeGrow(ns, server, target, threads, growDelay, false, false, growthTime);
            }

            // Execute weaken operations
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
            `endTime=${Date.now() + sleepTime + weakenTime}`,
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
            `endTime=${Date.now() + sleepTime + growTime}`,
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
            `endTime=${Date.now() + sleepTime + hackTime}`,
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
     * Only kicks in late game basically because early game we don't have spare ram - need it for batch hacking
     * Late game the xpFarm cycle is finally faster than our tick time so we can do a few cycles per tick and we will also have left over ram
     * @param {NS} ns - The Netscript API.
     */
    function xpFarm(ns, always = false) {
        const xpTarget = "foodnstuff";
        const xpFarmScript = "/scripts/xp-farm.js";

        // Check if target server exists and we have root access
        if (!ns.serverExists(xpTarget) || !ns.hasRootAccess(xpTarget)) {
            return;
        }

        let serverInfo = ns.getServer(xpTarget);

        if (serverInfo.moneyAvailable < serverInfo.moneyMax || serverInfo.hackDifficulty > serverInfo.minDifficulty) {
            const prepRamUsed = prepServer(ns, xpTarget, 1, true);
            if (prepRamUsed !== false && prepRamUsed > 0) {
                ns.print(`SUCCESS XP Farm: Prepped ${xpTarget} with ${ns.formatRam(prepRamUsed)}`);
            }
            return;
        }

        const growTime = ns.getGrowTime(xpTarget);
        let growCycles = Math.floor(TICK_DELAY / (growTime + BASE_SCRIPT_DELAY));
        if (always) {
            growCycles = Math.max(growCycles, 1);
        }

        // Collect server/thread pairs for all available RAM
        const serverThreadPairs = [];
        let totalThreads = 0;

        for (const server of executableServers) {
            // Use serverRamCache which reflects actual available RAM after all batch scheduling
            const availableRam = serverRamCache.get(server) || 0;
            const threadsAvailable = Math.floor(availableRam / GROW_SCRIPT_RAM_USAGE);

            if (threadsAvailable > 0) {
                serverThreadPairs.push(server, threadsAvailable);
                totalThreads += threadsAvailable;

                // Update serverRamCache to reflect the RAM that will be used
                serverRamCache.set(server, availableRam - threadsAvailable * GROW_SCRIPT_RAM_USAGE);
            }
        }

        if (serverThreadPairs.length > 0 && growCycles > 0) {
            // Build arguments: target, cycles, weakenTime, server1, threads1, server2, threads2, ...
            const args = [xpTarget, growCycles, growTime, ...serverThreadPairs];

            // Launch the XP farm script on home
            const pid = ns.exec(xpFarmScript, "home", 1, ...args);

            if (pid) {
                const remainingRamUsed = totalThreads * GROW_SCRIPT_RAM_USAGE;
                ns.print(
                    `SUCCESS XP Farm: Launched script with ${growCycles} cycles, ${ns.formatRam(remainingRamUsed)} across ${serverThreadPairs.length / 2} servers`,
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
     *     hack: Map<string, number>,     // serverName -> threads
     *     grow: Map<string, number>,     // serverName -> threads
     *     weaken: Map<string, number>,   // serverName -> threads
     *     initial_weaken: Map<string, number>, // if id='initial_weaken'
     *     final_weaken: Map<string, number>,   // if id='final_weaken'
     *     // ... other operations with custom ids
     *     totalRamUsed: number,
     *     scalingFactor: number          // Factor by which operations were scaled (1.0 = no scaling)
     *   }
     *
     * Key behaviors:
     * 1. If insufficient total RAM, scales down all operations proportionally
     * 2. Operations can be split across multiple servers
     * 3. Grow operations are allocated first to ensure they get priority
     * 4. Remaining operations are allocated to remaining servers
     * 6. Updates global serverRamCache and removes servers with insufficient RAM (< 1.75GB)
     */
    function allocateServersForOperations(ns, operations, allowPartial = false) {
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

        // Calculate scaling factor if requires more than all of the ram we have
        if (totalRamRequired > maxRamAvailable && allowPartial) {
            // Scale based on free ram, not max ram
            // Leave a bit of room in every server in case scripts just barely fit
            scalingFactor = Math.max(
                0,
                (totalFreeRam - (MINIMUM_SCRIPT_RAM_USAGE / 2) * executableServers.length) / totalRamRequired,
            );
        }

        // Scale down operations if necessary
        const scaledOperations = operations.map((op) => ({
            ...op,
            threads: Math.max(1, Math.floor(op.threads * scalingFactor)),
        }));

        const scaledTotalRamRequired = getTotalRamRequired(scaledOperations);

        // Result object to store allocations
        const result = {
            success: false,
            totalRamUsed: 0,
            scalingFactor: scalingFactor,
            totalRamRequired: totalRamRequired,
            scaledTotalRamRequired: scaledTotalRamRequired,
            operations: scaledOperations,
        };

        // Validate input
        if (!operations || operations.length === 0 || scaledTotalRamRequired === 0) {
            result.success = false;
            return result;
        }

        // Skip low scaling factor so we don't allocate spare threads.
        if (scalingFactor < PARTIAL_PREP_THRESHOLD) {
            return result;
        }

        if (scalingFactor < 1) {
            ns.print(
                `INFO: Partial allocation required. Scaling ${ns.formatNumber(scalingFactor)}x: ${ns.formatRam(scaledTotalRamRequired)} of ${ns.formatRam(totalRamRequired)} to fit ${ns.formatRam(totalFreeRam)}`,
            );
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

        // Step 2: Allocate hack operations
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

        // Step 3: Allocate weaken operations
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

        // All allocations successful
        result.success = true;
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

    /**
     * Cleanup old cache entries to prevent memory leaks.
     * Should be called periodically to clear expired caches.
     */
    function cleanupServerCaches() {
        const now = Date.now();

        if (hackableServersCache && now - hackableServersCacheTime > CACHE_EXPIRY_MS * 3) {
            hackableServersCache = null;
        }
        if (executableServersCache && now - executableServersCacheTime > CACHE_EXPIRY_MS * 3) {
            executableServersCache = null;
        }
    }

    function getWeakenTimeDrift(ns) {
        // Check for weakenTime desync by comparing with original batch timings
        let outOfSyncServers = 0;
        let totalPercentChange = 0;
        let totalMsChange = 0;
        let totalCurrentTime = 0;

        const DRIFT_THRESHOLD_PERCENT = 0.01; // 1% drift threshold for holding HGW and resuming on new weaken time
        const HOLD_BUFFER_MS = DELAY_BETWEEN_BATCHES * 4;

        for (const [server, { originalWeakenTime }] of serverBatchTimings.entries()) {
            const serverStats = globalPrioritiesMap.get(server);
            if (!serverStats) {
                ns.print(`WARN: No server stats found for ${server}`);
                continue;
            }

            // Use a small tolerance for floating point comparisons
            if (Math.abs(serverStats.weakenTime - originalWeakenTime) > 0.001) {
                outOfSyncServers++;
                const msChange = originalWeakenTime - serverStats.weakenTime;
                const percentChange = originalWeakenTime !== 0 ? Math.abs(msChange / originalWeakenTime) : 0;

                totalMsChange += msChange;
                totalPercentChange += percentChange;
                totalCurrentTime += serverStats.weakenTime;

                // Check if server should be put on hold for excessive drift
                if (percentChange > DRIFT_THRESHOLD_PERCENT && !serversOnHold.has(server)) {
                    const holdDurationMs = serverStats.weakenTime * DRIFT_THRESHOLD_PERCENT + HOLD_BUFFER_MS;
                    serversOnHold.set(server, Date.now() + holdDurationMs);

                    ns.print(
                        `WARN: ${server} drift ${ns.formatPercent(percentChange)} > ${DRIFT_THRESHOLD_PERCENT}% threshold. Hold for ${ns.formatNumber(holdDurationMs / 1000, 1)}s`,
                    );
                    serverBatchTimings.delete(server);
                }
            }
        }

        if (outOfSyncServers > 0) {
            const avgPercentChange = totalPercentChange / outOfSyncServers;
            const avgMsChange = totalMsChange / outOfSyncServers;
            const avgCurrentWeakenTime = totalCurrentTime / outOfSyncServers;

            return {
                avgPercentChange,
                avgMsChange,
                avgCurrentWeakenTime,
                outOfSyncServers,
            };
        }
        return {
            avgPercentChange: 0,
            avgMsChange: 0,
            avgCurrentWeakenTime: 0,
            outOfSyncServers: 0,
        };
    }

    /**
     * Checks if servers on hold can resume and cleans up expired holds.
     * @param {NS} ns - The Netscript API.
     */
    function processServersOnHold(ns) {
        const currentTime = Date.now();
        const serversToResume = [];

        for (const [server, resumeTimestamp] of serversOnHold.entries()) {
            if (currentTime >= resumeTimestamp) {
                serversToResume.push(server);
            }
        }

        for (const server of serversToResume) {
            serversOnHold.delete(server);
            ns.print(`DRIFT RESUME: ${server} can resume batch execution after drift cooldown`);
        }
    }
}
