import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    const threads = ns.args[0];
    while (true) {
        const fragments = ns.stanek.activeFragments();
        for (const fragment of fragments) {
            let success = false;
            if (!fragment.effect.includes("adjacent")) {
                success = ns.run(`./charge.js`, threads, fragment.x, fragment.y);
                if (success) {
                    ns.print(`Charged fragment [${fragment.x}, ${fragment.y}] - ${fragment.numCharge} charges`);
                    continue;
                } else {
                    await ns.sleep(100);
                }
            }
        }
    }
}
