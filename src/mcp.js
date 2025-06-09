/**
 * @param {NS} ns
 **/

// Import shared constants to avoid sync issues
import { SEC_THRESHOLD, MONEY_PERCENTAGE, MONEY_MINIMUM, MONEY_MAX_PERCENTAGE } from "lib/constants.js"

// Local configuration constants
const SLEEP_TIME = 1          // Minutes between cycles
const HOME_RESERVED_RAM = 8   // Reserve RAM on home for other scripts

// Home assistance thresholds
const ASSIST_MONEY_THRESHOLD = 0.1    // Assist servers with < 10% money
const ASSIST_SECURITY_THRESHOLD = 10   // Assist servers with security > 5 above min
const ASSIST_VALUE_THRESHOLD = 20000000 // Assist high-value servers

let SERVERS = {
	"crush-fitness": { "action": null, "servers": ["CSEC"], "needsHomeAssist": false },
	"johnson-ortho": { "action": null, "servers": ['avmnite-02h'], "needsHomeAssist": false },
	"computek": { "action": null, "servers": ["I.I.I.I"], "needsHomeAssist": false },
	"snap-fitness": { "action": null, "servers": ["run4theh111z"], "needsHomeAssist": false },
	"syscore": { "action": null, "servers": [], "needsHomeAssist": false },
	"applied-energetics": { "action": null, "servers": [], "needsHomeAssist": false },
	"4sigma": { "action": null, "servers": [], "needsHomeAssist": false },
	"fulcrumassets": { "action": null, "servers": [], "needsHomeAssist": false },
	"nwo": { "action": null, "servers": [], "needsHomeAssist": false },
}

const EXECUTE_SCRIPT = "scripts/execute.js"
const HOME_ASSIST_SCRIPT = "scripts/home_assist.js"
const FILES_TO_COPY = [
	"scripts/hack.js", "scripts/grow.js", "scripts/weaken.js",
	"scripts/copy_scripts.js", "scripts/execute.js", "scripts/home_assist.js"
]

function disable_logs(ns) {
	const logs = ["scan", "run", "getServerSecurityLevel", "getServerMoneyAvailable", "getServerMaxMoney", "getServerMinSecurityLevel", "exec", "killall", "scp"]
	logs.forEach(log => ns.disableLog(log))
}

function get_all_servers(ns) {
	const servers = ["home"]
	const result = []
	let i = 0

	while (i < servers.length) {
		const server = servers[i]
		const connections = ns.scan(server)

		for (const connection of connections) {
			if (!servers.includes(connection)) {
				servers.push(connection)
				result.push(connection)
			}
		}
		i++
	}
	return result
}

function ensure_scripts_on_servers(ns) {
	const allServers = get_all_servers(ns)

	for (const server of allServers) {
		if (ns.hasRootAccess(server) && server !== "home") {
			for (const file of FILES_TO_COPY) {
				if (ns.fileExists(file, "home") && !ns.fileExists(file, server)) {
					ns.scp(file, server)
				}
			}
		}
	}
}

function get_action(ns, host) {
	const actions = ns.ps(host)
	if (actions.length === 0) return null
	return actions[0].filename.replace("scripts/", "").replace(".js", "")
}

// Consolidated server metrics calculation
function get_server_metrics(ns, server) {
	const money = ns.getServerMoneyAvailable(server)
	const maxMoney = ns.getServerMaxMoney(server)
	const security = ns.getServerSecurityLevel(server)
	const minSecurity = ns.getServerMinSecurityLevel(server)

	return {
		money,
		maxMoney,
		moneyRatio: money / maxMoney,
		securityDiff: security - minSecurity,
		priority: maxMoney * (1 - money / maxMoney) + (security - minSecurity) * 1000000
	}
}

export function determine_action(ns, server) {
	const { moneyRatio, securityDiff, money } = get_server_metrics(ns, server)

	if (securityDiff >= SEC_THRESHOLD) return "weaken"
	if ((moneyRatio < MONEY_PERCENTAGE || money < MONEY_MINIMUM) && moneyRatio < MONEY_MAX_PERCENTAGE) return "grow"
	return "hack" // Can hack with sufficient money AND percentage
}

function should_home_assist(ns, server, action) {
	return true
}

function update_servers(ns) {
	const allServers = get_all_servers(ns)

	for (const server of allServers) {
		if (parseInt(ns.getServerMaxMoney(server)) === 0) continue

		if (!SERVERS[server]) {
			SERVERS[server] = { "action": null, "servers": [], "needsHomeAssist": false }
		}
		SERVERS[server]["action"] = get_action(ns, server)
	}
}

// Get purchased servers (servers with no money but have RAM)
function get_purchased_servers(ns) {
	const allServers = get_all_servers(ns)
	return allServers.filter(server =>
		ns.hasRootAccess(server) &&
		ns.getServerMaxMoney(server) === 0 &&
		ns.getServerMaxRam(server) > 0 &&
		server !== "home"
	)
}

