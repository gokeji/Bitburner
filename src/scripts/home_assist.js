/**
 * Home Assistance Script
 * Runs hack/grow/weaken operations from home server to assist remote servers
 * Takes advantage of home server's high RAM capacity
 *
 * Usage: run home_assist.js [action] [target_server]
 * @param {NS} ns
 */

/** @param {NS} ns */
export async function main(ns) {
    let action = ns.args[0]  // "hack", "grow", or "weaken"
    let target = ns.args[1]  // target server to assist

    if (!action || !target) {
        ns.tprint("Usage: run home_assist.js [hack|grow|weaken] [target_server]")
        return
    }

    if (!ns.serverExists(target)) {
        ns.tprint(`Target server ${target} does not exist`)
        return
    }

    // Validate action

    ns.print(`Home server assisting ${target} with ${action} operations`)

    // Continuous assistance loop
    while (true) {
        try {
            if (action === "hack") {
                await ns.hack(target)
            } else if (action === "grow") {
                await ns.grow(target)
            } else if (action === "weaken") {
                await ns.weaken(target)
            }
        } catch (error) {
            ns.print(`Error assisting ${target}: ${error}`)
            await ns.sleep(5000)  // Wait 5 seconds before retrying
        }
    }
}