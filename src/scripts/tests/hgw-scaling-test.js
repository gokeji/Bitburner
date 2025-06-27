import { NS } from "@ns";

/**
 * Creates a test script to verify HGW thread scaling and its effects.
 *
 * This script tests two main hypotheses:
 * 1. Does linearly scaling the number of threads for an HGW operation
 *    result in a linearly scaled effect? (e.g., do 50% of the threads
 *    achieve 50% of the goal?)
 * 2. Is the optimal number of threads for a scaled-down operation
 *    itself a linear scaling of the original threads?
 *
 * @param {NS} ns Bitburner namespace.
 */
export async function main(ns) {
    const target = ns.args[0]?.toString() || "joesguns";
    const scaleFactor = 0.5;
    const baseHackFraction = 0.5; // 50%

    // --- CONFIGURATION ---
    const host = "n00dles";
    const player = ns.getPlayer();
    const cores = ns.getServer(host).cpuCores;

    // --- SERVER STATE SETUP ---
    const server = ns.getServer(target);
    server.hackDifficulty = server.minDifficulty;
    server.moneyAvailable = server.moneyMax;

    ns.print("=".repeat(80));
    ns.print("HGW THREAD AND EFFECT SCALING TEST");
    ns.print("=".repeat(80));
    ns.print(`Target: ${target} (Max Money: ${ns.formatNumber(server.moneyMax)})`);
    ns.print(`Player Skill: ${player.skills.hacking}, Cores: ${cores}`);
    ns.print(`Baseline Operation: Hack ${baseHackFraction * 100}%`);
    ns.print(`Scaling Factor: ${scaleFactor}`);
    ns.print("=".repeat(80));

    // --- SCENARIO 1: BASELINE OPTIMAL THREADS ---
    ns.print("\n--- SCENARIO 1: BASELINE OPTIMAL CALCULATION ---");
    ns.print(`Calculating optimal threads to hack ${baseHackFraction * 100}% and recover...`);
    const baseline = calculateHGWThreads(ns, player, server, baseHackFraction, cores);
    printResults("Baseline", ns, baseline);

    // --- SCENARIO 2: LINEARLY SCALED THREADS ---
    ns.print("\n--- SCENARIO 2: VALIDATING LINEARLY SCALED THREADS ---");
    ns.print(`Using ${scaleFactor * 100}% of baseline threads and checking the effect...`);
    validateScaledThreads(ns, player, server, baseline, scaleFactor, cores);

    // --- SCENARIO 3: RECALCULATED OPTIMAL THREADS ---
    ns.print("\n--- SCENARIO 3: RECALCULATED OPTIMAL FOR SCALED GOAL ---");
    const scaledHackFraction = baseHackFraction * scaleFactor;
    ns.print(`Calculating optimal threads to hack ${scaledHackFraction * 100}% and recover...`);
    const recalculated = calculateHGWThreads(ns, player, server, scaledHackFraction, cores);
    printResults("Recalculated", ns, recalculated);

    // --- ANALYSIS ---
    ns.print("\n" + "=".repeat(80));
    ns.print("ANALYSIS & CONCLUSION");
    ns.print("=".repeat(80));
    compareResults(ns, baseline, recalculated, scaleFactor);
}

/**
 * @typedef {object} HGWResult
 * @property {number} hackThreads
 * @property {number} growThreads
 * @property {number} weakenThreads
 * @property {number} totalRam
 * @property {number} hackFraction
 */

function calculateHGWThreads(ns, player, serverInitial, hackFraction, cores) {
    const moneyToHack = serverInitial.moneyMax * hackFraction;
    if (moneyToHack <= 0) return { hackThreads: 0, growThreads: 0, weakenThreads: 0, totalRam: 0, hackFraction };

    const hackThreads = Math.ceil(ns.hackAnalyzeThreads(serverInitial.hostname, moneyToHack));
    if (hackThreads === Infinity || isNaN(hackThreads)) {
        return { hackThreads: 0, growThreads: 0, weakenThreads: 0, totalRam: 0, hackFraction };
    }

    const serverAfterHack = { ...serverInitial };
    const percentStolenByOneThread = ns.formulas.hacking.hackPercent(serverAfterHack, player);
    const moneyStolen = serverAfterHack.moneyAvailable * (1 - Math.pow(1 - percentStolenByOneThread, hackThreads));

    serverAfterHack.moneyAvailable = Math.max(0, serverInitial.moneyAvailable - moneyStolen);

    let growThreads = 0;
    if (serverAfterHack.moneyAvailable < serverInitial.moneyMax) {
        growThreads = Math.ceil(
            ns.formulas.hacking.growThreads(serverAfterHack, player, serverInitial.moneyMax, cores),
        );
    }

    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, serverInitial.hostname);
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, serverInitial.hostname, cores);
    const totalSecurityIncrease = hackSecurityIncrease + growSecurityIncrease;
    const weakenThreads = Math.ceil(totalSecurityIncrease / ns.weakenAnalyze(1, cores));

    const ramHack = ns.getScriptRam("/scripts/hack.js") * hackThreads;
    const ramGrow = ns.getScriptRam("/scripts/grow.js") * growThreads;
    const ramWeaken = ns.getScriptRam("/scripts/weaken.js") * weakenThreads;
    const totalRam = ramHack + ramGrow + ramWeaken;

    return { hackThreads, growThreads, weakenThreads, totalRam, hackFraction };
}

