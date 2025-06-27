import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const target = ns.args[0] || "n00dles";
    const threads = parseInt(ns.args[1]) || 10;

    // Get current server and player info
    const originalServer = ns.getServer(target);
    const player = ns.getPlayer();

    // Create test server with 10% money for consistent comparison
    const testServer = {
        ...originalServer,
        moneyAvailable: originalServer.moneyMax * 0.1,
        hackDifficulty: originalServer.minDifficulty, // Use minimum security for cleaner comparison
    };

    ns.print("=".repeat(80));
    ns.print("GROW CORE EFFECTIVENESS TEST");
    ns.print("=".repeat(80));
    ns.print(`Target: ${target}`);
    ns.print(`Threads: ${threads}`);
    ns.print(`Max Money: $${ns.formatNumber(testServer.moneyMax)}`);
    ns.print(`Starting Money: $${ns.formatNumber(testServer.moneyAvailable)} (10%)`);
    ns.print(`Security: ${testServer.hackDifficulty.toFixed(2)} (min: ${testServer.minDifficulty.toFixed(2)})`);
    ns.print("");

    // Test different core counts
    const coreResults = [];
    const testCores = [1, 2, 3, 4, 5, 6, 7, 8];

    ns.print("--- CORE COMPARISON RESULTS ---");
    ns.print("Cores | Grow Multiplier | Final Money      | Final %   | Improvement vs 1 Core");
    ns.print("-".repeat(80));

    let baselineMultiplier = 0;
    let baselineMoney = 0;

    for (const cores of testCores) {
        const growMultiplier = ns.formulas.hacking.growPercent(testServer, threads, player, cores);
        const finalMoney = Math.min(testServer.moneyAvailable * growMultiplier, testServer.moneyMax);
        const finalPercentage = (finalMoney / testServer.moneyMax) * 100;

        if (cores === 1) {
            baselineMultiplier = growMultiplier;
            baselineMoney = finalMoney;
        }

        const improvement = cores === 1 ? 0 : (growMultiplier / baselineMultiplier - 1) * 100;
        const moneyImprovement = cores === 1 ? 0 : (finalMoney / baselineMoney - 1) * 100;

        coreResults.push({
            cores,
            multiplier: growMultiplier,
            finalMoney,
            finalPercentage,
            improvement,
            moneyImprovement,
        });

        const improvementStr = cores === 1 ? "baseline" : `+${improvement.toFixed(2)}%`;
        ns.print(
            `${cores.toString().padStart(4)} | ${growMultiplier.toFixed(6).padStart(14)} | $${ns.formatNumber(finalMoney).padStart(13)} | ${finalPercentage.toFixed(2).padStart(7)}% | ${improvementStr}`,
        );
    }

    // Show marginal improvements
    ns.print("\n--- MARGINAL IMPROVEMENTS ---");
    ns.print("From X cores to X+1 cores:");
    ns.print("Cores | Multiplier Gain | Money Gain    | % Improvement");
    ns.print("-".repeat(60));

    for (let i = 1; i < coreResults.length; i++) {
        const prev = coreResults[i - 1];
        const curr = coreResults[i];

        const multiplierGain = curr.multiplier - prev.multiplier;
        const moneyGain = curr.finalMoney - prev.finalMoney;
        const percentGain = (curr.multiplier / prev.multiplier - 1) * 100;

        ns.print(
            `${prev.cores}→${curr.cores}   | +${multiplierGain.toFixed(6).padStart(13)} | $${ns.formatNumber(moneyGain).padStart(10)} | +${percentGain.toFixed(3)}%`,
        );
    }

    // Efficiency analysis
    ns.print("\n--- EFFICIENCY ANALYSIS ---");
    ns.print("Cost-benefit assuming cores cost resources:");
    ns.print("Cores | Multiplier per Core | Efficiency Score");
    ns.print("-".repeat(50));

    for (const result of coreResults) {
        const multiplierPerCore = result.multiplier / result.cores;
        const efficiencyScore = result.multiplier / result.cores / (baselineMultiplier / 1); // Relative to 1-core efficiency

        ns.print(
            `${result.cores.toString().padStart(4)} | ${multiplierPerCore.toFixed(6).padStart(17)} | ${efficiencyScore.toFixed(4)}`,
        );
    }

    // Test at different money percentages with core scaling
    ns.print("\n--- CORE SCALING AT DIFFERENT MONEY LEVELS ---");
    const testPercentages = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9];

    ns.print("Money % | 1 Core    | 2 Cores   | 4 Cores   | 8 Cores   | 8-Core Advantage");
    ns.print("-".repeat(75));

    for (const pct of testPercentages) {
        const testMoney = testServer.moneyMax * pct;
        const server = { ...testServer, moneyAvailable: testMoney };

        const mult1 = ns.formulas.hacking.growPercent(server, threads, player, 1);
        const mult2 = ns.formulas.hacking.growPercent(server, threads, player, 2);
        const mult4 = ns.formulas.hacking.growPercent(server, threads, player, 4);
        const mult8 = ns.formulas.hacking.growPercent(server, threads, player, 8);

        const advantage = (mult8 / mult1 - 1) * 100;

        ns.print(
            `${(pct * 100).toFixed(1).padStart(6)}% | ${mult1.toFixed(4).padStart(8)} | ${mult2.toFixed(4).padStart(8)} | ${mult4.toFixed(4).padStart(8)} | ${mult8.toFixed(4).padStart(8)} | +${advantage.toFixed(2)}%`,
        );
    }

    // Summary recommendations
    ns.print("\n" + "=".repeat(80));
    ns.print("SUMMARY & RECOMMENDATIONS");
    ns.print("=".repeat(80));

    const cores2Improvement = (coreResults[1].multiplier / coreResults[0].multiplier - 1) * 100;
    const cores4Improvement = (coreResults[3].multiplier / coreResults[0].multiplier - 1) * 100;
    const cores8Improvement = (coreResults[7].multiplier / coreResults[0].multiplier - 1) * 100;

    ns.print(`• 2 cores vs 1 core: +${cores2Improvement.toFixed(2)}% grow effectiveness`);
    ns.print(`• 4 cores vs 1 core: +${cores4Improvement.toFixed(2)}% grow effectiveness`);
    ns.print(`• 8 cores vs 1 core: +${cores8Improvement.toFixed(2)}% grow effectiveness`);
    ns.print("");

    // Find diminishing returns point
    let bestEfficiency = 0;
    let bestEfficiencyCores = 1;

    for (const result of coreResults) {
        const efficiency = result.multiplier / result.cores;
        if (efficiency > bestEfficiency) {
            bestEfficiency = efficiency;
            bestEfficiencyCores = result.cores;
        }
    }

    ns.print(`• Most efficient core count (multiplier per core): ${bestEfficiencyCores} cores`);

    // Find point of diminishing returns (where improvement drops below 10%)
    let diminishingPoint = 8;
    for (let i = 1; i < coreResults.length; i++) {
        const prev = coreResults[i - 1];
        const curr = coreResults[i];
        const percentGain = (curr.multiplier / prev.multiplier - 1) * 100;

        if (percentGain < 10) {
            diminishingPoint = curr.cores;
            break;
        }
    }

    ns.print(`• Diminishing returns start at: ${diminishingPoint} cores (improvement <10%)`);
    ns.print("");
    ns.print("💡 For most efficient resource allocation, consider the marginal cost");
    ns.print("   of additional cores vs. the grow effectiveness improvement.");

    return coreResults;
}
