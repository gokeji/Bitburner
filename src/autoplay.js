// import { NS } from "@ns";

const HOST_NAME = "home";

/** @param {NS} ns */
export async function main(ns) {
	// Kill all other scripts called autoplay.js
	ns.ps(HOST_NAME).filter(p => p.filename === "autoplay.js").forEach(p => {
		if (p.pid !== ns.pid) {
			ns.kill(p.pid)
		}
	})

	const showFactionServerPaths = ns.args.includes("--faction") || ns.args.includes("-f");

	// Start all required scripts if not running
	startDistributedHackIfNotRunning(ns);

	// startUpgradeHnetIfNeeded(ns);

	startUpgradeServersIfNotRunning(ns);

	startIpvgoIfNotRunning(ns);

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
			startShareAllRamIfNotRunning(ns);

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
	let ipvgoRunning = isScriptRunning(ns, 'techLord/master/auto-play-ipvgo.js', 'home');

	// If not running, execute the script
	if (!ipvgoRunning) {
		ns.exec('techLord/master/auto-play-ipvgo.js', "home");
	} else {
		ns.tprint("techLord/master/auto-play-ipvgo.js is already running");
	}
}

function startUpgradeServersIfNotRunning(ns) {
	// Check if "scripts/upgrade-servers.js" is running on "home"
	let upgradeServersRunning = isScriptRunning(ns, 'scripts/upgrade-servers.js', HOST_NAME);

	// If not running, execute the script
	if (!upgradeServersRunning) {
		ns.exec('scripts/upgrade-servers.js', HOST_NAME);
		ns.tprint("Started scripts/upgrade-servers.js");
	} else {
		ns.tprint("scripts/upgrade-servers.js is already running");
	}
}

function startStockTraderIfNotRunning(ns) {

	const has4SDataTixApi = ns.getPlayer().has4SDataTixApi;

	if (has4SDataTixApi) {
		ns.tprint("4SDataTix API is available - starting stock trader");
		// Check if "kamu/stock-trader.js" is running on "home"
		let stockTraderRunning = isScriptRunning(ns, 'kamu/stock-trader.js', HOST_NAME);

		// If not running, execute the script
		if (!stockTraderRunning) {
			ns.kill('kamu/early-stock-trader.js');
			ns.exec('kamu/stock-trader.js', HOST_NAME);
			ns.tprint("Started kamu/stock-trader.js");
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
			ns.exec('kamu/early-stock-trader.js', HOST_NAME);
			ns.tprint("Started kamu/early-stock-trader.js");
		} else {
			ns.tprint("kamu/early-stock-trader.js is already running");
		}
	}
}

function startUpgradeHnetIfNeeded(ns) {
	// Check if "kamu/upgrade-hnet.js" is running on "home"
	const upgradeHnetRunning = isScriptRunning(ns, 'letsPlayBitBurner/hnet-full.js', HOST_NAME);

	// If not running, execute the script
	if (!upgradeHnetRunning) {
		ns.exec('letsPlayBitBurner/hnet-full.js', HOST_NAME, 1, 0, 0.2);
	}
}

function launchStatsMonitoring(ns) {
	// Launch "get_stats_new.js -c"
	ns.exec('get_stat_new.js', HOST_NAME, 1, "--chart");
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

function isScriptRunning(ns, scriptName, hostname) {
	const runningScripts = ns.ps(hostname).map(process => process.filename);
	return runningScripts.includes(scriptName);
}