import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.args;

    const SCRIPT_DELAY = 20; // ms delay between scripts

    if (args.length < 3) {
        ns.tprint("Usage: xp-farm.js <target> <cycles> <growTime> <server1> <threads1> <server2> <threads2> ...");
        return;
    }

    const target = args[0];
    const cycles = parseInt(args[1]);
    const growTime = parseInt(args[2]);

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

    ns.print(`XP Farm: Starting ${cycles} cycles on ${target}, ${growTime}ms grow time`);
    ns.print(`Servers: ${serverThreadPairs.map((p) => `${p.server}(${p.threads})`).join(", ")}`);

    const growScript = "/kamu/grow.js";
    let totalThreads = 0;

    // Run the specified number of cycles
    for (let cycle = 0; cycle < cycles; cycle++) {
        let cycleThreads = 0;
        let serversUsed = 0;

        // Execute weaken on each server with specified threads
        for (const pair of serverThreadPairs) {
            if (pair.threads > 0) {
                const pid = ns.exec(
                    growScript,
                    pair.server,
                    pair.threads,
                    target,
                    0,
                    false,
                    "xp",
                    cycle,
                    `endTime=${Date.now() + growTime}`,
                );
                if (pid) {
                    cycleThreads += pair.threads;
                    serversUsed++;
                } else {
                    ns.print(`WARN: Failed to launch grow script on ${pair.server}`);
                }
            }
        }

        if (cycleThreads > 0) {
            totalThreads += cycleThreads;
            ns.print(`Cycle ${cycle + 1}/${cycles}: ${cycleThreads} threads on ${serversUsed} servers`);

            // Wait for this cycle to complete before starting the next one
            if (cycle < cycles - 1) {
                // Don't wait after the last cycle
                await ns.sleep(growTime + SCRIPT_DELAY); // Add small buffer
            }
        }
    }

    ns.print(`XP Farm Complete: ${cycles} cycles, ${totalThreads} total threads on ${target}`);
}
