import { NS } from "@ns";

const HOST_NAME = "home";
const MAX_SERVER_VALUE = -1; //160 * 10 ** 9; // 12 B max server value
const HACKNET_MAX_PAYBACK_TIME = 0.2; // 0.2 hours max payback time
const SERVER_TO_START_SHARING_RAM_ON = null; //"b-05";

const IPVGO_OPPONENTS = [
    "Netburners", // increased hacknet production
    // "Slum Snakes", // crime success rate
    "The Black Hand", // hacking money
    // "Tetrads", // strength, defense, dexterity, and agility levels
    "Daedalus", // reputation gain
    "Illuminati", // faster hack(), grow(), and weaken()
    // "????????????", // w0r1d_d43m0n Hacking Levels
];

export function autocomplete(data, args) {
    return ["--share", "--faction", "--low-ram", "--go"];
}

/** @param {NS} ns */
export async function main(ns) {
    const shouldShare = ns.args.includes("--share");
    const showFactionServerPaths = ns.args.includes("--faction") || ns.args.includes("-f");
    const lowRamMode = ns.args.includes("--low-ram");
    const goMode = ns.args.includes("--go");

    if (goMode) {
        restartIpvgo(ns);
        return;
    }

    // Kill all other scripts called autoplay.js
    ns.ps(HOST_NAME)
        .filter((p) => p.filename === "autoplay.js")
        .forEach((p) => {
            if (p.pid !== ns.pid) {
                ns.kill(p.pid);
            }
        });

    // Start all required scripts if not running
    startDistributedHackIfNotRunning(ns);

    startUpgradeHnetIfNeeded(ns);

    // After unlocking gangs, sleeves should be assigned manually
    // if (ns.heart.break() > -54000) {
    startSleeveIfNeeded(ns);
    // }

    startGangIfNeeded(ns);

    restartUpgradeServers(ns);

    restartIpvgo(ns);

    if (!lowRamMode) {
        // Start TOR and program managers
        startTorManagerIfNotRunning(ns);
        startProgramManagerIfNotRunning(ns);

        startAutoJoinFactionsIfNotRunning(ns);
        // startHacknetSpendIfNeeded(ns);
    }

    if (showFactionServerPaths) {
        printAllFactionServerPaths(ns);
    }

    launchStatsMonitoring(ns);

    let startedStockTrader = false;
    let sharedRam = false;

    ns.tprint("INFO Autoplay check complete - all required scripts are now running");
    ns.tprint("INFO Waiting for stock trader and share ram to start");

    if (ns.getServerMaxRam(HOST_NAME) > 16384) {
        ns.tprint("INFO Home server has enough RAM, first sharing some on home");
        let runningHomeShare = isScriptRunning(ns, "scripts/share-all-free-ram.js", HOST_NAME, [HOST_NAME]);
        if (!runningHomeShare) {
            const success = ns.exec(
                "scripts/share-all-free-ram.js",
                HOST_NAME,
                1,
                HOST_NAME,
                Math.max(2048, Math.min(ns.getServerMaxRam("home") / 16, 2 ** 20)),
            );
            if (success) {
                ns.tprint("SUCCESS Successfully started share-all-free-ram.js on home");
            }
        } else {
            ns.tprint("scripts/share-all-free-ram.js is already running on home");
        }
    }

    while (!startedStockTrader || (!sharedRam && SERVER_TO_START_SHARING_RAM_ON)) {
        if (
            !sharedRam &&
            shouldShare &&
            SERVER_TO_START_SHARING_RAM_ON &&
            ns.serverExists(SERVER_TO_START_SHARING_RAM_ON)
        ) {
            startShareAllRamIfNotRunning(ns);
            sharedRam = true;
        }

        const totalServerValue = ns
            .getPurchasedServers()
            .reduce((acc, server) => acc + ns.getPurchasedServerCost(ns.getServer(server).maxRam), 0);

        // if MAX_SERVER_VALUE is -1, don't start until we have b-24 server
        const noMaxServerValueCondition =
            MAX_SERVER_VALUE === -1 && ns.getPurchasedServers().length < ns.getPurchasedServerLimit();

        // Start stock trader and also share ram after we purchase the server to share ram on
        if (totalServerValue > MAX_SERVER_VALUE && !noMaxServerValueCondition) {
            // startStockTraderIfNotRunning(ns);

            startedStockTrader = true;
        }
        await ns.sleep(10000);
    }

    ns.tprint("INFO Stock trader and share ram started - Autoplay complete");
}

/**
 * @param {NS} ns
 * @param {string} scriptName
 * @param {string} hostname
 * @returns {number}
 */
function isScriptRunning(ns, scriptName, hostname, args = []) {
    if (args.length > 0) {
        const runningProcesses = ns.ps(hostname);
        return (
            runningProcesses.filter(
                (process) => process.filename.includes(scriptName) && args.every((arg) => process.args.includes(arg)),
            )[0]?.pid ?? 0
        );
    } else {
        const runningProcesses = ns.ps(hostname);
        return runningProcesses.filter((process) => process.filename.includes(scriptName))[0]?.pid ?? 0;
    }
}

/**
 * Helper function to start a script if it's not already running
 * @param {NS} ns - The NetScript namespace
 * @param {string} scriptName - Name of the script to start
 * @param {string} hostname - Hostname to run the script on (default: HOME_NAME)
 * @param {number} threads - Number of threads (default: 1)
 * @param {...any} args - Arguments to pass to the script
 * @returns {{pid: number, success: boolean}} - PID and success status
 */
