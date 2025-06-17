import { NS } from "@ns";

const HOST_NAME = "home";

/** @param {NS} ns */
export async function main(ns) {
	const shouldShare = ns.args.includes("--share");

	// Kill all other scripts called autoplay.js
	ns.ps(HOST_NAME).filter(p => p.filename === "autoplay.js").forEach(p => {
		if (p.pid !== ns.pid) {
			ns.kill(p.pid)
		}
	})

	const showFactionServerPaths = ns.args.includes("--faction") || ns.args.includes("-f");

	// Start all required scripts if not running
	startDistributedHackIfNotRunning(ns);

	// Start TOR and program managers
	startTorManagerIfNotRunning(ns);
	startProgramManagerIfNotRunning(ns);

	startUpgradeHnetIfNeeded(ns);

	startUpgradeServersIfNotRunning(ns);

	startIpvgoIfNotRunning(ns);

	startAutoJoinFactionsIfNotRunning(ns);

	if (showFactionServerPaths) {
		printAllFactionServerPaths(ns);
	}

	launchStatsMonitoring(ns);

	let startedStockTrader = false;
	let sharedRam = false;

	ns.tprint("INFO Autoplay check complete - all required scripts are now running");
	ns.tprint("INFO Waiting for stock trader and share ram to start");

	while (!startedStockTrader || !sharedRam) {
		// Start stock trader and also share ram after we purchase server b-24
		if (ns.serverExists("b-24")) {
			startStockTraderIfNotRunning(ns);
			if (shouldShare) {
				startShareAllRamIfNotRunning(ns);
			}

			startedStockTrader = true;
			sharedRam = true;
			break;
		}
		await ns.sleep(10000);
	}

	ns.tprint("INFO Stock trader and share ram started - Autoplay complete");
}

function startDistributedHackIfNotRunning(ns) {
	// Check if "kamu/distributed-hack.js" is running on "home"
	let distributedHackRunning = isScriptRunning(ns, 'kamu/distributed-hack.js', HOST_NAME);

	// If not running, execute the script
	if (!distributedHackRunning) {
		ns.exec('kamu/distributed-hack.js', HOST_NAME);
		ns.tprint("Started kamu/distributed-hack.js");
	} else {
		ns.tprint("kamu/distributed-hack.js is already running");
	}
}

export function startIpvgoIfNotRunning(ns) {
	// Check if "master/ipvgo.js" is running on "home"
	let ipvgoRunning = isScriptRunning(ns, 'techLord/master/ipvgo.js', 'home');

	// If not running, execute the script
	if (!ipvgoRunning) {
		ns.exec('techLord/master/auto-play-ipvgo.js', "home");
		ns.tprint("Started techLord/master/auto-play-ipvgo.js");
	} else {
		ns.tprint("techLord/master/ipvgo.js is already running");
	}
}

function startAutoJoinFactionsIfNotRunning(ns) {
	// Check if "scripts/auto_join_factions.js" is running on "home"
	let autoJoinFactionsRunning = isScriptRunning(ns, 'scripts/auto_join_factions.js', HOST_NAME);

	// If not running, execute the script
	if (!autoJoinFactionsRunning) {
		ns.exec('scripts/auto_join_factions.js', HOST_NAME);
		ns.tprint("Started scripts/auto_join_factions.js");
	} else {
		ns.tprint("scripts/auto_join_factions.js is already running");
	}
}

