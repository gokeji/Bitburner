import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
  // const hackingMultiplier = ns.getPlayer().
  // const hackingMultiplier = ns.singularity.getHackingLevelMultiplier();
  // const hackingLevel = Math.floor(14.14 * (32 * Math.log(100000000000 + 534.6) - 200))

  ns.print("\n\n\n\n\n\n\n\n\n")

  ns.print(ns.singularity.getOwnedAugmentations());

  const player = ns.getPlayer();
  const factions = player.factions;
  let factionAugmentations = [];
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
              available: true,
              prereqs: prereqs,
              hackingBoost: hasHackingBoost(stats),
              repReq: repReq,
              stats: stats
            });
          }
        }
      }
    }
  }

  // Sort by price (cheapest first), then by faction name for consistency
  affordableAugmentations.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.faction.localeCompare(b.faction);
  });

  ns.print("\n=== AFFORDABLE AUGMENTATIONS (by faction) ===");
  ns.print(`Found ${affordableAugmentations.length} affordable augmentation-faction combinations:`);

  for (const aug of affordableAugmentations) {
    const hackingMark = aug.hackingBoost ? ' 🧠' : '';
    const prereqInfo = aug.prereqs.length > 0 ? `, prereqs: [${aug.prereqs.map(p => `'${p}'`).join(', ')}]` : ', prereqs: []';

    ns.print(`{ name: '${aug.name}', cost: ${aug.cost.toFixed(3)}, faction: '${aug.faction}', available: true${prereqInfo}, hackingBoost: ${aug.hackingBoost} }${hackingMark}`);
  }

  ns.print("\n=== DETAILED VIEW ===");
  for (const aug of affordableAugmentations) {
    const hackingMark = aug.hackingBoost ? ' 🧠' : '';
    ns.print(`\n${aug.name}${hackingMark} [${aug.faction}]:`);
    ns.print(`  Price: $${ns.formatNumber(aug.cost * 1000000)} (${aug.cost.toFixed(3)}M)`);
    ns.print(`  Rep Required: ${ns.formatNumber(aug.repReq)}`);
    ns.print(`  Available from: ${aug.faction}`);
    if (aug.prereqs.length > 0) {
      ns.print(`  Prerequisites: ${aug.prereqs.join(', ')}`);
    }

    // Show hacking-related stats if it's a hacking boost augmentation
    if (aug.hackingBoost) {
      ns.print(`  Hacking Stats:`);
      if (aug.stats.hacking > 1) ns.print(`    Hacking Level: +${((aug.stats.hacking - 1) * 100).toFixed(1)}%`);
      if (aug.stats.hacking_chance > 1) ns.print(`    Hacking Chance: +${((aug.stats.hacking_chance - 1) * 100).toFixed(1)}%`);
      if (aug.stats.hacking_speed > 1) ns.print(`    Hacking Speed: +${((aug.stats.hacking_speed - 1) * 100).toFixed(1)}%`);
      if (aug.stats.hacking_money > 1) ns.print(`    Hacking Money: +${((aug.stats.hacking_money - 1) * 100).toFixed(1)}%`);
      if (aug.stats.hacking_grow > 1) ns.print(`    Hacking Grow: +${((aug.stats.hacking_grow - 1) * 100).toFixed(1)}%`);
      if (aug.stats.hacking_exp > 1) ns.print(`    Hacking Exp: +${((aug.stats.hacking_exp - 1) * 100).toFixed(1)}%`);
    }
  }

  // Also show current player stats for reference
  ns.print("\n=== PLAYER STATUS ===");
  ns.print(`Money: $${ns.formatNumber(player.money)}`);
  ns.print(`Factions: ${player.factions.join(', ')}`);

  ns.print("\n=== FACTION REPUTATION ===");
  for (const faction of player.factions) {
    const rep = ns.singularity.getFactionRep(faction);
    ns.print(`${faction}: ${ns.formatNumber(rep)}`);
  }

  // Summary statistics
  const hackingAugments = affordableAugmentations.filter(aug => aug.hackingBoost);
  const uniqueAugments = new Set(affordableAugmentations.map(aug => aug.name));
  ns.print("\n=== SUMMARY ===");
  ns.print(`Total affordable augmentation-faction combinations: ${affordableAugmentations.length}`);
  ns.print(`Unique augmentations: ${uniqueAugments.size}`);
  ns.print(`Hacking augment combinations: ${hackingAugments.length}`);
  ns.print(`Total cost: $${ns.formatNumber(affordableAugmentations.reduce((sum, aug) => sum + (aug.cost * 1000000), 0))}`);

  // JSON OUTPUT for augment-calc.js
  ns.print("\n=== JSON OUTPUT FOR AUGMENT-CALC.JS ===");
  ns.print("Copy and paste this to replace the initialAugments array in augment-calc.js:");
  ns.print("");

  const jsonOutput = affordableAugmentations.map(aug => {
    const prereqsStr = aug.prereqs.length > 0 ? `[${aug.prereqs.map(p => `'${p}'`).join(', ')}]` : '[]';
    return `    { name: '${aug.name}', cost: ${aug.cost.toFixed(3)}, faction: '${aug.faction}', available: true, prereqs: ${prereqsStr}, hackingBoost: ${aug.hackingBoost} }`;
  });

  ns.print("let initialAugments = [");
  ns.print("");
  for (let i = 0; i < jsonOutput.length; i++) {
    const comma = i < jsonOutput.length - 1 ? ',' : '';
    ns.print(`${jsonOutput[i]}${comma}`);
  }
  ns.print("");
  ns.print("];");
}