function validateScaledThreads(ns, player, serverInitial, baseline, scaleFactor, cores) {
    const sThreads = {
        hack: Math.ceil(baseline.hackThreads * scaleFactor),
        grow: Math.ceil(baseline.growThreads * scaleFactor),
        weaken: Math.ceil(baseline.weakenThreads * scaleFactor),
    };
    ns.print(`  Scaled Threads -> H: ${sThreads.hack}, G: ${sThreads.grow}, W: ${sThreads.weaken}`);

    // 1. Analyze Hack Effect
    const serverAfterHack = { ...serverInitial };
    const actualHackPercent = ns.formulas.hacking.hackPercent(serverAfterHack, player) * sThreads.hack;
    const actualMoneyHacked = actualHackPercent * serverAfterHack.moneyAvailable;
    serverAfterHack.moneyAvailable -= actualMoneyHacked;

    const targetHackFraction = baseline.hackFraction * scaleFactor;
    ns.print(`  HACK:   Target was to hack ${ns.formatPercent(targetHackFraction, 2)}.`);
    ns.print(`          Actual hack was ${ns.formatPercent(actualHackPercent, 2)}.`);

    // 2. Analyze Grow Effect
    const serverAfterGrow = { ...serverAfterHack };
    const growMultiplier = ns.formulas.hacking.growPercent(serverAfterGrow, sThreads.grow, player, cores);
    serverAfterGrow.moneyAvailable *= growMultiplier;
    serverAfterGrow.moneyAvailable = Math.min(serverInitial.moneyMax, serverAfterGrow.moneyAvailable);
    const moneyRecovered = serverAfterGrow.moneyAvailable - serverAfterHack.moneyAvailable;
    const percentOfMax = serverAfterGrow.moneyAvailable / serverInitial.moneyMax;
    ns.print(`  GROW:   Started with ${ns.formatNumber(serverAfterHack.moneyAvailable)}.`);
    ns.print(
        `          Grew by ${ns.formatNumber(moneyRecovered)}, finishing at ${ns.formatPercent(percentOfMax, 2)} of max.`,
    );

    // 3. Analyze Weaken Effect
    const secIncrease = ns.hackAnalyzeSecurity(sThreads.hack) + ns.growthAnalyzeSecurity(sThreads.grow);
    const secDecrease = ns.weakenAnalyze(sThreads.weaken, cores);
    ns.print(`  WEAKEN: Security increase from H/G is ${secIncrease.toFixed(2)}.`);
    ns.print(`          Security decrease from W is ${secDecrease.toFixed(2)}.`);
    if (secDecrease >= secIncrease) {
        ns.print("          ✅ Weaken is sufficient.");
    } else {
        ns.print("          ❌ Weaken is INSUFFICIENT.");
    }
}

function printResults(label, ns, results) {
    const { hackThreads, growThreads, weakenThreads, totalRam, hackFraction } = results;
    ns.print(`  ${label} (for ${ns.formatPercent(hackFraction, 2)} hack):`);
    ns.print(`    Threads: H:${hackThreads} G:${growThreads} W:${weakenThreads}`);
    if (hackThreads > 0) {
        ns.print(
            `    Ratios (G/H, W/H): ${(growThreads / hackThreads).toFixed(3)}, ${(weakenThreads / hackThreads).toFixed(3)}`,
        );
    }
    ns.print(`    Total RAM: ${ns.formatRam(totalRam, 2)}`);
}

function compareResults(ns, baseline, recalculated, scaleFactor) {
    ns.print("Comparing [SCENARIO 1: Baseline] vs [SCENARIO 3: Recalculated Optimal]");
    const ramRatio = recalculated.totalRam / baseline.totalRam;
    const growRatioRatio =
        recalculated.growThreads / recalculated.hackThreads / (baseline.growThreads / baseline.hackThreads);

    ns.print(`  Expected RAM scaling factor: ${scaleFactor.toFixed(4)}`);
    ns.print(
        `  Actual RAM scaling factor:   ${ramRatio.toFixed(4)} (${ns.formatPercent(ramRatio / scaleFactor - 1, 2)} diff)`,
    );
    ns.print("");
    ns.print("  Thread Ratios (Grow/Hack):");
    ns.print(`    Baseline:     ${(baseline.growThreads / baseline.hackThreads).toFixed(4)}`);
    ns.print(`    Recalculated: ${(recalculated.growThreads / recalculated.hackThreads).toFixed(4)}`);
    ns.print(`    Ratio of ratios: ${growRatioRatio.toFixed(4)} (${ns.formatPercent(growRatioRatio - 1, 2)} diff)`);
    ns.print("");

    const ramDiff = Math.abs(ramRatio / scaleFactor - 1);
    const ratioDiff = Math.abs(growRatioRatio - 1);

    if (ramDiff > 0.05 || ratioDiff > 0.05) {
        ns.print("CONCLUSION: ❌ Major non-linearities detected.");
        ns.print("  The optimal threads and RAM cost DO NOT scale linearly with the hack amount.");
        ns.print("  This is expected. You cannot simply scale thread counts and expect a scaled result.");
        ns.print("  Always recalculate optimal threads for the specific amount you intend to hack.");
    } else {
        ns.print("CONCLUSION: ✅ Scaling is approximately linear, but with deviations.");
        ns.print("  While the ratios are close, they are not perfect. This is due to the game's formulas");
        ns.print("  and integer math for threads. For maximum efficiency, you should still recalculate");
        ns.print("  threads for each batch rather than scaling them.");
    }
}
