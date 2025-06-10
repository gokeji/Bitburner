/**
 * Cleanup script to kill all home_assist processes across all servers
 * @param {NS} ns
 */

const HOME_ASSIST_SCRIPT = "scripts/home_assist.js"

function disable_logs(ns) {
	const logs = ["scan", "getServerMaxMoney", "getServerMaxRam", "hasRootAccess", "kill"]
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

function cleanup_home_assist_processes(ns) {
	const purchasedServers = get_purchased_servers(ns)
	const assistanceServers = ["home", ...purchasedServers]

	let totalKilled = 0
	const killReport = []

	// Kill all home assistance processes across all servers
	for (const assistServer of assistanceServers) {
		const processes = ns.ps(assistServer).filter(p => p.filename === HOME_ASSIST_SCRIPT)
		let killedOnServer = 0

		processes.forEach(p => {
			ns.kill(p.pid)
			killedOnServer++
			totalKilled++
		})

		if (killedOnServer > 0) {
			killReport.push(`${assistServer}: ${killedOnServer} processes`)
		}
	}

	return { totalKilled, killReport }
}

/**
 * @param {NS} ns
 */
export async function main(ns) {
	disable_logs(ns)

	ns.tprint("=== Home Assist Cleanup Script ===")
	ns.tprint("Scanning all servers for home_assist processes...")

	const purchasedServers = get_purchased_servers(ns)
	ns.tprint(`Found ${purchasedServers.length} purchased servers`)

	const { totalKilled, killReport } = cleanup_home_assist_processes(ns)

	if (totalKilled > 0) {
		ns.tprint(`Successfully killed ${totalKilled} home_assist processes:`)
		killReport.forEach(report => ns.tprint(`  ${report}`))
	} else {
		ns.tprint("No home_assist processes found running")
	}

	ns.tprint("=== Cleanup Complete ===")
}