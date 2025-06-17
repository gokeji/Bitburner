import { NS } from "@ns";

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

  ns.print("let initialAugments = [");
  ns.print("");

  const factionNames = Object.keys(augmentationsByFaction).sort();

  for (let factionIndex = 0; factionIndex < factionNames.length; factionIndex++) {
    const faction = factionNames[factionIndex];
    const augments = augmentationsByFaction[faction];

    // Add faction comment
    ns.print(`\n    // ${faction}`);

    // Add augmentations for this faction
    for (let i = 0; i < augments.length; i++) {
      const aug = augments[i];
      const prereqsStr = aug.prereqs.length > 0 ? `[${aug.prereqs.map(p => `'${p}'`).join(', ')}]` : '[]';
      const isLastAugmentInFaction = i === augments.length - 1;
      const isLastFaction = factionIndex === factionNames.length - 1;
      const comma = (isLastAugmentInFaction && isLastFaction) ? '' : ',';

      ns.print(`    { name: '${aug.name}', cost: ${aug.cost.toFixed(3)}, faction: '${aug.faction}', prereqs: ${prereqsStr}, hackingBoost: ${aug.hackingBoost}, repBoost: ${aug.repBoost} }${comma}`);
    }
  }

  ns.print("");
  ns.print("];");

  ns.print(`Total augmentations: ${affordableAugmentations.length}`);
  ns.print(`Unique augmentations: ${new Set(affordableAugmentations.map(aug => aug.name)).size}`);
  ns.print(`Total hacking augments: ${affordableAugmentations.filter(aug => aug.hackingBoost).length}`);
  ns.print(`Total cost: $${affordableAugmentations.reduce((sum, aug) => sum + aug.cost, 0).toFixed(3)}`);

}