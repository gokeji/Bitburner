import { NS } from "@ns";
import { calculateBestSleeveStats } from "../sleeve.js";

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail(); // Log Window
    ns.ui.resizeTail(180, 140);
    const windowSize = ns.ui.windowSize();
    ns.ui.moveTail(windowSize[0] - 400, 40);

    const existingKarmaScript = ns.getRunningScript("karma.js");
    if (existingKarmaScript) {
        ns.ui.openTail(existingKarmaScript.pid);
        ns.ui.resizeTail(180, 140);
        ns.ui.moveTail(windowSize[0] - 400, 40);
        return;
    }

    var karmaHistory = [];
    let predictedTimeToGang = 0;
    let predictedGangUpdateTime = 0;
    let reachedGang = ns.heart.break() <= -54000;

    while (true) {
        var karma = ns.heart.break();
        var now = Date.now();

        if (karma <= -54000 && !reachedGang) {
            reachedGang = true;
            ns.tprint(now);
            ns.tprint(`Unlocked gang after ${formatTime((now - ns.getResetInfo().lastNodeReset) / 1000)} in Bitnode.`);
        }

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
        const timeTillGang = formatTime(timeTillGangSeconds);

        if (Date.now() - predictedGangUpdateTime > 10000) {
            const { bestTime, bestConfig } = calculateBestSleeveStats(ns, true, 0);
            predictedTimeToGang = bestTime;
            predictedGangUpdateTime = Date.now();
        }
        const predictedTimeTillGangSeconds = formatTime(
            predictedTimeToGang - (Date.now() - predictedGangUpdateTime) / 1000,
        );

        ns.print("🔴 Karma: " + ns.formatNumber(karma));
        ns.print("🔴 Rate : " + ns.formatNumber(rate) + "/s");
        ns.print("🔴 Due  : " + timeTillGang);
        ns.print("🔴 Calc : " + predictedTimeTillGangSeconds);

        await ns.sleep(1000);
    }
}

function formatTime(time) {
    return `${Math.floor(time / 3600)
        .toString()
        .padStart(2, "0")}:${Math.floor((time % 3600) / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor(time % 60)
        .toString()
        .padStart(2, "0")}`;
}