function startUpgradeServersIfNotRunning(ns) {
	// Check if "scripts/upgrade-servers.js" is running on "home"
	let upgradeServersRunning = isScriptRunning(ns, 'scripts/upgrade_servers.js', HOST_NAME);

	// If not running, execute the script
	if (!upgradeServersRunning) {
		const pid = ns.exec('scripts/upgrade_servers.js', HOST_NAME, 1, 120000000000); // 120 B max server value
		// const pid = ns.exec('scripts/upgrade_servers.js', HOST_NAME); // No limit
		ns.ui.openTail(pid, HOST_NAME);
		ns.tprint("Started scripts/upgrade_servers.js");
	} else {
		ns.tprint("scripts/upgrade_servers.js is already running");
	}
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
		// Check if "kamu/stock-trader.js" is running on "home"
		let stockTraderRunning = isScriptRunning(ns, 'kamu/stock-trader.js', HOST_NAME);

		// If not running, execute the script
		if (!stockTraderRunning) {
			ns.kill('kamu/early-stock-trader.js');
			const pid = ns.exec('kamu/stock-trader.js', HOST_NAME);
			ns.tprint("Started kamu/stock-trader.js");
			ns.ui.openTail(pid, HOST_NAME);
		} else {
			ns.tprint("kamu/stock-trader.js is already running");
		}
	} else {
		ns.tprint("4SDataTix API is not available - starting early stock trader");
		// Check if "kamu/stock-trader.js" is running on "home"
		let stockTraderRunning = isScriptRunning(ns, 'kamu/early-stock-trader.js', HOST_NAME);

		// If not running, execute the script
		if (!stockTraderRunning) {
			ns.kill('kamu/stock-trader.js');
			const pid = ns.exec('kamu/early-stock-trader.js', HOST_NAME);
			ns.tprint("Started kamu/early-stock-trader.js");
			ns.ui.openTail(pid, HOST_NAME);
		} else {
			ns.tprint("kamu/early-stock-trader.js is already running");
		}
	}
}

function startUpgradeHnetIfNeeded(ns) {
	// Check if "kamu/upgrade-hnet.js" is running on "home"
	const upgradeHnetRunning = isScriptRunning(ns, 'scripts/hacknet_manager.js', HOST_NAME);

	// If not running, execute the script
	if (!upgradeHnetRunning) {
		ns.exec('scripts/hacknet_manager.js', HOST_NAME, 1, 0, 0.1);
	}
}

function launchStatsMonitoring(ns) {
	// Launch "get_stats.js -c"
	ns.exec('get_stats.js', HOST_NAME, 1, "--chart");
}

function startShareAllRamIfNotRunning(ns) {
	// Launch "run scripts/share_all_free_ram.js b-24" if not running
	const shareAllRamRunning = isScriptRunning(ns, 'scripts/share_all_free_ram.js', HOST_NAME);
	if (!shareAllRamRunning) {
		ns.exec('scripts/share_all_free_ram.js', HOST_NAME, 1, 'b-24');
	}
}

function printAllFactionServerPaths(ns) {
	// Call 'scripts/find_server.js' with --faction
	ns.exec('scripts/find_server.js', HOST_NAME, 1, "--faction");
}

function startTorManagerIfNotRunning(ns) {
	// Check if TOR is already available
	let hasTor = () => ns.scan("home").includes("darkweb");
	if (hasTor()) {
		ns.tprint("TOR router already available");
		return;
	}

	// Check if "scripts/tor_manager.js" is running on "home"
	let torManagerRunning = isScriptRunning(ns, 'scripts/tor_manager.js', HOST_NAME);

	// If not running, execute the script
	if (!torManagerRunning) {
		ns.exec('scripts/tor_manager.js', HOST_NAME, 1, "-c");
		ns.tprint("Started scripts/tor_manager.js");
	} else {
		ns.tprint("scripts/tor_manager.js is already running");
	}
}

function startProgramManagerIfNotRunning(ns) {
	// Check if all programs are already available
	const programNames = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
	const allProgramsAvailable = programNames.every(prog => ns.fileExists(prog, "home"));

	if (allProgramsAvailable) {
		ns.tprint("All port opener programs already available");
		return;
	}

	// Check if "scripts/program_manager.js" is running on "home"
	let programManagerRunning = isScriptRunning(ns, 'scripts/program_manager.js', HOST_NAME);

	// If not running, execute the script
	if (!programManagerRunning) {
		ns.exec('scripts/program_manager.js', HOST_NAME, 1, "-c");
		ns.tprint("Started scripts/program_manager.js");
	} else {
		ns.tprint("scripts/program_manager.js is already running");
	}
}

function isScriptRunning(ns, scriptName, hostname) {
	const runningScripts = ns.ps(hostname).map(process => process.filename);
	return runningScripts.includes(scriptName);
}