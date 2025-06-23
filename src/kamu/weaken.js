import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    await ns.sleep(ns.args[1]);

    await ns.weaken(ns.args[0]);

    const currentTime = new Date().toISOString().substring(11, 23);
    ns.tprint(currentTime + " Batch: " + ns.args[3] + " W  Delay: " + ns.args[1]);
}
