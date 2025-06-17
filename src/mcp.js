/**
 * @param {NS} ns
 **/

// Import shared constants to avoid sync issues
import { SEC_THRESHOLD, MONEY_PERCENTAGE, MONEY_MINIMUM, MONEY_MAX_PERCENTAGE } from "lib/constants.js";

// Local configuration constants
const SLEEP_TIME = 0.2; // Minutes between cycles
const HOME_RESERVED_RAM = 8; // Reserve RAM on home for other scripts
const MAX_HACK_THREADS = 130;

// Script mappings for direct action execution
const ACTION_SCRIPTS = {
    grow: "scripts/grow.js",
    hack: "scripts/hack.js",
    weaken: "scripts/weaken.js",
};

// Track current home assistance state
let HOME_ASSISTANCE_STATE = {};
let LAST_ELIGIBLE_SERVER_COUNT = 0; // Track eligible server count changes (renamed for clarity)

let SERVERS = {
    "crush-fitness": { action: null, servers: ["CSEC"], needsHomeAssist: false },
    "johnson-ortho": { action: null, servers: ["avmnite-02h"], needsHomeAssist: false },
    computek: { action: null, servers: ["I.I.I.I"], needsHomeAssist: false },
    "snap-fitness": { action: null, servers: ["run4theh111z"], needsHomeAssist: false },
    syscore: { action: null, servers: [], needsHomeAssist: false },
    "applied-energetics": { action: null, servers: [], needsHomeAssist: false },
    "4sigma": { action: null, servers: [], needsHomeAssist: false },
    fulcrumassets: { action: null, servers: [], needsHomeAssist: false },
    nwo: { action: null, servers: [], needsHomeAssist: false },
};

const EXECUTE_SCRIPT = "scripts/execute.js";
const FILES_TO_COPY = [
    "scripts/hack.js",
    "scripts/grow.js",
    "scripts/weaken.js",
    "scripts/copy_scripts.js",
    "scripts/execute.js",
];

function disable_logs(ns) {
    const logs = [
        "scan",
        "run",
        "getServerSecurityLevel",
        "getServerMoneyAvailable",
        "getServerMaxMoney",
        "getServerMinSecurityLevel",
        "exec",
        "killall",
        "scp",
        "sleep",
        "getServerRequiredHackingLevel",
        "getHackingLevel",
    ];
    logs.forEach((log) => ns.disableLog(log));
}

function get_all_servers(ns) {
    const servers = ["home"];
    const result = [];
    let i = 0;

    while (i < servers.length) {
        const server = servers[i];
        const connections = ns.scan(server);

        for (const connection of connections) {
            if (!servers.includes(connection)) {
                servers.push(connection);
                result.push(connection);
            }
        }
        i++;
    }
    return result;
}

function ensure_scripts_on_servers(ns) {
    const allServers = get_all_servers(ns);

    for (const server of allServers) {
        if (ns.hasRootAccess(server) && server !== "home") {
            for (const file of FILES_TO_COPY) {
                if (ns.fileExists(file, "home") && !ns.fileExists(file, server)) {
                    ns.scp(file, server);
                }
            }
        }
    }
}

function get_action(ns, host) {
    const actions = ns.ps(host);
    if (actions.length === 0) return null;
    return actions[0].filename.replace("scripts/", "").replace(".js", "");
}

// Consolidated server metrics calculation
function get_server_metrics(ns, server) {
    const money = ns.getServerMoneyAvailable(server);
    const maxMoney = ns.getServerMaxMoney(server);
    const security = ns.getServerSecurityLevel(server);
    const minSecurity = ns.getServerMinSecurityLevel(server);

    return {
        money,
        maxMoney,
        moneyRatio: money / maxMoney,
        securityDiff: security - minSecurity,
        priority: maxMoney * (1 - money / maxMoney) + (security - minSecurity) * 1000000,
    };
}

export function determine_action(ns, server) {
    const { moneyRatio, securityDiff, money } = get_server_metrics(ns, server);

    if (securityDiff >= SEC_THRESHOLD) return "weaken";
    if ((moneyRatio < MONEY_PERCENTAGE || money < MONEY_MINIMUM) && moneyRatio < MONEY_MAX_PERCENTAGE) return "grow";
    return "hack"; // Can hack with sufficient money AND percentage
}