function execute_home_assistance(ns, serversNeedingHelp) {
	if (serversNeedingHelp.length === 0) return

	// Get all available servers for assistance (home + purchased servers)
	const purchasedServers = get_purchased_servers(ns)
	const assistanceServers = ["home", ...purchasedServers]

	// Log purchased servers being used
	if (purchasedServers.length > 0) {
		ns.print(`Using ${purchasedServers.length} purchased servers for assistance: ${purchasedServers.join(", ")}`)
	}

	// Kill existing home assistance on all servers
	for (const assistServer of assistanceServers) {
		ns.ps(assistServer)
			.filter(p => p.filename === HOME_ASSIST_SCRIPT)
			.forEach(p => ns.kill(p.pid))
	}

	// Calculate total available RAM across all assistance servers
	let totalAvailableRam = 0
	const serverRamInfo = []

	for (const assistServer of assistanceServers) {
		const maxRam = ns.getServerMaxRam(assistServer)
		const usedRam = ns.getServerUsedRam(assistServer)
		const reservedRam = assistServer === "home" ? HOME_RESERVED_RAM : 0
		const availableRam = Math.max(0, maxRam - usedRam - reservedRam)

		if (availableRam > 0) {
			totalAvailableRam += availableRam
			serverRamInfo.push({ server: assistServer, availableRam })
		}
	}

	const scriptRam = ns.getScriptRam(HOME_ASSIST_SCRIPT)
	const totalMaxThreads = Math.floor(totalAvailableRam / scriptRam)

	if (totalMaxThreads > 0) {
		const threadsPerTarget = Math.floor(totalMaxThreads / serversNeedingHelp.length)

		if (threadsPerTarget > 0) {
			let targetIndex = 0

			// Distribute assistance across all available servers
			for (const { server: assistServer, availableRam } of serverRamInfo) {
				const maxThreadsOnServer = Math.floor(availableRam / scriptRam)
				let threadsUsed = 0

				while (threadsUsed < maxThreadsOnServer && targetIndex < serversNeedingHelp.length) {
					const { server: targetServer, action } = serversNeedingHelp[targetIndex]
					const threadsToUse = Math.min(threadsPerTarget, maxThreadsOnServer - threadsUsed)

					if (threadsToUse > 0) {
						ns.exec(HOME_ASSIST_SCRIPT, assistServer, threadsToUse, action, targetServer)
						threadsUsed += threadsToUse
					}

					targetIndex++
				}
			}

			const totalAssistServers = serverRamInfo.length
			ns.print(`Assisting ${serversNeedingHelp.length} servers using ${totalAssistServers} assistance servers (${threadsPerTarget} threads each)`)
		}
	}
}

function execute_server_action(ns, server, action) {
	ns.run(EXECUTE_SCRIPT, 1, action, server, server)

	// Execute on associated servers
	if (SERVERS[server]["servers"]) {
		for (const host of SERVERS[server]["servers"]) {
			ns.run(EXECUTE_SCRIPT, 1, action, server, host)
		}
	}

	// Execute on purchased server if it exists
	if (ns.serverExists(server + "-serv")) {
		ns.run(EXECUTE_SCRIPT, 1, action, server, server + "-serv")
	}
}

function start_ipvgo_if_not_running(ns) {
	// Check if "master/ipvgo.js" is running on "home"
	let ipvgoRunning = ns.isRunning('techLord/master/ipvgo.js', 'home');

	// If not running, execute the script
	if (!ipvgoRunning) {
		// Determine which opponent to reset the board against
		const opponents = ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];
		const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];

		// Reset the board state with the randomly chosen opponent
		ns.go.resetBoardState(randomOpponent, 13);

		// Start the new game
		ns.exec('techLord/master/ipvgo.js', "home");
	}
}

/**
 * @param {NS} ns
 */
export async function main(ns) {
	disable_logs(ns)
	ns.tprint("Enhanced MCP started - leveraging home and purchased servers for assistance")

	while (true) {
		ensure_scripts_on_servers(ns)
		update_servers(ns)
		start_ipvgo_if_not_running(ns)

		const serversNeedingHomeHelp = []
		const serverList = Object.keys(SERVERS)

		// Sort by priority (high-value servers first)
		serverList.sort((a, b) => {
			const priorityA = get_server_metrics(ns, a).priority
			const priorityB = get_server_metrics(ns, b).priority
			return priorityB - priorityA
		})

		for (const server of serverList) {
			if (!ns.hasRootAccess(server)) continue

			const action = determine_action(ns, server)
			const needsAssist = should_home_assist(ns, server, action)

			// Track home assistance
			if (needsAssist) {
				serversNeedingHomeHelp.push({ server, action })
			}
			SERVERS[server]["needsHomeAssist"] = needsAssist

			// Execute action if changed
			if (SERVERS[server]["action"] !== action) {
				SERVERS[server]["action"] = action
				execute_server_action(ns, server, action)

				const status = needsAssist ? " (home assisting)" : ""
				ns.print(`${server}: ${action}${status}`)
				await ns.sleep(500)
			}
		}

		execute_home_assistance(ns, serversNeedingHomeHelp)

		// Status summary
		const purchasedServers = get_purchased_servers(ns)
		const counts = {
			hacking: serverList.filter(s => SERVERS[s].action === "hack").length,
			growing: serverList.filter(s => SERVERS[s].action === "grow").length,
			weakening: serverList.filter(s => SERVERS[s].action === "weaken").length
		}

		ns.print(`Status - Hacking: ${counts.hacking}, Growing: ${counts.growing}, Weakening: ${counts.weakening}, Home Assisting: ${serversNeedingHomeHelp.length}, Purchased Servers: ${purchasedServers.length}`)

		await ns.sleep(60000 * SLEEP_TIME)
	}
}