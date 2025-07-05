import { NS } from "@ns";

/** @param {NS} ns **/
function main(ns) {
    while (true) {
        if (ns.getPlayer().money * 0.1 > ns.singularity.getUpgradeHomeRamCost()) {
            ns.singularity.upgradeHomeRam();
            ns.tprint(`Upgraded home ram to ${ns.getServerMaxRam("home")} GB`);
            ns.print(`Upgraded home ram to ${ns.getServerMaxRam("home")} GB`);
            ns.toast(`Upgraded home ram to ${ns.getServerMaxRam("home")} GB`);
        }
        ns.sleep(10000);
    }
}
