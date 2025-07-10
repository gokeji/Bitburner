import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    // Import the necessary functions from hacker.js
    // We need to replicate the key functions since we can't directly import them

    const hackScript = "/kamu/hack.js";
    const growScript = "/kamu/grow.js";
    const weakenScript = "/kamu/weaken.js";

    const HACK_SCRIPT_RAM_USAGE = 1.7;
    const GROW_SCRIPT_RAM_USAGE = 1.75;
    const WEAKEN_SCRIPT_RAM_USAGE = 1.75;

    let hackPercentage = 0.1;
    const CORRECTIVE_GROW_WEAK_MULTIPLIER = 1.2;
    const BASE_SCRIPT_DELAY = 20;
    const DELAY_BETWEEN_BATCHES = 20;

    // Get all hackable servers
    const hackableServers = getHackableServers(ns);

    // Calculate max RAM available (simplified)
    const executableServers = getExecutableServers(ns);
    const maxRamAvailable = executableServers.reduce((acc, server) => acc + ns.getServerMaxRam(server), 0);

    // Initialize baseline security levels map
    const serverBaselineSecurityLevels = new Map();
    for (const server of hackableServers) {
        serverBaselineSecurityLevels.set(server, ns.getServerMinSecurityLevel(server));
    }

    ns.print("=== CURRENT SERVER PRIORITIES ===");
    const currentPriorities = calculateTargetServerPriorities(
        ns,
        hackableServers,
        maxRamAvailable,
        serverBaselineSecurityLevels,
    );
    printPriorities(ns, currentPriorities, "CURRENT");

    ns.print("\n=== SIMULATING 10 MAX MONEY UPGRADES (2% each) ===");
    const maxMoneyUpgradedPriorities = simulateMaxMoneyUpgrades(
        ns,
        hackableServers,
        maxRamAvailable,
        serverBaselineSecurityLevels,
        10,
    );
    printPriorities(ns, maxMoneyUpgradedPriorities, "MAX MONEY ONLY");

    ns.print("\n=== SIMULATING 10 SECURITY REDUCTION UPGRADES (2% each) ===");
    const securityUpgradedPriorities = simulateSecurityUpgrades(
        ns,
        hackableServers,
        maxRamAvailable,
        serverBaselineSecurityLevels,
        10,
    );
    printPriorities(ns, securityUpgradedPriorities, "SECURITY ONLY");

    ns.print("\n=== SIMULATING BOTH UPGRADES COMBINED (10 each) ===");
    const combinedUpgradedPriorities = simulateCombinedUpgrades(
        ns,
        hackableServers,
        maxRamAvailable,
        serverBaselineSecurityLevels,
        50,
        50,
    );
    printPriorities(ns, combinedUpgradedPriorities, "BOTH COMBINED");

    ns.print("\n=== PRIORITY COMPARISON ===");
    comparePriorities(
        ns,
        currentPriorities,
        maxMoneyUpgradedPriorities,
        securityUpgradedPriorities,
        combinedUpgradedPriorities,
    );

    /**
     * Gets all hackable servers
     */
    function getHackableServers(ns) {
        const discovered = new Set(["home"]);
        const toScan = ["home"];
        const resultSet = new Set();

        const isHackable = (server) => {
            if (!ns.hasRootAccess(server)) return false;
            if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) return false;
            if (ns.getServerMaxMoney(server) === 0) return false;
            if (server === "home") return false;
            return true;
        };

        while (toScan.length > 0) {
            const server = toScan.shift();

            if (isHackable(server)) {
                resultSet.add(server);
            }

            const connectedServers = ns.scan(server);
            for (const connectedServer of connectedServers) {
                if (!discovered.has(connectedServer)) {
                    toScan.push(connectedServer);
                    discovered.add(connectedServer);
                }
            }
        }

        return Array.from(resultSet);
    }

    /**
     * Gets all executable servers
     */
    function getExecutableServers(ns) {
        const discovered = new Set(["home"]);
        const toScan = ["home"];
        const resultSet = new Set();

        const isExecutable = (server) => {
            if (!ns.hasRootAccess(server)) return false;
            if (ns.getServerMaxRam(server) === 0) return false;
            if (server.startsWith("hacknet-server")) return false;
            return true;
        };

        while (toScan.length > 0) {
            const server = toScan.shift();

            if (isExecutable(server)) {
                resultSet.add(server);
            }

            const connectedServers = ns.scan(server);
            for (const connectedServer of connectedServers) {
                if (!discovered.has(connectedServer)) {
                    toScan.push(connectedServer);
                    discovered.add(connectedServer);
                }
            }
        }

        return Array.from(resultSet);
    }

    /**
     * Create a wrapper for ns functions that can be overridden for simulation
     */
    function createNSWrapper(ns, overrides = {}) {
        return new Proxy(ns, {
            get(target, prop) {
                if (overrides[prop]) {
                    return overrides[prop];
                }
                return target[prop];
            },
        });
    }

    /**
     * Replicated getServerHackStats function from hacker.js
     */
    function getServerHackStats(nsWrapper, server, useFormulas = false) {
        const cpuCores = 1;
        const serverInfo = nsWrapper.getServer(server);
        const securityLevel = serverInfo.hackDifficulty;
        const minSecurityLevel = serverInfo.minDifficulty;
        const currentMoney = serverInfo.moneyAvailable;
        const maxMoney = serverInfo.moneyMax;

        let calcServer, player;

        if (useFormulas) {
            calcServer = {
                ...serverInfo,
                hackDifficulty: serverInfo.minDifficulty,
                moneyAvailable: serverInfo.moneyMax,
            };
            player = nsWrapper.getPlayer();
        }

        const weakenAmount = nsWrapper.weakenAnalyze(1, cpuCores);

        let weakenTime, growthTime, hackTime, hackChance, hackPercentageFromOneThread, growthFactor;

        if (useFormulas) {
            weakenTime = nsWrapper.formulas.hacking.weakenTime(calcServer, player);
            growthTime = nsWrapper.formulas.hacking.growTime(calcServer, player);
            hackTime = nsWrapper.formulas.hacking.hackTime(calcServer, player);
            hackChance = nsWrapper.formulas.hacking.hackChance(calcServer, player);
            hackPercentageFromOneThread = nsWrapper.formulas.hacking.hackPercent(calcServer, player);
            growthFactor = nsWrapper.getServerGrowth(server);
        } else {
            weakenTime = nsWrapper.getWeakenTime(server);
            growthTime = nsWrapper.getGrowTime(server);
            hackTime = nsWrapper.getHackTime(server);
            hackChance = nsWrapper.hackAnalyzeChance(server);
            hackPercentageFromOneThread = nsWrapper.hackAnalyze(server);
            growthFactor = nsWrapper.getServerGrowth(server);
        }

        const hackThreads =
            hackPercentageFromOneThread === 0 ? 0 : Math.ceil(hackPercentage / hackPercentageFromOneThread);
        const actualHackPercentage = hackThreads * hackPercentageFromOneThread;
        const hackSecurityChange = hackThreads * 0.002;

        let growthThreads;
        if (useFormulas) {
            const targetMoney = maxMoney;
            const currentMoneyAfterHack = maxMoney * (1 - actualHackPercentage);
            const currentSecurityAfterHack = minSecurityLevel + hackSecurityChange;
            growthThreads = Math.ceil(
                CORRECTIVE_GROW_WEAK_MULTIPLIER *
                    nsWrapper.formulas.hacking.growThreads(
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
            const growthMultiplier = 1 / Math.max(1 - actualHackPercentage, 1);
            growthThreads = Math.ceil(nsWrapper.growthAnalyze(server, growthMultiplier, cpuCores));
        }

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
     * Replicated calculateTargetServerPriorities function from hacker.js
     */
    function calculateTargetServerPriorities(
        nsWrapper,
        hackableServers,
        maxRamAvailable,
        serverBaselineSecurityLevels,
    ) {
        const prioritiesMap = new Map();

        for (const server of hackableServers) {
            const serverInfo = nsWrapper.getServer(server);
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
            } = getServerHackStats(nsWrapper, server, true);

            const timePerBatch = BASE_SCRIPT_DELAY * 3 + DELAY_BETWEEN_BATCHES;
            const theoreticalBatchLimit = weakenTime / timePerBatch;

            const ramNeededPerBatch =
                hackThreads * HACK_SCRIPT_RAM_USAGE +
                growthThreads * GROW_SCRIPT_RAM_USAGE +
                weakenThreadsNeeded * WEAKEN_SCRIPT_RAM_USAGE;
            const availableBatchLimit = maxRamAvailable / ramNeededPerBatch;

            let ramForMaxThroughput = theoreticalBatchLimit * ramNeededPerBatch;

            const batchLimitForSustainedThroughput = Math.min(availableBatchLimit, theoreticalBatchLimit);

            const moneyPerBatch =
                actualHackPercentage *
                maxMoney *
                hackChance *
                nsWrapper.getPlayer().mults.hacking_money *
                nsWrapper.getBitNodeMultipliers().ScriptHackMoney;
            const throughput = (theoreticalBatchLimit * moneyPerBatch) / (weakenTime / 1000);

            if (serverInfo.hackDifficulty > (serverBaselineSecurityLevels.get(server) || serverInfo.minDifficulty)) {
                ramForMaxThroughput = 0;
            }

            prioritiesMap.set(server, {
                priority: throughput / ramNeededPerBatch / (weakenTime / 50000),
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
     * Simulate max money upgrades using wrapper approach
     */
    function simulateMaxMoneyUpgrades(ns, hackableServers, maxRamAvailable, serverBaselineSecurityLevels, upgrades) {
        const multiplier = 1.02 ** upgrades; // 2% increase per upgrade

        const nsWrapper = createNSWrapper(ns, {
            getServerMaxMoney: function (server) {
                return ns.getServerMaxMoney(server) * multiplier;
            },
            getServer: function (server) {
                const serverInfo = ns.getServer(server);
                return {
                    ...serverInfo,
                    moneyMax: serverInfo.moneyMax * multiplier,
                };
            },
        });

        return calculateTargetServerPriorities(
            nsWrapper,
            hackableServers,
            maxRamAvailable,
            serverBaselineSecurityLevels,
        );
    }

    /**
     * Simulate security reduction upgrades using wrapper approach
     */
    function simulateSecurityUpgrades(ns, hackableServers, maxRamAvailable, serverBaselineSecurityLevels, upgrades) {
        const multiplier = 0.98 ** upgrades; // 2% reduction per upgrade

        const nsWrapper = createNSWrapper(ns, {
            getServerMinSecurityLevel: function (server) {
                return Math.max(1, ns.getServerMinSecurityLevel(server) * multiplier);
            },
            getServer: function (server) {
                const serverInfo = ns.getServer(server);
                const newMinSecurity = Math.max(1, serverInfo.minDifficulty * multiplier);
                return {
                    ...serverInfo,
                    minDifficulty: newMinSecurity,
                    hackDifficulty: Math.max(newMinSecurity, serverInfo.hackDifficulty),
                };
            },
        });

        // Update baseline security levels for the simulation
        const updatedBaselineSecurityLevels = new Map();
        for (const [server, originalBaseline] of serverBaselineSecurityLevels.entries()) {
            updatedBaselineSecurityLevels.set(server, Math.max(1, originalBaseline * multiplier));
        }

        return calculateTargetServerPriorities(
            nsWrapper,
            hackableServers,
            maxRamAvailable,
            updatedBaselineSecurityLevels,
        );
    }

    /**
     * Simulate both max money and security reduction upgrades combined
     */
    function simulateCombinedUpgrades(
        ns,
        hackableServers,
        maxRamAvailable,
        serverBaselineSecurityLevels,
        moneyUpgrades,
        securityUpgrades,
    ) {
        const moneyMultiplier = Math.pow(1.02, moneyUpgrades); // 2% multiplicative increase per upgrade
        const securityMultiplier = Math.pow(0.98, securityUpgrades); // 2% multiplicative reduction per upgrade

        const nsWrapper = createNSWrapper(ns, {
            getServerMaxMoney: function (server) {
                return ns.getServerMaxMoney(server) * moneyMultiplier;
            },
            getServerMinSecurityLevel: function (server) {
                return Math.max(1, ns.getServerMinSecurityLevel(server) * securityMultiplier);
            },
            getServer: function (server) {
                const serverInfo = ns.getServer(server);
                const newMinSecurity = Math.max(1, serverInfo.minDifficulty * securityMultiplier);
                return {
                    ...serverInfo,
                    moneyMax: serverInfo.moneyMax * moneyMultiplier,
                    minDifficulty: newMinSecurity,
                    hackDifficulty: Math.max(newMinSecurity, serverInfo.hackDifficulty),
                };
            },
        });

        // Update baseline security levels for the simulation
        const updatedBaselineSecurityLevels = new Map();
        for (const [server, originalBaseline] of serverBaselineSecurityLevels.entries()) {
            updatedBaselineSecurityLevels.set(server, Math.max(1, originalBaseline * securityMultiplier));
        }

        return calculateTargetServerPriorities(
            nsWrapper,
            hackableServers,
            maxRamAvailable,
            updatedBaselineSecurityLevels,
        );
    }

    /**
     * Print priorities in a formatted table
     */
    function printPriorities(ns, prioritiesMap, label) {
        const sortedPriorities = Array.from(prioritiesMap.entries())
            .sort((a, b) => b[1].priority - a[1].priority)
            .slice(0, 10); // Top 10 servers

        ns.print(`\n${label} - TOP 10 SERVERS:`);
        ns.print(
            "Server".padEnd(15) +
                "Priority".padEnd(12) +
                "Throughput".padEnd(12) +
                "RAM/Batch".padEnd(12) +
                "Weaken Time",
        );
        ns.print("-".repeat(70));

        for (const [server, stats] of sortedPriorities) {
            ns.print(
                server.padEnd(15) +
                    ns.formatNumber(stats.priority, 2).padEnd(12) +
                    ("$" + ns.formatNumber(stats.throughput, 0) + "/s").padEnd(12) +
                    ns.formatRam(stats.ramNeededPerBatch).padEnd(12) +
                    ns.formatNumber(stats.weakenTime / 1000, 1) +
                    "s",
            );
        }
    }

    /**
     * Compare priorities between different scenarios
     */
    function comparePriorities(ns, current, maxMoney, security, combined) {
        ns.print("\nPRIORITY CHANGES (Top 5 servers):");
        ns.print(
            "Server".padEnd(15) +
                "Current".padEnd(12) +
                "MaxMoney".padEnd(12) +
                "Security".padEnd(12) +
                "Combined".padEnd(12) +
                "Best Upgrade",
        );
        ns.print("-".repeat(90));

        const currentSorted = Array.from(current.entries())
            .sort((a, b) => b[1].priority - a[1].priority)
            .slice(0, 5);

        for (const [server, currentStats] of currentSorted) {
            const maxMoneyStats = maxMoney.get(server);
            const securityStats = security.get(server);
            const combinedStats = combined.get(server);

            const currentPriority = currentStats.priority;
            const maxMoneyPriority = maxMoneyStats ? maxMoneyStats.priority : 0;
            const securityPriority = securityStats ? securityStats.priority : 0;
            const combinedPriority = combinedStats ? combinedStats.priority : 0;

            const maxMoneyIncrease = ((maxMoneyPriority - currentPriority) / currentPriority) * 100;
            const securityIncrease = ((securityPriority - currentPriority) / currentPriority) * 100;
            const combinedIncrease = ((combinedPriority - currentPriority) / currentPriority) * 100;

            // Determine best upgrade
            let bestUpgrade = "MaxMoney";
            let bestIncrease = maxMoneyIncrease;

            if (securityIncrease > bestIncrease) {
                bestUpgrade = "Security";
                bestIncrease = securityIncrease;
            }

            if (combinedIncrease > bestIncrease) {
                bestUpgrade = "Combined";
                bestIncrease = combinedIncrease;
            }

            ns.print(
                server.padEnd(15) +
                    ns.formatNumber(currentPriority, 2).padEnd(12) +
                    `+${ns.formatNumber(maxMoneyIncrease, 1)}%`.padEnd(12) +
                    `+${ns.formatNumber(securityIncrease, 1)}%`.padEnd(12) +
                    `+${ns.formatNumber(combinedIncrease, 1)}%`.padEnd(12) +
                    `${bestUpgrade} (+${ns.formatNumber(bestIncrease, 1)}%)`,
            );
        }
    }
}
