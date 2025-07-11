import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.run("scripts/get-augments.js", 1, "--hacking", "--rep", "--hacknet", "--buy", "--force-buy");
    ns.run("scripts/get-augments.js", 1, "--buy", "--force-buy");

    const purchasedAugmentations = ns.singularity
        .getOwnedAugmentations(true)
        .filter((augmentation) => !ns.singularity.getOwnedAugmentations(false).includes(augmentation));

    ns.tprint(`Purchased ${purchasedAugmentations.length} augmentations`);
    let idx = 1;
    for (const augmentation of purchasedAugmentations) {
        ns.tprint(`${idx}: ${augmentation}`);
        idx++;
    }

    await ns.sleep(3000);
    while (ns.getPlayer().money > ns.singularity.getUpgradeHomeRamCost()) {
        ns.singularity.upgradeHomeRam();
        ns.tprint(`Upgraded home ram to ${ns.formatRam(ns.getServerMaxRam("home"))}`);
    }
    while (ns.getPlayer().money > ns.singularity.getUpgradeHomeCoresCost()) {
        ns.singularity.upgradeHomeCores();
        ns.tprint(`Upgraded home cores to ${ns.getServer("home").cpuCores}`);
    }
    // Restart gangs with higher augmentation budget

    if (ns.scriptRunning("gangs.js", "home")) {
        ns.scriptKill("gangs.js", "home");
        ns.run("gangs.js", 1, "--augmentations-budget", 1);
    }
    await ns.sleep(1000);
    if (ns.scriptRunning("gangs.js", "home")) {
        ns.scriptKill("gangs.js", "home");
        ns.run("gangs.js", 1, "--equipment-budget", 1);
    }
    await ns.sleep(1000);
    ns.singularity.installAugmentations("scripts/after-install.js");
}
