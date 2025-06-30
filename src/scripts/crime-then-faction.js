import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    try {
        await ns.grafting.waitForOngoingGrafting();
        ns.tprint(`${new Date().toISOString()}: Grafting complete, starting crime`);
    } catch (e) {
        ns.tprint(`${new Date().toISOString()}: Grafting not complete, skipping crime`);
    }

    while (true) {
        if (ns.heart.break() > -54000) {
            ns.singularity.commitCrime("homicide", true);
        } else {
            ns.singularity.workForFaction("NiteSec", "hacking");
        }

        await ns.sleep(5000);
    }
}
