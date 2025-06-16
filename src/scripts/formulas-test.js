import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
  const target = "n00dles";

  // Get current server and player info
  const originalServer = ns.getServer(target);
  const player = ns.getPlayer();

  ns.tprint("=".repeat(80));
  ns.tprint("FORMULAS.HACKING API TESTING");
  ns.tprint("=".repeat(80));

  // Test with different server states
  const testStates = [
    {
      name: "Current State",
      server: { ...originalServer }
    },
    {
      name: "Min Security, Max Money",
      server: {
        ...originalServer,
        hackDifficulty: originalServer.minDifficulty,
        moneyAvailable: originalServer.moneyMax
      }
    },
    {
      name: "50% Money, Current Security",
      server: {
        ...originalServer,
        moneyAvailable: originalServer.moneyMax * 0.5
      }
    },
    {
      name: "25% Money, High Security (+10)",
      server: {
        ...originalServer,
        moneyAvailable: originalServer.moneyMax * 0.25,
        hackDifficulty: originalServer.minDifficulty + 10
      }
    }
  ];

  const cores = 1;
  const threads = 10;

  for (const state of testStates) {
    ns.tprint("\n" + "=".repeat(60));
    ns.tprint(`TESTING: ${state.name}`);
    ns.tprint("=".repeat(60));

    const server = state.server;

    ns.tprint(`Server State:`);
    ns.tprint(`  Money: $${ns.formatNumber(server.moneyAvailable)} / $${ns.formatNumber(server.moneyMax)} (${(server.moneyAvailable/server.moneyMax*100).toFixed(1)}%)`);
    ns.tprint(`  Security: ${server.hackDifficulty.toFixed(2)} / ${server.minDifficulty.toFixed(2)} (+${(server.hackDifficulty - server.minDifficulty).toFixed(2)})`);

    ns.tprint("\n--- TIMING FUNCTIONS ---");
    try {
      const hackTime = ns.formulas.hacking.hackTime(server, player);
      const growTime = ns.formulas.hacking.growTime(server, player);
      const weakenTime = ns.formulas.hacking.weakenTime(server, player);

      ns.tprint(`hackTime(): ${ns.formatNumber(hackTime)}ms`);
      ns.tprint(`growTime(): ${ns.formatNumber(growTime)}ms`);
      ns.tprint(`weakenTime(): ${ns.formatNumber(weakenTime)}ms`);

      // Compare with existing functions
      ns.tprint(`\nComparison with existing functions:`);
      ns.tprint(`  ns.getHackTime(): ${ns.formatNumber(ns.getHackTime(target))}ms`);
      ns.tprint(`  ns.getGrowTime(): ${ns.formatNumber(ns.getGrowTime(target))}ms`);
      ns.tprint(`  ns.getWeakenTime(): ${ns.formatNumber(ns.getWeakenTime(target))}ms`);
    } catch (e) {
      ns.tprint(`Error with timing functions: ${e}`);
    }

    ns.tprint("\n--- HACK FUNCTIONS ---");
    try {
      const hackChance = ns.formulas.hacking.hackChance(server, player);
      const hackPercent = ns.formulas.hacking.hackPercent(server, player);
      const hackExp = ns.formulas.hacking.hackExp(server, player);

      ns.tprint(`hackChance(): ${(hackChance * 100).toFixed(2)}%`);
      ns.tprint(`hackPercent() [1 thread]: ${(hackPercent * 100).toFixed(4)}%`);
      ns.tprint(`hackExp() [1 thread]: ${hackExp.toFixed(2)} exp`);

      // Calculate money stolen with different thread counts
      const moneyStolen1 = server.moneyAvailable * hackPercent;
      const moneyStolen10 = server.moneyAvailable * hackPercent * 10;
      ns.tprint(`Money stolen [1 thread]: $${ns.formatNumber(moneyStolen1)}`);
      ns.tprint(`Money stolen [10 threads]: $${ns.formatNumber(moneyStolen10)}`);

      // Compare with existing functions
      ns.tprint(`\nComparison with existing functions:`);
      ns.tprint(`  ns.hackAnalyzeChance(): ${(ns.hackAnalyzeChance(target) * 100).toFixed(2)}%`);
      ns.tprint(`  ns.hackAnalyze(): ${(ns.hackAnalyze(target) * 100).toFixed(4)}%`);
    } catch (e) {
      ns.tprint(`Error with hack functions: ${e}`);
    }

    ns.tprint("\n--- GROW FUNCTIONS ---");
    try {
      const growPercent = ns.formulas.hacking.growPercent(server, threads, player, cores);
      const growAmount = ns.formulas.hacking.growAmount(server, player, threads, cores);

      // Test different target amounts
      const targetMoney1 = server.moneyMax;
      const targetMoney2 = server.moneyMax * 0.8;
      const growThreadsToMax = ns.formulas.hacking.growThreads(server, player, targetMoney1, cores);
      const growThreadsTo80 = ns.formulas.hacking.growThreads(server, player, targetMoney2, cores);

      ns.tprint(`growPercent() [${threads} threads]: ${growPercent.toFixed(4)}x multiplier`);
      ns.tprint(`growAmount() [${threads} threads]: $${ns.formatNumber(growAmount)}`);
      ns.tprint(`growThreads() to reach max money: ${Math.ceil(growThreadsToMax)} threads`);
      ns.tprint(`growThreads() to reach 80% max: ${Math.ceil(growThreadsTo80)} threads`);

      // Show the math
      const currentMoney = server.moneyAvailable;
      const expectedGrowth = currentMoney * growPercent;
      ns.tprint(`\nGrowth calculation:`);
      ns.tprint(`  Current: $${ns.formatNumber(currentMoney)}`);
      ns.tprint(`  Multiplier: ${growPercent.toFixed(4)}x`);
      ns.tprint(`  Expected after grow: $${ns.formatNumber(expectedGrowth)}`);
      ns.tprint(`  Formula result: $${ns.formatNumber(growAmount)}`);

      // Compare with existing functions
      ns.tprint(`\nComparison with existing functions:`);
      const existingGrowthAnalyze = ns.growthAnalyze(target, targetMoney1 / currentMoney, cores);
      ns.tprint(`  ns.growthAnalyze() to max: ${existingGrowthAnalyze.toFixed(2)} threads`);
    } catch (e) {
      ns.tprint(`Error with grow functions: ${e}`);
    }

    ns.tprint("\n--- PRACTICAL SCENARIOS ---");
    try {
      // Scenario 1: Hack 50% then grow back to max
      const hackPercent50 = 0.5;
      const threadsToSteal50 = hackPercent50 / ns.formulas.hacking.hackPercent(server, player);
      const moneyAfterHack = server.moneyAvailable * (1 - hackPercent50);

      // Create server state after hack
      const serverAfterHack = {
        ...server,
        moneyAvailable: moneyAfterHack,
        hackDifficulty: server.hackDifficulty + (threadsToSteal50 * 0.002) // Hack increases security
      };

      const threadsToGrowBack = ns.formulas.hacking.growThreads(serverAfterHack, player, server.moneyMax, cores);

      ns.tprint(`Scenario: Hack 50% then grow back to max`);
      ns.tprint(`  Threads to hack 50%: ${Math.ceil(threadsToSteal50)}`);
      ns.tprint(`  Money after hack: $${ns.formatNumber(moneyAfterHack)}`);
      ns.tprint(`  Security after hack: ${serverAfterHack.hackDifficulty.toFixed(2)}`);
      ns.tprint(`  Threads to grow back to max: ${Math.ceil(threadsToGrowBack)}`);

      // Scenario 2: Weaken calculations
      const securityIncrease = (threadsToSteal50 * 0.002) + (threadsToGrowBack * 0.004);
      const weakenThreadsNeeded = securityIncrease / 0.05; // Each weaken thread reduces by 0.05

      ns.tprint(`\nWeaken calculations:`);
      ns.tprint(`  Total security increase: +${securityIncrease.toFixed(3)}`);
      ns.tprint(`  Weaken threads needed: ${Math.ceil(weakenThreadsNeeded)}`);

    } catch (e) {
      ns.tprint(`Error with practical scenarios: ${e}`);
    }
  }

  ns.tprint("\n" + "=".repeat(80));
  ns.tprint("KEY INSIGHTS:");
  ns.tprint("=".repeat(80));
  ns.tprint("1. Formulas functions use the EXACT server state you provide");
  ns.tprint("2. Existing ns functions use the CURRENT server state from the game");
  ns.tprint("3. This allows formulas to simulate 'what if' scenarios");
  ns.tprint("4. Security level affects hack chance and timing significantly");
  ns.tprint("5. Money available affects grow calculations but not grow percent");
  ns.tprint("6. You can chain operations by updating server state between calls");

  return;
}