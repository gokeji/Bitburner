import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
  // Test printing all the hack grow and weaken stats for n00dles as a test
  const target = "n00dles";

  // Get the current stats

  const hackPercentage = 0.5;
  const cpuCores = 1;

  const serverInfo = ns.getServer(target);
  const securityLevel = serverInfo.hackDifficulty;
  const minSecurityLevel = serverInfo.minDifficulty;
  const currentMoney = serverInfo.moneyAvailable;
  const maxMoney = serverInfo.moneyMax;

  ns.print("\n\n\n\n\n\n")
  ns.print(`${target}`)
  ns.print(`Security Level: ${securityLevel}`)
  ns.print(`Min Security Level: ${minSecurityLevel}`)
  ns.print(`Current Money: ${currentMoney}`)
  ns.print(`Max Money: ${maxMoney}`)

  const hackChance = ns.hackAnalyzeChance(target);
  const hackPercentageFromOneThread = ns.hackAnalyze(target);
  const hackThreads = ns.hackAnalyzeThreads(target, hackPercentage * maxMoney);
  const hackSecurityChange = ns.hackAnalyzeSecurity(hackThreads, target);
  const hackTime = ns.getHackTime(target);

  const growthThreads = ns.growthAnalyze(target, 1 / hackPercentage, cpuCores);
  const growthSecurityChange = ns.growthAnalyzeSecurity(growthThreads, target, cpuCores)
  const growthTime = ns.getGrowTime(target)
  const growthFactor = ns.getServerGrowth(target)

  const weakenAmount = ns.weakenAnalyze(1, cpuCores);
  const weakenTime = ns.getWeakenTime(target);

  ns.print(`Hack Chance: ${hackChance}`)
  ns.print(`Hack Percentage From One Thread: ${hackPercentageFromOneThread}`)
  ns.print(`Hack Amount: ${hackPercentage * maxMoney}`)
  ns.print(`Hack Threads: ${hackThreads}`)
  ns.print(`Hack Security Change: ${hackSecurityChange}`)
  ns.print(`Hack Time: ${hackTime}ms`)

  ns.print(`Growth Threads: ${growthThreads}`)
  ns.print(`Growth Security Change: ${growthSecurityChange}`)
  ns.print(`Growth Time: ${growthTime}ms`)
  ns.print(`Growth Factor: ${growthFactor}`)

  ns.print(`Weaken Amount: ${weakenAmount}`)
  ns.print(`Weaken Time: ${weakenTime}ms`)





  return;
}