/**
 * @param {NS} ns
 **/
 /*
Gets stats of each hacked server.
RAM: 2.55GB
 */

// Import shared constants to avoid sync issues
import { determine_action } from "mcp.js"

function get_all_servers(ns, all=false) {
	/*
	Scans and iterates through all servers.
	If all is false, only servers with root access and have money are returned.
	*/
	var servers = ["home"]
	var result = []

	var i = 0
	while (i < servers.length) {
		var server = servers[i]
		var s = ns.scan(server)
		for (var j in s) {
			var con = s[j]
			if (servers.indexOf(con) < 0) {
				servers.push(con)
				if (all || (ns.hasRootAccess(con) && parseInt(ns.getServerMaxMoney(con)) > 0)) {
					result.push(con)
				}
			}
		}
		i += 1
	}
	return result
}

// Get purchased servers (servers with no money but have RAM) - reused from mcp.js
function get_purchased_servers(ns) {
	const allServers = get_all_servers(ns, true)
	return allServers.filter(server =>
		ns.hasRootAccess(server) &&
		ns.getServerMaxMoney(server) === 0 &&
		ns.getServerMaxRam(server) > 0 &&
		server !== "home"
	)
}

function get_action(ns, host) {
	/*
	Gets the first action in the list and returns it with thread count.
	*/
	var actions = ns.ps(host)
	return actions.length > 0 ? {
		action: actions[0].filename.replace("scripts/", "").replace(".js", ""),
		threads: actions[0].threads
	} : { action: null, threads: 0 }
}

// Enhanced: Check assistance from all available servers (home + purchased servers)
function get_home_assistance(ns, server) {
	const purchasedServers = get_purchased_servers(ns)
	const assistanceServers = ["home", ...purchasedServers]
	const assistanceInfo = []

	for (const assistServer of assistanceServers) {
		const processes = ns.ps(assistServer)
		for (const process of processes) {
			if (process.filename === "scripts/home_assist.js" &&
				process.args.length >= 2 &&
				process.args[1] === server) {
				assistanceInfo.push({
					server: assistServer,
					action: process.args[0],
					threads: process.threads
				})
			}
		}
	}

	if (assistanceInfo.length === 0) return null

	// Format assistance info: action(totalThreads) from X servers
	const totalThreads = assistanceInfo.reduce((sum, info) => sum + info.threads, 0)
	const action = assistanceInfo[0].action // All should be the same action
	const serverCount = assistanceInfo.length

	return `${action}(${totalThreads}t:${serverCount})`
}

// NEW: Check if server should be hacking based on thresholds from constants
function should_be_hacking(ns, server) {
	return determine_action(ns, server) === "hack"
}

function pad_str(string, len) {
	/*
	Prepends the requested padding to the string.
	*/
	var pad = "                          "  // Extended for home assistance column
	return String(pad + string).slice(-len)
}

function get_server_data(ns, server) {
	/*
	Creates the info text for each server. Currently gets money, security, RAM, and home assistance.
	NOTE: ns.getServer() can return a server object and obtain all of the necessary properties.
	However, ns.getServer() costs 2GB, which doubles the RAM requirement for this script.
	*/
	var moneyAvailable = ns.getServerMoneyAvailable(server)
	var moneyMax =  ns.getServerMaxMoney(server)
	var securityLvl = ns.getServerSecurityLevel(server)
	var securityMin = ns.getServerMinSecurityLevel(server)
	var ram = ns.getServerMaxRam(server)
	var actionInfo = get_action(ns, server)
	var homeAssist = get_home_assistance(ns, server)  // NEW: Check home assistance
	var shouldHack = should_be_hacking(ns, server)    // NEW: Check if should be hacking

	// Format money with M suffix for millions
	var formatMoney = (amount, digits = 0) => {
		if (amount >= 1000000) {
			return (amount / 1000000).toFixed(digits) + "M"
		}
		return parseInt(amount).toString()
	}

	// Format percentage with % suffix
	var formatPercentage = (amount, digits = 0) => {
		if (amount == 1) {
			return "100%"
		}
		return (amount * 100).toFixed(digits) + "%"
	}

	// Format action with thread count for remote servers
	var actionDisplay = actionInfo.action ? `${actionInfo.action}(${actionInfo.threads}t)` : "none"

	var result = `${pad_str(server, 15)}`+
			` money:${pad_str(formatMoney(moneyAvailable, 3), 10)}/${pad_str(formatMoney(moneyMax), 6)}${pad_str(`(${formatPercentage((moneyAvailable / moneyMax), 1)})`, 8)}` +
			` sec:${pad_str(securityLvl.toFixed(2), 6)}(${pad_str(securityMin, 2)})` +
			` RAM:${pad_str(parseInt(ram), 4)}` +
			` Action:${pad_str(actionDisplay, 12)}`

	// Enhanced: Add assistance status from all servers
		result += homeAssist ? pad_str(` [+${homeAssist}]`, 18) : pad_str("", 18)

	// Add status indicator for servers ready to hack
	if (shouldHack && actionInfo.action !== "hack") {
		result += " [READY TO HACK]"
	} else if (actionInfo.action === "hack") {
		result += " [HACKING $$]"
	}

	return result
}

