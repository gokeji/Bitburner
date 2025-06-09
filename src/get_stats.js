/**
 * @param {NS} ns
 **/
 /*
Gets stats of each hacked server.
RAM: 2.55GB
 */

// Import shared constants to avoid sync issues
import { SEC_THRESHOLD, MONEY_PERCENTAGE, MONEY_MINIMUM } from "lib/constants.js"
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
	var formatMoney = (amount) => {
		if (amount >= 1000000) {
			return (amount / 1000000).toFixed(0) + "M"
		}
		return parseInt(amount).toString()
	}

	// Format action with thread count for remote servers
	var actionDisplay = actionInfo.action ? (server !== "home" && actionInfo.threads > 0 ? `${actionInfo.action}(${actionInfo.threads}t)` : actionInfo.action) : "none"

	var result = `${pad_str(server, 15)}`+
			` money:${pad_str(parseInt(moneyAvailable), 10)}/${pad_str(formatMoney(moneyMax), 5)}(${pad_str((moneyAvailable / moneyMax).toFixed(3), 4)})` +
			` sec:${pad_str(securityLvl.toFixed(2), 6)}(${pad_str(securityMin, 2)})` +
			` RAM:${pad_str(parseInt(ram), 4)}` +
			` Action:${pad_str(actionDisplay, 12)}`

	// Enhanced: Add assistance status from all servers
	if (homeAssist) {
		result += ` [Assist: ${homeAssist}]`
	}

	// Add status indicator for servers ready to hack
	if (shouldHack && actionInfo.action !== "hack") {
		result += " [READY TO HACK]"
	} else if (actionInfo.action === "hack") {
		result += " [HACKING $$]"
	}

	return result
}

function get_servers(ns) {
	/*
	Gets servers. If specific servers requested, then returns those only.
	Otherwise, scans and returns all servers.
	return: list of servers
	*/
	if (ns.args.length >= 1) {
		return ns.args
	} else {
		return get_all_servers(ns, false)
	}
}

export async function main(ns) {
	var servers = get_servers(ns)
	var stats = {}
	// For each server in servers, get the server data and add to our Hash Table.
	for (var server of servers) {
		stats[parseInt(ns.getServerMaxMoney(server))] = get_server_data(ns, server)
	}
	// Sort each server based on how much money it holds.
	var keys = Object.keys(stats)
	keys.sort((a, b) => a - b)
	// Print the results
	for (var i in keys){
		var key = keys[i]
		ns.tprint(stats[key])
	}
}