function should_home_assist(ns, server, action) {
    if (server === "n00dles") return false;
    return true;
}

async function update_servers(ns) {
    const eligibleServers = get_all_servers(ns).filter((server) => {
        if (!ns.hasRootAccess(server)) return false;
        if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) return false;
        return true;
    });

    // Count only eligible servers (those we can actually hack)
    let eligibleServerCount = eligibleServers.length;

    // Detect if eligible servers changed
    const eligibleServersChanged = eligibleServerCount !== LAST_ELIGIBLE_SERVER_COUNT;
    if (eligibleServersChanged && LAST_ELIGIBLE_SERVER_COUNT > 0) {
        ns.print(
            `Eligible server count changed from ${LAST_ELIGIBLE_SERVER_COUNT} to ${eligibleServerCount} - cleaning up processes`,
        );
        await cleanup_all_processes(ns);
    }
    LAST_ELIGIBLE_SERVER_COUNT = eligibleServerCount;

    for (const server of eligibleServers) {
        if (parseInt(ns.getServerMaxMoney(server)) === 0) continue;

        if (!SERVERS[server]) {
            SERVERS[server] = { action: null, servers: [], needsHomeAssist: false };
        }
        SERVERS[server]["action"] = get_action(ns, server);
    }
}

// Get purchased servers (servers with no money but have RAM)
export function get_purchased_servers(ns) {
    const allServers = get_all_servers(ns);
    return allServers.filter((server) => ns.getServer(server).purchasedByPlayer);
}

// Find all home assistance processes targeting a specific server
function find_home_assist_processes_for_target(ns, targetServer) {
    const purchasedServers = get_purchased_servers(ns);
    const assistanceServers = ["home", ...purchasedServers];
    const processes = [];

    for (const assistServer of assistanceServers) {
        const serverProcesses = ns
            .ps(assistServer)
            .filter(
                (p) =>
                    Object.values(ACTION_SCRIPTS).includes(p.filename) &&
                    p.args.length >= 1 &&
                    p.args[0] === targetServer,
            );

        processes.push(...serverProcesses.map((p) => ({ ...p, assistServer })));
    }

    return processes;
}

// Kill home assistance processes for a specific target server
function kill_home_assist_for_target(ns, targetServer) {
    const processes = find_home_assist_processes_for_target(ns, targetServer);
    processes.forEach((p) => ns.kill(p.pid));
    if (processes.length > 0) {
        ns.print(`Killed ${processes.length} home assistance processes for ${targetServer}`);
    }
}

