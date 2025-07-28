import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    ns.ui.openTail();

    // Get sleeve overclock cycles. If sleeve remaining cycles is greater than 300, do infiltrate synthoids task
    while (true) {
        if (!ns.scriptRunning("scripts/bb-sleeves-int-farm.js", "home")) {
            ns.run("scripts/bb-sleeves-int-farm.js");
        }

        if (!ns.isRunning("scripts/hacknet-spend.js", "home", "--bladeburnerSP")) {
            ns.run("scripts/hacknet-spend.js", 1, "--bladeburnerSP");
        }

        // Buy as many hyperdrive as possible
        const hyperdriveCost = ns.bladeburner.getSkillUpgradeCost("Hyperdrive");
        const skillPoints = ns.bladeburner.getSkillPoints();

        const numHyperdrives = Math.floor(skillPoints / hyperdriveCost);

        if (numHyperdrives > 0) {
            // Can buy at least one upgrade
            let success = false;
            let purchaseAmount = numHyperdrives;
            while (!success) {
                success = ns.bladeburner.upgradeSkill("Hyperdrive", purchaseAmount);
                purchaseAmount--;
                if (purchaseAmount === 0) {
                    break;
                }
            }

            if (success) {
                ns.print(
                    `${new Date().toLocaleTimeString()} Bought ${numHyperdrives} hyperdrives, final level: ${ns.bladeburner.getSkillLevel("Hyperdrive")}`,
                );
            } else {
                ns.print(
                    `${new Date().toLocaleTimeString()} Failed to buy ${numHyperdrives} hyperdrives, final level: ${ns.bladeburner.getSkillLevel("Hyperdrive")}`,
                );
            }
        }

        // const numAssassinationContracts = ns.bladeburner.getActionCountRemaining("Operations", "Assassination");

        // Set to incite violence
        const currentAction = ns.bladeburner.getCurrentAction();
        // ns.bladeburner.getActionCurrentTime()
        // ns.bladeburner.getActionTime()

        if (!currentAction || currentAction.name !== "Incite Violence") {
            const inciteViolenceSuccess = ns.bladeburner.startAction("General", "Incite Violence");
            ns.print(`${new Date().toLocaleTimeString()} Incite violence success: ${inciteViolenceSuccess}`);
        }

        while (ns.hacknet.numNodes() < ns.hacknet.maxNumNodes() || ns.hacknet.hashCapacity() < 20e6) {
            // Max out hacknet hash capacity
            const maxCacheLevel = 15;
            for (let i = 0; i < ns.hacknet.numNodes(); i++) {
                const node = ns.hacknet.getNodeStats(i);

                const currentCacheLevel = node.cache;

                if (currentCacheLevel < maxCacheLevel) {
                    ns.hacknet.upgradeCache(i, maxCacheLevel - currentCacheLevel);
                }
            }
            await ns.sleep(500);
        }
        await ns.sleep(5000);
    }
}

/** @param {NS} ns */
// async function assassinateIfNeeded(ns) {
//     if (numAssassinationContracts > 100) {
//         const assassinationMinSuccessChance = ns.bladeburner.getActionEstimatedSuccessChance(
//             "Operations",
//             "Assassination",
//         )[0];
//         while (assassinationMinSuccessChance < 1) {
//             ns.bladeburner.upgradeSkill("Reaper");
//             ns.bladeburner.upgradeSkill("Evasive System");
//         }
//         ns.bladeburner.startAction("General", "Diplomacy");
//     }
// }
