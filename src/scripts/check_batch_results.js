import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const target = ns.args[0];

    if (!target) {
        ns.print("Usage: run check_batch_results.js <server_name>");
        return;
    }

    const serverInfo = ns.getServer(target);

    ns.print(`\n=== BATCH RESULTS: ${target} ===`);
    ns.print(`CURRENT STATE:`);
    ns.print(
        `  Money: ${ns.formatNumber(serverInfo.moneyAvailable)} / ${ns.formatNumber(serverInfo.moneyMax)} (${((serverInfo.moneyAvailable / serverInfo.moneyMax) * 100).toFixed(1)}%)`,
    );
    ns.print(
        `  Security: ${serverInfo.hackDifficulty.toFixed(2)} / ${serverInfo.minDifficulty.toFixed(2)} (+${(serverInfo.hackDifficulty - serverInfo.minDifficulty).toFixed(2)})`,
    );

    // Check if server is back to optimal state
    const moneyOptimal = serverInfo.moneyAvailable >= serverInfo.moneyMax * 0.99;
    const securityOptimal = serverInfo.hackDifficulty <= serverInfo.minDifficulty + 0.1;

    ns.print(`STATUS:`);
    ns.print(`  Money Optimal: ${moneyOptimal ? "✅ YES" : "❌ NO"}`);
    ns.print(`  Security Optimal: ${securityOptimal ? "✅ YES" : "❌ NO"}`);

    if (!moneyOptimal || !securityOptimal) {
        ns.print(`⚠️  BATCH IMBALANCE DETECTED!`);
        if (!moneyOptimal) {
            ns.print(`  Money deficit: ${ns.formatNumber(serverInfo.moneyMax - serverInfo.moneyAvailable)}`);
        }
        if (!securityOptimal) {
            ns.print(`  Security excess: +${(serverInfo.hackDifficulty - serverInfo.minDifficulty).toFixed(3)}`);
        }

        ns.print(`\nPOSSIBLE CAUSES:`);
        if (!securityOptimal) {
            ns.print(`  1. Weaken threads insufficient for hack+grow security increase`);
            ns.print(`  2. Scripts completed out of order (timing issue)`);
            ns.print(`  3. Server state changed during calculation vs execution`);
        }
        if (!moneyOptimal) {
            ns.print(`  1. Grow threads insufficient for actual hack amount`);
            ns.print(`  2. Hack percentage calculation mismatch`);
            ns.print(`  3. Grow calculation based on wrong security level`);
        }
    } else {
        ns.print(`✅ BATCH SUCCESSFUL - Server returned to optimal state!`);
    }

    // Show currently running scripts on this target
    const runningScripts = [];
    const allServers = ["home"]; // Add logic to get all servers if needed

    // Simple scan for common servers
    const commonServers = [
        "home",
        "n00dles",
        "foodnstuff",
        "sigma-cosmetics",
        "joesguns",
        "nectar-net",
        "hong-fang-tea",
        "harakiri-sushi",
    ];

    for (const server of commonServers) {
        try {
            const scripts = ns.ps(server);
            for (const script of scripts) {
                if (script.args.length > 0 && script.args[0] === target) {
                    runningScripts.push({
                        server: server,
                        script: script.filename,
                        threads: script.threads,
                        args: script.args,
                    });
                }
            }
        } catch (e) {
            // Server doesn't exist or no access, skip
        }
    }

    if (runningScripts.length > 0) {
        ns.print(`\nSTILL RUNNING SCRIPTS ON ${target}:`);
        for (const script of runningScripts) {
            ns.print(`  ${script.server}: ${script.script} (${script.threads} threads) ${script.args.join(" ")}`);
        }
    } else {
        ns.print(`\nNo scripts currently running on ${target}`);
    }
}
