/**
 * Cleanup script to kill all direct action assistance processes across all servers
 * @param {NS} ns
 */

import { get_purchased_servers } from "../mcp.js"

// Direct action scripts used for assistance
const ACTION_SCRIPTS = {
	"scripts/grow.js": "grow",
	"scripts/hack.js": "hack",
	"scripts/weaken.js": "weaken"
}

function disable_logs(ns) {
	const logs = ["scan", "getServerMaxMoney", "getServerMaxRam", "hasRootAccess", "kill"]
	logs.forEach(log => ns.disableLog(log))
}

function cleanup_home_assist_processes(ns) {
	const purchasedServers = get_purchased_servers(ns)
	const assistanceServers = ["home", ...purchasedServers]

	let totalKilled = 0
	const killReport = []

	// Kill all direct action assistance processes across all servers
	for (const assistServer of assistanceServers) {
		const processes = ns.ps(assistServer).filter(p => Object.keys(ACTION_SCRIPTS).includes(p.filename))
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

	ns.tprint("=== Direct Action Assistance Cleanup Script ===")
	ns.tprint("Scanning all servers for direct action assistance processes...")
	ns.tprint(`Looking for: ${Object.keys(ACTION_SCRIPTS).join(", ")}`)

	const purchasedServers = get_purchased_servers(ns)
	ns.tprint(`Found ${purchasedServers.length} purchased servers`)

	const { totalKilled, killReport } = cleanup_home_assist_processes(ns)

	if (totalKilled > 0) {
		ns.tprint(`Successfully killed ${totalKilled} direct action assistance processes:`)
		killReport.forEach(report => ns.tprint(`  ${report}`))
	} else {
		ns.tprint("No direct action assistance processes found running")
	}

	ns.tprint("=== Cleanup Complete ===")
}