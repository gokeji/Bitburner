import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const target = ns.args[0] || "n00dles";

    // Get current server and player info
    const originalServer = ns.getServer(target);
    const player = ns.getPlayer();
    const cores = 1;

    // Create test server with 10% money
    const testServer = {
        ...originalServer,
        moneyAvailable: originalServer.moneyMax * 0.1,
        hackDifficulty: originalServer.minDifficulty, // Use minimum security for cleaner comparison
    };

    ns.print("=".repeat(80));
    ns.print("GROW THREAD SPLITTING TEST");
    ns.print("=".repeat(80));
    ns.print(`Target: ${target}`);
    ns.print(`Max Money: $${ns.formatNumber(testServer.moneyMax)}`);
    ns.print(`Starting Money: $${ns.formatNumber(testServer.moneyAvailable)} (10%)`);
    ns.print(`Security: ${testServer.hackDifficulty.toFixed(2)} (min: ${testServer.minDifficulty.toFixed(2)})`);
    ns.print("");

    // Test 1: 10 threads all at once
    ns.print("--- TEST 1: 10 THREADS ALL AT ONCE ---");

    const growMultiplier10 = ns.formulas.hacking.growPercent(testServer, 10, player, cores);
    const finalMoney10 = Math.min(testServer.moneyAvailable * growMultiplier10, testServer.moneyMax);
    const actualMultiplier10 = finalMoney10 / testServer.moneyAvailable;

    ns.print(`Grow multiplier (10 threads): ${growMultiplier10.toFixed(6)}x`);
    ns.print(`Money after grow: $${ns.formatNumber(finalMoney10)}`);
    ns.print(`Actual multiplier: ${actualMultiplier10.toFixed(6)}x`);
    ns.print(`Final money percentage: ${((finalMoney10 / testServer.moneyMax) * 100).toFixed(2)}%`);

    // Test 2: 5 threads, then 5 more threads
    ns.print("\n--- TEST 2: 5 THREADS + 5 THREADS ---");

    // First batch of 5 threads
    const growMultiplier5_1 = ns.formulas.hacking.growPercent(testServer, 5, player, cores);
    const moneyAfter5_1 = Math.min(testServer.moneyAvailable * growMultiplier5_1, testServer.moneyMax);
    const securityAfter5_1 = testServer.hackDifficulty + 5 * 0.004;

    ns.print(`First 5 threads:`);
    ns.print(`  Grow multiplier: ${growMultiplier5_1.toFixed(6)}x`);
    ns.print(`  Money after: $${ns.formatNumber(moneyAfter5_1)}`);
    ns.print(`  Percentage: ${((moneyAfter5_1 / testServer.moneyMax) * 100).toFixed(2)}%`);

    // Create server state after first grow
    const serverAfter5 = {
        ...testServer,
        moneyAvailable: moneyAfter5_1,
        hackDifficulty: securityAfter5_1,
    };

    // Second batch of 5 threads
    const growMultiplier5_2 = ns.formulas.hacking.growPercent(serverAfter5, 5, player, cores);
    const finalMoney5x2 = Math.min(moneyAfter5_1 * growMultiplier5_2, testServer.moneyMax);

    ns.print(`Second 5 threads:`);
    ns.print(`  Starting from: $${ns.formatNumber(moneyAfter5_1)}`);
    ns.print(`  Grow multiplier: ${growMultiplier5_2.toFixed(6)}x`);
    ns.print(`  Final money: $${ns.formatNumber(finalMoney5x2)}`);
    ns.print(`  Final percentage: ${((finalMoney5x2 / testServer.moneyMax) * 100).toFixed(2)}%`);

    const totalMultiplier5x2 = finalMoney5x2 / testServer.moneyAvailable;
    ns.print(`Total multiplier (5+5): ${totalMultiplier5x2.toFixed(6)}x`);

    // Comparison
    ns.print("\n" + "=".repeat(80));
    ns.print("COMPARISON RESULTS");
    ns.print("=".repeat(80));

    const difference = finalMoney5x2 - finalMoney10;
    const percentDifference = (finalMoney5x2 / finalMoney10 - 1) * 100;

    ns.print(`10 threads at once: $${ns.formatNumber(finalMoney10)} (${actualMultiplier10.toFixed(6)}x)`);
    ns.print(`5+5 threads split: $${ns.formatNumber(finalMoney5x2)} (${totalMultiplier5x2.toFixed(6)}x)`);
    ns.print(`Difference: $${ns.formatNumber(difference)}`);
    ns.print(`Percentage difference: ${percentDifference.toFixed(4)}%`);

    if (Math.abs(difference) < 1) {
        ns.print("✅ Results are essentially identical");
    } else if (finalMoney5x2 > finalMoney10) {
        ns.print("📈 Split approach gives MORE money");
    } else {
        ns.print("📉 All-at-once approach gives MORE money");
    }

    // Mathematical explanation
    ns.print("\n--- MATHEMATICAL ANALYSIS ---");
    ns.print("Grow formula is exponential based on current money:");
    ns.print("  newMoney = currentMoney * growMultiplier(threads)");
    ns.print("  growMultiplier increases with more threads but with diminishing returns");
    ns.print("");

    // Show the individual multipliers
    ns.print("Individual multipliers:");
    ns.print(`  5 threads on 10% money: ${growMultiplier5_1.toFixed(6)}x`);
    ns.print(
        `  5 threads on ${((moneyAfter5_1 / testServer.moneyMax) * 100).toFixed(2)}% money: ${growMultiplier5_2.toFixed(6)}x`,
    );
    ns.print(
        `  Combined: ${growMultiplier5_1.toFixed(6)} × ${growMultiplier5_2.toFixed(6)} = ${(growMultiplier5_1 * growMultiplier5_2).toFixed(6)}x`,
    );
    ns.print(`  10 threads on 10% money: ${growMultiplier10.toFixed(6)}x`);

    // Test with different starting percentages
    ns.print("\n--- TESTING AT DIFFERENT MONEY PERCENTAGES ---");
    const testPercentages = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9];

    for (const pct of testPercentages) {
        const testMoney = testServer.moneyMax * pct;
        const server = { ...testServer, moneyAvailable: testMoney };

        // 10 at once
        const mult10 = ns.formulas.hacking.growPercent(server, 10, player, cores);
        const final10 = Math.min(testMoney * mult10, testServer.moneyMax);

        // 5 + 5
        const mult5_1 = ns.formulas.hacking.growPercent(server, 5, player, cores);
        const after5_1 = Math.min(testMoney * mult5_1, testServer.moneyMax);
        const server2 = { ...server, moneyAvailable: after5_1, hackDifficulty: server.hackDifficulty + 5 * 0.004 };
        const mult5_2 = ns.formulas.hacking.growPercent(server2, 5, player, cores);
        const final5x2 = Math.min(after5_1 * mult5_2, testServer.moneyMax);

        const diff = (final5x2 / final10 - 1) * 100;
        ns.print(
            `${(pct * 100).toFixed(1)}% money: 10-at-once=${mult10.toFixed(4)}x, 5+5=${(mult5_1 * mult5_2).toFixed(4)}x, diff=${diff.toFixed(4)}%`,
        );
    }

    return;
}
