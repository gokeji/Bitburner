/**
 * @param {NS} ns
 **/
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
				if (all || (ns.hasRootAccess(con) && (ns.getServerRequiredHackingLevel(con) <= ns.getHackingLevel()) && (ns.getServerMaxMoney(con) > 0))) {
					result.push(con)
				}
			}
		}
		i += 1
	}
	return result
}

// Updated: Count total threads attacking a server from distributed-hack.js system
function get_distributed_attack_info(ns, targetServer) {
	const allServers = get_all_servers(ns, true)
	const kamuScripts = {
		"kamu/weaken.js": "weaken",
		"kamu/grow.js": "grow",
		"kamu/hack.js": "hack"
	}

	let totalThreads = 0
	let threadCounts = {
		grow: 0,
		weaken: 0,
		hack: 0
	}
	let scriptCounts = {
		weaken: 0,
		grow: 0,
		hack: 0
	}

	// Check all servers for kamu scripts targeting this server
	for (const server of allServers) {
		if (!ns.hasRootAccess(server)) continue

		const processes = ns.ps(server)
		for (const process of processes) {
			// Check if it's a kamu script targeting our server
			if (kamuScripts[process.filename] &&
				process.args.length >= 1 &&
				process.args[0] === targetServer) {
				const actionType = kamuScripts[process.filename]
				threadCounts[actionType] += process.threads
				totalThreads += process.threads
				scriptCounts[actionType] += 1
			}
		}
	}

	// ns.tprint(`${targetServer}: ${totalThreads}`)

	if (totalThreads === 0) return null

	// Build the display string based on which actions are present
	let displayParts = []
	let threadParts = []
	let activeThreadCounts = []

	// Collect active thread counts in G:W:H order
	if (threadCounts.grow > 0) {
		displayParts.push("G")
		activeThreadCounts.push(threadCounts.grow)
	}
	if (threadCounts.weaken > 0) {
		displayParts.push("W")
		activeThreadCounts.push(threadCounts.weaken)
	}
	if (threadCounts.hack > 0) {
		displayParts.push("H")
		activeThreadCounts.push(threadCounts.hack)
	}

	// Find the maximum value to determine scaling factor
	const maxThreads = Math.max(...activeThreadCounts)

	// Count number of digits in maxThreads
	const numDigits = maxThreads.toString().length

	// Calculate scaling factor
	const scaleFactor = 10 ** (numDigits - 2)

	// Scale and format the thread counts
	for (const action in activeThreadCounts) {
		const scaledValue = activeThreadCounts[action] / scaleFactor
		const formattedValue = Math.round(scaledValue).toString()
		threadParts.push(`${displayParts[action]}${formattedValue}`)
	}

	const totalScriptCount = scriptCounts.weaken + scriptCounts.grow + scriptCounts.hack
	// Format total threads with padding
	const totalThreadsStr = `[${ns.formatNumber(totalThreads, 1)}-${ns.formatNumber(totalScriptCount, 0)}]`
	const paddedTotal = totalThreadsStr.padStart(10)

	return `${threadParts.join(":")} ${paddedTotal}`
}

// Global variable to store profit data from distributed-hack.js
var distributedHackProfits = new Map();

// Function to read profit data from port 4 (sent by distributed-hack.js)
function update_distributed_hack_profits(ns) {
	const profitPortHandle = ns.getPortHandle(4);
	const newProfits = new Map();

	// Read all profit data from the port
	while (!profitPortHandle.empty()) {
		try {
			const data = JSON.parse(profitPortHandle.read());
			newProfits.set(data.server, data.profit);
		} catch (e) {
			// Skip invalid JSON data
			continue;
		}
	}

	if (newProfits.size > 0) {
		// Update the global variable with the new profits
		distributedHackProfits = newProfits;
	}
}

// Get hacking priority from distributed-hack.js data, fallback to local calculation
function get_hacking_priority(ns, server) {
	// Try to get from distributed-hack.js first
	if (distributedHackProfits.has(server)) {
		return distributedHackProfits.get(server);
	}

	return null;
}

function pad_str(string, len) {
	/*
	Prepends the requested padding to the string.
	*/
	var pad = "                          "  // Extended for attack info column
	return String(pad + string).slice(-len)
}

