import { NS } from "@ns";

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");

    // Do crime until we hit 230K money
    while (ns.getPlayer().money < 230000) {
        ns.singularity.commitCrime("Shoplift");
        ns.print(`Doing Shoplift until we have 230K money`);
        await ns.sleep(5000);
    }

    // Stop committing crime as it slows down casino.js
    ns.singularity.stopAction();

    // Wait for casino to make 10B
    while (ns.getMoneySources().sinceInstall.casino < 10e9) {
        ns.print(`Waiting for casino to make 10B`);

        // Run casino.js
        if (!ns.scriptRunning("casino.js", "home")) {
            ns.run("casino.js");
        }

        await ns.sleep(5000);
    }

    // Upgrade home ram to at least 512GB
    while (ns.getServer("home").maxRam < 512) {
        ns.singularity.upgradeHomeRam();
        ns.print(`Upgraded home ram to ${ns.getServer("home").maxRam}GB`);
    }

    // Run autoplay.js to start rest of the scripts
    ns.run("autoplay.js");
    ns.print("INFO After-install complete - autoplay.js has been started");
}
