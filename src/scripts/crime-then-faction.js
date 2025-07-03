import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.ui.openTail();

    ns.disableLog("sleep");
    ns.disableLog("singularity.commitCrime");

    let isGrafting = false;

    while (true) {
        try {
            ns.print("Waiting for graft...");
            await ns.grafting.waitForOngoingGrafting();
            isGrafting = false;
            ns.print(`${new Date().toISOString()}: Grafting complete, starting crime`);
        } catch (e) {
            const graftQlink = ns.grafting.graftAugmentation("QLink");
            if (graftQlink) {
                isGrafting = true;
                ns.print(`${new Date().toISOString()}: Started grafting QLink`);
            } else {
                const graftGene = ns.grafting.graftAugmentation("SPTN-97 Gene Modification");
                if (graftGene) {
                    isGrafting = true;
                    ns.print(`${new Date().toISOString()}: Started grafting Gene`);
                } else {
                    ns.print(`${new Date().toISOString()}: Failed to graft SPTN-97 Gene Modification`);
                }
            }
        }

        if (!isGrafting) {
            if (ns.heart.break() > -54000) {
                ns.singularity.commitCrime("homicide", true);
            } else {
                const success = ns.singularity.workForFaction("BitRunners", "hacking");
                if (!success) {
                    ns.print(`${new Date().toISOString()}: Failed to work for BitRunners`);
                    const success2 = ns.singularity.workForFaction("NiteSec", "hacking");
                    if (!success2) {
                        ns.print(`${new Date().toISOString()}: Failed to work for NiteSec`);
                        ns.singularity.workForFaction("The Black Hand", "hacking");
                    }
                }
            }
        }
        await ns.sleep(10000);
    }
}
