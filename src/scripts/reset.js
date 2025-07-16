import { NS } from "@ns";
import { getCurrentNeuroFluxPurchaseLevel } from "./get-augments.js";

/** @param {NS} ns **/
export async function main(ns) {
    let resetLog = [`Reset started at ${new Date().toLocaleString()}\n`];

    // Kill all other scripts
    ns.killall("home", true);

    const currentNeuroFluxLevel = getCurrentNeuroFluxPurchaseLevel(ns);
    ns.tprint(`Current neuroflux level: ${currentNeuroFluxLevel}`);

    // Wait for augmentation purchase scripts to complete
    // const pid1 = ns.run("scripts/get-augments.js", 1, "--combat", "--buy", "--force-buy");
    const pid1 = ns.run("scripts/get-augments.js", 1, "--hacking", "--rep", "--hacknet", "--buy", "--force-buy");
    await ns.sleep(100);
    const pid2 = ns.run("scripts/get-augments.js", 1, "--buy", "--force-buy");

    // Wait for both scripts to finish
    while (ns.isRunning(pid1) || ns.isRunning(pid2)) {
        await ns.sleep(100);
    }

    const newNeuroFluxLevel = getCurrentNeuroFluxPurchaseLevel(ns);
    ns.tprint(`New neuroflux level: ${newNeuroFluxLevel}`);

    const purchasedAugmentations = ns.singularity
        .getOwnedAugmentations(true)
        .filter((augmentation) => !ns.singularity.getOwnedAugmentations(false).includes(augmentation));

    const neuroFluxLevelIncrease = newNeuroFluxLevel - currentNeuroFluxLevel;

    const purchasedMessage = `Purchased ${purchasedAugmentations.length + neuroFluxLevelIncrease} augmentations`;
    ns.tprint(purchasedMessage);
    resetLog.push(purchasedMessage);

    let idx = 1;
    for (const augmentation of purchasedAugmentations) {
        const augMessage = `${idx}: ${augmentation}`;
        ns.tprint(augMessage);
        resetLog.push(augMessage);
        idx++;
    }

    for (let i = 0; i < neuroFluxLevelIncrease; i++) {
        const augMessage = `${idx}: NeuroFlux Governor - Level ${currentNeuroFluxLevel + i}`;
        ns.tprint(augMessage);
        resetLog.push(augMessage);
        idx++;
    }

    await ns.sleep(3000);

    // Track RAM upgrades
    let ramUpgrades = 0;
    while (ns.getPlayer().money > ns.singularity.getUpgradeHomeRamCost() && ns.getServer("home").maxRam < 2 ** 30) {
        ns.singularity.upgradeHomeRam();
        ramUpgrades++;
        const ramMessage = `Upgraded home ram to ${ns.formatRam(ns.getServerMaxRam("home"))}`;
        ns.tprint(ramMessage);
        resetLog.push(ramMessage);
    }

    // Track core upgrades
    let coreUpgrades = 0;
    while (ns.getPlayer().money > ns.singularity.getUpgradeHomeCoresCost() && ns.getServer("home").cpuCores < 8) {
        ns.singularity.upgradeHomeCores();
        coreUpgrades++;
        const coreMessage = `Upgraded home cores to ${ns.getServer("home").cpuCores}`;
        ns.tprint(coreMessage);
        resetLog.push(coreMessage);
    }

    // Restart gangs with higher augmentation budget
    if (ns.scriptRunning("gangs.js", "home")) {
        ns.scriptKill("gangs.js", "home");
        ns.run("gangs.js", 1, "--augmentations-budget", 1);
        const gangMessage = "Restarted gangs with augmentations budget";
        resetLog.push(gangMessage);
    }
    await ns.sleep(1000);
    if (ns.scriptRunning("gangs.js", "home")) {
        ns.scriptKill("gangs.js", "home");
        ns.run("gangs.js", 1, "--equipment-budget", 1);
        const gangMessage = "Restarted gangs with equipment budget";
        resetLog.push(gangMessage);
    }
    await ns.sleep(1000);

    // Add summary information
    resetLog.push(`\nReset Summary:`);
    resetLog.push(`- Total augmentations purchased: ${purchasedAugmentations.length}`);
    resetLog.push(`- RAM upgrades performed: ${ramUpgrades}`);
    resetLog.push(`- Core upgrades performed: ${coreUpgrades}`);
    resetLog.push(`- Final home RAM: ${ns.formatRam(ns.getServerMaxRam("home"))}`);
    resetLog.push(`- Final home cores: ${ns.getServer("home").cpuCores}`);
    resetLog.push(`\nInstalling augmentations at ${new Date().toLocaleString()}`);

    // Write all logged information to file
    ns.write("reset-info.txt", resetLog.join("\n"), "w");

    ns.singularity.installAugmentations("scripts/after-install.js");
}
