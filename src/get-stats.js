import { NS } from "@ns";

const REFRESH_RATE = 500;
const CACHE_EXPIRY_MS = 10000; // Cache server list for 10 seconds
const HGW_DISPLAY_CACHE_EXPIRY_MS = 2000; // Cache HGW display data for 2 seconds

// Global caches to reduce expensive operations
let serverListCache = null;
let serverListCacheTime = 5000;
let executableServersCache = null;
let executableServersCacheTime = 5000;
let hgwStatsCache = new Map(); // targetServer -> {attackInfo, earliestEndTime, timestamp}

// Hacking money rate tracking (similar to karma.js)
let hackingMoneyHistory = [];

// Modify this to match your scripts
const hgwScripts = {
    "kamu/weaken.js": "weaken",
    "kamu/grow.js": "grow",
    "kamu/hack.js": "hack",
};

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");

    // Kill all other scripts called get_stats.js
    ns.ps(ns.getHostname())
        .filter((p) => p.filename === "get-stats.js")
        .forEach((p) => {
            if (p.pid !== ns.pid) {
                ns.ui.closeTail(p.pid);
                ns.kill(p.pid);
            }
        });

    const charsWidth = 137; // Updated to include 8-char priority column + 6-char batch column + 5-char time column + separators

    // Chart mode: dynamic updating terminal display
    ns.ui.openTail();

    // Initial window setup (will be adjusted dynamically)
    ns.ui.resizeTail(charsWidth * 10, 400);
    ns.ui.moveTail(320, 0);

    let cleanupCounter = 0;

    // Clear all caches at startup to ensure fresh data
    serverMaxMoneyCache.clear();
    serverOrderCache = null;
    lastServerList = null;
    cleanupCaches();

    while (true) {
        // Update profit data from distributed-hack.js
        update_distributed_hack_profits(ns);

        // Update hacking money rate tracking
        updateHackingMoneyRate(ns);

        // Cleanup caches every 30 seconds to prevent memory leaks
        cleanupCounter++;
        if (cleanupCounter % Math.floor(30000 / REFRESH_RATE) === 0) {
            // Every 30 seconds
            cleanupCaches();
        }

        // Rescan for servers on each iteration, but use cache to reduce overhead
        var servers = getServers(ns, "hackable");

        // Dynamically adjust window size based on current server count
        const windowWidth = charsWidth * 9.7; // 120 characters * 8px per char
        const windowHeight = Math.min((servers.length + 6) * 26, 800); // lines * 16px per line

        ns.ui.resizeTail(windowWidth, windowHeight);

        // Generate all content first to minimize flashing
        const chartData = generate_chart_data(ns, servers);
        const hackingRate = getHackingMoneyRate();

        const timeHeader = `Time: ${new Date().toLocaleTimeString()} - Hack Monitor - Hacking Rate: ${ns.formatNumber(hackingRate)}/s`;
        const separator = "=".repeat(charsWidth);
        const dashSeparator = "-".repeat(charsWidth);
        const tableHeader = get_table_header();

        const allUsableServers = getServers(ns, "executable");
        const purchasedServerCount = allUsableServers.filter(
            (server) => ns.getServer(server).purchasedByPlayer && server !== "home",
        ).length;
        const totalRam = allUsableServers.reduce((acc, server) => acc + ns.getServerMaxRam(server), 0);
        const usedRam = allUsableServers.reduce((acc, server) => acc + ns.getServerUsedRam(server), 0);
        const ramUtilization = usedRam / totalRam;
        const footer = `Target servers: ${servers.length} | Usable servers: ${allUsableServers.length} (Purchased: ${purchasedServerCount}/${ns.getPurchasedServerLimit()}) | CPU cores: ${allUsableServers.reduce((acc, server) => acc + ns.getServer(server).cpuCores, 0)} | RAM: ${ns.formatRam(usedRam, 2)} / ${ns.formatRam(totalRam, 2)} (${ns.formatPercent(ramUtilization, 2)})`;

        // Clear and display all content at once to reduce flashing
        ns.clearLog();
        ns.print(timeHeader);
        ns.print(separator);
        ns.print(tableHeader);
        ns.print(dashSeparator);

        // Display server data
        for (const serverLine of chartData) {
            ns.print(serverLine);
        }

        // Add footer with summary
        ns.print(separator);
        ns.print(footer);

        await ns.sleep(REFRESH_RATE);
    }
}

