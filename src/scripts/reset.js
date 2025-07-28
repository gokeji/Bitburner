import { NS } from "@ns";
import { getCurrentNeuroFluxPurchaseLevel } from "./get-augments.js";

/** @param {NS} ns **/
export async function main(ns) {
    const allowSoftReset = ns.args.includes("--allowSoftReset");

    let resetLog = [`Reset started at ${new Date().toLocaleString()}\n`];

    ns.tprint(`\n\n\n\n\n\n`);
    ns.tprint(`Starting reset...`);

    // Kill all other scripts
    ns.killall("home", true);

    const currentNeuroFluxLevel = ns.getResetInfo().ownedAugs.get("NeuroFlux Governor") ?? 0;

    // Wait for augmentation purchase scripts to complete
    // const pid1 = ns.run("scripts/get-augments.js", 1, "--combat", "--buy", "--force-buy");
    // const pid1 = ns.run(
    //     "scripts/get-augments.js",
    //     1,
    //     "--hacking",
    //     "--rep",
    //     "--hacknet",
    //     "--buy",
    //     "--force-buy",
    //     "--no-tail",
    // );
    // await ns.sleep(100);
    // const pid2 = ns.run("scripts/get-augments.js", 1, "--buy", "--force-buy", "--no-tail");

    // // Wait for both scripts to finish
    // while (ns.isRunning(pid1) || ns.isRunning(pid2)) {
    //     await ns.sleep(100);
    // }

    const newNeuroFluxLevel = getCurrentNeuroFluxPurchaseLevel(ns);

    const purchasedAugmentations = ns.singularity
        .getOwnedAugmentations(true)
        .filter((augmentation) => !ns.singularity.getOwnedAugmentations(false).includes(augmentation));

    const neuroFluxLevelIncrease = newNeuroFluxLevel - currentNeuroFluxLevel - 1;

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
        const augMessage = `${idx}: NeuroFlux Governor - Level ${currentNeuroFluxLevel + i + 1}`;
        ns.tprint(augMessage);
        resetLog.push(augMessage);
        idx++;
    }

    // ns.tprint(`🔄 Waiting for augmentations to be installed...`);
    // await ns.sleep(3000);

    // ns.tprint(`🔄 Upgrading home ram...`);
    // // Track RAM upgrades
    // let ramUpgrades = 0;
    // while (ns.getPlayer().money > ns.singularity.getUpgradeHomeRamCost() && ns.getServer("home").maxRam < 2 ** 30) {
    //     ns.singularity.upgradeHomeRam();
    //     ramUpgrades++;
    //     const ramMessage = `💾 Upgraded home ram to ${ns.formatRam(ns.getServerMaxRam("home"))}`;
    //     ns.tprint(ramMessage);
    //     resetLog.push(ramMessage);
    // }

    // ns.tprint(`🔄 Upgrading home cores...`);
    // // Track core upgrades
    // let coreUpgrades = 0;
    // while (ns.getPlayer().money > ns.singularity.getUpgradeHomeCoresCost() && ns.getServer("home").cpuCores < 8) {
    //     ns.singularity.upgradeHomeCores();
    //     coreUpgrades++;
    //     const coreMessage = `🖥️ Upgraded home cores to ${ns.getServer("home").cpuCores}`;
    //     ns.tprint(coreMessage);
    //     resetLog.push(coreMessage);
    // }

    // const gangMembers = ns.gang.getMemberNames();
    // let haveAllEquipment = true;
    // for (const member of gangMembers) {
    //     const memberInfo = ns.gang.getMemberInformation(member);
    //     if (memberInfo.upgrades.length < 21 || memberInfo.augmentations.length < 11) {
    //         haveAllEquipment = false;
    //         break;
    //     }
    // }

    // if (haveAllEquipment) {
    //     ns.tprint(`🔄 All gang members have full equipment`);
    //     await ns.sleep(1000);
    // }

    // if (ns.gang.inGang() && !haveAllEquipment) {
    //     for (let i = 10; i > 0; i--) {
    //         // Restart gangs with higher augmentation budget
    //         if (ns.scriptRunning("gangs.js", "home")) {
    //             ns.scriptKill("gangs.js", "home");
    //         }

    //         ns.run("gangs.js", 1, "--buy-all-before-reset");
    //         const gangMessage = `🔄 ${i}: Waiting for gangs to finish buying equipment...`;
    //         ns.tprint(gangMessage);
    //         resetLog.push(gangMessage);
    //         await ns.sleep(1000); // Wait for a few ticks to ensure gangs are done buying equipment
    //     }
    // }
    // resetLog.push(`- Total augmentations purchased: ${purchasedAugmentations.length}`);
    // resetLog.push(`- RAM upgrades performed: ${ramUpgrades}`);
    // resetLog.push(`- Core upgrades performed: ${coreUpgrades}`);
    // resetLog.push(`- Final home RAM: ${ns.formatRam(ns.getServerMaxRam("home"))}`);
    // resetLog.push(`- Final home cores: ${ns.getServer("home").cpuCores}`);
    // resetLog.push(`\nInstalling augmentations at ${new Date().toLocaleString()}`);

    // Write all logged information to file
    ns.write("reset-info.txt", resetLog.join("\n"), "w");

    if (purchasedAugmentations.length + neuroFluxLevelIncrease > 0) {
        ns.singularity.installAugmentations("scripts/after-install.js");
    } else if (allowSoftReset) {
        ns.singularity.softReset("scripts/after-install.js");
    }
}
