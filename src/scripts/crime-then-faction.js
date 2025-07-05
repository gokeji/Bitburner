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
        { type: "faction", target: "Netburners", goal: "12500" },
        { type: "faction", target: "NiteSec", goal: "favor" },
    ];

    while (taskQueue.length > 0) {
        await waitForOngoingGraft();

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
                await waitForOngoingGraft();
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

                let taskGoalIsMet = false;
                if (task.goal === "favor") {
                    const favorAfterReset =
                        ns.singularity.getFactionFavor(task.target) + ns.singularity.getFactionFavorGain(task.target);
                    taskGoalIsMet = favorAfterReset >= 150;
                } else {
                    taskGoalIsMet = ns.singularity.getFactionRep(task.target) >= task.goal;
                }

                if (!taskGoalIsMet) {
                    ns.singularity.workForFaction(task.target, "hacking", true);
                    await ns.sleep(10000);
                } else {
                    // Completed faction goal
                    ns.print(`${new Date().toLocaleTimeString()} Completed faction goal for ${task.target}`);
                    taskQueue.shift();
                }

                break;
            case "homicide":
                if (ns.heart.break() > -54000) {
                    ns.singularity.commitCrime("homicide", true);
                    await ns.sleep(10000);
                } else {
                    ns.print(`${new Date().toLocaleTimeString()} Gang is unlocked`);
                    taskQueue.shift();
                }
                break;
        }
    }

    async function waitForOngoingGraft() {
        try {
            ns.print("Waiting for graft...");
            await ns.grafting.waitForOngoingGrafting();
            ns.print(`${new Date().toLocaleTimeString()} Graft complete`);
        } catch (e) {
            ns.print(`${new Date().toLocaleTimeString()} No graft ongoing`);
        }
    }
}
