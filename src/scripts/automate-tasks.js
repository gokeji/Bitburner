import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.ui.openTail();

    ns.disableLog("sleep");
    ns.disableLog("singularity.commitCrime");

    let taskQueue = [
        {
            type: "graft",
            target: "OmniTek InfoLoad",
        },
        { type: "faction", target: "CyberSec", goal: "2000" },

        { type: "faction", target: "Tian Di Hui", goal: "6250" },

        { type: "faction", target: "Netburners", goal: "12500" },
        { type: "faction", target: "NiteSec", goal: "favor" },
        { type: "homicide" },
    ];

    let hasMessaged = false;

    while (taskQueue.length > 0) {
        await waitForOngoingGraft(ns);
        let currentWork = ns.singularity.getCurrentWork();

        const task = taskQueue[0];

        switch (task.type) {
            case "graft":
                if (ns.singularity.getOwnedAugmentations(true).includes(task.target)) {
                    ns.print(`${new Date().toLocaleTimeString()} Already have ${task.target}`);
                    taskQueue.shift();
                    break;
                }
                ns.singularity.travelToCity("New Tokyo");
                ns.grafting.graftAugmentation(task.target);
                await waitForOngoingGraft(ns);
                taskQueue.shift();
                break;
            case "faction":
                if (!ns.getPlayer().factions.includes(task.target)) {
                    ns.print(`${new Date().toLocaleTimeString()} Player has not joined ${task.target} yet`);
                    // Move this behind the next task
                    taskQueue.unshift(task);
                    taskQueue.shift();
                    await ns.sleep(10000);
                    break;
                }

                let goalReputation = task.goal;
                if (task.goal === "favor") {
                    const currentFavor = ns.singularity.getFactionFavor(task.target);
                    goalReputation =
                        ns.formulas.reputation.calculateFavorToRep(150) -
                        ns.formulas.reputation.calculateFavorToRep(currentFavor);
                }

                if (ns.singularity.getFactionRep(task.target) < goalReputation) {
                    if (!currentWork || currentWork.type !== "FACTION" || currentWork.factionName !== task.target) {
                        ns.singularity.workForFaction(task.target, "hacking", true);
                        ns.print(
                            `${new Date().toLocaleTimeString()} Starting work for ${task.target}, goal: ${ns.formatNumber(goalReputation)}`,
                        );
                        hasMessaged = false;
                    }
                    if (!hasMessaged) {
                        ns.print(
                            `${new Date().toLocaleTimeString()} Waiting for ${task.target} work, goal: ${ns.formatNumber(goalReputation)}`,
                        );
                        hasMessaged = true;
                    }
                    await ns.sleep(10000);
                } else {
                    // Completed faction goal
                    ns.print(
                        `${new Date().toLocaleTimeString()} Completed faction goal ${ns.formatNumber(goalReputation)} rep for ${task.target}`,
                    );
                    taskQueue.shift();
                }

                break;
            case "homicide":
                if (ns.heart.break() > -54000) {
                    if (!currentWork || currentWork.type !== "CRIME" || currentWork.crimeType !== "Homicide") {
                        ns.singularity.commitCrime("homicide", true);
                        ns.print(`${new Date().toLocaleTimeString()} Starting homicide`);
                        hasMessaged = false;
                    }
                    if (!hasMessaged) {
                        ns.print(`${new Date().toLocaleTimeString()} Waiting for gang unlock`);
                        hasMessaged = true;
                    }
                    await ns.sleep(10000);
                } else {
                    ns.print(`${new Date().toLocaleTimeString()} Gang is unlocked`);
                    taskQueue.shift();
                }
                break;
        }
    }
    /** @param {NS} ns **/
    async function waitForOngoingGraft(ns) {
        let currentWork = ns.singularity.getCurrentWork();

        if (currentWork && currentWork.type === "GRAFTING") {
            ns.print("Waiting for graft...");
            await ns.grafting.waitForOngoingGrafting();
            ns.print(`${new Date().toLocaleTimeString()} Graft complete`);
        }
    }
}
