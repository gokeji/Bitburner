import { NS } from "@ns";

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail(); // Log Window
    ns.ui.resizeTail(180, 120);
    const windowSize = ns.ui.windowSize();
    ns.ui.moveTail(windowSize[0] - 400, 40);

    var karmaHistory = [];

    while (true) {
        var karma = ns.heart.break();
        var now = Date.now();

        // Keep 60 seconds of history
        karmaHistory.push({ karma, time: now });
        karmaHistory = karmaHistory.filter((entry) => now - entry.time <= 60000);

        ns.clearLog(); // Clear the Log window

        // Calculate rate from oldest entry
        var rate = 0;
        if (karmaHistory.length >= 2) {
            var oldest = karmaHistory[0];
            rate = (karma - oldest.karma) / ((now - oldest.time) / 1000);
        }

        const timeTillGangSeconds = rate === 0 ? 0 : (-54000 - karma) / rate;
        const timeTillGang = `${Math.floor(timeTillGangSeconds / 3600)
            .toString()
            .padStart(2, "0")}:${Math.floor((timeTillGangSeconds % 3600) / 60)
            .toString()
            .padStart(2, "0")}:${Math.floor(timeTillGangSeconds % 60)
            .toString()
            .padStart(2, "0")}`;

        ns.print("🔴 Karma: " + ns.formatNumber(karma));
        ns.print("🔴 Rate : " + ns.formatNumber(rate) + "/s");
        ns.print("🔴 Due  : " + timeTillGang);

        await ns.sleep(1000);
    }
}
