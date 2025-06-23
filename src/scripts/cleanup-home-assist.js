/**
 * Cleanup script to kill all direct action assistance processes across all servers
 * @param {NS} ns
 */

// import { get_purchased_servers } from "../mcp.js"
import { scanAll } from "../kamu/distributed-hack.js";

function disable_logs(ns) {
    const logs = ["scan", "getServerMaxMoney", "getServerMaxRam", "hasRootAccess", "kill"];
    logs.forEach((log) => ns.disableLog(log));
}

async function cleanup_home_assist_processes(ns) {
    const servers = new Set(["home"]);
    scanAll(ns, "home", servers);
    ns.tprint(`Found ${servers.size} servers`);

    // First kill all hack scripts
    const { totalKilled: totalKilledHack, killReport: killReportHack } = cleanScriptOnAllServers(
        ns,
        "kamu/hack.js",
        servers,
    );

    await ns.sleep(200);
    // Then kill all grow scripts
    const { totalKilled: totalKilledGrow, killReport: killReportGrow } = cleanScriptOnAllServers(
        ns,
        "kamu/grow.js",
        servers,
    );

    await ns.sleep(200);
    // Then kill all weaken scripts
    const { totalKilled: totalKilledWeaken, killReport: killReportWeaken } = cleanScriptOnAllServers(
        ns,
        "kamu/weaken.js",
        servers,
    );

    return {
        totalKilled: totalKilledHack + totalKilledGrow + totalKilledWeaken,
        killReport: [...killReportHack, ...killReportGrow, ...killReportWeaken],
    };
}

function cleanScriptOnAllServers(ns, script, servers) {
    const assistanceServers = ["home", ...servers];

    let totalKilled = 0;
    const killReport = [];

    for (const assistServer of assistanceServers) {
        const processes = ns.ps(assistServer).filter((p) => p.filename === script);
        let killedOnServer = 0;

        processes.forEach((p) => {
            ns.kill(p.pid);
            killedOnServer++;
            totalKilled++;
        });

        if (killedOnServer > 0) {
            killReport.push(`${assistServer}: ${killedOnServer} processes`);
        }
    }

    return { totalKilled, killReport };
}

/**
 * @param {NS} ns
 */
export async function main(ns) {
    disable_logs(ns);

    const { totalKilled, killReport } = cleanup_home_assist_processes(ns);

    if (totalKilled > 0) {
        ns.tprint(`Successfully killed ${totalKilled} direct action HGW processes:`);
        killReport.forEach((report) => ns.tprint(`  ${report}`));
    } else {
        ns.tprint("No direct HGW processes found running");
    }
}