async function execute_home_assistance(ns, serversNeedingHelp) {
    // Handle servers that no longer need assistance or have changed actions
    for (const targetServer of Object.keys(HOME_ASSISTANCE_STATE)) {
        const currentAssistance = HOME_ASSISTANCE_STATE[targetServer];
        const newAssistance = serversNeedingHelp.find((s) => s.server === targetServer);

        // Server no longer needs assistance or action changed
        if (!newAssistance || newAssistance.action !== currentAssistance.action) {
            kill_home_assist_for_target(ns, targetServer);
            delete HOME_ASSISTANCE_STATE[targetServer];
        }
    }

    // Filter out servers that already have correct assistance running
    const serversNeedingNewAssistance = serversNeedingHelp.filter(({ server, action }) => {
        const currentAssistance = HOME_ASSISTANCE_STATE[server];
        return !currentAssistance || currentAssistance.action !== action;
    });

    ns.print(
        `Servers needing help: ${serversNeedingHelp.length}, needing new assistance: ${serversNeedingNewAssistance.length}`,
    );
    if (serversNeedingNewAssistance.length > 0) {
        ns.print(
            `New assistance needed for: ${serversNeedingNewAssistance.map((s) => `${s.server}(${s.action})`).join(", ")}`,
        );
    }

    if (serversNeedingNewAssistance.length === 0) return;

    // Get all available servers for assistance (home + purchased servers)
    const purchasedServers = get_purchased_servers(ns);
    const assistanceServers = ["home", ...purchasedServers];

    // Log purchased servers being used
    if (purchasedServers.length > 0) {
        ns.print(`Using ${purchasedServers.length} purchased servers for assistance: ${purchasedServers.join(", ")}`);
    }

    // Use grow.js as baseline since all action scripts have similar RAM usage
    const scriptRam = ns.getScriptRam(ACTION_SCRIPTS["grow"]);

    // Calculate max theoretical capacity for each assistance server
    const serverRamInfo = [];
    let totalMaxThreads = 0;

    for (const assistServer of assistanceServers) {
        const maxRam = ns.getServerMaxRam(assistServer);
        const usedRam = ns.getServerUsedRam(assistServer);
        const reservedRam = assistServer === "home" ? HOME_RESERVED_RAM : 0;
        const maxAvailableRam = Math.max(0, maxRam - reservedRam);
        const currentAvailableRam = Math.max(0, maxRam - usedRam - reservedRam);

        if (maxAvailableRam >= scriptRam) {
            // Only include if we can theoretically run at least one thread
            const maxThreadsOnServer = Math.floor(maxAvailableRam / scriptRam);
            const currentAvailableThreads = Math.floor(currentAvailableRam / scriptRam);

            serverRamInfo.push({
                server: assistServer,
                maxAvailableRam,
                availableRam: currentAvailableRam,
                maxThreads: maxThreadsOnServer,
                availableThreads: currentAvailableThreads,
            });
            totalMaxThreads += maxThreadsOnServer;
        }
    }

    // Sort by available RAM (largest first) for better distribution
    serverRamInfo.sort((a, b) => b.availableRam - a.availableRam);

    // Calculate total currently available threads (not theoretical max)
    const totalCurrentlyAvailableThreads = serverRamInfo.reduce((sum, info) => sum + info.availableThreads, 0);

    if (totalMaxThreads > 0 && totalCurrentlyAvailableThreads > 0) {
        // Calculate fair share based on theoretical maximum capacity (for consistent allocation)
        const fairSharePerServer = Math.floor(totalMaxThreads / serversNeedingHelp.length);

        ns.print(`Thread allocation: ${totalCurrentlyAvailableThreads} available, ${totalMaxThreads} max capacity`);
        ns.print(
            `Fair share calculation: ${totalMaxThreads} ÷ ${serversNeedingHelp.length} = ${fairSharePerServer} per server`,
        );

        // Track threads already assigned to each target
        const targetThreadCounts = {};
        serversNeedingNewAssistance.forEach(({ server }) => {
            targetThreadCounts[server] = HOME_ASSISTANCE_STATE[server] ? HOME_ASSISTANCE_STATE[server].totalThreads : 0;
        });

        // Calculate expected thread limits for each server that needs new assistance
        const serverThreadLimits = {};
        serversNeedingNewAssistance.forEach(({ server, action }) => {
            if (action === "hack") {
                serverThreadLimits[server] = MAX_HACK_THREADS; // Hard cap for hack
            } else {
                serverThreadLimits[server] = fairSharePerServer; // Fair share for grow/weaken
            }
        });

        let totalDistributedThreads = 0;
        let currentTargetIndex = 0;

        for (const { server: assistServer, availableRam, availableThreads } of serverRamInfo) {
            const maxThreadsOnServer = availableThreads;
            let threadsUsed = 0;

            ns.print(`Distributing ${maxThreadsOnServer} threads from ${assistServer}`);

            // Keep assigning threads until this server is full
            while (threadsUsed < maxThreadsOnServer && serversNeedingNewAssistance.length > 0) {
                // Find target with fewest threads assigned that can still accept more threads
                let targetServer = null;
                let targetAction = null;
                let minThreads = Infinity;
                let hasAvailableTargets = false;

                // Look for targets that still need threads
                for (const { server, action } of serversNeedingNewAssistance) {
                    const currentThreads = targetThreadCounts[server] || 0;
                    const serverLimit = serverThreadLimits[server] || fairSharePerServer;
                    const remainingAllowedThreads = Math.max(0, serverLimit - currentThreads);

                    // Only consider servers that can still accept threads
                    if (remainingAllowedThreads > 0) {
                        hasAvailableTargets = true;
                        if (currentThreads < minThreads) {
                            minThreads = currentThreads;
                            targetServer = server;
                            targetAction = action;
                        }
                    }
                }

                // Debug logging for thread assignment
                if (targetServer) {
                    const currentThreads = targetThreadCounts[targetServer] || 0;
                    const serverLimit = serverThreadLimits[targetServer] || fairSharePerServer;
                    const remainingAllowedThreads = Math.max(0, serverLimit - currentThreads);
                    ns.print(
                        `    Selected ${targetServer} (${targetAction}): current=${currentThreads}, limit=${serverLimit}, remaining=${remainingAllowedThreads}`,
                    );
                }

                // If we can't find a target that can accept more threads, we're done with this assist server
                if (targetServer === null || !hasAvailableTargets) break;

                // Calculate how many threads to assign based on fair share and limits
                const currentThreads = targetThreadCounts[targetServer] || 0;
                const serverLimit = serverThreadLimits[targetServer] || fairSharePerServer;
                const remainingAllowedThreads = Math.max(0, serverLimit - currentThreads);

                const threadsToAssign = Math.min(maxThreadsOnServer - threadsUsed, remainingAllowedThreads);

                if (threadsToAssign > 0) {
                    const script = ACTION_SCRIPTS[targetAction];
                    const pid = ns.exec(script, assistServer, threadsToAssign, targetServer);

                    // Check if execution failed (returns 0 on failure)
                    if (pid === 0) {
                        ns.print(`WARNING: Failed to execute ${script} on ${assistServer} - possible RAM conflict`);
                        // Force cleanup and retry in next cycle
                        await force_ram_reallocation(ns);
                        return;
                    }

                    threadsUsed += threadsToAssign;
                    totalDistributedThreads += threadsToAssign;
                    targetThreadCounts[targetServer] += threadsToAssign;

                    // Update state tracking
                    if (!HOME_ASSISTANCE_STATE[targetServer]) {
                        HOME_ASSISTANCE_STATE[targetServer] = {
                            action: targetAction,
                            totalThreads: 0,
                            assignments: [],
                        };
                    }
                    HOME_ASSISTANCE_STATE[targetServer].totalThreads += threadsToAssign;
                    HOME_ASSISTANCE_STATE[targetServer].assignments.push({
                        server: assistServer,
                        threads: threadsToAssign,
                        pid: pid,
                    });

                    ns.print(
                        `  Assigned ${threadsToAssign} threads to ${targetServer} (${targetAction}) - total: ${targetThreadCounts[targetServer]}`,
                    );
                } else {
                    // This shouldn't happen anymore since we pre-check remainingAllowedThreads
                    ns.print(`WARNING: Unexpected zero thread assignment to ${targetServer}`);
                    break;
                }
            }
        }

        // Log final distribution
        ns.print(
            `Total distributed: ${totalDistributedThreads} threads across ${serversNeedingNewAssistance.length} targets`,
        );
        for (const { server, action } of serversNeedingNewAssistance) {
            const state = HOME_ASSISTANCE_STATE[server];
            if (state) {
                ns.print(
                    `  ${server} (${action}): ${state.totalThreads} threads from ${state.assignments.length} assistance servers`,
                );
            }
        }
    }
}

