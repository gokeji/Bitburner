import { NS } from "@ns";

/**
 * @param {NS} ns
 */
export async function main(ns) {
    eval("ns.bypass(document)");
    ns.singularity.joinFaction("Sector-12");
    ns.singularity.upgradeHomeRam(64);
    ns.singularity.upgradeHomeRam(128);
    ns.singularity.upgradeHomeRam(256);
    ns.run("scripts/int-farm-2.js");
}
