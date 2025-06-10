/**
 * @param {NS} ns
 **/
 /*
Lists the RAM and cores for all servers you own (home + purchased servers).
RAM: 1.75GB
 */

// Cost calculation functions (same as in money.purchasedservers.js)
const powerToRam = (power) => {
	return Math.pow(2, power);
}

const calculateServerCost = (ram) => {
	const cost_per_ram = 55000;
	return cost_per_ram * ram;
}

function get_all_servers(ns) {
	/*
	Scans and iterates through all servers.
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
				result.push(con)
			}
		}
		i += 1
	}
	return result
}

// Get purchased servers (servers owned by the player)
function get_purchased_servers(ns) {
	const allServers = get_all_servers(ns)
	return allServers.filter(server =>
		ns.getServer(server).purchasedByPlayer
	)
}

// Get all owned servers (home + purchased servers)
function get_owned_servers(ns) {
	const purchasedServers = get_purchased_servers(ns)
	return ["home", ...purchasedServers]
}

function format_ram(ram) {
	/*
	Formats RAM with appropriate suffix (GB, TB, etc.)
	*/
	if (ram >= 1024) {
		return (ram / 1024).toFixed(1) + "TB"
	} else {
		return ram + "GB"
	}
}

function format_cost(cost) {
	/*
	Formats cost with appropriate suffix (K, M, B, etc.)
	*/
	if (cost >= 1000000000) {
		return (cost / 1000000000).toFixed(1) + "B"
	} else if (cost >= 1000000) {
		return (cost / 1000000).toFixed(1) + "M"
	} else if (cost >= 1000) {
		return (cost / 1000).toFixed(1) + "K"
	} else {
		return cost.toString()
	}
}

function pad_str(string, len) {
	/*
	Prepends the requested padding to the string.
	*/
	var pad = "                    "
	return String(pad + string).slice(-len)
}

function get_server_ram_info(ns, server) {
	/*
	Creates the info text for each server's RAM, cores, and cost.
	*/
	var maxRam = ns.getServerMaxRam(server)
	var cores = ns.getServer(server).cpuCores

	// Format RAM values
	var maxRamFormatted = format_ram(maxRam)

	// Calculate and format cost
	var cost = server === "home" ? 0 : calculateServerCost(maxRam)
	var costFormatted = server === "home" ? "FREE" : "$" + format_cost(cost)

	// Determine server type
	var serverType = server === "home" ? "HOME" : "PURCHASED"

	// Build row with separators
	// Column layout: Server (20) | Type (10) | Max RAM (8) | Cores (6) | Cost (12)
	var result = `${pad_str(server, 20)}|` +
			`${pad_str(serverType, 10)}|` +
			`${pad_str(maxRamFormatted, 8)}|` +
			`${pad_str(cores.toString(), 6)}|` +
			`${pad_str(costFormatted, 12)}`

	return result
}

function get_table_header() {
	// Column layout with separators:
	// Server: 20 chars
	// Type: 10 chars
	// Max RAM: 8 chars
	// Cores: 6 chars
	// Cost: 12 chars
	return `${pad_str("Server", 20)}|${pad_str("Type", 10)}|${pad_str("Max RAM", 8)}|${pad_str("Cores", 6)}|${pad_str("Cost", 12)}`
}

export async function main(ns) {
	ns.disableLog('ALL')

	var ownedServers = get_owned_servers(ns)

	// Sort servers: home first, then purchased servers alphabetically
	ownedServers.sort((a, b) => {
		if (a === "home") return -1
		if (b === "home") return 1
		return a.localeCompare(b)
	})

	const charsWidth = 62 // Increased width to accommodate cost column

	// Add header
	ns.tprint(`Server RAM & Cores List - ${new Date().toLocaleTimeString()}`)
	ns.tprint('='.repeat(charsWidth))
	ns.tprint(get_table_header())
	ns.tprint('-'.repeat(charsWidth))

	// Calculate totals
	var totalMaxRam = 0
	var totalCores = 0
	var totalCost = 0

	// Display server data
	for (const server of ownedServers) {
		const serverInfo = get_server_ram_info(ns, server)
		ns.tprint(serverInfo)

		// Add to totals
		totalMaxRam += ns.getServerMaxRam(server)
		totalCores += ns.getServer(server).cpuCores
		if (server !== "home") {
			totalCost += calculateServerCost(ns.getServerMaxRam(server))
		}
	}

	// Add footer with summary
	ns.tprint('-'.repeat(charsWidth))
	ns.tprint(`${pad_str("TOTALS", 20)}|${pad_str("", 10)}|${pad_str(format_ram(totalMaxRam), 8)}|${pad_str(totalCores.toString(), 6)}|${pad_str("$" + format_cost(totalCost), 12)}`)
	ns.tprint('='.repeat(charsWidth))
	ns.tprint(`Total owned servers: ${ownedServers.length}`)
	ns.tprint(`Home servers: 1, Purchased servers: ${ownedServers.length - 1}`)
	ns.tprint(`Total investment in servers: $${format_cost(totalCost)}`)
}