function execute_server_action(ns, server, action) {
    ns.run(EXECUTE_SCRIPT, 1, action, server, server);

    // Execute on associated servers
    if (SERVERS[server]["servers"]) {
        for (const host of SERVERS[server]["servers"]) {
            ns.run(EXECUTE_SCRIPT, 1, action, server, host);
        }
    }

    // Execute on purchased server if it exists
    if (ns.serverExists(server + "-serv")) {
        ns.run(EXECUTE_SCRIPT, 1, action, server, server + "-serv");
    }
}

function start_ipvgo_if_not_running(ns) {
    // Check if "master/ipvgo.js" is running on "home"
    let ipvgoRunning = ns.isRunning("techLord/master/ipvgo.js", "home");

    // If not running, execute the script
    if (!ipvgoRunning) {
        // Determine which opponent to reset the board against
        const opponents = ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];
        const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];

        // Reset the board state with the randomly chosen opponent
        ns.go.resetBoardState(randomOpponent, 13);

        // Start the new game
        ns.exec("techLord/master/ipvgo.js", "home");
    }
}

// Add comprehensive cleanup function
async function cleanup_all_processes(ns) {
    const purchasedServers = get_purchased_servers(ns);
    const assistanceServers = ["home", ...purchasedServers];

    let totalKilled = 0;

    // Kill all home assistance processes (direct action scripts)
    for (const assistServer of assistanceServers) {
        const processes = ns.ps(assistServer).filter((p) => Object.values(ACTION_SCRIPTS).includes(p.filename));
        processes.forEach((p) => {
            ns.kill(p.pid);
            totalKilled++;
        });
    }

    // Kill all execute processes on purchased servers
    for (const server of purchasedServers) {
        const processes = ns.ps(server).filter((p) => p.filename === EXECUTE_SCRIPT);
        processes.forEach((p) => {
            ns.kill(p.pid);
            totalKilled++;
        });
    }

    // Clear assistance state
    HOME_ASSISTANCE_STATE = {};

    if (totalKilled > 0) {
        ns.print(`Cleaned up ${totalKilled} old processes`);
    }

    // Wait for cleanup to complete
    await ns.sleep(1000);
}

