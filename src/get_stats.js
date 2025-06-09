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

function get_action(ns, host) {
	/*
	Gets the first action in the list and returns it.
	*/
	var actions = ns.ps(host)
	if (actions.length == 0) {
		return null
	}
	return actions[0].filename.replace("scripts/", "").replace(".js", "")
}

// NEW: Check if home server is assisting this server
function get_home_assistance(ns, server) {
	var homeProcesses = ns.ps("home")
	for (var process of homeProcesses) {
		if (process.filename === "scripts/home_assist.js" &&
			process.args.length >= 2 &&
			process.args[1] === server) {
			return `${process.args[0]}(${process.threads}t)`
		}
	}
	return null
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
	var action = get_action(ns, server)
	var homeAssist = get_home_assistance(ns, server)  // NEW: Check home assistance
	var shouldHack = should_be_hacking(ns, server)    // NEW: Check if should be hacking

	// Format money with M suffix for millions
	var formatMoney = (amount) => {
		if (amount >= 1000000) {
			return (amount / 1000000).toFixed(0) + "M"
		}
		return parseInt(amount).toString()
	}

	var result = `${pad_str(server, 15)}`+
			` money:${pad_str(parseInt(moneyAvailable), 10)}/${pad_str(formatMoney(moneyMax), 5)}(${pad_str((moneyAvailable / moneyMax).toFixed(3), 4)})` +
			` sec:${pad_str(securityLvl.toFixed(2), 6)}(${pad_str(securityMin, 2)})` +
			` RAM:${pad_str(parseInt(ram), 4)}` +
			` Action:${pad_str(action || "none", 7)}`

	// NEW: Add home assistance status in brackets
	if (homeAssist) {
		result += ` [Home: ${homeAssist}]`
	}

	// NEW: Add status indicator for servers ready to hack
	if (shouldHack && action !== "hack") {
		result += " [READY TO HACK]"
	} else if (action === "hack") {
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