function get_servers(ns, serverArgs = null) {
	/*
	Gets servers. If specific servers requested, then returns those only.
	Otherwise, scans and returns all servers.
	return: list of servers
	*/
	// Use provided serverArgs if available, otherwise use ns.args
	const args = serverArgs || ns.args

	if (args.length >= 1) {
		return args
	} else {
		return get_all_servers(ns, false)
	}
}

// NEW: Function to generate chart data for dynamic updates
function generate_chart_data(ns, servers) {
	var stats = {}
	// For each server in servers, get the server data and add to our Hash Table.
	for (var server of servers) {
		stats[parseInt(ns.getServerMaxMoney(server))] = get_server_data(ns, server)
	}
	// Sort each server based on how much money it holds.
	var keys = Object.keys(stats)
	keys.sort((a, b) => a - b)

	// Return sorted data for chart display
	return keys.map(key => stats[key])
}

export async function main(ns) {
	// Check for chart mode argument
	const isChartMode = ns.args.includes('--chart') || ns.args.includes('-c')
	const refreshRate = ns.args.includes('--refresh') ? parseInt(ns.args[ns.args.indexOf('--refresh') + 1]) || 1000 : 1000

	// Filter out chart-related arguments for server list
	const serverArgs = ns.args.filter(arg => !['--chart', '-c', '--refresh'].includes(arg))

	var servers = get_servers(ns, serverArgs)

	if (isChartMode) {
		// Chart mode: dynamic updating terminal display
		ns.ui.openTail()
		ns.disableLog('ALL')

		// Calculate window size in pixels
		// Approximate: 8px per character width, 16px per line height
		// Table width is ~120 characters, so width = 120 * 8 = 960px
		// Height: headers(3) + servers + footers(3) + buffer(5) = (servers.length + 11) * 16
		const windowWidth = 123 * 10  // 120 characters * 8px per char
		const windowHeight = (servers.length + 4) * 26  // lines * 16px per line

		ns.ui.resizeTail(windowWidth, windowHeight)
		ns.ui.moveTail(120, 20)

		while (true) {
			ns.clearLog()

			// Generate and display chart data
			const chartData = generate_chart_data(ns, servers)

			// Add header
			ns.print(`Time: ${new Date().toLocaleTimeString()}`)
			ns.print('='.repeat(120))

			// Display server data
			for (const serverLine of chartData) {
				ns.print(serverLine)
			}

			// Add footer with summary
			ns.print('='.repeat(120))
			ns.print(`Total servers: ${servers.length}`)

			await ns.sleep(refreshRate)
		}
	} else {
		// Normal mode: single output with formatted table
		const chartData = generate_chart_data(ns, servers)

		// Add header
		ns.tprint(`Server Stats - ${new Date().toLocaleTimeString()}`)
		ns.tprint('='.repeat(120))

		// Display server data
		for (const serverLine of chartData) {
			ns.tprint(serverLine)
		}

		// Add footer with summary
		ns.tprint('='.repeat(120))
		ns.tprint(`Total servers: ${servers.length}`)
	}
}