/**
 * @param {NS} ns
 * @param {"executable" | "hackable"} type
 **/
function getServers(ns, type) {
    /*
	Scans and iterates through all servers.
	If all is false, only servers with root access and have money are returned.
	*/
    const now = Date.now();

    // Check if we have a valid cache
    if (type === "executable" && executableServersCache && now - executableServersCacheTime < CACHE_EXPIRY_MS) {
        return executableServersCache;
    }
    if (type === "hackable" && serverListCache && now - serverListCacheTime < CACHE_EXPIRY_MS) {
        return serverListCache;
    }

    // Use efficient BFS implementation with Set for O(1) lookups
    const discovered = new Set(["home"]); // Track all discovered servers
    const toScan = ["home"]; // Queue of servers to scan

    const hackableServerFilter = (server) => {
        if (!ns.hasRootAccess(server)) return false;
        if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) return false;
        if (ns.getServerMaxMoney(server) === 0) return false;
        if (server === "home") return false;
        return true;
    };

    const executableServerFilter = (server) => {
        if (!ns.hasRootAccess(server)) return false;
        if (ns.getServerMaxRam(server) === 0) return false;
        if (server.startsWith("hacknet-server")) return false;
        return true;
    };

    // BFS traversal of the server network
    while (toScan.length > 0) {
        const server = toScan.shift(); // Process next server in queue

        // Scan for connected servers and add new ones to the queue
        const connectedServers = ns.scan(server);
        for (const connectedServer of connectedServers) {
            if (!discovered.has(connectedServer)) {
                toScan.push(connectedServer);
                discovered.add(connectedServer);
            }
        }
    }

    // Convert to array and filter based on type
    let result = Array.from(discovered);

    if (type === "executable") {
        result = result.filter(executableServerFilter);
    } else if (type === "hackable") {
        result = result.filter(hackableServerFilter);
    }

    // Cache the results
    if (type === "executable") {
        executableServersCache = result;
        executableServersCacheTime = now;
    } else {
        serverListCache = result;
        serverListCacheTime = now;
    }

    return result;
}

/**
 * Finds all HGW processes targeting the target server and returns the total threads and earliest end time.
 * Uses caching to avoid expensive recalculation on every tick.
 * @param {NS} ns
 * @param {string} targetServer
 * @returns {{attackInfo: string, earliestEndTime: number}}
 */
