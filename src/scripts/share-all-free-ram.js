/** @param {NS} ns **/
// Get all free ram on current server and kick off max threads of share.js
export async function main(ns) {
    const server = ns.args[0];
    const ramToShare = ns.args[1];

    if (!server || !ns.serverExists(server)) {
        ns.tprint("Server does not exist");
        return;
    }

    let reserverRam = 0;
    if (server === "home") {
        reserverRam = 100;
    }

    while (true) {
        const maxRam = ns.getServerMaxRam(server);
        const usedRam = ns.getServerUsedRam(server);
        const freeRam = maxRam - usedRam;
        const shareScriptRam = 4;
        let maxThreads = Math.floor((freeRam - reserverRam) / shareScriptRam);

        if (ramToShare) {
            maxThreads = Math.min(maxThreads, Math.floor(ramToShare / shareScriptRam));
        }

        if (maxThreads <= 0) {
            await ns.sleep(1000);
            continue;
        }

        ns.print(`${server} has ${freeRam} free RAM, kicking off ${maxThreads} threads of share.js`);
        ns.scp("kamu/share.js", server);
        const success = ns.exec("kamu/share.js", server, maxThreads);
        if (!success) {
            ns.print(`Failed to execute share.js on ${server}`);
        }
        await ns.sleep(10025); // Sleep 25ms extra to make sure share is done running
    }
}
