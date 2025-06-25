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
    const CORRECTIVE_GROW_WEAK_MULTIPLIER = 1.1; // Use extra grow and weak threads to correct for out of sync HGW batches

    let hackPercentage = 0.5;
    const SCRIPT_DELAY = 150; // ms delay between scripts
    const DELAY_BETWEEN_BATCHES = 150; // ms delay between batches
    const TICK_DELAY = 6000; // ms delay between ticks
    // Batch scheduling: Each batch takes (20*3 + 20) = 80ms to schedule
    // In 2000ms tick, we can fit exactly 25 batches (2000/80 = 25)
    // All 25 batches complete before next tick starts
    const MAX_BATCHES_PER_TICK = Math.floor(TICK_DELAY / (SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES)); // max batches to schedule per tick

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
        hackableServers = getServers(ns, "hackableOnly").filter((server) => ns.getWeakenTime(server) < MAX_WEAKEN_TIME);

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
        globalPrioritiesMap = calculateTargetServerPriorities(ns);

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

        while (totalRamUsed < totalRamAvailable && serverIndex < serversByThroughput.length) {
            const currentServer = serversByThroughput[serverIndex];
            serverIndex++; // Increment server index

            // Skip servers that are already being targeted
            const { isTargeted, isPrep, isHgw } = isServerBeingTargeted(ns, currentServer);

            const serverStats = globalPrioritiesMap.get(currentServer);
            if (!serverStats) {
                ns.print(`ERROR: No server stats found for ${currentServer}`);
                continue;
            }

            const serverInfo = ns.getServer(currentServer);
            const securityLevel = serverInfo.hackDifficulty;
            const minSecurityLevel = serverInfo.minDifficulty;
            const currentMoney = serverInfo.moneyAvailable;
            const maxMoney = serverInfo.moneyMax;

            // Continue to next server if it's already being prepped
            if (isPrep) {
                ns.print(`INFO: Server ${currentServer} is already being prepped`);
                continue;
            }

            // TODO: - Do not weaken if we need to reserve for higher priority servers
            if (
                (currentMoney < maxMoney * PREP_MONEY_THRESHOLD ||
                    securityLevel > minSecurityLevel + SECURITY_LEVEL_THRESHOLD) &&
                !isTargeted // Do not prep if it has HGW scripts running on it or prep scripts
            ) {
                const prepRamUsed = prepServer(ns, currentServer, successfullyProcessedServers.length + 1);
                if (prepRamUsed !== false) {
                    totalRamUsed += prepRamUsed;
                    successfullyProcessedServers.push(currentServer);
                }
                continue; // Move on to next server
            }

            // Calculate available RAM for this server after reserving for higher priority servers
            const availableRamForServer = calculateAvailableRamForServer(
                ns,
                currentServer,
                totalRamAvailable - totalRamUsed,
            );

            // Calculate maximum batches we can afford with available RAM
            const maxAffordableBatches = Math.floor(availableRamForServer / serverStats.ramNeededPerBatch);
            const batchesToSchedule = Math.min(
                serverStats.actualBatchLimit,
                MAX_BATCHES_PER_TICK,
                maxAffordableBatches,
            );

            if (batchesToSchedule > 0) {
                // Schedule batches for the highest priority server
                const ramUsedForBatches = scheduleBatchHackCycles(
                    ns,
                    currentServer,
                    batchesToSchedule,
                    successfullyProcessedServers.length + 1,
                    serverStats,
                );

                // Ensure we made progress to avoid infinite loop
                if (ramUsedForBatches > 0) {
                    successfullyProcessedServers.push(currentServer);
                    totalRamUsed += ramUsedForBatches;
                }
            } else {
                ns.print(
                    `INFO: HGW - ${currentServer} Failed. Need ${ns.formatRam(serverStats.ramNeededPerBatch)} ram.`,
                );
            }

            continue; // Move on to next server
        }

        if (successfullyProcessedServers.length === 0) {
            ns.print("INFO: No servers could be processed this tick");
        }

        // XP farming: Use all remaining RAM for weaken scripts
        xpFarm(ns);

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
     * @returns {Map<string, {priority: number, ramNeededPerBatch: number, throughput: number, weakenTime: number, hackThreads: number, growthThreads: number, weakenThreadsNeeded: number, hackChance: number}>} - Map of server names to their calculated priorities.
     */
    function calculateTargetServerPriorities(ns, excludeServers = []) {
        const maxRamAvailable = executableServers.reduce((acc, server) => acc + ns.getServerMaxRam(server), 0);
        const servers = hackableServers.filter((server) => !excludeServers.includes(server));
        const prioritiesMap = new Map();

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

            if (getServerOptions === "all" || ignoreServers.includes(server)) {
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
            operations.push({ type: "grow", threads: growthThreads, allowSplit: true });
            operations.push({ type: "weaken", threads: finalWeakenThreads, id: "final_weaken" });
        }

        // Find servers for prep operations with proper RAM accounting
        const allocation = allocateServersForOperations(ns, operations);

        // Display prep information
        const prepOperations = [];
        if (needsInitialWeaken) prepOperations.push(`${initialWeakenThreads}W`);
        if (needsGrow) prepOperations.push(`${growthThreads}G`);
        if (needsGrow) prepOperations.push(`${finalWeakenThreads}W`);

        const totalPrepRam = initialWeakenRam + growRam + finalWeakenRam;

        if (!allocation) {
            ns.print(`INFO: PREP - ${target} Failed. Need ${ns.formatRam(totalPrepRam)} ram`);
            return false;
        } else {
            ns.print(
                `SUCCESS ${serverIndex}. ${target}: PREP ${ns.formatRam(allocation.totalRamUsed)} for ${prepOperations.join(" + ")}`,
            );
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
                const [[growServer, growThreadsActual]] = allocation.grow; // Get the single entry
                const growDelay = needsInitialWeaken ? weakenTime - growthTime + SCRIPT_DELAY : 0;
                for (const [server, threads] of allocation.grow) {
                    executeGrow(ns, server, target, threads, growDelay, false, true, growthTime);
                }
                totalRamUsed += growRam;

                // Execute final weaken on potentially multiple servers
                const finalWeakenDelay = needsInitialWeaken ? 2 * SCRIPT_DELAY : 0;
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
                `SUCCESS ${serverIndex}. ${target}: HGW ${successfulBatches}/${totalBatches} batches, ${ns.formatRam(totalRamUsed)} (${serverStats.hackThreads}H ${serverStats.growthThreads}G ${serverStats.weakenThreadsNeeded}W per batch)`,
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

        // Build operations array for the new allocation function
        const operations = [
            { type: "hack", threads: hackThreads },
            { type: "grow", threads: growthThreads },
            { type: "weaken", threads: weakenThreadsNeeded },
        ];

        // Find servers for all three operations with proper RAM accounting
        const allocation = allocateServersForOperations(ns, operations);

        // If not enough RAM to run H G and W, return failure
        if (!allocation) {
            const hackRamUsed = hackThreads * HACK_SCRIPT_RAM_USAGE;
            const growRamUsed = growthThreads * GROW_SCRIPT_RAM_USAGE;
            const weakenRamUsed = weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;
            const totalRamUsed = hackRamUsed + growRamUsed + weakenRamUsed;

            ns.print(`INFO: No servers found for batch hack ${target}, need ${ns.formatRam(totalRamUsed)} ram`);
            return { success: false, ramUsed: 0 }; // Not enough RAM to run H G and W
        }

        // Calculate delays
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

        if (allocation.hack && allocation.grow && allocation.weaken) {
            // Execute hack operations (can be split across multiple servers)
            for (const [server, threads] of allocation.hack) {
                executeHack(ns, server, target, threads, hackDelay, false, false, hackTime);
            }

            // Execute grow operation (single server only)
            const [[growServer, growThreadsActual]] = allocation.grow; // Get the single entry
            executeGrow(ns, growServer, target, growThreadsActual, growDelay, false, false, growthTime);

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
     * Calculates how much RAM should be reserved for higher priority servers during the target server's batch cycle.
     * This ensures higher priority servers can maintain continuous batch streams without being starved by lower priority allocations.
     * @param {NS} ns - The Netscript API.
     * @param {string} targetServer - The server we're considering scheduling batches for.
     * @returns {number} - Total RAM that should be reserved for higher priority servers (in GB).
     */
    function calculateReservedRam(ns, targetServer) {
        const targetStats = globalPrioritiesMap.get(targetServer);
        if (!targetStats) {
            return 0;
        }

        // Calculate the reservation period (target server's cycle duration)
        const reservationPeriod = targetStats.weakenTime + TICK_DELAY; // ms
        const ticksInReservationPeriod = Math.ceil(reservationPeriod / TICK_DELAY);

        // Get all servers sorted by priority (throughput) descending
        const sortedServers = Array.from(globalPrioritiesMap.entries()).sort(
            (a, b) => b[1].throughput - a[1].throughput,
        );

        let totalReservedRam = 0;

        // For each higher priority server, calculate how much RAM they'll need
        for (const [serverName, serverStats] of sortedServers) {
            // Stop when we reach the target server (all remaining servers have lower priority)
            if (serverName === targetServer) {
                break;
            }

            // Skip reserving RAM for servers that are not being batched for HGW
            // They don't need RAM to be reserved
            const { isHgw } = isServerBeingTargeted(ns, serverName);
            if (!isHgw) {
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
        const xpTarget = "foodnstuff";
        const xpFarmScript = "/scripts/xp-farm.js";

        // Check if target server exists and we have root access
        if (!ns.serverExists(xpTarget) || !ns.hasRootAccess(xpTarget)) {
            return;
        }

        const weakenTime = ns.getWeakenTime(xpTarget);
        const weakenCycles = Math.max(1, Math.floor(TICK_DELAY / (weakenTime + SCRIPT_DELAY))); // Kick off at least 1 weaken cycle

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
     * @param {Array<[string, number]>} sortedServers - Array of [serverName, availableRam] sorted by RAM (largest first)
     * @param {Map<string, number>} serverRamAvailable - Map of server names to available RAM (for updates)
     * @param {number} ramPerThread - RAM cost per thread for this operation type
     * @param {number} totalThreadsNeeded - Total number of threads needed
     * @param {boolean} allowSplit - Whether to allow splitting across multiple servers
     * @returns {{allocations: Map<string, number>, totalRamUsed: number} | false} -
     *   Returns allocation map and total RAM used, or false if allocation failed
     */
    function allocateRamForOperation(
        sortedServers,
        serverRamAvailable,
        ramPerThread,
        totalThreadsNeeded,
        allowSplit = true,
    ) {
        const allocations = new Map();
        let totalRamUsed = 0;
        let remainingThreads = totalThreadsNeeded;

        // Determine iteration order based on allowSplit:
        // - Non-splittable operations (allowSplit=false) use largest servers first to minimize fragmentation
        // - Splittable operations (allowSplit=true) use smallest servers first to preserve larger servers
        const serversToIterate = allowSplit ? [...sortedServers].reverse() : sortedServers;

        // Single loop handles both splittable and non-splittable operations
        for (const [server] of serversToIterate) {
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
                if (!allowSplit) {
                    // Cannot split, so we fail
                    return false;
                } else {
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
        }

        if (remainingThreads > 0) {
            return false; // Cannot allocate all remaining threads
        }

        return { allocations, totalRamUsed };
    }

    /**
     * Allocates servers for any combination of HGW operations and updates global RAM cache.
     * This function can handle both batch operations and prep operations with flexible allocation.
     *
     * @param {NS} ns - The Netscript API.
     * @param {Array<{type: 'hack'|'grow'|'weaken', threads: number, id?: string}>} operations - Array of operations needed.
     *   Each operation should specify:
     *   - type: 'hack', 'grow', or 'weaken'
     *   - threads: number of threads needed
     *   - id: optional identifier to distinguish multiple operations of the same type (e.g., 'initial_weaken', 'final_weaken')
     *
     * @returns {Object|false} - Returns allocation result or false if not enough RAM.
     *   Success format: {
     *     hack: Map<string, number>,     // serverName -> threads (can be split across multiple servers)
     *     grow: Map<string, number>,     // serverName -> threads (single server only)
     *     weaken: Map<string, number>,   // serverName -> threads (can be split across multiple servers)
     *     initial_weaken: Map<string, number>, // if id='initial_weaken'
     *     final_weaken: Map<string, number>,   // if id='final_weaken'
     *     // ... other operations with custom ids
     *     totalRamUsed: number
     *   }
     *
     * Key behaviors:
     * 1. All operations must be satisfied or the function returns false
     * 2. Grow operations must be allocated to a single server (cannot be split)
     * 3. Hack and weaken operations can be split across multiple servers
     * 4. Grow operations are allocated first to ensure they get priority
     * 5. Remaining operations are allocated to remaining servers
     * 6. Updates global serverRamCache and removes servers with insufficient RAM (< 1.75GB)
     */
    function allocateServersForOperations(ns, operations) {
        // Validate input
        if (!operations || operations.length === 0) {
            return false;
        }

        // Create a copy of server RAM availability to track allocations
        const serverRamAvailable = new Map(serverRamCache);

        // Sort servers by available RAM (largest first) - do this once and reuse
        const sortedServersByRam = Array.from(serverRamAvailable.entries()).sort((a, b) => b[1] - a[1]); // Sort by RAM descending (largest first)

        // Separate operations by type
        const growOperations = operations.filter((op) => op.type === "grow");
        const hackOperations = operations.filter((op) => op.type === "hack");
        const weakenOperations = operations.filter((op) => op.type === "weaken");

        // Result object to store allocations
        const result = {
            totalRamUsed: 0,
        };

        // Step 1: Allocate grow operations first (must be on single servers)
        // Will automatically use largest servers first since allowSplit=false
        for (const growOp of growOperations) {
            const opKey = growOp.id || "grow";
            const canSplit = growOp.allowSplit === true;
            const allocation = allocateRamForOperation(
                sortedServersByRam,
                serverRamAvailable,
                GROW_SCRIPT_RAM_USAGE,
                growOp.threads,
                canSplit, // Grow can be split for prep, but not for batches
            );

            if (!allocation) {
                return false; // Cannot allocate grow operation
            }

            result[opKey] = allocation.allocations;
            result.totalRamUsed += allocation.totalRamUsed;
        }

        // Step 2: Allocate hack operations (can be split across multiple servers)
        // Will automatically use smallest servers first since allowSplit=true
        for (const hackOp of hackOperations) {
            const opKey = hackOp.id || "hack";
            const allocation = allocateRamForOperation(
                sortedServersByRam,
                serverRamAvailable,
                HACK_SCRIPT_RAM_USAGE,
                hackOp.threads,
                true, // Hack can be split (will use smallest servers first)
            );

            if (!allocation) {
                return false; // Cannot allocate hack operation
            }

            result[opKey] = allocation.allocations;
            result.totalRamUsed += allocation.totalRamUsed;
        }

        // Step 3: Allocate weaken operations (can be split across multiple servers)
        // Will automatically use smallest servers first since allowSplit=true
        for (const weakenOp of weakenOperations) {
            const opKey = weakenOp.id || "weaken";
            const allocation = allocateRamForOperation(
                sortedServersByRam,
                serverRamAvailable,
                WEAKEN_SCRIPT_RAM_USAGE,
                weakenOp.threads,
                true, // Weaken can be split (will use smallest servers first)
            );

            if (!allocation) {
                return false; // Cannot allocate weaken operation
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
}