// Force cleanup and reallocation when RAM issues are detected
async function force_ram_reallocation(ns) {
    ns.print("Forcing RAM reallocation due to allocation conflicts");
    await cleanup_all_processes(ns);

    // Wait longer for all processes to fully terminate
    await ns.sleep(2000);

    // Clear any lingering state
    HOME_ASSISTANCE_STATE = {};
}

/**
 * @param {NS} ns
 */
export async function main(ns) {
    disable_logs(ns);
    ns.tprint(
        "Enhanced MCP started - leveraging home and purchased servers with direct action scripts for optimal RAM usage",
    );

    // Initialize eligible server count
    const allServers = get_all_servers(ns);

    let eligibleServerCount = 0;
    for (const server of allServers) {
        if (!ns.hasRootAccess(server)) continue;
        if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) continue;
        eligibleServerCount++;
    }

    LAST_ELIGIBLE_SERVER_COUNT = eligibleServerCount;
    ns.print(`Initial eligible server count: ${LAST_ELIGIBLE_SERVER_COUNT}`);

    while (true) {
        ensure_scripts_on_servers(ns);
        await update_servers(ns);
        start_ipvgo_if_not_running(ns);

        const serversNeedingHomeHelp = [];
        const serverList = Object.keys(SERVERS);

        // Sort by priority (high-value servers first)
        serverList.sort((a, b) => {
            const priorityA = get_server_metrics(ns, a).priority;
            const priorityB = get_server_metrics(ns, b).priority;
            return priorityB - priorityA;
        });

        for (const server of serverList) {
            // Skip servers that are beyond our hacking level
            if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) {
                ns.print(
                    `Skipping ${server} - requires hacking level ${ns.getServerRequiredHackingLevel(server)}, current level: ${ns.getHackingLevel()}`,
                );
                continue;
            }

            const action = determine_action(ns, server);
            const needsAssist = should_home_assist(ns, server, action);

            // Track home assistance
            if (needsAssist) {
                // Get server metrics to check money ratio
                const { moneyRatio } = get_server_metrics(ns, server);

                // If server needs hack but isn't at 90%+ money, assist with grow instead
                let assistAction = action;
                if (action === "hack" && moneyRatio <= MONEY_MAX_PERCENTAGE) {
                    assistAction = "grow";
                }

                serversNeedingHomeHelp.push({ server, action: assistAction });
            }
            SERVERS[server]["needsHomeAssist"] = needsAssist;

            // Execute action if changed
            if (SERVERS[server]["action"] !== action) {
                SERVERS[server]["action"] = action;
                execute_server_action(ns, server, action);

                const status = needsAssist ? " (home assisting)" : "";
                ns.print(`${server}: ${action}${status}`);
                await ns.sleep(500);
            }
        }

        await execute_home_assistance(ns, serversNeedingHomeHelp);

        // Status summary
        const purchasedServers = get_purchased_servers(ns);
        const counts = {
            hacking: serverList.filter((s) => SERVERS[s].action === "hack").length,
            growing: serverList.filter((s) => SERVERS[s].action === "grow").length,
            weakening: serverList.filter((s) => SERVERS[s].action === "weaken").length,
        };

        ns.print(
            `Status - Hacking: ${counts.hacking}, Growing: ${counts.growing}, Weakening: ${counts.weakening}, Home Assisting: ${serversNeedingHomeHelp.length}, Purchased Servers: ${purchasedServers.length}`,
        );

        await ns.sleep(60000 * SLEEP_TIME);
    }
}
