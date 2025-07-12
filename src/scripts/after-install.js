import { NS } from "@ns";

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");

    const isLateGame =
        ns.getPlayer().mults.hacking * ns.getBitNodeMultipliers().HackingLevelMultiplier > 5 ||
        ns.getServerMaxRam("home") > 2 ** 20;
    //  ||
    // (ns.gang.inGang() && ns.gang.getGangInformation().territory > 0.4);

    // Start stanek early so it can run during crime and casino phases
    if (!ns.scriptRunning("stanek.js", "home")) {
        const stanekPid = ns.run("stanek.js");
        if (stanekPid) {
            ns.print("SUCCESS Started stanek.js early - it will run during crime and casino phases");
        } else {
            ns.print("WARNING Failed to start stanek.js early");
        }
    }

    // Run gangs.js to start making some money
    if (!ns.scriptRunning("gangs.js", "home")) {
        const gangsPid = ns.run("gangs.js");
        if (gangsPid) {
            ns.print("SUCCESS Started gangs.js early - it will run during crime and casino phases");
        }
    }

    if (!isLateGame) {
        // Do crime until we hit 230K money
        while (ns.getPlayer().money < 230000) {
            const currentWork = ns.singularity.getCurrentWork();
            if (currentWork && (currentWork.type !== "CRIME" || currentWork.crimeType !== "Shoplift")) {
                ns.singularity.commitCrime("Shoplift");
            }
            ns.print(`Doing Shoplift until we have 230K money`);
            await ns.sleep(5000);
        }

        // Wait for casino to make 10B
        while (ns.getMoneySources().sinceInstall.casino < 10e9) {
            ns.print(`Waiting for casino to make 10B`);

            // Run roulette navigator (which will start roulette.js)
            if (
                !ns.scriptRunning("scripts/roulette-navigator.js", "home") &&
                !ns.scriptRunning("scripts/roulette.js", "home")
            ) {
                ns.run("scripts/roulette-navigator.js");
            }

            await ns.sleep(5000);
        }
    }

    // Upgrade home ram to at least 512GB
    while (ns.getServer("home").maxRam < 512) {
        if (ns.getPlayer().money < ns.singularity.getUpgradeHomeRamCost()) {
            ns.print(`Not enough money to upgrade home ram, waiting...`);
            await ns.sleep(5000);
            continue;
        }
        ns.singularity.upgradeHomeRam();
        ns.print(`Upgraded home ram to ${ns.getServer("home").maxRam}GB`);
    }

    // Run autoplay.js to start rest of the scripts
    ns.run("autoplay.js");
    ns.print("INFO After-install complete - autoplay.js has been started");
}
