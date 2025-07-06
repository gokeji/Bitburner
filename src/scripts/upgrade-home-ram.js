import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    while (true) {
        if (ns.getPlayer().money * 0.2 > ns.singularity.getUpgradeHomeRamCost()) {
            const success = ns.singularity.upgradeHomeRam();
            if (success) {
                ns.tprint(`Upgraded home ram to ${ns.getServerMaxRam("home")} GB`);
                ns.print(`Upgraded home ram to ${ns.getServerMaxRam("home")} GB`);
                ns.toast(`Upgraded home ram to ${ns.getServerMaxRam("home")} GB`);
            }
        }
        if (ns.getPlayer().money * 0.06 > ns.singularity.getUpgradeHomeCoresCost()) {
            const success = ns.singularity.upgradeHomeCores();
            if (success) {
                ns.tprint(`Upgraded home cores to ${ns.getServer("home").cpuCores} cores`);
                ns.print(`Upgraded home cores to ${ns.getServer("home").cpuCores} cores`);
                ns.toast(`Upgraded home cores to ${ns.getServer("home").cpuCores} cores`);
            }
        }
        await ns.sleep(10000);
    }
}
