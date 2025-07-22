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
    let MAX_WEAKEN_TIME = 5 * 60 * 1000; // ms max weaken time (Max 10 minutes)

    let ALLOW_HASH_UPGRADES = true;
    const CORRECTIVE_GROW_WEAK_MULTIPLIER = 1.4; // Use extra grow and weak threads to correct for out of sync HGW batches
    let PARTIAL_PREP_THRESHOLD = 0;

    let serversToHack = []; // ["clarkinc"];

    // let minMoneyProtectionThreshold = 1 - hackPercentage - 0.25;
    const BASE_SCRIPT_DELAY = 20; // ms delay between scripts, will be added to dynamically
    const DELAY_BETWEEN_BATCHES = 20; // ms delay between batches
    const TIME_PER_BATCH = BASE_SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES;
    const TICK_DELAY = 800; // ms delay between ticks

    const HOME_SERVER_RESERVED_RAM = 100; // GB reserved for home server
    const ALWAYS_XP_FARM = false;
    const XP_FARM_SERVER = "foodnstuff";
    const ALLOW_PARTIAL_PREP = true;
    const SHOULD_INFLUENCE_STOCKS = true;
    const ONLY_MANIPULATE_STOCKS = false;

    let growStocks = new Map();
    let hackStocks = new Map();

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
        // "w0r1d_d43m0n",
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
    let maxRamAvailableForHacking = 0;

    ns.disableLog("ALL");

    if (ns.args.length > 0) {
        ignoreServers = ns.args;
    }

    // Global counters for server success tracking
    let totalServersAttempted = 0;
    let totalServersNotDiscarded = 0;
    let totalServerTickTimes = 0;

    // === PERFORMANCE MONITORING ===
    let performanceStats = {
        infrastructure: [],
        dataGathering: [],
        stateMachine: [],
        actionExecution: [],
        cleanup: [],
        total: [],
        // Detailed breakdown for bottleneck identification
        getServers: [],
        scriptInfo: [],
        stockPorts: [],
        priorities: [],
        knapsack: [],
        allocations: [],
    };

    function logPerformance(category, duration, details = "") {
        performanceStats[category].push(duration);
        // Keep only last 10 measurements to prevent memory growth
        if (performanceStats[category].length > 10) {
            performanceStats[category].shift();
        }
    }

    function getPerformanceAverage(category) {
        const stats = performanceStats[category];
        if (stats.length === 0) return 0;
        return stats.reduce((a, b) => a + b, 0) / stats.length;
    }

    let didPrintPerformanceReport = false;
    function printPerformanceReport() {
        if (tickCounter % 20 === 0 && !didPrintPerformanceReport) {
            // Report every 5 ticks
            ns.tprint(`\n=== PERFORMANCE REPORT (Tick ${tickCounter}) ===`);
            ns.tprint(`Infrastructure: ${getPerformanceAverage("infrastructure").toFixed(1)}ms`);
            ns.tprint(`Data Gathering: ${getPerformanceAverage("dataGathering").toFixed(1)}ms`);
            ns.tprint(`  - getServers: ${getPerformanceAverage("getServers").toFixed(1)}ms`);
            ns.tprint(`  - scriptInfo: ${getPerformanceAverage("scriptInfo").toFixed(1)}ms`);
            ns.tprint(`  - stockPorts: ${getPerformanceAverage("stockPorts").toFixed(1)}ms`);
            ns.tprint(`  - priorities: ${getPerformanceAverage("priorities").toFixed(1)}ms`);
            ns.tprint(`    - knapsack: ${getPerformanceAverage("knapsack").toFixed(1)}ms`);
            ns.tprint(`State Machine: ${getPerformanceAverage("stateMachine").toFixed(1)}ms`);
            ns.tprint(`Action Execution: ${getPerformanceAverage("actionExecution").toFixed(1)}ms`);
            ns.tprint(`  - allocations: ${getPerformanceAverage("allocations").toFixed(1)}ms`);
            ns.tprint(`Cleanup: ${getPerformanceAverage("cleanup").toFixed(1)}ms`);
            ns.tprint(`TOTAL TICK TIME: ${getPerformanceAverage("total").toFixed(1)}ms (target: 0ms)`);

            const totalAvg = getPerformanceAverage("total");
            if (totalAvg > 800) {
                ns.tprint(
                    `WARNING: Tick time ${totalAvg.toFixed(1)}ms exceeds target 800ms by ${(totalAvg - 800).toFixed(1)}ms`,
                );
            }
            didPrintPerformanceReport = true;
        }
    }

    // Server States for State Machine
    const ServerState = {
        NEEDS_PREP: "NEEDS_PREP",
        PREPPING: "PREPPING",
        BATCHING: "BATCHING",
        ON_HOLD: "ON_HOLD",
        EXCLUDED: "EXCLUDED", // For servers that don't meet basic criteria
    };

    // Action Types
    const ActionType = {
        UPGRADE_HASH_MAX_MONEY: "UPGRADE_HASH_MAX_MONEY",
        UPGRADE_HASH_MIN_SECURITY: "UPGRADE_HASH_MIN_SECURITY",
        PREP_SERVER: "PREP_SERVER",
        SCHEDULE_BATCHES: "SCHEDULE_BATCHES",
        SKIP_BATCHES: "SKIP_BATCHES",
        KILL_SCRIPTS: "KILL_SCRIPTS",
        CLEAR_TIMINGS: "CLEAR_TIMINGS",
        UPDATE_BASELINE: "UPDATE_BASELINE",
        STORE_TIMINGS: "STORE_TIMINGS",
        XP_FARM: "XP_FARM",
        LOG_MESSAGE: "LOG_MESSAGE",
    };
    let lastTickTime = 0;

    // === SIMPLE TICK-BASED PRIORITY CACHE ===
    let prioritiesCacheData = null;
    let prioritiesCacheValidUntilTick = 0;
    const CACHE_DURATION_TICKS = 30; // Cache priorities for 30 ticks

    // === PERFORMANCE OPTIMIZATION: Server Stats Cache ===
    // Cache expensive calculations that don't change between thread counts for the same server
    let serverStatsCache = new Map(); // Map<serverName, CachedServerStats>
    let globalCalculationCache = null; // Cache player, bitnode multipliers etc.

    let ramOverestimation = 1.8;

    // === MAIN STATE MACHINE LOOP ===
    while (true) {
        const tickStartTime = performance.now();
        tickCounter++;
        ns.print(`\n=== Tick ${tickCounter} ===`);

        // Clear optimization caches at start of each tick
        serverStatsCache.clear();
        globalCalculationCache = null;

        if (lastTickTime !== 0) {
            const actualTickTime = tickStartTime - lastTickTime;
            totalServerTickTimes += actualTickTime;
            ns.print(`Previous tick took ${actualTickTime.toFixed(1)}ms`);
        }

        // === INFRASTRUCTURE PHASE ===
        const infraStart = performance.now();
        await setupServers(ns);
        logPerformance("infrastructure", performance.now() - infraStart);

        // === DATA GATHERING PHASE ===
        const dataStart = performance.now();
        const gameState = gatherGameState(ns);
        logPerformance("dataGathering", performance.now() - dataStart);

        // === STATE MACHINE PHASE (Pure Reducer) ===
        const stateStart = performance.now();
        const actions = calculateActions(gameState);
        logPerformance("stateMachine", performance.now() - stateStart);

        // === ACTION EXECUTION PHASE ===
        const execStart = performance.now();
        const executionResults = await executeActions(ns, actions);
        logPerformance("actionExecution", performance.now() - execStart);

        // === CLEANUP PHASE ===
        const cleanupStart = performance.now();
        performEndOfTickOperations(ns, executionResults);
        logPerformance("cleanup", performance.now() - cleanupStart);

        const tickEndTime = performance.now();
        const totalTickTime = tickEndTime - tickStartTime;
        logPerformance("total", totalTickTime);
        lastTickTime = tickStartTime;

        // Print performance report
        printPerformanceReport();

        // Log severe performance warnings immediately
        const totalAvg = getPerformanceAverage("total");
        if (totalAvg > 1200) {
            ns.tprint(`CRITICAL: Tick time ${totalAvg.toFixed(1)}ms severely exceeds target! Check performance log.`);
        }

        await ns.sleep(TICK_DELAY);
    }

    // === INFRASTRUCTURE SETUP ===
    async function setupServers(ns) {
        // Cleanup server caches every 30 seconds to prevent memory leaks
        if (tickCounter % Math.floor(30000 / TICK_DELAY) === 0) {
            cleanupServerCaches();
            processServersOnHold(ns);
        }

        // Get all servers
        const getServersStart = performance.now();
        executableServers = getServers(ns, "executableOnly");
        hackableServers = getServers(ns, "hackableOnly").filter((server) => {
            return true;
        });
        logPerformance("getServers", performance.now() - getServersStart);

        maxRamAvailable = executableServers.reduce((acc, server) => acc + ns.getServerMaxRam(server), 0);
        totalFreeRam = getTotalFreeRam(ns);
        ns.print(`Total RAM Available: ${ns.formatRam(totalFreeRam)}`);

        // Run contract solving script each tick
        runSolveContractsScript(ns);

        // Copy scripts to all executable servers
        const scriptsToCopy = [hackScript, growScript, weakenScript];
        for (const server of executableServers) {
            if (server !== "home") {
                ns.scp(scriptsToCopy, server, "home");
            }
        }
    }

    // === DATA GATHERING PHASE ===
    function gatherGameState(ns) {
        // Gather all required data for decision making
        const scriptInfoStart = performance.now();
        const { scriptInfoByTarget, scriptInfoByHost } = getRunningScriptInfo(ns);
        logPerformance("scriptInfo", performance.now() - scriptInfoStart);

        maxRamAvailableForHacking = executableServers.reduce(
            (acc, server) => acc + scriptInfoByHost.get(server).ramUsed,
            totalFreeRam,
        );

        ns.print(`DEBUG: maxRamAvailableForHacking: ${ns.formatRam(maxRamAvailableForHacking)}`);

        // Gather stocks to grow/short
        const stockStart = performance.now();
        if (SHOULD_INFLUENCE_STOCKS) {
            /** @param {NS} ns
             * @param {number} portNumber
             * @param {Set<string>} content
             * @returns {Set<string>}
             */
            function getStockPortContent(ns, portNumber, content) {
                var portHandle = ns.getPortHandle(portNumber);
                var firstPortElement = portHandle.peek();
                if (firstPortElement == "NULL PORT DATA") {
                    // no new data available
                    return content;
                } else if (firstPortElement == "EMPTY") {
                    // "EMPTY" means that the list shall be set to empty
                    portHandle.clear();
                    return new Map();
                } else {
                    // list shall be updated
                    content = new Map();
                    while (!portHandle.empty()) {
                        const [server, value] = portHandle.read().split(":");
                        content.set(server, Number(value));
                    }
                }
                return content;
            }

            growStocks = getStockPortContent(ns, 1, growStocks); // port 1 is grow
            hackStocks = getStockPortContent(ns, 2, hackStocks); // port 2 is hack
        }
        logPerformance("stockPorts", performance.now() - stockStart);

        // Calculate global priorities map once per tick (without excluding any servers)
        const prioritiesStart = performance.now();
        const { prioritiesMap, serverMaxPriorities } = calculateTargetServerPriorities(ns);
        globalPrioritiesMap = prioritiesMap;

        for (const [server, config] of globalPrioritiesMap.entries()) {
            ns.print(
                `MAX HACK: ${config.server} | ${config.hackThreads}H (${ns.formatPercent(config.hackPercentage)}) | ${ns.formatRam(config.ramPerBatch, 1)} x ${config.batchLimitForSustainedThroughput} = ${ns.formatRam(config.ramUsageForSustainedThroughput, 1)} (${ns.formatPercent(config.batchSustainRatio)}) p${ns.formatNumber(config.priority, 1)}`,
            );
        }
        logPerformance("priorities", performance.now() - prioritiesStart);

        // Process servers on hold and check if any can resume
        processServersOnHold(ns);

        // Send throughput data to port 4 for get_stats.js
        var priorityPortHandle = ns.getPortHandle(4);
        priorityPortHandle.clear();
        for (let [server, maxPriority] of serverMaxPriorities.entries()) {
            priorityPortHandle.write(JSON.stringify({ server: server, priority: maxPriority }));
        }

        var throughputPortHandle = ns.getPortHandle(5);
        throughputPortHandle.clear();
        for (let [server, { throughput }] of prioritiesMap.entries()) {
            throughputPortHandle.write(JSON.stringify({ server: server, throughput: throughput }));
        }

        // Sort servers by their maximum possible throughput (calculated in calculateTargetServerPriorities)
        const serversByPriority = Array.from(serverMaxPriorities.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([server]) => server);

        return {
            scriptInfoByTarget,
            serversByPriority,
        };
    }

    // === PURE REDUCER - STATE MACHINE ===
    function calculateActions(gameState) {
        const actions = [];
        let ramToDistribute = totalFreeRam;
        let totalRamUsed = 0;
        let successfullyProcessedServers = [];

        // 1. Hash Upgrade Actions
        const hashActions = calculateHashUpgradeActions(gameState);
        actions.push(...hashActions);

        // 2. Server Processing Actions
        ns.print(
            `DEBUG: Processing ${gameState.serversByPriority.length} servers with ${ns.formatRam(ramToDistribute)} available`,
        );
        for (
            let serverIndex = 0;
            serverIndex < gameState.serversByPriority.length && ramToDistribute > 0;
            serverIndex++
        ) {
            const server = gameState.serversByPriority[serverIndex];
            const serverState = determineServerState(server, gameState);
            // if (serverState !== ServerState.EXCLUDED) {
            //     ns.print(`DEBUG: Server ${server} state: ${serverState}`);
            // }
            const serverInfo = ns.getServer(server);

            // === SERVER ACTIONS CALCULATION ===
            let serverActions = [];

            switch (serverState) {
                case ServerState.NEEDS_PREP:
                    // calculatePrepActions
                    serverActions = [
                        {
                            type: ActionType.PREP_SERVER,
                            server,
                            serverIndex: serverIndex + 1,
                            allowPartial: ALLOW_PARTIAL_PREP,
                        },
                    ];
                    break;

                case ServerState.PREPPING:
                    // Calculate completed prep early exit
                    const isFullyPrepped =
                        serverInfo.moneyAvailable >= serverInfo.moneyMax &&
                        serverInfo.hackDifficulty <= serverInfo.minDifficulty;

                    if (isFullyPrepped) {
                        // Clean up stale prep scripts
                        serverActions = [
                            {
                                type: ActionType.LOG_MESSAGE,
                                message: `WARN: ${server} is fully prepped with lingering G/W scripts. Clearing them to start HGW.`,
                            },
                            {
                                type: ActionType.KILL_SCRIPTS,
                                server,
                                scriptTypes: ["grow", "weaken"],
                            },
                        ];
                        break;
                    }

                    // calculatePreppingActions
                    if (serverPrepTimings.has(server)) {
                        const prepTiming = serverPrepTimings.get(server);
                        const prepStats = getServerPrepStats(ns, server);
                        const newWeakenTime = prepStats.weakenTime;

                        const currentFinishTime = prepTiming.startTime + prepTiming.weakenTime;
                        const newFinishTime = Date.now() + newWeakenTime;

                        if (currentFinishTime > newFinishTime) {
                            serverActions.push({
                                type: ActionType.LOG_MESSAGE,
                                message: `WARN: ${server} hack levels improved so much that we should re-prep since it'll be faster`,
                            });
                            serverActions.push({
                                type: ActionType.KILL_SCRIPTS,
                                server,
                                scriptTypes: ["grow", "weaken"],
                            });
                        }
                    }
                    break;

                case ServerState.BATCHING:
                    const serverStats = globalPrioritiesMap.get(server);
                    // Determine server drift recovery conditions
                    const securityThreshold = Math.max(
                        serverInfo.minDifficulty + 15,
                        serverInfo.minDifficulty + serverStats.totalSecurityIncrease * 2,
                    );

                    const moneyProtectionThreshold = 1 - serverStats.hackPercentage - 0.25; // TODO: this could be outdated, a new server can become available and the smaller one gets hacked way less

                    const securityBreach = serverInfo.hackDifficulty > securityThreshold;
                    const moneyBreach = serverInfo.moneyAvailable < serverInfo.moneyMax * moneyProtectionThreshold;

                    const needsRecovery = securityBreach || moneyBreach;

                    if (needsRecovery) {
                        const message = securityBreach
                            ? `WARN: ${new Date().toLocaleTimeString()} Security on ${server} (${ns.formatNumber(
                                  serverInfo.hackDifficulty,
                                  2,
                              )}) breached threshold (${ns.formatNumber(securityThreshold, 2)}). Recovering.`
                            : `WARN: ${new Date().toLocaleTimeString()} Money on ${server} ($${ns.formatNumber(
                                  serverInfo.moneyAvailable,
                              )}) below ${ns.formatPercent(moneyProtectionThreshold)} of max money. Recovering.`;

                        serverActions = [
                            { type: ActionType.LOG_MESSAGE, message },
                            { type: ActionType.KILL_SCRIPTS, server, scriptTypes: ["hack"] },
                            { type: ActionType.CLEAR_TIMINGS, server },
                        ];
                        break;
                    }

                    // calculateBatchingActions
                    if (serverStats) {
                        if (serverStats.skippedDueToSecurity) {
                            serverActions.push({
                                type: ActionType.SKIP_BATCHES,
                                server,
                            });
                            break;
                        }

                        // Single server optimization - continuously add batches every tick
                        const { batchLimitForSustainedThroughput, ramPerBatch } = serverStats;
                        const maxBatchesThisTick = Math.floor(TICK_DELAY / TIME_PER_BATCH);

                        // Schedule up to the maximum batches per tick
                        let batchesToSchedule = Math.min(batchLimitForSustainedThroughput, maxBatchesThisTick);

                        // For very fast servers (weaken time < TIME_PER_BATCH), use max tick batches
                        if (serverStats.weakenTime < TIME_PER_BATCH) {
                            batchesToSchedule = maxBatchesThisTick;
                        }

                        if (batchesToSchedule > 0) {
                            let timeDriftDelay = 0;
                            if (serverBatchTimings.has(server)) {
                                const originalTimings = serverBatchTimings.get(server);
                                timeDriftDelay = originalTimings.originalWeakenTime - serverStats.weakenTime;
                                if (timeDriftDelay < 0) {
                                    timeDriftDelay = 0;
                                }
                            }

                            serverActions.push({
                                type: ActionType.SCHEDULE_BATCHES,
                                server,
                                serverIndex: serverIndex + 1,
                                batchesToSchedule,
                                serverStats,
                                timeDriftDelay,
                                ramUsed: batchesToSchedule * ramPerBatch,
                            });

                            // Store timings if not already stored
                            if (!serverBatchTimings.has(server)) {
                                serverActions.push({
                                    type: ActionType.STORE_TIMINGS,
                                    server,
                                    timings: {
                                        originalWeakenTime: serverStats.weakenTime,
                                        originalGrowthTime: serverStats.growthTime,
                                        originalHackTime: serverStats.hackTime,
                                    },
                                });
                            }

                            // Update baseline security
                            serverActions.push({
                                type: ActionType.UPDATE_BASELINE,
                                server,
                            });
                        }
                    }
                    break;

                case ServerState.ON_HOLD:
                    // calculateOnHoldActions
                    const resumeTime = serversOnHold.get(server);
                    const timeLeft = Math.max(0, resumeTime - Date.now());

                    // Only log occasionally to avoid spam
                    if (tickCounter % 10 === 0) {
                        serverActions = [
                            {
                                type: ActionType.LOG_MESSAGE,
                                message: `INFO: ${server} on hold for drift. Resume in ${ns.formatNumber(timeLeft / 1000, 1)}s`,
                            },
                        ];
                    }
                    break;

                case ServerState.EXCLUDED:
                    serverActions = [];
                    break;

                default:
                    serverActions = [
                        {
                            type: ActionType.LOG_MESSAGE,
                            message: `ERROR: Unknown server state: ${serverState} for ${server}`,
                        },
                    ];
                    break;
            }

            actions.push(...serverActions);

            // Update RAM tracking for next server - no need to analyze actions here
            const ramUsed = serverActions
                .filter(
                    (action) => action.type === ActionType.PREP_SERVER || action.type === ActionType.SCHEDULE_BATCHES,
                )
                .reduce((total, action) => total + (action.ramUsed || 0), 0);

            if (ramUsed > 0) {
                totalRamUsed += ramUsed;
                ramToDistribute -= ramUsed;
                successfullyProcessedServers.push(server);
            }
        }

        // 3. XP Farm Action
        if (ramToDistribute > 0) {
            const scriptInfo = gameState.scriptInfoByTarget.get(XP_FARM_SERVER);
            actions.push({
                type: ActionType.XP_FARM,
                ramAvailable: ramToDistribute,
                always: ALWAYS_XP_FARM,
                isBatching: scriptInfo?.hasGrow && scriptInfo?.hasWeaken && scriptInfo?.hasHack,
            });
        }

        return {
            actions,
            metadata: {
                totalRamUsed,
                successfullyProcessedServers,
                ramToDistribute,
            },
        };
    }

    // === SERVER STATE DETERMINATION ===
    function determineServerState(server, gameState) {
        // Basic exclusion checks
        // if (!serversToHack.includes(server)) {
        //     return ServerState.EXCLUDED;
        // }

        if (serversOnHold.has(server)) {
            return ServerState.ON_HOLD;
        }

        const serverStats = globalPrioritiesMap.get(server);
        if (!serverStats) {
            return ServerState.EXCLUDED;
        }
        // if (serverStats.batchLimitForSustainedThroughput <= 0) {
        //     ns.print(
        //         `DEBUG: No sustainable batches for ${server}: limit=${serverStats.batchLimitForSustainedThroughput}`,
        //     );
        //     return ServerState.EXCLUDED;
        // }

        const serverInfo = ns.getServer(server);
        const currentServerScripts = gameState.scriptInfoByTarget.get(server) || {
            ramUsed: 0,
            isPrep: false,
            hasHack: false,
            hasGrow: false,
            hasWeaken: false,
            isXp: false,
        };

        const isHgw = currentServerScripts.hasHack && currentServerScripts.hasGrow && currentServerScripts.hasWeaken;
        const isPrep =
            currentServerScripts.isPrep ||
            (!currentServerScripts.hasHack &&
                (currentServerScripts.hasGrow || currentServerScripts.hasWeaken) &&
                !currentServerScripts.isXp);

        if (isHgw) {
            return ServerState.BATCHING;
        }

        if (isPrep) {
            return ServerState.PREPPING;
        }

        // Check if server needs prep
        const needsPrep =
            serverInfo.moneyAvailable < serverInfo.moneyMax || serverInfo.hackDifficulty > serverInfo.minDifficulty;

        if (needsPrep) {
            return ServerState.NEEDS_PREP;
        }

        return ServerState.BATCHING;
    }

    // === HASH UPGRADE ACTIONS CALCULATOR ===
    function calculateHashUpgradeActions(gameState) {
        const actions = [];

        if (!ALLOW_HASH_UPGRADES) return actions;

        // Find highest priority server for hash upgrades
        const highestPriorityServer = gameState.serversByPriority.find((server) => {
            return (
                ns.getWeakenTime(server) <= MAX_WEAKEN_TIME &&
                (ns.getServerMaxMoney(server) < 10e12 || ns.getServerMinSecurityLevel(server) > 10)
            );
        });

        if (!highestPriorityServer) return actions;

        const serverScriptInfo = gameState.scriptInfoByTarget.get(highestPriorityServer);
        const hasAllScripts = serverScriptInfo?.hasHack && serverScriptInfo?.hasGrow && serverScriptInfo?.hasWeaken;

        if (!hasAllScripts) return actions;

        const serverInfo = ns.getServer(highestPriorityServer);

        // Generate upgrade actions
        if (serverInfo.moneyMax < 10e12 && CORRECTIVE_GROW_WEAK_MULTIPLIER > 1) {
            actions.push({
                type: ActionType.UPGRADE_HASH_MAX_MONEY,
                server: highestPriorityServer,
            });
        }

        if (serverInfo.hackDifficulty > 10 && serverInfo.hackDifficulty === serverInfo.minDifficulty) {
            actions.push({
                type: ActionType.UPGRADE_HASH_MIN_SECURITY,
                server: highestPriorityServer,
            });
        }

        return actions;
    }

    // === ACTION EXECUTOR ===
    async function executeActions(ns, actionResults) {
        const { actions, metadata } = actionResults;
        let totalRamUsed = 0;

        for (const action of actions) {
            switch (action.type) {
                case ActionType.UPGRADE_HASH_MAX_MONEY:
                    await executeHashUpgradeMaxMoney(ns, action);
                    break;

                case ActionType.UPGRADE_HASH_MIN_SECURITY:
                    await executeHashUpgradeMinSecurity(ns, action);
                    break;

                case ActionType.PREP_SERVER:
                    const prepRamUsed = await executePrepServer(ns, action);
                    if (prepRamUsed > 0) {
                        totalRamUsed += prepRamUsed;
                    }
                    break;

                case ActionType.SCHEDULE_BATCHES:
                    const batchRamUsed = await executeScheduleBatches(ns, action);
                    if (batchRamUsed > 0) {
                        totalRamUsed += batchRamUsed;
                    }
                    totalServersAttempted++; // Count all batch attempts
                    totalServersNotDiscarded++; // If we get here, server was not skipped due to security
                    break;

                case ActionType.SKIP_BATCHES:
                    totalServersAttempted++;
                    ns.print(`WARN: ${action.server} is skipped due to security.`);
                    break;

                case ActionType.KILL_SCRIPTS:
                    killAllScriptsForTarget(ns, action.server, action.scriptTypes);
                    break;

                case ActionType.CLEAR_TIMINGS:
                    if (serverBatchTimings.has(action.server)) {
                        serverBatchTimings.delete(action.server);
                        ns.print(`INFO: ${action.server} entering prep. Clearing stored batch timings.`);
                    }
                    if (serverBaselineSecurityLevels.has(action.server)) {
                        serverBaselineSecurityLevels.delete(action.server);
                    }
                    break;

                case ActionType.UPDATE_BASELINE:
                    updateBaselineSecurityLevel(ns, action.server);
                    break;

                case ActionType.STORE_TIMINGS:
                    serverBatchTimings.set(action.server, action.timings);
                    break;

                case ActionType.XP_FARM:
                    xpFarm(ns, action.always, action.isBatching);
                    break;

                case ActionType.LOG_MESSAGE:
                    ns.print(action.message);
                    if (action.message.startsWith("WARN:")) {
                        ns.tprint(action.message);
                    }
                    break;
            }
        }

        return {
            ...metadata,
            totalRamUsed: metadata.totalRamUsed + totalRamUsed,
        };
    }

    // === ACTION EXECUTORS ===
    async function executeHashUpgradeMaxMoney(ns, action) {
        const startingValue = ns.getServerMaxMoney(action.server);
        const { cost, success, level } = spendHashesOnUpgrade(ns, "Increase Maximum Money", action.server);

        if (success) {
            const endingValue = ns.getServerMaxMoney(action.server);
            logUpgradeSuccess(
                ns,
                "Max Money",
                `${action.server} | ${ns.formatNumber(startingValue)} -> ${ns.formatNumber(endingValue)}`,
                cost,
            );
        }
    }

    async function executeHashUpgradeMinSecurity(ns, action) {
        const startingValue = ns.getServerMinSecurityLevel(action.server);
        const { cost, success, level } = spendHashesOnUpgrade(ns, "Reduce Minimum Security", action.server);

        if (success) {
            const endingValue = ns.getServerMinSecurityLevel(action.server);
            logUpgradeSuccess(
                ns,
                "Min Security",
                `${action.server} | ${ns.formatNumber(startingValue)} -> ${ns.formatNumber(endingValue)}`,
                cost,
            );
        }
    }

    async function executePrepServer(ns, action) {
        const allocStart = performance.now();
        const prepRamUsed = prepServer(ns, action.server, action.serverIndex, action.allowPartial);
        logPerformance("allocations", performance.now() - allocStart);

        if (prepRamUsed !== false && prepRamUsed > 0) {
            const currentPrepStats = getServerPrepStats(ns, action.server);
            serverPrepTimings.set(action.server, {
                weakenTime: currentPrepStats.weakenTime,
                startTime: Date.now(),
            });
            return prepRamUsed;
        }
        return 0;
    }

    async function executeScheduleBatches(ns, action) {
        const allocStart = performance.now();
        const result = scheduleBatchHackCycles(
            ns,
            action.server,
            action.batchesToSchedule,
            action.serverIndex,
            action.serverStats,
            action.timeDriftDelay,
        );
        logPerformance("allocations", performance.now() - allocStart);
        return result;
    }

    function updateBaselineSecurityLevel(ns, server) {
        const serverInfo = ns.getServer(server);
        const originalBaselineSecurity = serverBaselineSecurityLevels.get(server) ?? serverInfo.minDifficulty;
        let baselineToUse = originalBaselineSecurity;

        if (serverInfo.hackDifficulty < originalBaselineSecurity) {
            ns.tprint(
                `INFO: ${server} new baseline security: ${ns.formatNumber(originalBaselineSecurity, 2)} -> ${ns.formatNumber(serverInfo.hackDifficulty, 2)}`,
            );
            baselineToUse = serverInfo.hackDifficulty;
        }
        serverBaselineSecurityLevels.set(server, baselineToUse);
    }

    // === END OF TICK OPERATIONS ===
    function performEndOfTickOperations(ns, processingResults) {
        const { totalRamUsed, successfullyProcessedServers } = processingResults;

        if (successfullyProcessedServers.length === 0) {
            ns.print("INFO: No servers could be processed this tick");
        }

        const totalRamUsedAfterTick = maxRamAvailable - totalFreeRam + totalRamUsed;
        const freeRamAfterTick = maxRamAvailable - totalRamUsedAfterTick;
        const ramUtilization = totalRamUsedAfterTick / maxRamAvailable;

        const serverSuccessRate = totalServersAttempted > 0 ? totalServersNotDiscarded / totalServersAttempted : 1;

        const { avgPercentChange, avgMsChange, avgCurrentWeakenTime } = getWeakenTimeDrift(ns);
        const weakenTimeDriftMessage = `Drift: ${ns.formatNumber(avgMsChange, 1)}ms / ${ns.formatNumber(avgCurrentWeakenTime / 1000, 1)}s (${ns.formatPercent(avgPercentChange, 1)})`;

        const averageTickTime = tickCounter > 1 ? totalServerTickTimes / (tickCounter - 1) : 0;

        ns.print(
            `INFO: RAM: ${ns.formatPercent(ramUtilization)} (${ns.formatRam(freeRamAfterTick)}+) | Batch: ${ns.formatPercent(serverSuccessRate, 2)} ${ns.formatNumber(totalServersNotDiscarded)}/${ns.formatNumber(totalServersAttempted)} | ${weakenTimeDriftMessage} | Ticks: ${ns.formatNumber(averageTickTime, 1)}ms | Overestimation: ${ns.formatNumber(ramOverestimation, 2)}x`,
        );

        // Note: XP farming is now handled by the reducer via XP_FARM actions
    }

    /**
     * Calculates the hack stats given current security, hacking to hackingPercentage, and growing back to 100% money.
     * OPTIMIZED VERSION: Caches expensive calculations that don't change between thread counts
     * @param {NS} ns
     * @param {string} server
     * @param {number} hackThreads - Number of hack threads to use
     * @param {boolean} useFormulas - If true, use formulas API with optimal server conditions (min security, max money)
     * @returns {Object} - Standardized server configuration object
     */
    function getServerHackStats(ns, server, hackThreads, useFormulas = true) {
        // Initialize global cache once per tick
        if (!globalCalculationCache) {
            globalCalculationCache = {
                player: ns.getPlayer(),
                bitnodeMultipliers: ns.getBitNodeMultipliers(),
                cpuCores: 1,
                weakenAmount: ns.weakenAnalyze(1, 1),
            };
        }

        // Get or create server-specific cache
        let serverCache = serverStatsCache.get(server);
        if (!serverCache) {
            const serverInfo = ns.getServer(server);

            let calcServer;
            if (useFormulas) {
                // Create optimal server state for formulas API calculations
                calcServer = {
                    ...serverInfo,
                    hackDifficulty: serverInfo.minDifficulty,
                    moneyAvailable: serverInfo.moneyMax,
                };
            }

            // Cache expensive calculations that are constant for this server
            serverCache = {
                serverInfo,
                calcServer,
                // Timing calculations (constant for all thread counts)
                weakenTime: useFormulas
                    ? ns.formulas.hacking.weakenTime(calcServer, globalCalculationCache.player)
                    : ns.getWeakenTime(server),
                growthTime: useFormulas
                    ? ns.formulas.hacking.growTime(calcServer, globalCalculationCache.player)
                    : ns.getGrowTime(server),
                hackTime: useFormulas
                    ? ns.formulas.hacking.hackTime(calcServer, globalCalculationCache.player)
                    : ns.getHackTime(server),
                hackChance: useFormulas
                    ? ns.formulas.hacking.hackChance(calcServer, globalCalculationCache.player)
                    : ns.hackAnalyzeChance(server),
                hackPercentageFromOneThread: useFormulas
                    ? ns.formulas.hacking.hackPercent(calcServer, globalCalculationCache.player)
                    : ns.hackAnalyze(server),

                // Pre-calculate expensive batch calculations
                batchesPerTick: Math.floor(TICK_DELAY / TIME_PER_BATCH),
                moneyMultiplierCache:
                    serverInfo.moneyMax *
                    globalCalculationCache.player.mults.hacking_money *
                    globalCalculationCache.bitnodeMultipliers.ScriptHackMoney *
                    globalCalculationCache.bitnodeMultipliers.ScriptHackMoneyGain,
            };

            serverStatsCache.set(server, serverCache);
        }

        const {
            serverInfo,
            calcServer,
            weakenTime,
            growthTime,
            hackTime,
            hackChance,
            hackPercentageFromOneThread,
            batchesPerTick,
            moneyMultiplierCache,
        } = serverCache;
        const { player, bitnodeMultipliers, cpuCores, weakenAmount } = globalCalculationCache;

        // Fast calculations that depend on hackThreads
        const hackPercentage = Math.min(hackThreads * hackPercentageFromOneThread, 1);

        // Early exit for very low hack percentages to avoid expensive growthThreads calculation
        if (hackPercentage < 0.001 || hackChance < 0.01) {
            // Less than 0.1% hack percentage or less than 1% hack chance
            return null;
        }

        const hackSecurityChange = hackThreads * 0.002;

        // Calculate growth threads (this is the expensive operation that varies with hackThreads)
        let growthThreads;
        if (useFormulas) {
            // Use formulas API to calculate threads needed to grow from ACTUAL hack amount back to 100%
            const targetMoney = serverInfo.moneyMax;
            const currentMoneyAfterHack = serverInfo.moneyMax * (1 - hackPercentage);
            const currentSecurityAfterHack = serverInfo.minDifficulty + hackSecurityChange;
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
            const growthMultiplier = 1 / Math.max(1 - hackPercentage, 1);
            growthThreads = Math.ceil(
                CORRECTIVE_GROW_WEAK_MULTIPLIER * ns.growthAnalyze(server, growthMultiplier, cpuCores),
            );
        }

        const growthSecurityChange = growthThreads * 0.004;
        const weakenTarget = hackSecurityChange + growthSecurityChange;
        const weakenThreadsNeeded = Math.ceil((CORRECTIVE_GROW_WEAK_MULTIPLIER * weakenTarget) / weakenAmount);

        if (hackThreads <= 0 || growthThreads <= 0 || weakenThreadsNeeded <= 0) {
            return null;
        }

        const ramPerBatch =
            hackThreads * HACK_SCRIPT_RAM_USAGE +
            growthThreads * GROW_SCRIPT_RAM_USAGE +
            weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;

        // Calculate actual throughput (money per second) using ACTUAL hack percentage
        const moneyPerBatch = hackPercentage * hackChance * moneyMultiplierCache;

        const maxConcurrentBatches = Math.floor(maxRamAvailableForHacking / ramPerBatch);
        const theoreticalBatchLimit = Math.floor((weakenTime / TICK_DELAY) * batchesPerTick);
        const batchLimitForSustainedThroughput = Math.min(maxConcurrentBatches, theoreticalBatchLimit);

        // Throughput is money per second from sustainable batches
        const throughput = (batchLimitForSustainedThroughput * moneyPerBatch) / (weakenTime / 1000);
        const ramUsageForSustainedThroughput = batchLimitForSustainedThroughput * ramPerBatch;
        const priority = throughput / (ramUsageForSustainedThroughput / 10000);

        const skippedDueToSecurity = serverInfo.hackDifficulty > serverBaselineSecurityLevels.get(server);

        return {
            // Core properties
            server,
            hackThreads,
            growthThreads,
            weakenThreadsNeeded,
            ramPerBatch,
            throughput,
            priority,
            ramUsageForSustainedThroughput,
            batchSustainRatio: batchLimitForSustainedThroughput / theoreticalBatchLimit,

            // Timing values
            weakenTime,
            hackTime,
            growthTime,

            // Performance values
            hackChance,
            hackPercentage,
            totalSecurityIncrease: weakenTarget,
            batchLimitForSustainedThroughput,
            skippedDueToSecurity,
        };
    }

    /**
     * Calculates optimal RAM allocation using knapsack algorithm.
     * For each server, evaluates 1-100 hack threads and finds the best combination.
     * @param {NS} ns - The Netscript API.
     * @returns {Map<string, Object>} - Map of server names to their optimal configurations.
     */
    function calculateTargetServerPriorities(ns) {
        // Check if we can use cached priorities
        if (prioritiesCacheData && tickCounter < prioritiesCacheValidUntilTick) {
            return prioritiesCacheData;
        }

        ns.print(`PERF: Recalculating priorities (cache expired)`);

        const configGenStart = performance.now();

        // Step 1: Generate all possible configurations for all servers
        let allConfigurations = [];
        const serverMaxPriorities = new Map(); // Track max throughput per server

        const serversToEvaluate = hackableServers.filter((server) => {
            return serversToHack.length === 0 ? true : serversToHack.includes(server);
        });

        for (const server of serversToEvaluate) {
            const serverStart = performance.now();
            let maxPriorityForServer = 0;
            let configsForServer = 0;

            // Generate configurations for 1-100 hack threads
            for (let hackThreads = 1; hackThreads <= 400; hackThreads++) {
                const config = getServerHackStats(ns, server, hackThreads);

                if (config === null || config.batchSustainRatio < 0.8) {
                    break;
                }

                // Track the maximum throughput for this server
                if (config.priority > maxPriorityForServer) {
                    maxPriorityForServer = config.priority;
                }
                if (
                    ns.getWeakenTime(server) > MAX_WEAKEN_TIME &&
                    !(ONLY_MANIPULATE_STOCKS && (growStocks.has(server) || hackStocks.has(server)))
                ) {
                    continue;
                }
                allConfigurations.push(config);
                configsForServer++;

                if (config.hackPercentage >= 1) {
                    break;
                }
            }

            // Store the maximum throughput for this server
            serverMaxPriorities.set(server, maxPriorityForServer);

            const serverTime = performance.now() - serverStart;
            if (serverTime > 100) {
                // Log servers that take more than 100ms
                ns.print(`PERF: ${server} took ${serverTime.toFixed(1)}ms to generate ${configsForServer} configs`);
            }
        }

        if (ONLY_MANIPULATE_STOCKS) {
            // Only evaluate servers that are in the growStocks or hackStocks sets. Priority is calculated based on stock manipulation strength
            allConfigurations = [];
            const stockManipulationServers = new Set();
            for (const server of growStocks.keys()) {
                stockManipulationServers.add(server);
            }
            for (const server of hackStocks.keys()) {
                stockManipulationServers.add(server);
            }
            for (const server of stockManipulationServers) {
                if (server === "") continue;
                // Generate configurations for 1-100 hack threads
                for (let hackThreads = 1; hackThreads <= 600; hackThreads++) {
                    const config = getServerHackStats(ns, server, hackThreads);
                    if (config === null) continue;
                    const totalStockValue = (growStocks.get(server) ?? 0) + (hackStocks.get(server) ?? 0);
                    config.throughput =
                        (config.hackPercentage * totalStockValue * config.batchLimitForSustainedThroughput) /
                        config.weakenTime;
                    config.priority = config.throughput / (config.ramUsageForSustainedThroughput / 10000);
                    allConfigurations.push(config);

                    if (config.hackPercentage >= 1) break;
                }
            }
        }

        // ns.write("allConfigurations.txt", JSON.stringify(allConfigurations, null, 2), "w");
        const configGenTime = performance.now() - configGenStart;

        ns.print(`DEBUG: allConfigurations: ${allConfigurations.length} (generated in ${configGenTime.toFixed(1)}ms)`);

        // Step 2: Apply knapsack algorithm
        const knapsackStart = performance.now();

        // Target is around 95%
        // if (tickCounter > 1) {
        //     const ramUtilization = (maxRamAvailableForHacking - totalFreeRam) / maxRamAvailableForHacking;

        //     if (ramUtilization < 0.9) {
        //         // increase overestimation to hit 95%
        //         ramOverestimation = Math.max(1, ramOverestimation * (0.95 / ramUtilization));
        //     } else if (ramUtilization > 0.95) {
        //         // decrease overestimation slowly
        //         ramOverestimation = ramOverestimation * (0.95 / ramUtilization);
        //     }
        // }

        const selectedConfigs = knapsackBucketed(allConfigurations, maxRamAvailableForHacking * ramOverestimation);
        const knapsackTime = performance.now() - knapsackStart;
        logPerformance("knapsack", knapsackTime);

        // Step 3: Convert results to prioritiesMap format (keeping compatibility)
        const prioritiesMap = new Map();

        for (const config of selectedConfigs) {
            // Map to existing format for compatibility
            prioritiesMap.set(config.server, config);
        }

        ns.print(
            `KNAPSACK: Selected ${selectedConfigs.length} configurations across ${serverMaxPriorities.size} total servers (${knapsackTime.toFixed(1)}ms)`,
        );

        // Cache the results
        const result = { prioritiesMap, serverMaxPriorities };
        prioritiesCacheData = result;
        prioritiesCacheValidUntilTick = tickCounter + CACHE_DURATION_TICKS;

        return result;
    }

    function knapsackGreedy(configurations, weightLimit) {
        // Sort by throughput (descending) - create a copy to avoid mutating the original array
        const sortedConfigsWithThroughput = [...configurations].sort((a, b) => b.throughput - a.throughput);

        let remainingWeight = weightLimit;
        const selected = [];
        const usedServers = new Set(); // Track servers already used
        let totalValue = 0;
        let totalWeight = 0;

        // Greedily select configurations
        for (const config of sortedConfigsWithThroughput) {
            // Skip if server already used or doesn't fit
            if (usedServers.has(config.server) || config.ramUsageForSustainedThroughput > remainingWeight) {
                continue;
            }

            selected.push(config);
            usedServers.add(config.server);
            totalValue += config.throughput;
            totalWeight += config.ramUsageForSustainedThroughput;
            remainingWeight -= config.ramUsageForSustainedThroughput;
        }

        return selected;
    }

    /**
     * Bucketed Dynamic Programming solution for the 0/1 Knapsack problem.
     * Uses adaptive bucketing based on actual weight distribution.
     * Only one configuration per server allowed.
     */
    function knapsackBucketed(configurations, weightLimit, numBuckets = 100) {
        // Group configurations by server first (O(n))
        const configsByServer = new Map();
        for (const config of configurations) {
            if (!configsByServer.has(config.server)) {
                configsByServer.set(config.server, []);
            }
            configsByServer.get(config.server).push(config);
        }

        // Sort configurations within each server group by throughput (O(Σ(ki log ki)))
        // This is more efficient than sorting all configurations at once when we have many servers
        for (const serverConfigs of configsByServer.values()) {
            serverConfigs.sort((a, b) => b.throughput - a.throughput);
        }

        // Sort server groups by their best (first) configuration's throughput
        // This ensures high-value servers are considered first in the DP algorithm
        const serverGroups = Array.from(configsByServer.values()).sort((a, b) => b[0].throughput - a[0].throughput);
        const bucketSize = Math.max(1, Math.ceil(weightLimit / numBuckets));

        // dp[w] will be an object { maxValue, selectedConfigs, actualWeight }
        let dp = new Array(numBuckets + 1).fill(null).map(() => ({
            maxValue: 0,
            selectedConfigs: [],
            actualWeight: 0,
        }));

        for (const group of serverGroups) {
            const nextDp = dp.map((item) => ({ ...item, selectedConfigs: [...item.selectedConfigs] }));

            const bucketedGroup = group.map((config) => ({
                ...config,
                bucketWeight: Math.floor(config.ramUsageForSustainedThroughput / bucketSize),
                originalWeight: config.ramUsageForSustainedThroughput,
            }));

            for (let w = numBuckets; w >= 0; w--) {
                // The value if we don't select any configuration from the current group
                let bestForW = dp[w];

                for (const config of bucketedGroup) {
                    if (config.bucketWeight <= w) {
                        const remainingState = dp[w - config.bucketWeight];
                        const newActualWeight = remainingState.actualWeight + config.originalWeight;

                        if (newActualWeight <= weightLimit) {
                            const newValue = remainingState.maxValue + config.throughput;
                            if (newValue > bestForW.maxValue) {
                                bestForW = {
                                    maxValue: newValue,
                                    selectedConfigs: [...remainingState.selectedConfigs, config],
                                    actualWeight: newActualWeight,
                                };
                            }
                        }
                    }
                }
                nextDp[w] = bestForW;
            }
            dp = nextDp;
        }

        const result = dp[numBuckets];
        const { selectedConfigs } = result;

        return selectedConfigs;
    }

    /**
     * Gets the total available RAM across all executable servers.
     * Updates the global server RAM cache on every call.
     * If stanek is running, excludes home server RAM entirely.
     * @param {NS} ns - The Netscript API.
     * @returns {number} - Total available RAM in GB.
     */
    function getTotalFreeRam(ns) {
        const ramCalcStart = performance.now();

        // Calculate total from the cache
        let totalRam = 0;
        serverRamCache.clear();

        const stanekIsRunning =
            ns.scriptRunning("stanek.js", "home") || ns.isRunning("scripts/stanek-charge.js", "home", "home");
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

        const ramCalcTime = performance.now() - ramCalcStart;
        if (ramCalcTime > 10) {
            // Only log if it takes more than 10ms
            ns.print(`PERF: getTotalFreeRam took ${ramCalcTime.toFixed(1)}ms`);
        }

        return totalRam;
    }

    /**
     * Scans all running scripts on all executable servers once per tick to gather information about each target.
     * @param {NS} ns - The Netscript API.
     * @returns {Map<string, {ramUsed: number, hasHack: boolean, hasGrow: boolean, hasWeaken: boolean, isPrep: boolean}>}
     */
    function getRunningScriptInfo(ns) {
        const scriptScanStart = performance.now();

        const scriptInfoByTarget = new Map();
        const scriptInfoByHost = new Map();

        const hackScriptName = hackScript.startsWith("/") ? hackScript.substring(1) : hackScript;
        const growScriptName = growScript.startsWith("/") ? growScript.substring(1) : growScript;
        const weakenScriptName = weakenScript.startsWith("/") ? weakenScript.substring(1) : weakenScript;

        for (const server of executableServers) {
            const runningScripts = ns.ps(server);
            scriptInfoByHost.set(server, {
                ramUsed: 0,
            });

            for (const script of runningScripts) {
                if (
                    !(
                        script.filename === hackScriptName ||
                        script.filename === growScriptName ||
                        script.filename === weakenScriptName
                    )
                ) {
                    continue;
                }

                if (script.args.length > 0) {
                    const target = script.args[0];

                    if (!scriptInfoByTarget.has(target)) {
                        scriptInfoByTarget.set(target, {
                            ramUsed: 0,
                            hasHack: false,
                            hasGrow: false,
                            hasWeaken: false,
                            isPrep: false,
                            isXp: false,
                        });
                    }

                    const info = scriptInfoByTarget.get(target);
                    const hostInfo = scriptInfoByHost.get(server);
                    const scriptRam = ns.getScriptRam(script.filename, server);
                    if (scriptRam > 0) {
                        info.ramUsed += scriptRam * script.threads;
                        hostInfo.ramUsed += scriptRam * script.threads;
                    }

                    if (script.args.includes("prep")) {
                        info.isPrep = true;
                    }

                    if (script.args.includes("xp")) {
                        info.isXp = true;
                    }

                    if (script.args.includes("hgw")) {
                        if (script.filename === hackScriptName) info.hasHack = true;
                        else if (script.filename === growScriptName) info.hasGrow = true;
                        else if (script.filename === weakenScriptName) info.hasWeaken = true;
                    }
                }
            }
        }

        const scriptScanTime = performance.now() - scriptScanStart;
        if (scriptScanTime > 50) {
            // Only log if it takes more than 50ms
            ns.print(
                `PERF: getRunningScriptInfo took ${scriptScanTime.toFixed(1)}ms (scanned ${executableServers.length} servers)`,
            );
        }

        return { scriptInfoByTarget, scriptInfoByHost };
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

        // Calculate thread requirements
        const initialWeakenThreads = Math.ceil((securityLevel - minSecurityLevel) / weakenAmount);

        const growthAmount = maxMoney / Math.max(currentMoney, 1);
        const growthThreads = Math.ceil(
            CORRECTIVE_GROW_WEAK_MULTIPLIER * ns.growthAnalyze(target, growthAmount, cpuCores),
        );
        const growthSecurityChange = growthThreads * 0.004;
        const finalWeakenThreads = Math.ceil((CORRECTIVE_GROW_WEAK_MULTIPLIER * growthSecurityChange) / weakenAmount);

        // Calculate RAM requirements for prep operations
        const initialWeakenRam = initialWeakenThreads * WEAKEN_SCRIPT_RAM_USAGE;
        const growRam = growthThreads * GROW_SCRIPT_RAM_USAGE;
        const finalWeakenRam = finalWeakenThreads * WEAKEN_SCRIPT_RAM_USAGE;

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

        ns.print(
            `INFO: ${target} PREP ${operations.map((op) => `${op.threads}${op.type.substring(0, 1).toUpperCase()}`).join("-")} (${ns.formatRam(initialWeakenRam + growRam + finalWeakenRam)})`,
        );

        // Find servers for prep operations with proper RAM accounting
        const prepAllocStart = performance.now();
        const allocation = allocateServersForOperations(ns, operations);
        logPerformance("allocations", performance.now() - prepAllocStart);

        let finalAllocation = allocation;
        if (!allocation.success && allowPartial) {
            if (needsInitialWeaken) {
                // Try again with only weaken operations
                const weakenOnlyOperations = [{ type: "weaken", threads: initialWeakenThreads, id: "initial_weaken" }];
                const weakenOnlyAllocation = allocateServersForOperations(ns, weakenOnlyOperations);

                if (weakenOnlyAllocation.success) {
                    finalAllocation = weakenOnlyAllocation;
                    shouldGrow = false;
                }
            } else if (shouldGrow) {
                // Try again with only grow operations
                const scaledGrowWeakenOperations = [
                    { type: "grow", threads: growthThreads },
                    { type: "weaken", threads: finalWeakenThreads, id: "final_weaken" },
                ];
                const scaledGrowWeakenAllocation = allocateServersForOperations(
                    ns,
                    scaledGrowWeakenOperations,
                    allowPartial,
                );

                if (scaledGrowWeakenAllocation.success) {
                    finalAllocation = scaledGrowWeakenAllocation;
                }
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
                executeGrow(ns, server, target, threads, growDelay, true, growthTime);
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
            ns.print(`SUCCESS ${serverIndex}. ${target}: PREP ${ns.formatRam(totalRamUsed)}`);
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

        const weakenTimeCompletionTarget = 0 * BASE_SCRIPT_DELAY; // Target the midpoint of the 400ms H-G-W window
        const weakenTimeFinishOffset = (timeDriftDelay + serverStats.weakenTime) % TIME_PER_BATCH;
        const weakenTimeSyncDelay =
            (TIME_PER_BATCH + (weakenTimeCompletionTarget - weakenTimeFinishOffset)) % TIME_PER_BATCH;

        for (let i = 0; i < totalBatches; i++) {
            const batchResult = runBatchHack(ns, target, TIME_PER_BATCH * i + weakenTimeSyncDelay, serverStats);
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
        const batchAllocStart = performance.now();
        const allocation = allocateServersForOperations(ns, operations);
        logPerformance("allocations", performance.now() - batchAllocStart);

        // If not enough RAM to run H G and W, return failure
        if (!allocation.success) {
            return { success: false, ramUsed: 0 }; // Not enough RAM to run H G and W
        }

        // Calculate delays
        const hackDelay = Math.max(weakenTime, TIME_PER_BATCH) + extraDelay - 2 * BASE_SCRIPT_DELAY - hackTime;
        const growDelay = Math.max(weakenTime, TIME_PER_BATCH) + extraDelay - BASE_SCRIPT_DELAY - growthTime;
        const weakenDelay = Math.max(0, TIME_PER_BATCH - weakenTime) + extraDelay;

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
                executeHack(ns, server, target, threads, hackDelay, false, hackTime);
            }

            for (const [server, threads] of allocation.grow) {
                executeGrow(ns, server, target, threads, growDelay, false, growthTime);
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
     * @param {boolean} isPrep - Whether the script is being executed for prep.
     * @param {number} growTime - The time the grow script should finish at.
     */
    function executeGrow(ns, host, target, threads, sleepTime, isPrep = false, growTime = 0) {
        const pid = ns.exec(
            growScript,
            host,
            threads,
            target,
            sleepTime,
            growStocks.has(target),
            isPrep ? "prep" : "hgw",
            tickCounter,
            `endTime=${Date.now() + sleepTime + growTime}`,
        );
        if (!pid) {
            ns.tprint(`WARN Failed to execute grow script on ${target}`);
            ns.print(`WARN Failed to execute grow script on ${target}`);
            ns.print(
                `WARN Host: ${host}, Target: ${target}, Threads: ${threads}, SleepTime: ${sleepTime}, StockArg: ${growStocks.has(target)}, IsPrep: ${isPrep}, GrowTime: ${growTime}`,
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
     * @param {boolean} isPrep - Whether the script is being executed for prep.
     * @param {number} hackTime - The time the hack script should finish at.
     */
    function executeHack(ns, host, target, threads, sleepTime, isPrep = false, hackTime = 0) {
        const pid = ns.exec(
            hackScript,
            host,
            threads,
            target,
            sleepTime,
            hackStocks.has(target),
            isPrep ? "prep" : "hgw",
            tickCounter,
            `endTime=${Date.now() + sleepTime + hackTime}`,
        );
        if (!pid) {
            ns.tprint(`WARN Failed to execute hack script on ${target}`);
            ns.print(`WARN Failed to execute hack script on ${target}`);
            ns.print(
                `WARN Host: ${host}, Target: ${target}, Threads: ${threads}, SleepTime: ${sleepTime}, StockArg: ${hackStocks.has(target)}, IsPrep: ${isPrep}, HackTime: ${hackTime}`,
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
    function xpFarm(ns, always = false, isBatching = false) {
        const xpTarget = XP_FARM_SERVER;
        const xpFarmScript = "/scripts/xp-farm.js";

        // Check if target server exists and we have root access
        if (!ns.serverExists(xpTarget) || !ns.hasRootAccess(xpTarget)) {
            return;
        }

        let serverInfo = ns.getServer(xpTarget);

        if (
            (serverInfo.moneyAvailable < serverInfo.moneyMax || serverInfo.hackDifficulty > serverInfo.minDifficulty) &&
            !isBatching
        ) {
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
                continue;
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
        if (totalRamRequired > maxRamAvailableForHacking && allowPartial) {
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

        const DRIFT_THRESHOLD_PERCENT = 0.01; // 5% drift threshold for holding HGW and resuming on new weaken time
        const HOLD_BUFFER_MS = DELAY_BETWEEN_BATCHES * 4;

        for (const [server, { originalWeakenTime }] of serverBatchTimings.entries()) {
            const serverStats = globalPrioritiesMap.get(server);
            if (!serverStats) {
                ns.print(`WARN: No longer hacking ${server}`);
                serverBatchTimings.delete(server);
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