function startScriptIfNotRunning(ns, scriptName, hostname = HOST_NAME, threads = 1, ...args) {
    const isRunning = isScriptRunning(ns, scriptName, hostname);

    if (isRunning) {
        ns.tprint(`${scriptName} is already running`);
        return { pid: 0, success: false };
    }

    const pid = ns.exec(scriptName, hostname, threads, ...args);

    if (pid === 0) {
        ns.tprint(`ERROR Failed to start ${scriptName}`);
        return { pid: 0, success: false };
    } else {
        ns.tprint(`SUCCESS Started ${scriptName}${args.length > 0 ? ` ${args}` : ""} with PID ${pid}`);
        return { pid, success: true };
    }
}

function startDistributedHackIfNotRunning(ns) {
    if (SERVER_TO_START_SHARING_RAM_ON) {
        startScriptIfNotRunning(ns, "scripts/hacker.js", HOST_NAME, 1, SERVER_TO_START_SHARING_RAM_ON);
    } else {
        startScriptIfNotRunning(ns, "scripts/hacker.js", HOST_NAME, 1);
    }
}

function restartIpvgo(ns) {
    // Check if "master/ipvgo.js" is running on HOST_NAME (different check script name)
    let ipvgoPid = isScriptRunning(ns, "ipvgo-smart.js", HOST_NAME);

    if (ipvgoPid) {
        ns.kill(ipvgoPid);
    }

    startScriptIfNotRunning(ns, "ipvgo-smart.js", HOST_NAME, 1, ...IPVGO_OPPONENTS);
    // Note: This function checks for a different script name than what it starts
}

function startSleeveIfNeeded(ns) {
    const result = startScriptIfNotRunning(ns, "sleeve.js", HOST_NAME, 1);
    if (result.success) {
        ns.ui.openTail(result.pid, HOST_NAME);
    }
}

function startGangIfNeeded(ns) {
    const result = startScriptIfNotRunning(ns, "gangs.js", HOST_NAME, 1, "--money-focus");
    if (result.success) {
        ns.ui.openTail(result.pid, HOST_NAME);
    }
}

function startHacknetSpendIfNeeded(ns) {
    startScriptIfNotRunning(ns, "scripts/hacknet-spend.js", HOST_NAME, 1, "--maxMoney", "--minSecurity");
}

function startAutoJoinFactionsIfNotRunning(ns) {
    startScriptIfNotRunning(ns, "scripts/auto-join-factions.js");
}

function restartUpgradeServers(ns) {
    const isRunning = isScriptRunning(ns, "scripts/upgrade-servers.js", HOST_NAME);

    if (isRunning) {
        ns.kill(isRunning);
    }

    const result = startScriptIfNotRunning(ns, "scripts/upgrade-servers.js", HOST_NAME, 1, MAX_SERVER_VALUE);
}

function startStockTraderIfNotRunning(ns) {
    const canTradeStocks = ns.stock.hasTIXAPIAccess();
    const has4SDataTixApi = ns.stock.has4SDataTIXAPI();

    if (!canTradeStocks) {
        ns.tprint("Cannot trade stocks, skipping stock trader");
        return;
    }

    if (has4SDataTixApi) {
        ns.tprint("4SDataTix API is available - starting stock trader");

        const result = startScriptIfNotRunning(ns, "kamu/stock-trader.js");
        if (result.success) {
            ns.kill("kamu/early-stock-trader.js");
            ns.ui.openTail(result.pid, HOST_NAME);
        }
    } else {
        ns.tprint("4SDataTix API is not available - starting early stock trader");

        const result = startScriptIfNotRunning(ns, "kamu/early-stock-trader.js");
        if (result.success) {
            ns.kill("kamu/stock-trader.js");
            ns.ui.openTail(result.pid, HOST_NAME);
        }
    }

    startScriptIfNotRunning(ns, "scripts/stock-monitor.js");
}

function startUpgradeHnetIfNeeded(ns) {
    // startScriptIfNotRunning(ns, "scripts/hacknet-servers.js", HOST_NAME, 1, HACKNET_MAX_PAYBACK_TIME);
    startScriptIfNotRunning(ns, "scripts/hacknet-servers.js", HOST_NAME, 1, "--continuous");
}

function launchStatsMonitoring(ns) {
    startScriptIfNotRunning(ns, "get-stats.js", HOST_NAME, 1, "--chart");
}

function startShareAllRamIfNotRunning(ns) {
    startScriptIfNotRunning(ns, "scripts/share-all-free-ram.js", HOST_NAME, 1, SERVER_TO_START_SHARING_RAM_ON);
}

function printAllFactionServerPaths(ns) {
    startScriptIfNotRunning(ns, "scripts/find-server.js", HOST_NAME, 1, "--faction");
}

function startTorManagerIfNotRunning(ns) {
    // Check if TOR is already available
    let hasTor = () => ns.scan(HOST_NAME).includes("darkweb");
    if (hasTor()) {
        ns.tprint("TOR router already available");
        return;
    }

    startScriptIfNotRunning(ns, "scripts/tor-manager.js", HOST_NAME, 1, "-c");
}

function startProgramManagerIfNotRunning(ns) {
    // Check if all programs are already available
    const programNames = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
    const allProgramsAvailable = programNames.every((prog) => ns.fileExists(prog, HOST_NAME));

    if (allProgramsAvailable) {
        ns.tprint("All port opener programs already available");
        return;
    }

    startScriptIfNotRunning(ns, "scripts/program-manager.js", HOST_NAME, 1, "-c");
}
