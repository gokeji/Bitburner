import { NS } from "@ns";

let isRunningDiplomacy = false;
let isRunningAssassination = false;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    ns.ui.openTail();

    ns.run("scripts/bb-sleeves-int-farm.js"); // Launch once

    // Get sleeve overclock cycles. If sleeve remaining cycles is greater than 300, do infiltrate synthoids task
    while (true) {
        // if (!ns.scriptRunning("scripts/bb-sleeves-int-farm.js", "home")) {
        //     ns.run("scripts/bb-sleeves-int-farm.js");
        // }

        // if (!ns.isRunning("scripts/hacknet-spend.js", "home", "--bladeburnerSP")) {
        //     ns.run("scripts/hacknet-spend.js", 1, "--bladeburnerSP");
        // }

        if (!ns.isRunning("scripts/int-farm-monitor.js", "home")) {
            ns.run("scripts/int-farm-monitor.js");
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
        const action = determineAction(ns);

        if (!currentAction || currentAction.name !== action.action || ns.bladeburner.getCity() !== action.city) {
            ns.bladeburner.switchCity(action.city);
            const success = ns.bladeburner.startAction(action.type, action.action);
            ns.print(
                `${new Date().toLocaleTimeString()} Starting ${action.action} in ${action.city} (${success ? "success" : "failed"})`,
            );
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
        await ns.bladeburner.nextUpdate();
    }
}

/** @param {NS} ns */
function determineAction(ns) {
    const cities = {
        Aevum: "Aevum",
        Chongqing: "Chongqing",
        Sector12: "Sector-12",
        NewTokyo: "New Tokyo",
        Ishima: "Ishima",
        Volhaven: "Volhaven",
    };
    const cityInfo = Object.values(cities).map((city) => ({
        name: city,
        population: ns.bladeburner.getCityEstimatedPopulation(city),
        chaos: ns.bladeburner.getCityChaos(city),
    }));

    const cityWithHighestPopulation = cityInfo.sort((a, b) => b.population - a.population)[0].name;
    const cityWithHighestChaos = cityInfo.sort((a, b) => b.chaos - a.chaos)[0].name;
    const currentCity = ns.bladeburner.getCity();

    const assassinationMinSuccessChance = ns.bladeburner.getActionEstimatedSuccessChance(
        "Operations",
        "Assassination",
    )[0];
    const assassinationActionsRemaining = ns.bladeburner.getActionCountRemaining("Operations", "Assassination");

    if (assassinationMinSuccessChance < 1 || isRunningDiplomacy) {
        isRunningDiplomacy = true;

        if (cityInfo.find((city) => city.name === cityWithHighestChaos).chaos > 50) {
            return { type: "General", action: "Diplomacy", city: cityWithHighestChaos };
        } else {
            isRunningDiplomacy = false;

            if (assassinationMinSuccessChance < 1) {
                return { type: "General", action: "Field Analysis", city: currentCity };
            }
            if (assassinationActionsRemaining >= 1) {
                isRunningAssassination = true; // Can start assassination
            }
        }
    }

    if (assassinationActionsRemaining < 1) {
        isRunningAssassination = false;
    }

    if (!isRunningAssassination) {
        // Default to incite violence unless we're ready for assassination
        return { type: "General", action: "Incite Violence", city: cityWithHighestPopulation };
    }

    return { type: "Operations", action: "Assassination", city: cityWithHighestPopulation };
}