function get_server_data(ns, server) {
	/*
	Creates the info text for each server. Currently gets money, security, RAM, distributed attack info, and priority.
	*/
	var moneyAvailable = ns.getServerMoneyAvailable(server)
	var moneyMax =  ns.getServerMaxMoney(server)
	var securityLvl = ns.getServerSecurityLevel(server)
	var securityMin = ns.getServerMinSecurityLevel(server)
	var ram = ns.getServerMaxRam(server)
	var requiredHackingSkill = ns.getServerRequiredHackingLevel(server)
	var attackInfo = get_distributed_attack_info(ns, server)  // Get distributed attack info
	var priority = get_hacking_priority(ns, server)  // Get hacking priority

	// Format money with M suffix for millions
	var formatMoney = (amount, digits = 0) => {
		if (amount === null) return "--"
		if (amount === 0) return "0"

		const units = ["", "k", "m", "b", "t", "q"]
		let unitIndex = 0
		let value = amount

		while (value >= 1000 && unitIndex < units.length - 1) {
			value /= 1000
			unitIndex++
		}

		// If it's a whole number, don't show decimals
		if (value === Math.floor(value)) {
			return value + units[unitIndex]
		}

		// Otherwise, show up to `digits` decimal places
		return value.toFixed(digits) + units[unitIndex]
	}

	// Format percentage with % suffix
	var formatPercentage = (amount, digits = 0) => {
		if (amount == 1) {
			return "100%"
		}
		return (amount * 100).toFixed(digits) + "%"
	}

	// Create progress bar (20 chars, each char = 5%)
	var createProgressBar = (percentage) => {
		const totalChars = 20
		const filledChars = Math.floor(percentage * totalChars)
		const emptyChars = totalChars - filledChars
		return '█'.repeat(filledChars) + '░'.repeat(emptyChars)
	}

	// Calculate money percentage for progress bar
	var moneyPercentage = moneyMax > 0 ? (moneyAvailable / moneyMax) : 0
	var progressBar = createProgressBar(moneyPercentage)

	// Build row with separators and no column labels
	var result = `${pad_str(server, 18)}|`+
			`${pad_str(formatMoney(moneyAvailable, 2), 8)}/${pad_str(formatMoney(moneyMax, 2), 7)}${pad_str(`(${formatPercentage(moneyPercentage, 1)})`, 8)}|` +
			`${progressBar}|` +
			`${pad_str(securityLvl.toFixed(2), 6)}(${pad_str(securityMin, 2)})|` +
			`${pad_str(ram, 4)}G|` +
			`${pad_str(requiredHackingSkill, 5)}|` +
			`${pad_str(formatMoney(priority, 2), 8)}|`

	// Add distributed attack info
	result += attackInfo ? pad_str(`${attackInfo}`, 24) : pad_str("", 20)

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

// Add table header function that matches exact column spacing
function get_table_header() {
	// Column layout with separators (exact character counts):
	// Server: 18 chars
	// Money: 25 chars (10 + "/" + 6 + 8 for percentage)
	// Progress Bar: 20 chars
	// Security: 9 chars (6 + "(" + 2 + ")")
	// RAM: 5 chars
	// Skill: 5 chars
	// Priority: 8 chars
	// Attack Info: 20 chars

	return `${pad_str("Server", 18)}|${pad_str("Money Available/Max (%)", 24)}|${pad_str("Money Reserve", 20)}|${pad_str("Sec(Min)", 10)}|${pad_str("RAM", 5)}|${pad_str("Skill", 5)}|${pad_str("Priority", 8)}|${pad_str("Attack Threads", 24)}`
}

export async function main(ns) {
	ns.disableLog('ALL')

	// Kill all other scripts called get_stats.js
	ns.ps(ns.getHostname()).filter(p => p.filename === "get_stats.js").forEach(p => {
		if (p.pid !== ns.pid) {
			ns.ui.closeTail(p.pid)
			ns.kill(p.pid)
		}
	})

	// Check for chart mode argument
	const isChartMode = ns.args.includes('--chart') || ns.args.includes('-c')
	const refreshRate = 200

	// Filter out chart-related arguments for server list
	const serverArgs = ns.args.filter(arg => !['--chart', '-c', '--refresh'].includes(arg))

	const charsWidth = 121  // Updated to include 8-char priority column + separator

	if (isChartMode) {

		// Chart mode: dynamic updating terminal display
		ns.ui.openTail()

		// Initial window setup (will be adjusted dynamically)
		ns.ui.resizeTail(charsWidth * 10, 400)
		ns.ui.moveTail(120, 0)

		while (true) {
			// Update profit data from distributed-hack.js
			update_distributed_hack_profits(ns);

			// Rescan for servers on each iteration to detect new servers
			var servers = get_servers(ns, serverArgs)

			// Dynamically adjust window size based on current server count
			const windowWidth = charsWidth * 10  // 120 characters * 8px per char
			const windowHeight = Math.min((servers.length + 6) * 26, 800)  // lines * 16px per line

			ns.ui.resizeTail(windowWidth, windowHeight)

			// Generate all content first to minimize flashing
			const chartData = generate_chart_data(ns, servers)
			const timeHeader = `Time: ${new Date().toLocaleTimeString()} - Distributed Hack Monitor`
			const separator = '='.repeat(charsWidth)
			const dashSeparator = '-'.repeat(charsWidth)
			const tableHeader = get_table_header()
			const footer = `Total servers: ${servers.length}`

			// Clear and display all content at once to reduce flashing
			ns.clearLog()
			ns.print(timeHeader)
			ns.print(separator)
			ns.print(tableHeader)
			ns.print(dashSeparator)

			// Display server data
			for (const serverLine of chartData) {
				ns.print(serverLine)
			}

			// Add footer with summary
			ns.print(separator)
			ns.print(footer)

			await ns.sleep(refreshRate)
		}
	} else {
		// Normal mode: single output with formatted table
		// Update profit data from distributed-hack.js
		update_distributed_hack_profits(ns);

		const servers = get_servers(ns, serverArgs)
		const chartData = generate_chart_data(ns, servers)

		// Add header
		ns.tprint(`Distributed Hack Server Stats - ${new Date().toLocaleTimeString()}`)
		ns.tprint('='.repeat(charsWidth))
		ns.tprint(get_table_header())
		ns.tprint('-'.repeat(charsWidth))

		// Display server data
		for (const serverLine of chartData) {
			ns.tprint(serverLine)
		}

		// Add footer with summary
		ns.tprint('='.repeat(charsWidth))
		ns.tprint(`Total servers: ${servers.length}`)
	}
}