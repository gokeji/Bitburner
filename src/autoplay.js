/** @param {NS} ns */
export async function main(ns) {
	// Start all required scripts if not running
	start_distributed_hack_if_not_running(ns);
	start_ipvgo_if_not_running(ns);
	start_upgrade_servers_if_not_running(ns);
	// start_stock_trader_if_not_running(ns); // Do not run stock trader for now

	ns.tprint("Autoplay check complete - all required scripts are now running");
}

function start_distributed_hack_if_not_running(ns) {
	// Check if "kamu/distributed-hack.js" is running on "home"
	let distributedHackRunning = ns.isRunning('kamu/distributed-hack.js', 'home');

	// If not running, execute the script
	if (!distributedHackRunning) {
		ns.exec('kamu/distributed-hack.js', "home");
		ns.tprint("Started kamu/distributed-hack.js");
	} else {
		ns.tprint("kamu/distributed-hack.js is already running");
	}
}

function start_ipvgo_if_not_running(ns) {
	// Check if "master/ipvgo.js" is running on "home"
	let ipvgoRunning = ns.isRunning('techLord/master/auto-play-ipvgo.js', 'home');

	// If not running, execute the script
	if (!ipvgoRunning) {
		ns.exec('techLord/master/auto-play-ipvgo.js', "home");
	} else {
		ns.tprint("techLord/master/auto-play-ipvgo.js is already running");
	}
}

function start_upgrade_servers_if_not_running(ns) {
	// Check if "kamu/upgrade-servers.js" is running on "home"
	let upgradeServersRunning = ns.isRunning('kamu/upgrade-servers.js', 'home');

	// If not running, execute the script
	if (!upgradeServersRunning) {
		ns.exec('kamu/upgrade-servers.js', "home");
		ns.tprint("Started kamu/upgrade-servers.js");
	} else {
		ns.tprint("kamu/upgrade-servers.js is already running");
	}
}

function start_stock_trader_if_not_running(ns) {
	// Check if "kamu/stock-trader.js" is running on "home"
	let stockTraderRunning = ns.isRunning('kamu/stock-trader.js', 'home');

	// If not running, execute the script
	if (!stockTraderRunning) {
		ns.exec('kamu/stock-trader.js', "home");
		ns.tprint("Started kamu/stock-trader.js");
	} else {
		ns.tprint("kamu/stock-trader.js is already running");
	}
}
