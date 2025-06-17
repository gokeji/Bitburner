import { startIpvgoIfNotRunning } from "../autoplay";

/** @param {NS} ns **/
// Get all free ram on current server and kick off max threads of share.js
export async function main(ns) {
    const servers = ["home", ...ns.getPurchasedServers()];
    for (const server of servers) {
        // kill all scripts on server
        await ns.killall(server, true);
    }
    await ns.sleep(1000);

    startIpvgoIfNotRunning(ns);

    for (const server of servers) {
        shareAllFreeRam(ns, server);
    }
}

async function shareAllFreeRam(ns, server) {
    ns.exec("scripts/share_all_free_ram.js", "home", 1, server);
}
