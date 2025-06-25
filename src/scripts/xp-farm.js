import { NS } from "@ns";
import { SCRIPT_DELAY } from "/scripts/hacker.js";

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.args;

    if (args.length < 3) {
        ns.tprint("Usage: xp-farm.js <target> <cycles> <weakenTime> <server1> <threads1> <server2> <threads2> ...");
        return;
    }

    const target = args[0];
    const cycles = parseInt(args[1]);
    const weakenTime = parseInt(args[2]);

    // Parse server/thread pairs from remaining arguments
    const serverThreadPairs = [];
    for (let i = 3; i < args.length; i += 2) {
        if (i + 1 < args.length) {
            serverThreadPairs.push({
                server: args[i],
                threads: parseInt(args[i + 1]),
            });
        }
    }

    ns.print(`XP Farm: Starting ${cycles} cycles on ${target}, ${weakenTime}ms weaken time`);
    ns.print(`Servers: ${serverThreadPairs.map((p) => `${p.server}(${p.threads})`).join(", ")}`);

    const weakenScript = "/kamu/weaken.js";
    let totalThreads = 0;

    // Run the specified number of cycles
    for (let cycle = 0; cycle < cycles; cycle++) {
        let cycleThreads = 0;
        let serversUsed = 0;

        // Execute weaken on each server with specified threads
        for (const pair of serverThreadPairs) {
            if (pair.threads > 0) {
                const pid = ns.exec(weakenScript, pair.server, pair.threads, target, 0, "xp", cycle);
                if (pid) {
                    cycleThreads += pair.threads;
                    serversUsed++;
                }
            }
        }

        if (cycleThreads > 0) {
            totalThreads += cycleThreads;
            ns.print(`Cycle ${cycle + 1}/${cycles}: ${cycleThreads} threads on ${serversUsed} servers`);

            // Wait for this cycle to complete before starting the next one
            if (cycle < cycles - 1) {
                // Don't wait after the last cycle
                await ns.sleep(weakenTime + SCRIPT_DELAY); // Add small buffer
            }
        }
    }

    ns.print(`XP Farm Complete: ${cycles} cycles, ${totalThreads} total threads on ${target}`);
}
