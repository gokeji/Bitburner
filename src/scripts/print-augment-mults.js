import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const augment = ns.args[0];
    const mults = ns.singularity.getAugmentationStats(augment);
    ns.print(JSON.stringify(mults, null, 2));
    ns.ui.openTail();
}