function findHGWProcesses(ns, targetServer) {
    const now = Date.now();
    const cached = hgwStatsCache.get(targetServer);

    // Check if we have valid cached data (cache for 2 seconds)
    if (cached && now - cached.timestamp < 2000) {
        return { attackInfo: cached.attackInfo, earliestEndTime: cached.earliestEndTime };
    }

    const executableServers = getServers(ns, "executable");

    let totalThreads = 0;
    let threadCounts = {
        grow: 0,
        weaken: 0,
        hack: 0,
    };
    let scriptCounts = {
        weaken: 0,
        grow: 0,
        hack: 0,
    };
    let serverEarliestEndTime = new Map();

    // Check all servers for hgw scripts targeting this server
    for (const server of executableServers) {
        const processes = ns.ps(server);
        for (const process of processes) {
            // Check if it's a hgw script targeting our server
            if (hgwScripts[process.filename] && process.args.length >= 1 && process.args[0] === targetServer) {
                const actionType = hgwScripts[process.filename];
                threadCounts[actionType] += process.threads;
                totalThreads += process.threads;
                scriptCounts[actionType] += 1;

                const endTime = process.args.find((arg) => typeof arg === "string" && arg.startsWith("endTime="));
                if (endTime) {
                    const endTimeMs = parseInt(endTime.split("=")[1]);
                    serverEarliestEndTime.set(
                        server,
                        Math.min(serverEarliestEndTime.get(server) || endTimeMs, endTimeMs),
                    );
                }
            }
        }
    }

    if (totalThreads === 0) {
        const result = { attackInfo: null, earliestEndTime: null };

        // Cache the result even when no threads are found
        hgwStatsCache.set(targetServer, {
            attackInfo: result.attackInfo,
            earliestEndTime: result.earliestEndTime,
            timestamp: now,
        });

        return result;
    }

    // Build the display string based on which actions are present
    let displayParts = [];
    let threadParts = [];
    let activeThreadCounts = [];

    // Collect active thread counts in G:W:H order
    if (threadCounts.grow > 0) {
        displayParts.push("G");
        activeThreadCounts.push(threadCounts.grow);
    }
    if (threadCounts.weaken > 0) {
        displayParts.push("W");
        activeThreadCounts.push(threadCounts.weaken);
    }
    if (threadCounts.hack > 0) {
        displayParts.push("H");
        activeThreadCounts.push(threadCounts.hack);
    }

    // Find the maximum value to determine scaling factor
    const maxThreads = Math.max(...activeThreadCounts);

    // Count number of digits in maxThreads
    const numDigits = maxThreads.toString().length;

    // Calculate scaling factor
    const scaleFactor = 10 ** Math.max(numDigits - 2, 0);

    // Scale and format the thread counts
    for (const action in activeThreadCounts) {
        const scaledValue = activeThreadCounts[action] / scaleFactor;
        const formattedValue = Math.round(scaledValue).toString();
        threadParts.push(`${displayParts[action]}${formattedValue}`);
    }

    const totalScriptCount = scriptCounts.weaken + scriptCounts.grow + scriptCounts.hack;
    // Format total threads with padding
    const totalThreadsStr = `[${ns.formatNumber(totalThreads, 1)}-${ns.formatNumber(totalScriptCount, 0)}]`;
    const paddedTotal = totalThreadsStr.padStart(12);

    // Find the earliest end time across all servers
    const earliestEndTime =
        serverEarliestEndTime.size > 0 ? Math.min(...Array.from(serverEarliestEndTime.values())) : null;

    const result = {
        attackInfo: `${threadParts.join(":")} ${paddedTotal}`,
        earliestEndTime: earliestEndTime,
    };

    // Cache the result
    hgwStatsCache.set(targetServer, {
        attackInfo: result.attackInfo,
        earliestEndTime: result.earliestEndTime,
        timestamp: now,
    });

    return result;
}

// Global variable to store profit data from distributed-hack.js
var distributedHackProfits = new Map();

// Function to read profit data from port 4 (sent by distributed-hack.js)
function update_distributed_hack_profits(ns) {
    const profitPortHandle = ns.getPortHandle(4);
    const newProfits = new Map();

    // Read all profit data from the port
    while (!profitPortHandle.empty()) {
        try {
            const data = JSON.parse(profitPortHandle.read());
            newProfits.set(data.server, data.profit);
        } catch (e) {
            // Skip invalid JSON data
            continue;
        }
    }

    if (newProfits.size > 0) {
        // Update the global variable with the new profits
        distributedHackProfits = newProfits;
    }
}

// Get hacking priority from distributed-hack.js data, fallback to local calculation
function get_hacking_priority(ns, server) {
    // Try to get from distributed-hack.js first
    if (distributedHackProfits.has(server)) {
        return distributedHackProfits.get(server);
    }

    return null;
}

function pad_str(string, len) {
    /*
	Prepends the requested padding to the string.
	*/
    var pad = "                          "; // Extended for attack info column
    return String(pad + string).slice(-len);
}

/**
 * @param {NS} ns
 * @param {string} server
 * @returns {string}
 */
