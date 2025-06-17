import { NS } from "@ns";
import { optimizeAugmentPurchases } from "./augment-calc.js";

/** @param {NS} ns **/
export async function main(ns) {
  // const hackingMultiplier = ns.getPlayer().
  // const hackingMultiplier = ns.singularity.getHackingLevelMultiplier();
  // const hackingLevel = Math.floor(14.14 * (32 * Math.log(100000000000 + 534.6) - 200))

  ns.print("\n\n\n\n\n\n\n\n\n")

  const player = ns.getPlayer();
  const factions = player.factions;
  let allAugmentations = new Set();

  for (const faction of factions) {
    const factionAugmentations = ns.singularity.getAugmentationsFromFaction(faction);

    factionAugmentations.forEach(augmentation => {
      allAugmentations.add(augmentation);
    });

    factionAugmentations.push({
      faction,
      augmentations: factionAugmentations
    });
  }

  const ownedAndPurchasedAugmentations = ns.singularity.getOwnedAugmentations(true);
  const availableAugmentations = Array.from(allAugmentations).filter(augmentation => !ownedAndPurchasedAugmentations.includes(augmentation));

  // Helper function to check if an augmentation has hacking boost
  function hasHackingBoost(stats) {
    return stats.hacking > 1 ||
           stats.hacking_chance > 1 ||
           stats.hacking_speed > 1 ||
           stats.hacking_money > 1 ||
           stats.hacking_grow > 1 ||
           stats.hacking_exp > 1;
  }

  // Helper function to check if an augmentation has reputation boost
  function hasRepBoost(stats) {
    return stats.faction_rep > 1;
  }

  // Check which augmentations we can afford (both price and reputation) - separate entry for each qualifying faction
  const affordableAugmentations = [];

  for (const augmentation of availableAugmentations) {
    const price = ns.singularity.getAugmentationPrice(augmentation);
    const repReq = ns.singularity.getAugmentationRepReq(augmentation);
    const augFactions = ns.singularity.getAugmentationFactions(augmentation);
    const stats = ns.singularity.getAugmentationStats(augmentation);
    const prereqs = ns.singularity.getAugmentationPrereq(augmentation);

    // Check if we have enough money
    const canAffordPrice = player.money >= price;

    if (canAffordPrice) {
      // Check each faction separately - create separate entries for each qualifying faction
      for (const faction of augFactions) {
        if (player.factions.includes(faction)) {
          const factionRep = ns.singularity.getFactionRep(faction);
          if (factionRep >= repReq) {
            affordableAugmentations.push({
              name: augmentation,
              cost: price / 1000000, // Convert to millions for easier reading
              faction: faction,
              prereqs: prereqs,
              hackingBoost: hasHackingBoost(stats),
              repBoost: hasRepBoost(stats),
              repReq: repReq,
              stats: stats
            });
          }
        }
      }
    }
  }

  // Sort by faction first, then by price within each faction
  affordableAugmentations.sort((a, b) => {
    if (a.faction !== b.faction) return a.faction.localeCompare(b.faction);
    return a.cost - b.cost;
  });

  // Group augmentations by faction
  const augmentationsByFaction = {};
  affordableAugmentations.forEach(aug => {
    if (!augmentationsByFaction[aug.faction]) {
      augmentationsByFaction[aug.faction] = [];
    }
    augmentationsByFaction[aug.faction].push(aug);
  });

  // Convert to format expected by optimizeAugmentPurchases
  const augmentsForOptimizer = affordableAugmentations.map(aug => ({
    name: aug.name,
    cost: aug.cost, // Already in millions
    faction: aug.faction,
    prereqs: aug.prereqs,
    hackingBoost: aug.hackingBoost,
    repBoost: aug.repBoost,
    available: true
  }));

  // Get player's current money in dollars for budget calculation
  const currentMoney = player.money;

  // Optimize the purchase order
  const result = optimizeAugmentPurchases(augmentsForOptimizer, currentMoney);


  // Display the optimal purchase order
  ns.print('');
  ns.print('=== OPTIMAL AUGMENTATION PURCHASE ORDER ===');
  ns.print(`Cost multiplier per purchase: 1.9x`);
  ns.print('Legend: 🧠 = Improves hacking, 📈 = Improves reputation');
  ns.print('');

  for (let i = 0; i < result.purchaseOrder.length; i++) {
    const aug = result.purchaseOrder[i];
    const hackingMark = aug.hackingBoost ? ' 🧠' : '';
    const repMark = aug.repBoost ? ' 📈' : '';
    const prereqInfo = aug.prereqs.length > 0 ? ` (requires: ${aug.prereqs.join(', ')})` : '';
    ns.print(`${i+1}. ${aug.name}${hackingMark}${repMark} - $${ns.formatNumber(aug.currentCost * 1000000)} [${aug.faction}]${prereqInfo}`);
  }

  ns.print('');
  ns.print('=== SUMMARY ===');
  ns.print(`Total augments to purchase: ${result.purchaseOrder.length}`);
  ns.print(`Total cost: $${ns.formatNumber(result.totalCost * 1000000)}`);
  ns.print(`Current money: $${ns.formatNumber(currentMoney)}`);
  ns.print(`Hacking augments: ${result.purchaseOrder.filter(aug => aug.hackingBoost).length}`);
  ns.print(`Reputation augments: ${result.purchaseOrder.filter(aug => aug.repBoost).length}`);

}