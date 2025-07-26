import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const target = ns.args[0] || "n00dles";
    const baseThreads = parseInt(ns.args[1]) || 20;

    // Get current server and player info
    const originalServer = ns.getServer(target);
    const player = ns.getPlayer();

    // Create test server with 10% money for consistent comparison
    const testServer = {
        ...originalServer,
        moneyAvailable: originalServer.moneyMax * 0.1,
        hackDifficulty: originalServer.minDifficulty,
    };

    ns.print("=".repeat(80));
    ns.print("GROW CORE MATHEMATICAL OPTIMIZATION TEST (CORRECTED)");
    ns.print("=".repeat(80));
    ns.print(`Target: ${target}`);
    ns.print(`Base threads needed: ${baseThreads} @ 1 core`);
    ns.print(`Max Money: $${ns.formatNumber(testServer.moneyMax)}`);
    ns.print(`Starting Money: $${ns.formatNumber(testServer.moneyAvailable)} (10%)`);
    ns.print("");

    // Calculate core bonus using the simple formula
    function getCoreBonus(cores) {
        return 1 + (cores - 1) * (1 / 16);
    }

    // CORRECTED: Calculate threads needed using binary search since grow is exponential
    function calculateThreadsNeeded(targetMultiplier, cores) {
        let low = 1,
            high = 1000;
        let bestThreads = high;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const actualMult = ns.formulas.hacking.growPercent(testServer, mid, player, cores);

            if (actualMult >= targetMultiplier) {
                bestThreads = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        return bestThreads;
    }

    // First, establish baseline: what multiplier do we need to achieve?
    const targetMultiplier = ns.formulas.hacking.growPercent(testServer, baseThreads, player, 1);

    ns.print(`TARGET: ${baseThreads} threads @ 1 core = ${targetMultiplier.toFixed(6)}x multiplier`);
    ns.print("");

    // Test core bonus calculations
    ns.print("--- CORE BONUS ANALYSIS (CORRECTED METHOD) ---");
    ns.print("Cores | Core Bonus | Calculated Threads | Thread Savings | Actual Multiplier | Verification");
    ns.print("-".repeat(90));

    const results = [];

    for (const cores of [1, 2, 4, 8]) {
        const coreBonus = getCoreBonus(cores);
        const calculatedThreads = calculateThreadsNeeded(targetMultiplier, cores);
        const threadSavings = baseThreads - calculatedThreads;

        // Verify with actual formulas
        const actualMultiplier = ns.formulas.hacking.growPercent(testServer, calculatedThreads, player, cores);
        const verification = actualMultiplier - targetMultiplier >= 0 ? "✅ Match" : "❌ Mismatch";

        results.push({
            cores,
            coreBonus,
            calculatedThreads,
            threadSavings,
            actualMultiplier,
            verification: verification.includes("✅"),
        });

        ns.print(
            `${cores.toString().padStart(4)} | ${coreBonus.toFixed(6).padStart(9)} | ${calculatedThreads.toString().padStart(17)} | ${threadSavings.toString().padStart(13)} | ${actualMultiplier.toFixed(6).padStart(16)} | ${verification}`,
        );
    }

    // Test if we can derive a mathematical relationship
    ns.print("\n--- ANALYZING THE CORE RELATIONSHIP ---");
    ns.print("Let's see if we can find a pattern in the actual thread requirements:");
    ns.print("");

    const scenarios = [5, 10, 15, 20, 25, 30];
    ns.print("Base | 1-core | 2-core | 4-core | 8-core | 2-core ratio | 4-core ratio | 8-core ratio");
    ns.print("-".repeat(85));

    for (const baseT of scenarios) {
        const baseMult = ns.formulas.hacking.growPercent(testServer, baseT, player, 1);
        const threads1 = baseT;
        const threads2 = calculateThreadsNeeded(baseMult, 2);
        const threads4 = calculateThreadsNeeded(baseMult, 4);
        const threads8 = calculateThreadsNeeded(baseMult, 8);

        const ratio2 = threads2 / threads1;
        const ratio4 = threads4 / threads1;
        const ratio8 = threads8 / threads1;

        ns.print(
            `${baseT.toString().padStart(4)} | ${threads1.toString().padStart(6)} | ${threads2.toString().padStart(6)} | ${threads4.toString().padStart(6)} | ${threads8.toString().padStart(6)} | ${ratio2.toFixed(4).padStart(11)} | ${ratio4.toFixed(4).padStart(11)} | ${ratio8.toFixed(4).padStart(11)}`,
        );
    }

    // Test the inverse relationship
    ns.print("\n--- TESTING INVERSE CORE BONUS HYPOTHESIS ---");
    ns.print("Testing if threadRatio ≈ 1/coreBonus for different scenarios:");
    ns.print("");

    for (const cores of [2, 4, 8]) {
        const coreBonus = getCoreBonus(cores);
        const expectedRatio = 1 / coreBonus;

        ns.print(`${cores} cores (bonus: ${coreBonus.toFixed(6)}, expected ratio: ${expectedRatio.toFixed(6)}):`);

        let totalError = 0;
        let testCount = 0;

        for (const baseT of scenarios) {
            const baseMult = ns.formulas.hacking.growPercent(testServer, baseT, player, 1);
            const threadsNeeded = calculateThreadsNeeded(baseMult, cores);
            const actualRatio = threadsNeeded / baseT;
            const error = Math.abs(actualRatio - expectedRatio);

            totalError += error;
            testCount++;

            ns.print(`  ${baseT} threads: actual ratio ${actualRatio.toFixed(6)}, error: ${error.toFixed(6)}`);
        }

        const avgError = totalError / testCount;
        ns.print(`  Average error: ${avgError.toFixed(6)} (${((avgError / expectedRatio) * 100).toFixed(2)}%)`);
        ns.print("");
    }

    // Practical allocation example with corrected method
    ns.print("\n--- PRACTICAL ALLOCATION EXAMPLE (CORRECTED) ---");
    ns.print(`Scenario: You need to achieve ${targetMultiplier.toFixed(6)}x grow multiplier`);
    ns.print("Available servers with different core counts:");
    ns.print("");

    const availableServers = [
        { cores: 8, maxThreads: 10, name: "high-end-1" },
        { cores: 4, maxThreads: 15, name: "mid-tier-1" },
        { cores: 2, maxThreads: 20, name: "budget-1" },
        { cores: 1, maxThreads: 25, name: "basic-1" },
    ];

    // Greedy allocation using binary search for each server
    let remainingMultiplier = targetMultiplier;
    const allocation = [];

    ns.print("Optimal allocation (trying to minimize total threads):");

    // Sort by efficiency (highest cores first)
    const sortedServers = [...availableServers].sort((a, b) => b.cores - a.cores);

    for (const server of sortedServers) {
        if (Math.abs(remainingMultiplier - 1.0) < 0.001) break; // Close enough to 1x

        // Find how many threads on this server to get as close to remaining multiplier as possible
        let bestThreads = 0;
        let bestMult = 1;

        for (let threads = 1; threads <= server.maxThreads; threads++) {
            const mult = ns.formulas.hacking.growPercent(testServer, threads, player, server.cores);
            if (mult <= remainingMultiplier + 0.001) {
                // Allow small tolerance
                bestThreads = threads;
                bestMult = mult;
            }
        }

        if (bestThreads > 0) {
            allocation.push({
                server: server.name,
                cores: server.cores,
                threads: bestThreads,
                multiplier: bestMult,
            });

            remainingMultiplier = remainingMultiplier / bestMult;

            ns.print(
                `  ${server.name}: ${bestThreads} threads @ ${server.cores} cores = ${bestMult.toFixed(6)}x, remaining: ${remainingMultiplier.toFixed(6)}x`,
            );
        }
    }

    const totalActualThreads = allocation.reduce((sum, alloc) => sum + alloc.threads, 0);
    const threadSavings = baseThreads - totalActualThreads;

    ns.print("");
    ns.print(`Total actual threads used: ${totalActualThreads}`);
    ns.print(`Thread savings: ${threadSavings} (${((threadSavings / baseThreads) * 100).toFixed(2)}%)`);

    // Verify the allocation works
    ns.print("\n--- ALLOCATION VERIFICATION ---");
    let combinedMultiplier = 1;
    for (const alloc of allocation) {
        combinedMultiplier *= alloc.multiplier;
        ns.print(`${alloc.server}: ${alloc.threads} threads @ ${alloc.cores} cores = ${alloc.multiplier.toFixed(6)}x`);
    }

    ns.print(`Combined multiplier: ${combinedMultiplier.toFixed(6)}x`);
    ns.print(`Target multiplier: ${targetMultiplier.toFixed(6)}x`);
    ns.print(`Match: ${Math.abs(combinedMultiplier - targetMultiplier) < 0.01 ? "✅ Success" : "❌ Failed"}`);

    // Summary
    ns.print("\n" + "=".repeat(80));
    ns.print("CORRECTED FINDINGS");
    ns.print("=".repeat(80));
    ns.print("❌ Simple division by core bonus does NOT work for grow operations");
    ns.print("✅ Core bonus affects the exponential grow formula internally");
    ns.print("✅ Must use binary search or formulas to find correct thread counts");
    ns.print("✅ Thread savings are real but require proper calculation");
    ns.print("");
    ns.print("For production use:");
    ns.print("1. Use ns.formulas.hacking.growPercent() to verify thread counts");
    ns.print("2. Use binary search to find minimum threads for target multiplier");
    ns.print("3. Core bonus helps but relationship is not linear");

    return {
        targetMultiplier,
        results,
        allocation,
        threadSavings,
        getCoreBonus,
    };
}
