import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const target = ns.args[0] || "n00dles";
    const threads = parseInt(ns.args[1]) || 10;

    // Get current server and player info
    const originalServer = ns.getServer(target);
    const player = ns.getPlayer();

    ns.print("=".repeat(80));
    ns.print("COMPREHENSIVE CORE SCALING ANALYSIS");
    ns.print("=".repeat(80));
    ns.print(`Target: ${target}`);
    ns.print(`Threads: ${threads}`);
    ns.print(`Player Hacking: ${player.skills.hacking}`);
    ns.print(`Server Required Hacking: ${originalServer.requiredHackingSkill}`);
    ns.print(
        `Server Security: ${originalServer.hackDifficulty.toFixed(2)} (min: ${originalServer.minDifficulty.toFixed(2)})`,
    );
    ns.print("");

    // Test different core counts
    const testCores = [1, 2, 4, 8, 16];

    // HACK ANALYSIS
    ns.print("=".repeat(80));
    ns.print("HACK OPERATION CORE SCALING");
    ns.print("=".repeat(80));

    // Create server at optimal conditions for hack
    const hackServer = {
        ...originalServer,
        moneyAvailable: originalServer.moneyMax,
        hackDifficulty: originalServer.minDifficulty,
    };

    ns.print("Cores | Hack %    | Money Stolen  | Time (sec) | Money/sec     | Improvement");
    ns.print("-".repeat(75));

    let baselineHackPercent = 0;
    let baselineHackMoney = 0;
    let baselineHackTime = 0;

    for (const cores of testCores) {
        const hackPercent = ns.formulas.hacking.hackPercent(hackServer, player);
        const hackMoney = hackPercent * hackServer.moneyAvailable * threads;
        const hackTime = ns.formulas.hacking.hackTime(hackServer, player) / 1000;
        const hackCoreTime = hackTime / cores; // Cores reduce time
        const moneyPerSec = hackMoney / hackCoreTime;

        if (cores === 1) {
            baselineHackPercent = hackPercent;
            baselineHackMoney = hackMoney;
            baselineHackTime = hackCoreTime;
        }

        const timeImprovement = cores === 1 ? 0 : (baselineHackTime / hackCoreTime - 1) * 100;
        const efficiencyImprovement =
            cores === 1 ? 0 : (moneyPerSec / (baselineHackMoney / baselineHackTime) - 1) * 100;

        const improvementStr = cores === 1 ? "baseline" : `+${efficiencyImprovement.toFixed(1)}%`;

        ns.print(
            `${cores.toString().padStart(4)} | ${(hackPercent * 100).toFixed(3)}% | $${ns.formatNumber(hackMoney).padStart(10)} | ${hackCoreTime.toFixed(2).padStart(9)} | $${ns.formatNumber(moneyPerSec).padStart(10)} | ${improvementStr}`,
        );
    }

    // GROW ANALYSIS
    ns.print("\n" + "=".repeat(80));
    ns.print("GROW OPERATION CORE SCALING");
    ns.print("=".repeat(80));

    // Create server at 10% money for grow testing
    const growServer = {
        ...originalServer,
        moneyAvailable: originalServer.moneyMax * 0.1,
        hackDifficulty: originalServer.minDifficulty,
    };

    ns.print("Cores | Grow Multi | Money After   | Time (sec) | Growth/sec    | Improvement");
    ns.print("-".repeat(75));

    let baselineGrowMulti = 0;
    let baselineGrowTime = 0;

    for (const cores of testCores) {
        const growMultiplier = ns.formulas.hacking.growPercent(growServer, threads, player, cores);
        const moneyAfter = Math.min(growServer.moneyAvailable * growMultiplier, growServer.moneyMax);
        const growTime = ns.formulas.hacking.growTime(growServer, player) / 1000;
        const growCoreTime = growTime / cores; // Cores reduce time
        const growthPerSec = (moneyAfter - growServer.moneyAvailable) / growCoreTime;

        if (cores === 1) {
            baselineGrowMulti = growMultiplier;
            baselineGrowTime = growCoreTime;
        }

        const multiImprovement = cores === 1 ? 0 : (growMultiplier / baselineGrowMulti - 1) * 100;
        const timeImprovement = cores === 1 ? 0 : (baselineGrowTime / growCoreTime - 1) * 100;

        const improvementStr = cores === 1 ? "baseline" : `+${multiImprovement.toFixed(1)}%`;

        ns.print(
            `${cores.toString().padStart(4)} | ${growMultiplier.toFixed(4)} | $${ns.formatNumber(moneyAfter).padStart(10)} | ${growCoreTime.toFixed(2).padStart(9)} | $${ns.formatNumber(growthPerSec).padStart(10)} | ${improvementStr}`,
        );
    }

    // WEAKEN ANALYSIS
    ns.print("\n" + "=".repeat(80));
    ns.print("WEAKEN OPERATION CORE SCALING");
    ns.print("=".repeat(80));

    // Create server at high security for weaken testing
    const weakenServer = {
        ...originalServer,
        hackDifficulty: originalServer.minDifficulty + 10,
    };

    ns.print("Cores | Weaken Amt | Security After | Time (sec) | Weaken/sec    | Improvement");
    ns.print("-".repeat(75));

    let baselineWeakenAmt = 0;
    let baselineWeakenTime = 0;

    for (const cores of testCores) {
        const weakenAmount = ns.weakenAnalyze(threads, cores);
        const securityAfter = Math.max(weakenServer.hackDifficulty - weakenAmount, weakenServer.minDifficulty);
        const weakenTime = ns.formulas.hacking.weakenTime(weakenServer, player) / 1000;
        const weakenCoreTime = weakenTime / cores; // Cores reduce time
        const weakenPerSec = weakenAmount / weakenCoreTime;

        if (cores === 1) {
            baselineWeakenAmt = weakenAmount;
            baselineWeakenTime = weakenCoreTime;
        }

        const amountImprovement = cores === 1 ? 0 : (weakenAmount / baselineWeakenAmt - 1) * 100;
        const timeImprovement = cores === 1 ? 0 : (baselineWeakenTime / weakenCoreTime - 1) * 100;

        const improvementStr = cores === 1 ? "baseline" : `+${amountImprovement.toFixed(1)}%`;

        ns.print(
            `${cores.toString().padStart(4)} | ${weakenAmount.toFixed(4)} | ${securityAfter.toFixed(2).padStart(13)} | ${weakenCoreTime.toFixed(2).padStart(9)} | ${weakenPerSec.toFixed(4).padStart(12)} | ${improvementStr}`,
        );
    }

    // COMPARATIVE ANALYSIS
    ns.print("\n" + "=".repeat(80));
    ns.print("CORE SCALING COMPARISON SUMMARY");
    ns.print("=".repeat(80));

    ns.print("Operation effectiveness improvement with cores (vs 1 core):");
    ns.print("");
    ns.print("Cores | Hack Time | Grow Multi | Weaken Amt | Overall Benefit");
    ns.print("-".repeat(65));

    for (const cores of testCores) {
        // Calculate improvements
        const hackTimeReduction = cores === 1 ? 0 : ((cores - 1) * 100) / cores; // Simplified time reduction
        const growMultiBoost =
            cores === 1
                ? 0
                : (ns.formulas.hacking.growPercent(growServer, threads, player, cores) /
                      ns.formulas.hacking.growPercent(growServer, threads, player, 1) -
                      1) *
                  100;
        const weakenAmtBoost =
            cores === 1 ? 0 : (ns.weakenAnalyze(threads, cores) / ns.weakenAnalyze(threads, 1) - 1) * 100;

        const overallBenefit = (hackTimeReduction + growMultiBoost + weakenAmtBoost) / 3;

        if (cores === 1) {
            ns.print(`${cores.toString().padStart(4)} | baseline  | baseline   | baseline   | baseline`);
        } else {
            ns.print(
                `${cores.toString().padStart(4)} | +${hackTimeReduction.toFixed(1).padStart(6)}% | +${growMultiBoost.toFixed(1).padStart(7)}% | +${weakenAmtBoost.toFixed(1).padStart(7)}% | +${overallBenefit.toFixed(1)}%`,
            );
        }
    }

    // BATCH TIMING ANALYSIS
    ns.print("\n" + "=".repeat(80));
    ns.print("BATCH TIMING ANALYSIS WITH CORES");
    ns.print("=".repeat(80));

    ns.print("How cores affect HGW batch timing:");
    ns.print("");
    ns.print("Cores | Hack Time | Grow Time | Weaken Time | Longest (Batch)");
    ns.print("-".repeat(60));

    for (const cores of testCores) {
        const hackTime = ns.formulas.hacking.hackTime(hackServer, player) / 1000 / cores;
        const growTime = ns.formulas.hacking.growTime(growServer, player) / 1000 / cores;
        const weakenTime = ns.formulas.hacking.weakenTime(weakenServer, player) / 1000 / cores;
        const batchTime = Math.max(hackTime, growTime, weakenTime);

        ns.print(
            `${cores.toString().padStart(4)} | ${hackTime.toFixed(1).padStart(8)}s | ${growTime.toFixed(1).padStart(8)}s | ${weakenTime.toFixed(1).padStart(10)}s | ${batchTime.toFixed(1)}s`,
        );
    }

    // RECOMMENDATIONS
    ns.print("\n" + "=".repeat(80));
    ns.print("RECOMMENDATIONS");
    ns.print("=".repeat(80));

    ns.print("💡 KEY INSIGHTS:");
    ns.print("");
    ns.print("1. TIME REDUCTION: Cores directly reduce operation times by cores factor");
    ns.print("   - 2 cores = 50% time reduction");
    ns.print("   - 4 cores = 75% time reduction");
    ns.print("   - 8 cores = 87.5% time reduction");
    ns.print("");
    ns.print("2. GROW EFFECTIVENESS: Cores also boost grow multiplier effectiveness");
    ns.print("   - This is the biggest advantage for grow operations");
    ns.print("   - Double benefit: faster execution + more effective");
    ns.print("");
    ns.print("3. WEAKEN EFFECTIVENESS: Cores boost weaken amount per thread");
    ns.print("   - Similar to grow, both faster and more effective");
    ns.print("");
    ns.print("4. HACK OPERATIONS: Only benefit from time reduction");
    ns.print("   - Hack percentage is not affected by cores");
    ns.print("   - Still significant benefit from faster execution");
    ns.print("");
    ns.print("🎯 FOR BATCH OPTIMIZATION:");
    ns.print("- More cores = faster batch cycles = higher money/second");
    ns.print("- Grow operations benefit most from additional cores");
    ns.print("- Consider core cost vs. throughput improvement");
    ns.print("- Higher core counts enable more aggressive batching strategies");

    return {
        target,
        threads,
        coreTests: testCores,
        playerHacking: player.skills.hacking,
        serverInfo: {
            maxMoney: originalServer.moneyMax,
            minSecurity: originalServer.minDifficulty,
            requiredHacking: originalServer.requiredHackingSkill,
        },
    };
}
