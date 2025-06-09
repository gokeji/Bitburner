/**
 * @param {NS} ns
 **/

// Import shared constants to avoid sync issues
import { SEC_THRESHOLD, MONEY_PERCENTAGE, MONEY_MINIMUM, MONEY_MAX_PERCENTAGE } from "lib/constants.js"

// Local configuration constants
const SLEEP_TIME = 0.5          // Minutes between cycles
const HOME_RESERVED_RAM = 8   // Reserve RAM on home for other scripts

// Home assistance thresholds
const ASSIST_MONEY_THRESHOLD = 0.1    // Assist servers with < 10% money
const ASSIST_SECURITY_THRESHOLD = 10   // Assist servers with security > 5 above min
const ASSIST_VALUE_THRESHOLD = 20000000 // Assist high-value servers

// Track current home assistance state
let HOME_ASSISTANCE_STATE = {}

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

// Find all home assistance processes targeting a specific server
function find_home_assist_processes_for_target(ns, targetServer) {
	const purchasedServers = get_purchased_servers(ns)
	const assistanceServers = ["home", ...purchasedServers]
	const processes = []

	for (const assistServer of assistanceServers) {
		const serverProcesses = ns.ps(assistServer)
			.filter(p => p.filename === HOME_ASSIST_SCRIPT && p.args.length >= 2 && p.args[1] === targetServer)

		processes.push(...serverProcesses.map(p => ({ ...p, assistServer })))
	}

	return processes
}

// Kill home assistance processes for a specific target server
function kill_home_assist_for_target(ns, targetServer) {
	const processes = find_home_assist_processes_for_target(ns, targetServer)
	processes.forEach(p => ns.kill(p.pid))
	if (processes.length > 0) {
		ns.print(`Killed ${processes.length} home assistance processes for ${targetServer}`)
	}
}

function execute_home_assistance(ns, serversNeedingHelp) {
	// Handle servers that no longer need assistance or have changed actions
	for (const targetServer of Object.keys(HOME_ASSISTANCE_STATE)) {
		const currentAssistance = HOME_ASSISTANCE_STATE[targetServer]
		const newAssistance = serversNeedingHelp.find(s => s.server === targetServer)

		// Server no longer needs assistance or action changed
		if (!newAssistance || newAssistance.action !== currentAssistance.action) {
			kill_home_assist_for_target(ns, targetServer)
			delete HOME_ASSISTANCE_STATE[targetServer]
		}
	}

	// Filter out servers that already have correct assistance running
	const serversNeedingNewAssistance = serversNeedingHelp.filter(({ server, action }) => {
		const currentAssistance = HOME_ASSISTANCE_STATE[server]
		return !currentAssistance || currentAssistance.action !== action
	})

	if (serversNeedingNewAssistance.length === 0) return

	// Get all available servers for assistance (home + purchased servers)
	const purchasedServers = get_purchased_servers(ns)
	const assistanceServers = ["home", ...purchasedServers]

	// Log purchased servers being used
	if (purchasedServers.length > 0) {
		ns.print(`Using ${purchasedServers.length} purchased servers for assistance: ${purchasedServers.join(", ")}`)
	}

	// Calculate available RAM for each assistance server
	const serverRamInfo = []
	for (const assistServer of assistanceServers) {
		const maxRam = ns.getServerMaxRam(assistServer)
		const usedRam = ns.getServerUsedRam(assistServer)
		const reservedRam = assistServer === "home" ? HOME_RESERVED_RAM : 0
		const availableRam = Math.max(0, maxRam - usedRam - reservedRam)

		if (availableRam > 0) {
			serverRamInfo.push({ server: assistServer, availableRam })
		}
	}

	const scriptRam = ns.getScriptRam(HOME_ASSIST_SCRIPT)

	// Calculate total threads available across all servers
	const totalAvailableThreads = serverRamInfo.reduce((sum, info) =>
		sum + Math.floor(info.availableRam / scriptRam), 0
	)

	if (totalAvailableThreads > 0) {
		const threadsPerTarget = Math.floor(totalAvailableThreads / serversNeedingNewAssistance.length)

		if (threadsPerTarget > 0) {
			// Distribute threads more evenly by cycling through targets
			const targetQueue = [...serversNeedingNewAssistance]
			let currentTargetIndex = 0

			for (const { server: assistServer, availableRam } of serverRamInfo) {
				const maxThreadsOnServer = Math.floor(availableRam / scriptRam)
				let threadsUsed = 0

				// Distribute threads for this assistance server
				while (threadsUsed < maxThreadsOnServer && targetQueue.length > 0) {
					const { server: targetServer, action } = targetQueue[currentTargetIndex]

					// Calculate how many threads this target still needs
					const currentState = HOME_ASSISTANCE_STATE[targetServer]
					const threadsAlreadyAssigned = currentState ? currentState.totalThreads : 0
					const threadsStillNeeded = threadsPerTarget - threadsAlreadyAssigned

					if (threadsStillNeeded <= 0) {
						// This target is fully assigned, remove from queue
						targetQueue.splice(currentTargetIndex, 1)
						if (currentTargetIndex >= targetQueue.length) {
							currentTargetIndex = 0
						}
						continue
					}

					// Assign threads to this target
					const threadsToAssign = Math.min(
						threadsStillNeeded,
						maxThreadsOnServer - threadsUsed
					)

					if (threadsToAssign > 0) {
						ns.exec(HOME_ASSIST_SCRIPT, assistServer, threadsToAssign, action, targetServer)
						threadsUsed += threadsToAssign

						// Update state tracking - accumulate total threads
						if (!HOME_ASSISTANCE_STATE[targetServer]) {
							HOME_ASSISTANCE_STATE[targetServer] = {
								action,
								totalThreads: 0,
								assignments: []
							}
						}
						HOME_ASSISTANCE_STATE[targetServer].totalThreads += threadsToAssign
						HOME_ASSISTANCE_STATE[targetServer].assignments.push({
							server: assistServer,
							threads: threadsToAssign
						})
					}

					// Move to next target
					currentTargetIndex = (currentTargetIndex + 1) % targetQueue.length
				}
			}

			// Log the distribution
			ns.print(`Distributed ${totalAvailableThreads} threads across ${serversNeedingNewAssistance.length} targets (${threadsPerTarget} threads per target)`)
			for (const { server, action } of serversNeedingNewAssistance) {
				const state = HOME_ASSISTANCE_STATE[server]
				if (state) {
					ns.print(`  ${server} (${action}): ${state.totalThreads} threads from ${state.assignments.length} assistance servers`)
				}
			}
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
				// Get server metrics to check money ratio
				const { moneyRatio } = get_server_metrics(ns, server)

				// If server needs hack but isn't at 90%+ money, assist with grow instead
				let assistAction = action
				if (action === "hack" && moneyRatio <= 0.9) {
					assistAction = "grow"
				}

				serversNeedingHomeHelp.push({ server, action: assistAction })
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