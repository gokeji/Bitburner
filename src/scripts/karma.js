import { NS } from "@ns";

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail(); // Log Window

    var karmaHistory = [];

    while (true) {
        var karma = ns.heart.break();
        var now = Date.now();

        // Keep 10 seconds of history
        karmaHistory.push({ karma, time: now });
        karmaHistory = karmaHistory.filter((entry) => now - entry.time <= 20000);

        ns.clearLog(); // Clear the Log window

        // Calculate rate from oldest entry
        var rate = 0;
        if (karmaHistory.length >= 2) {
            var oldest = karmaHistory[0];
            rate = (karma - oldest.karma) / ((now - oldest.time) / 1000);
        }

        ns.print("🔴 Karma: " + ns.formatNumber(karma));
        ns.print("🔴 Rate : " + ns.formatNumber(rate) + "/s");

        await ns.sleep(500);
    }
}
