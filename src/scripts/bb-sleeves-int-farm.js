import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const sleeves = new Map(Array.from({ length: ns.sleeve.getNumSleeves() }, (_, i) => [i, ns.sleeve.getSleeve(i)]));

    for (const [sleeveNumber, sleeve] of sleeves) {
        ns.sleeve.setToBladeburnerAction(sleeveNumber, "Infiltrate Synthoids", "Synthoids");
    }

    // Get sleeve overclock cycles. If sleeve remaining cycles is greater than 300, do infiltrate synthoids task
    // while (true) {
    //     // Set sleeve action
    //     await infiltrateSynthoids(ns);
    // }
}

/** @param {NS} ns */
async function infiltrateSynthoids(ns) {
    const sleeves = new Map(Array.from({ length: ns.sleeve.getNumSleeves() }, (_, i) => [i, ns.sleeve.getSleeve(i)]));

    // print stored cycles of each sleeve
    let highestCycles = 0;
    let highestCyclesSleeveNumber = -1;
    let highestCyclesSleeve = null;
    for (const [sleeveNumber, sleeve] of sleeves) {
        // ns.tprint(`Sleeve ${sleeveNumber}: ${ns.formatNumber(sleeve.storedCycles)} stored cycles`);
        if (sleeve.storedCycles > highestCycles) {
            highestCycles = sleeve.storedCycles;
            highestCyclesSleeveNumber = sleeveNumber;
            highestCyclesSleeve = sleeve;
        }
        ns.sleeve.setToIdle(sleeveNumber);
    }

    const hasEnoughStoredCycles = highestCyclesSleeve.storedCycles > 300;
    if (hasEnoughStoredCycles) {
        ns.sleeve.setToBladeburnerAction(highestCyclesSleeveNumber, "Infiltrate Synthoids", "Synthoids");
        ns.print(
            `${new Date().toLocaleTimeString()}: Infiltrating synthoids sleeve ${highestCyclesSleeveNumber} - bonus: ${ns.formatNumber(highestCyclesSleeve.storedCycles)}`,
        );
        await ns.sleeve.getTask(highestCyclesSleeveNumber).nextCompletion;
    } else {
        await ns.sleep(1000);
    }
}