function get_server_data(ns, server, useFormulas = false) {
    /*
	Creates the info text for each server. Currently gets money, security, RAM, distributed attack info, priority, and batch time.
	*/
    var moneyAvailable = ns.getServerMoneyAvailable(server);
    var moneyMax = ns.getServerMaxMoney(server);
    var securityLvl = ns.getServerSecurityLevel(server);
    var securityMin = ns.getServerMinSecurityLevel(server);
    var ram = ns.getServerMaxRam(server);
    var requiredHackingSkill = ns.getServerRequiredHackingLevel(server);
    var hgwData = findHGWProcesses(ns, server); // Get distributed attack info and earliest end time
    var attackInfo = hgwData ? hgwData.attackInfo : null;
    var earliestEndTime = hgwData ? hgwData.earliestEndTime : null;
    var priority = get_hacking_priority(ns, server); // Get hacking priority
    var weakenTimeMs = ns.getWeakenTime(server); // Get weaken time (batch time)

    if (useFormulas) {
        // Show optimal weaken time vs real time weaken time
        // Create optimal server state for formulas API calculations
        const calcServer = {
            ...ns.getServer(server),
            hackDifficulty: ns.getServer(server).minDifficulty,
            moneyAvailable: ns.getServer(server).moneyMax,
        };
        const player = ns.getPlayer();
        weakenTimeMs = ns.formulas.hacking.weakenTime(calcServer, player);
    }

    // Format money with M suffix for millions
    var formatMoney = (amount, digits = 0) => {
        if (isNaN(amount)) return amount;
        if (amount === null) return "--";
        if (amount === 0) return "0";

        const units = ["", "k", "m", "b", "t", "q"];
        let unitIndex = 0;
        let value = amount;

        while (value >= 1000 && unitIndex < units.length - 1) {
            value /= 1000;
            unitIndex++;
        }

        // If it's a whole number, don't show decimals
        if (value === Math.floor(value)) {
            return value + units[unitIndex];
        }

        // Otherwise, show up to `digits` decimal places
        return value.toFixed(digits) + units[unitIndex];
    };

    // Format percentage with % suffix
    var formatPercentage = (amount, digits = 0) => {
        if (amount == 1) {
            return "100%";
        }
        return (amount * 100).toFixed(digits) + "%";
    };

    /**
     * Formats time from milliseconds to mm:ss
     * If timeMs is less than 5s, it will be formatted as ss.mmm
     * @param {number} timeMs
     * @returns {string}
     */
    var formatTime = (timeMs) => {
        const totalSeconds = timeMs / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const milliseconds = Math.floor(timeMs % 1000);

        if (totalSeconds > 5) {
            return `${minutes.toString()}:${seconds.toString().padStart(2, "0")}`;
        } else {
            return `${seconds.toString()}.${milliseconds.toString().padStart(3, "0")}`;
        }
    };

    /**
     * Formats time remaining until completion in mm:ss format
     * @param {number} endTimeMs - End time in milliseconds since epoch
     * @returns {string}
     */
    var formatTimeRemaining = (endTimeMs) => {
        if (!endTimeMs || endTimeMs === Infinity) return "";
        const now = Date.now();
        const remainingMs = endTimeMs - now;

        if (remainingMs <= 1) return "~~";

        return formatTime(remainingMs);
    };

    // Create progress bar (20 chars, each char = 5%)
    var createProgressBar = (percentage) => {
        const totalChars = 20;
        const filledChars = Math.floor(percentage * totalChars);
        const emptyChars = totalChars - filledChars;
        return "█".repeat(filledChars) + "░".repeat(emptyChars);
    };

    // Calculate money percentage for progress bar
    var moneyPercentage = moneyMax > 0 ? moneyAvailable / moneyMax : 0;
    var progressBar = createProgressBar(moneyPercentage);

    // Build row with separators and no column labels
    var result =
        `${pad_str(server, 18)}|` +
        `${pad_str(formatMoney(moneyAvailable, 2), 8)}/${pad_str(formatMoney(moneyMax, 2), 7)}${pad_str(`(${formatPercentage(moneyPercentage, 1)})`, 8)}|` +
        `${progressBar}|` +
        `${pad_str(securityLvl.toFixed(2), 6)}(${pad_str(ns.formatNumber(securityMin, 1), 4)})|` +
        `${pad_str(ram, 4)}G|` +
        `${pad_str(requiredHackingSkill, 5)}|` +
        `${pad_str(formatMoney(priority, 2), 8)}|` +
        `${pad_str(formatTime(weakenTimeMs), 6)}|` +
        `${pad_str(formatTimeRemaining(earliestEndTime), 6)}|`;

    // Add distributed attack info
    result += attackInfo ? pad_str(`${attackInfo}`, 24) : pad_str("", 20);

    return result;
}

