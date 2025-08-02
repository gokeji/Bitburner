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

        if (ns.bladeburner.getActionTime("Operations", "Assassination") > 1000) {
            increaseEvasiveSystemLevel(ns);
        }

        // Buy as many hyperdrive as possible with accurate cost calculation
        const skillPoints = ns.bladeburner.getSkillPoints();
        const currentLevel = ns.bladeburner.getSkillLevel("Hyperdrive");

        const maxHyperdrives = calculateMaxAffordableHyperdrives(skillPoints, currentLevel);

        if (maxHyperdrives > 0) {
            const success = ns.bladeburner.upgradeSkill("Hyperdrive", maxHyperdrives);

            if (success) {
                ns.print(
                    `${new Date().toLocaleTimeString()} Bought ${ns.formatNumber(maxHyperdrives)} hyperdrives, final level: ${ns.formatNumber(ns.bladeburner.getSkillLevel("Hyperdrive"))}`,
                );
            } else {
                ns.print(
                    `${new Date().toLocaleTimeString()} Failed to buy ${ns.formatNumber(maxHyperdrives)} hyperdrives, final level: ${ns.formatNumber(ns.bladeburner.getSkillLevel("Hyperdrive"))}`,
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

/** @param {NS} ns */
function increaseEvasiveSystemLevel(ns) {
    const evasiveSystemLevel = ns.bladeburner.getSkillLevel("Evasive System");

    // Buy half of current level of Evasive System
    const numToBuy = Math.floor(evasiveSystemLevel / 2);

    // Buy half of current level of Evasive System
    const success = ns.bladeburner.upgradeSkill("Evasive System", numToBuy);

    if (success) {
        // Print new level
        ns.print(`New Level: ${ns.bladeburner.getSkillLevel("Evasive System")}`);
    } else {
        ns.print(`Failed to increase Evasive System level`);
    }
}

/**
 * Calculate the maximum number of hyperdrives that can be bought with available skill points
 * Cost formula: actualCount * (baseCost + costInc * (currentLevel + (actualCount - 1) / 2))
 * Where baseCost = 1, costInc = 2.5
 * @param {number} availablePoints - Current skill points available
 * @param {number} currentLevel - Current hyperdrive level
 * @returns {number} Maximum number of hyperdrives that can be bought
 */
export function calculateMaxAffordableHyperdrives(availablePoints, currentLevel) {
    const baseCost = 1;
    const costInc = 2.5;

    // Expand the cost formula:
    // cost = actualCount * (baseCost + costInc * (currentLevel + (actualCount - 1) / 2))
    // cost = actualCount * (baseCost + costInc * currentLevel + costInc * (actualCount - 1) / 2)
    // cost = actualCount * baseCost + actualCount * costInc * currentLevel + actualCount * costInc * (actualCount - 1) / 2
    // cost = actualCount * baseCost + actualCount * costInc * currentLevel + costInc * actualCount * (actualCount - 1) / 2
    // cost = actualCount * baseCost + actualCount * costInc * currentLevel + costInc * (actualCount^2 - actualCount) / 2
    // cost = actualCount * baseCost + actualCount * costInc * currentLevel + costInc * actualCount^2 / 2 - costInc * actualCount / 2
    // cost = actualCount * (baseCost + costInc * currentLevel - costInc / 2) + costInc * actualCount^2 / 2
    // cost = actualCount * (baseCost + costInc * currentLevel - costInc / 2) + (costInc / 2) * actualCount^2

    // Rearranging to standard quadratic form: ax^2 + bx + c = 0
    // (costInc / 2) * actualCount^2 + (baseCost + costInc * currentLevel - costInc / 2) * actualCount - availablePoints = 0

    const a = costInc / 2;
    const b = baseCost + costInc * currentLevel - costInc / 2;
    const c = -availablePoints;

    // Quadratic formula: x = (-b ± √(b² - 4ac)) / 2a
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return 0; // No real solution, can't afford any
    }

    // We want the positive root
    const sqrt_discriminant = Math.sqrt(discriminant);
    const solution1 = (-b + sqrt_discriminant) / (2 * a);
    const solution2 = (-b - sqrt_discriminant) / (2 * a);

    // Take the positive solution and floor it since we can only buy whole levels
    const maxLevels = Math.max(solution1, solution2);
    return Math.floor(Math.max(0, maxLevels));
}
