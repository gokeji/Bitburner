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

async function cleanup_home_assist_processes(ns, typesToKill) {
    const servers = new Set(["home"]);
    scanAll(ns, "home", servers);
    ns.tprint(`Found ${servers.size} servers`);

    let totalKilled = 0;
    let killReport = {};

    if (typesToKill.includes("hack")) {
        // First kill all hack scripts
        const { totalKilled: totalKilledHack, killReport: killReportHack } = cleanScriptOnAllServers(
            ns,
            "kamu/hack.js",
            servers,
        );
        totalKilled += totalKilledHack;
        killReport.hack = killReportHack;

        await ns.sleep(200);
    }

    if (typesToKill.includes("grow")) {
        // Then kill all grow scripts
        const { totalKilled: totalKilledGrow, killReport: killReportGrow } = cleanScriptOnAllServers(
            ns,
            "kamu/grow.js",
            servers,
        );
        totalKilled += totalKilledGrow;
        killReport.grow = killReportGrow;

        await ns.sleep(200);
    }

    if (typesToKill.includes("weaken")) {
        // Then kill all weaken scripts
        const { totalKilled: totalKilledWeaken, killReport: killReportWeaken } = cleanScriptOnAllServers(
            ns,
            "kamu/weaken.js",
            servers,
        );
        totalKilled += totalKilledWeaken;
        killReport.weaken = killReportWeaken;
    }

    return {
        totalKilled,
        killReport,
    };
}

function cleanScriptOnAllServers(ns, script, servers) {
    let totalKilled = 0;
    const killReport = {};

    for (const server of servers) {
        const processes = ns.ps(server).filter((p) => p.filename === script);
        let killedOnServer = 0;

        processes.forEach((p) => {
            ns.kill(p.pid);
            killedOnServer++;
            totalKilled++;
        });

        if (killedOnServer > 0) {
            killReport[server] = killedOnServer;
        }
    }

    return { totalKilled, killReport };
}

/**
 * @param {NS} ns
 */
export async function main(ns) {
    disable_logs(ns);

    const typesToKill = ns.args.length > 0 ? ns.args : ["hack", "grow", "weaken"];

    const { totalKilled, killReport } = await cleanup_home_assist_processes(ns, typesToKill);

    if (totalKilled > 0) {
        const totalHacked = killReport.hack ? Object.values(killReport.hack).reduce((acc, curr) => acc + curr, 0) : 0;
        const totalGrown = killReport.grow ? Object.values(killReport.grow).reduce((acc, curr) => acc + curr, 0) : 0;
        const totalWeakened = killReport.weaken
            ? Object.values(killReport.weaken).reduce((acc, curr) => acc + curr, 0)
            : 0;
        ns.tprint(`Total: ${totalHacked}H ${totalGrown}G ${totalWeakened}W processes killed`);
    } else {
        ns.tprint("No direct HGW processes found running");
    }
}