// Cache for server max money (never changes) and server order
let serverMaxMoneyCache = new Map();
let serverOrderCache = null;
let lastServerList = null;

function getCachedServerMaxMoney(ns, server) {
    if (!serverMaxMoneyCache.has(server)) {
        serverMaxMoneyCache.set(server, ns.getServerMaxMoney(server));
    }
    return serverMaxMoneyCache.get(server);
}

function getSortedServerOrder(ns, servers) {
    // Convert servers array to string for comparison
    const currentServerList = servers.join(",");

    // Only recalculate order if server list has changed
    if (serverOrderCache === null || lastServerList !== currentServerList) {
        // Cache max money for any new servers
        for (const server of servers) {
            getCachedServerMaxMoney(ns, server);
        }

        // Sort servers by max money
        serverOrderCache = [...servers].sort((a, b) => serverMaxMoneyCache.get(a) - serverMaxMoneyCache.get(b));
        lastServerList = currentServerList;
    }

    return serverOrderCache;
}

// NEW: Function to generate chart data for dynamic updates
function generate_chart_data(ns, servers) {
    var stats = {};
    // For each server in servers, get the server data and add to our Hash Table.
    for (var server of servers) {
        stats[server] = get_server_data(ns, server);
    }

    // Get sorted server order (cached unless server list changed)
    var sortedServers = getSortedServerOrder(ns, servers);

    // Return sorted data for chart display
    return sortedServers.map((server) => stats[server]);
}

// Add table header function that matches exact column spacing
function get_table_header() {
    return `${pad_str("Server", 18)}|${pad_str("Money Available/Max (%)", 24)}|${pad_str("Money Reserve", 20)}|${pad_str("Sec(Min)", 12)}|${pad_str("RAM", 5)}|${pad_str("Skill", 5)}|${pad_str("Priority", 8)}|${pad_str("Batch", 6)}|${pad_str("Due", 6)}|${pad_str("Attack Threads", 24)}`;
}

// Cleanup old cache entries to prevent memory leaks
function cleanupCaches() {
    const now = Date.now();

    // Clean HGW stats cache
    for (const [server, data] of hgwStatsCache.entries()) {
        if (now - data.timestamp > 6000) {
            // Keep for 6 seconds before cleanup
            hgwStatsCache.delete(server);
        }
    }

    serverListCache = null;
    executableServersCache = null;

    // Also clear sorting cache to ensure proper re-sorting when server list changes
    serverOrderCache = null;
    lastServerList = null;
}

// Function to update hacking money rate tracking (similar to karma.js)
function updateHackingMoneyRate(ns) {
    var hackingMoney = ns.getMoneySources().sinceInstall.hacking;
    var now = Date.now();

    // Keep 60 seconds of history (same as karma.js)
    hackingMoneyHistory.push({ money: hackingMoney, time: now });
    hackingMoneyHistory = hackingMoneyHistory.filter((entry) => now - entry.time <= 60000);
}

// Function to calculate hacking money rate
function getHackingMoneyRate() {
    var rate = 0;
    if (hackingMoneyHistory.length >= 2) {
        var oldest = hackingMoneyHistory[0];
        var latest = hackingMoneyHistory[hackingMoneyHistory.length - 1];
        rate = (latest.money - oldest.money) / ((latest.time - oldest.time) / 1000);
    }
    return rate;
}
