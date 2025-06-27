import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const target = "n00dles";

    // Get current server and player info
    const originalServer = ns.getServer(target);
    const player = ns.getPlayer();

    // Test states
    const testStates = [
        {
            name: "Current (ns funcs)",
            server: { ...originalServer },
            useFormulas: false,
        },
        {
            name: "Current State",
            server: { ...originalServer },
            useFormulas: true,
        },
        {
            name: "Current +10 Sec",
            server: {
                ...originalServer,
                hackDifficulty: originalServer.hackDifficulty + 10,
            },
            useFormulas: true,
        },
        {
            name: "Min Sec, Max Money",
            server: {
                ...originalServer,
                hackDifficulty: originalServer.minDifficulty,
                moneyAvailable: originalServer.moneyMax,
            },
            useFormulas: true,
        },
        {
            name: "50% Money",
            server: {
                ...originalServer,
                moneyAvailable: originalServer.moneyMax * 0.5,
            },
            useFormulas: true,
        },
        {
            name: "25% Money, +10 Sec",
            server: {
                ...originalServer,
                moneyAvailable: originalServer.moneyMax * 0.25,
                hackDifficulty: originalServer.minDifficulty + 10,
            },
            useFormulas: true,
        },
    ];

    // Calculate all values for each state
    const results = [];
    const cores = 1;
    const testThreads = 10;

    for (const state of testStates) {
        const server = state.server;
        const result = {
            name: state.name,
            money: server.moneyAvailable,
            maxMoney: server.moneyMax,
            moneyPercent: ((server.moneyAvailable / server.moneyMax) * 100).toFixed(1),
            security: server.hackDifficulty.toFixed(2),
            minSecurity: server.minDifficulty.toFixed(2),
            securityDiff: (server.hackDifficulty - server.minDifficulty).toFixed(2),
        };

        if (state.useFormulas) {
            // Use formulas API
            result.hackTime = ns.formulas.hacking.hackTime(server, player);
            result.growTime = ns.formulas.hacking.growTime(server, player);
            result.weakenTime = ns.formulas.hacking.weakenTime(server, player);
            result.hackChance = ns.formulas.hacking.hackChance(server, player);
            result.hackPercent = ns.formulas.hacking.hackPercent(server, player);
            result.hackExp = ns.formulas.hacking.hackExp(server, player);

            // Grow functions
            result.growPercent10 = ns.formulas.hacking.growPercent(server, testThreads, player, cores);
            result.growAmount10 = ns.formulas.hacking.growAmount(server, player, testThreads, cores);
            result.growThreadsToMax = ns.formulas.hacking.growThreads(server, player, server.moneyMax, cores);
            result.growThreadsTo80 = ns.formulas.hacking.growThreads(server, player, server.moneyMax * 0.8, cores);

            // Security functions - use the same ns functions since formulas API doesn't have these
            result.hackSecurityIncrease = ns.hackAnalyzeSecurity(testThreads, target);
            result.growSecurityIncrease = ns.growthAnalyzeSecurity(testThreads, target, cores);
            result.weakenAmount = ns.weakenAnalyze(1, cores);
        } else {
            // Use existing ns functions
            result.hackTime = ns.getHackTime(target);
            result.growTime = ns.getGrowTime(target);
            result.weakenTime = ns.getWeakenTime(target);
            result.hackChance = ns.hackAnalyzeChance(target);
            result.hackPercent = ns.hackAnalyze(target);
            result.hackExp = "N/A"; // No direct equivalent
            result.growPercent10 = "N/A"; // No direct equivalent
            result.growAmount10 = "N/A"; // No direct equivalent
            result.growThreadsToMax = ns.growthAnalyze(target, server.moneyMax / server.moneyAvailable, cores);
            result.growThreadsTo80 = ns.growthAnalyze(target, (server.moneyMax * 0.8) / server.moneyAvailable, cores);

            // Security functions from existing API
            result.hackSecurityIncrease = ns.hackAnalyzeSecurity(testThreads, target);
            result.growSecurityIncrease = ns.growthAnalyzeSecurity(testThreads, target, cores);
            result.weakenAmount = ns.weakenAnalyze(1, cores);
        }

        results.push(result);
    }

    // Helper function to format numbers
    const fmt = (val, decimals = 2) => {
        if (val === "N/A") return val;
        if (typeof val === "number") {
            return ns.formatNumber(val, decimals);
        }
        return val;
    };

    const fmtTime = (ms) => {
        if (ms === "N/A") return ms;
        if (ms > 1000) return ns.formatNumber(ms / 1000, 2) + "s";
        return ns.formatNumber(ms, 0) + "ms";
    };

    const fmtMoney = (amt) => {
        if (amt === "N/A") return amt;
        return "$" + fmt(amt);
    };

    const fmtPercent = (val) => {
        if (val === "N/A") return val;
        return ns.formatNumber(val * 100, 4) + "%";
    };

    const fmtSecurity = (val) => {
        if (val === "N/A") return val;
        return "+" + ns.formatNumber(val, 3);
    };

    // Print table header
    const colWidth = 18;
    const totalWidth = 20 + (colWidth + 3) * results.length;
    ns.print("=".repeat(totalWidth));
    ns.print("FORMULAS.HACKING API COMPARISON TABLE");
    ns.print("=".repeat(totalWidth));

    // Column headers
    const headers = results.map((r) => r.name.padEnd(colWidth)).join(" | ");
    ns.print("Metric".padEnd(20) + " | " + headers);
    ns.print("=".repeat(totalWidth));

    // Server state info
    ns.print("--- SERVER STATE ---");
    ns.print("Money".padEnd(20) + " | " + results.map((r) => fmtMoney(r.money).padEnd(colWidth)).join(" | "));
    ns.print("Money %".padEnd(20) + " | " + results.map((r) => (r.moneyPercent + "%").padEnd(colWidth)).join(" | "));
    ns.print("Security".padEnd(20) + " | " + results.map((r) => r.security.padEnd(colWidth)).join(" | "));
    ns.print(
        "Security Diff".padEnd(20) + " | " + results.map((r) => ("+" + r.securityDiff).padEnd(colWidth)).join(" | "),
    );

    // Timing functions
    ns.print("\n--- TIMING FUNCTIONS ---");
    ns.print("Hack Time".padEnd(20) + " | " + results.map((r) => fmtTime(r.hackTime).padEnd(colWidth)).join(" | "));
    ns.print("Grow Time".padEnd(20) + " | " + results.map((r) => fmtTime(r.growTime).padEnd(colWidth)).join(" | "));
    ns.print("Weaken Time".padEnd(20) + " | " + results.map((r) => fmtTime(r.weakenTime).padEnd(colWidth)).join(" | "));

    // Hack functions
    ns.print("\n--- HACK FUNCTIONS ---");
    ns.print(
        "Hack Chance".padEnd(20) + " | " + results.map((r) => fmtPercent(r.hackChance).padEnd(colWidth)).join(" | "),
    );
    ns.print(
        "Hack % (1 thread)".padEnd(20) +
            " | " +
            results.map((r) => fmtPercent(r.hackPercent).padEnd(colWidth)).join(" | "),
    );
    ns.print("Hack Exp".padEnd(20) + " | " + results.map((r) => fmt(r.hackExp).padEnd(colWidth)).join(" | "));
    ns.print(
        "Money/1 thread".padEnd(20) +
            " | " +
            results
                .map((r) => {
                    if (r.hackPercent === "N/A") return "N/A".padEnd(colWidth);
                    return fmtMoney(r.money * r.hackPercent).padEnd(colWidth);
                })
                .join(" | "),
    );
    ns.print(
        `Hack Sec (${testThreads}t)`.padEnd(20) +
            " | " +
            results.map((r) => fmtSecurity(r.hackSecurityIncrease).padEnd(colWidth)).join(" | "),
    );

    // Grow functions
    ns.print("\n--- GROW FUNCTIONS ---");
    ns.print(
        `Grow % (${testThreads} threads)`.padEnd(20) +
            " | " +
            results
                .map((r) => {
                    if (r.growPercent10 === "N/A") return "N/A".padEnd(colWidth);
                    return (ns.formatNumber(r.growPercent10, 2) + "x").padEnd(colWidth);
                })
                .join(" | "),
    );
    ns.print(
        `Grow Amount (${testThreads}t)`.padEnd(20) +
            " | " +
            results.map((r) => fmtMoney(r.growAmount10).padEnd(colWidth)).join(" | "),
    );
    ns.print(
        "Threads to Max".padEnd(20) +
            " | " +
            results.map((r) => ns.formatNumber(r.growThreadsToMax, 2).padEnd(colWidth)).join(" | "),
    );
    ns.print(
        "Threads to 80%".padEnd(20) +
            " | " +
            results.map((r) => ns.formatNumber(r.growThreadsTo80, 2).padEnd(colWidth)).join(" | "),
    );
    ns.print(
        `Grow Sec (${testThreads}t)`.padEnd(20) +
            " | " +
            results.map((r) => fmtSecurity(r.growSecurityIncrease).padEnd(colWidth)).join(" | "),
    );

    // Weaken functions
    ns.print("\n--- WEAKEN FUNCTIONS ---");
    ns.print(
        "Weaken Amount (1t)".padEnd(20) +
            " | " +
            results
                .map((r) => {
                    if (r.weakenAmount === "N/A") return "N/A".padEnd(colWidth);
                    return ("-" + ns.formatNumber(r.weakenAmount, 3)).padEnd(colWidth);
                })
                .join(" | "),
    );

    ns.print("\n" + "=".repeat(totalWidth));
    ns.print("KEY OBSERVATIONS:");
    ns.print("=".repeat(totalWidth));

    // Analysis
    ns.print("1. TIMING: Security affects timing - compare 'Current State' vs 'Current +10 Sec'");
    ns.print("2. HACK %: Security reduces hack effectiveness - notice the difference");
    ns.print("3. GROW: growAmount() caps at server max, but growPercent() shows true multiplier");
    ns.print("4. GROW THREADS: Formulas give exact fractional threads, ns functions are estimates");
    ns.print("5. MONEY DEPENDENCY: Hack money scales with available money, grow threads scale inversely");
    ns.print("6. SECURITY: Hack/Grow increase security, Weaken decreases it by fixed amounts");

    // Highlight discrepancies
    ns.print("\n--- DISCREPANCIES TO INVESTIGATE ---");

    // Compare formulas vs ns functions for current state
    const current = results[0]; // ns functions
    const formulasCurrent = results[1]; // formulas with same state

    if (Math.abs(current.hackTime - formulasCurrent.hackTime) > 1) {
        ns.print(`⚠️  Hack time differs: ${fmtTime(current.hackTime)} vs ${fmtTime(formulasCurrent.hackTime)}`);
    }

    if (Math.abs(current.hackPercent - formulasCurrent.hackPercent) > 0.0001) {
        ns.print(
            `⚠️  Hack percent differs: ${fmtPercent(current.hackPercent)} vs ${fmtPercent(formulasCurrent.hackPercent)}`,
        );
    }

    if (Math.abs(current.growThreadsToMax - formulasCurrent.growThreadsToMax) > 1) {
        ns.print(
            `⚠️  Grow threads differ: ${fmt(current.growThreadsToMax)} vs ${fmt(formulasCurrent.growThreadsToMax)}`,
        );
    }

    if (Math.abs(current.hackSecurityIncrease - formulasCurrent.hackSecurityIncrease) > 0.001) {
        ns.print(
            `⚠️  Hack security differs: ${fmtSecurity(current.hackSecurityIncrease)} vs ${fmtSecurity(formulasCurrent.hackSecurityIncrease)}`,
        );
    }

    if (Math.abs(current.growSecurityIncrease - formulasCurrent.growSecurityIncrease) > 0.001) {
        ns.print(
            `⚠️  Grow security differs: ${fmtSecurity(current.growSecurityIncrease)} vs ${fmtSecurity(formulasCurrent.growSecurityIncrease)}`,
        );
    }

    if (Math.abs(current.weakenAmount - formulasCurrent.weakenAmount) > 0.001) {
        ns.print(`⚠️  Weaken amount differs: ${current.weakenAmount} vs ${formulasCurrent.weakenAmount}`);
    }

    // Highlight the grow calculation issue
    ns.print("\n--- GROW CALCULATION ANALYSIS ---");
    for (let i = 1; i < results.length; i++) {
        const r = results[i];
        if (r.growPercent10 !== "N/A" && r.growAmount10 !== "N/A") {
            const expected = r.money * r.growPercent10;
            const actual = r.growAmount10;
            if (Math.abs(expected - actual) > 1000) {
                ns.print(`${r.name}: Expected ${fmtMoney(expected)}, Got ${fmtMoney(actual)} - CAPPED AT MAX`);
            }
        }
    }

    // Security impact analysis
    ns.print("\n--- SECURITY IMPACT ANALYSIS ---");
    const currentState = results[1]; // Current state with formulas
    const currentPlus10 = results[2]; // Current +10 security

    ns.print(`Security +10 impact on timing:`);
    ns.print(
        `  Hack time: ${fmtTime(currentState.hackTime)} → ${fmtTime(currentPlus10.hackTime)} (${((currentPlus10.hackTime / currentState.hackTime - 1) * 100).toFixed(1)}% increase)`,
    );
    ns.print(
        `  Grow time: ${fmtTime(currentState.growTime)} → ${fmtTime(currentPlus10.growTime)} (${((currentPlus10.growTime / currentState.growTime - 1) * 100).toFixed(1)}% increase)`,
    );
    ns.print(
        `  Weaken time: ${fmtTime(currentState.weakenTime)} → ${fmtTime(currentPlus10.weakenTime)} (${((currentPlus10.weakenTime / currentState.weakenTime - 1) * 100).toFixed(1)}% increase)`,
    );

    ns.print(`Security +10 impact on effectiveness:`);
    ns.print(
        `  Hack %: ${fmtPercent(currentState.hackPercent)} → ${fmtPercent(currentPlus10.hackPercent)} (${((currentPlus10.hackPercent / currentState.hackPercent - 1) * 100).toFixed(1)}% change)`,
    );
    ns.print(
        `  Grow multiplier: ${currentState.growPercent10.toFixed(3)}x → ${currentPlus10.growPercent10.toFixed(3)}x (${((currentPlus10.growPercent10 / currentState.growPercent10 - 1) * 100).toFixed(1)}% change)`,
    );

    return;
}
