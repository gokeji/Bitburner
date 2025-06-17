import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
  // const hackingMultiplier = ns.getPlayer().
  // const hackingMultiplier = ns.singularity.getHackingLevelMultiplier();
  // const hackingLevel = Math.floor(14.14 * (32 * Math.log(100000000000 + 534.6) - 200))

  const targetLevel = parseInt(ns.args[0]);

  // Validate the argument
  if (!targetLevel || isNaN(targetLevel) || targetLevel <= 0) {
    ns.tprint("Usage: run playground.js <target_level>");
    ns.tprint("Example: run playground.js 100");
    return;
  }

  // Example usage
  calculateHackingExpNeeded(ns, targetLevel);
}

/**
 * Calculate EXP needed for target hacking level and show multiplier vs current EXP
 * @param {NS} ns
 * @param {number} targetLevel - The target hacking level you want to reach
 */
function calculateHackingExpNeeded(ns, targetLevel) {
  const player = ns.getPlayer();
  const currentLevel = player.skills.hacking;
  const currentExp = player.exp.hacking;
  const hackingMult = player.mults.hacking;

  // Correct formula from the game's source code:
  // calculateExp(skill: number, mult = 1): Math.exp((skill / mult + 200) / 32) - 534.6
  const targetExp = Math.exp((targetLevel / hackingMult + 200) / 32) - 534.6;

  const expNeeded = targetExp - currentExp;
  const expMultiplier = targetExp / currentExp;

  ns.tprint(`=== Hacking Level Analysis ===`);
  ns.tprint(`Current Level: ${currentLevel}`);
  ns.tprint(`Current EXP: ${ns.formatNumber(currentExp)}`);
  ns.tprint(`Hacking Mult: ${ns.formatNumber(hackingMult)}`);
  ns.tprint(`========================================`);

  ns.tprint(`Target Level: ${targetLevel}`);
  ns.tprint(`Target EXP Required: ${ns.formatNumber(targetExp)}`);
  ns.tprint(`EXP Still Needed: ${ns.formatNumber(expNeeded)}`);
  ns.tprint(`Target EXP is ${ns.formatNumber(expMultiplier)}x your current EXP`);

  if (expNeeded <= 0) {
    ns.tprint(`You've already reached or exceeded level ${targetLevel}!`);
  }
}