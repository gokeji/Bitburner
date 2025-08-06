import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    let hasAlerted = false;
    let timeProcessedSinceLastTerritoryTick = 0;
    let previousOtherGangInfo = null;

    while (true) {
        if (!ns.gang.inGang()) {
            if (ns.heart.break() > -54000) {
                // Wait for gang to unlock
                await ns.sleep(1000);
                break;
            } else {
                if (ns.getPlayer().factions.includes("Slum Snakes")) {
                    ns.gang.createGang("Slum Snakes");
                    const msSinceBitnodeStart = Date.now() - ns.getResetInfo().lastNodeReset;
                    const hoursSinceBitnodeStart = msSinceBitnodeStart / 1000 / 60 / 60;
                    ns.tprint(`Created gang at ${hoursSinceBitnodeStart.toFixed(2)} hours`);
                } else {
                    if (!hasAlerted) {
                        ns.alert("Unlock slum snakes to create gang");
                        hasAlerted = true;
                    }
                    await ns.sleep(1000);
                    break;
                }
            }
        }

        const gangInfo = ns.gang.getGangInformation();
        const otherGangInfo = ns.gang.getOtherGangInformation();

        // Need to first track down the first time power changes, to know when to start processing territory ticks
        ns.print("Gang Tick");
        if (JSON.stringify(previousOtherGangInfo) !== JSON.stringify(otherGangInfo)) {
            ns.print("Power changed");
            previousOtherGangInfo = otherGangInfo;
        }
        // if (timeProcessedSinceLastTerritoryTick > 20000) {
        //     // Process territory tick

        // }

        const processedTimeThisTick = await ns.gang.nextUpdate();
        timeProcessedSinceLastTerritoryTick += processedTimeThisTick;
    }
}
