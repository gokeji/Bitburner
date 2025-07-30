import { NS } from "@ns";
import { getBladeburnerIntGain, getSuccessesNeededForNextLevel } from "./formulas";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    ns.ui.openTail();
    ns.ui.resizeTail(360, 380);
    const windowSize = ns.ui.windowSize();
    ns.ui.moveTail(windowSize[0] - 600, 40);

    let lastIntExp = 0;
    let actualIntGained = 0;

    while (true) {
        ns.clearLog();

        // Show intelligence, assassination level, assassination operations, assassination chance, number of hyperdrive upgrades
        const player = ns.getPlayer();
        const int = player.skills.intelligence;
        const intExp = player.exp.intelligence;
        if (lastIntExp === 0) {
            lastIntExp = intExp;
        }

        const currentAction = ns.bladeburner.getCurrentAction();
        const assassinationLevel = ns.bladeburner.getActionMaxLevel("Operations", "Assassination");
        const assassinationActionsRemaining = ns.bladeburner.getActionCountRemaining("Operations", "Assassination");
        const assassinationSuccesses = ns.bladeburner.getActionSuccesses("Operations", "Assassination");
        const remainingOpsToNextLevel = getSuccessesNeededForNextLevel(assassinationLevel) - assassinationSuccesses;
        const assassinationSuccessChance = ns.bladeburner.getActionEstimatedSuccessChance(
            "Operations",
            "Assassination",
        )[0];
        const hyperdriveMaxLevel = ns.bladeburner.getSkillLevel("Hyperdrive");

        const intGainPerAssassination = getBladeburnerIntGain(assassinationLevel, hyperdriveMaxLevel, true);

        if (currentAction && currentAction.name === "Assassination") {
            actualIntGained = intExp - lastIntExp;
            lastIntExp = intExp;
        }

        if (currentAction) {
            ns.print(
                `👤: ${currentAction.name} - ${
                    (ns.bladeburner.getActionTime(currentAction.type, currentAction.name) -
                        ns.bladeburner.getActionCurrentTime()) /
                    1000
                }s`,
            );
        } else {
            ns.print("👤: No action");
        }
        ns.print(`🧠: ${ns.formatNumber(intExp, 6)} (${int} INT)`);
        ns.print(
            `🎯: lvl ${assassinationLevel} -${ns.formatNumber(remainingOpsToNextLevel)} +${ns.formatNumber(assassinationActionsRemaining)} (${ns.formatPercent(assassinationSuccessChance)})`,
        );
        ns.print(`🏎️: lvl ${ns.formatNumber(hyperdriveMaxLevel)} (${ns.formatNumber(1 + hyperdriveMaxLevel * 0.1)}x)`);
        ns.print(
            `💰: ${ns.formatNumber(intGainPerAssassination.intExp)} INT | Actual: ${ns.formatNumber(actualIntGained)} INT`,
        );

        // Show chaos for each city

        const cities = {
            Aevum: "Aevum",
            Chongqing: "Chongqing",
            Sector12: "Sector-12",
            NewTokyo: "New Tokyo",
            Ishima: "Ishima",
            Volhaven: "Volhaven",
        };
        ns.print("\n🔥 Chaos:");
        const currentCity = ns.bladeburner.getCity();
        for (const cityName of Object.values(cities)) {
            const chaos = ns.bladeburner.getCityChaos(cityName);
            const population = ns.bladeburner.getCityEstimatedPopulation(cityName);
            const currentCityIndicator = cityName === currentCity ? "👤" : " ";
            ns.print(
                `   ${cityName.padEnd(10)}: ${ns.formatNumber(chaos, 2).padEnd(7)} p${ns.formatNumber(population, 2).padEnd(7)} ${currentCityIndicator} `,
            );
        }

        await ns.bladeburner.nextUpdate();
    }
}
