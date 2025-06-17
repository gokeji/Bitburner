import { NS } from "@ns";
import { optimizeAugmentPurchases } from "./augment-calc.js";
import { calculatePortfolioValue } from "./stock_market.js";

/** @param {NS} ns **/
export async function main(ns) {
  // const hackingMultiplier = ns.getPlayer().
  // const hackingMultiplier = ns.singularity.getHackingLevelMultiplier();
  // const hackingLevel = Math.floor(14.14 * (32 * Math.log(100000000000 + 534.6) - 200))

  const shouldPurchase = ns.args.includes("--buy");

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

  const currentNeuroFluxGovernorPrice = ns.singularity.getAugmentationPrice("NeuroFlux Governor");
  const neuroFluxGovernorBasePrice = ns.singularity.getAugmentationBasePrice("NeuroFlux Governor");

  // How many exponents of 1.14 do we need to get to the current price? the exponent is the level
  const currentNeuroFluxGovernorLevel = 1 + Math.log(currentNeuroFluxGovernorPrice / neuroFluxGovernorBasePrice) / Math.log(1.14);
  ns.print(`Current NeuroFlux Governor Level: ${currentNeuroFluxGovernorLevel}`);

  const ownedAndPurchasedAugmentations = ns.singularity.getOwnedAugmentations(true);
  const availableAugmentations = Array.from(allAugmentations).filter(augmentation => !ownedAndPurchasedAugmentations.includes(augmentation)).concat("NeuroFlux Governor");

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
    name: aug.name === "NeuroFlux Governor" ? `NeuroFlux Governor - Level ${currentNeuroFluxGovernorLevel}` : aug.name,
    cost: aug.cost, // Already in millions
    faction: aug.faction,
    prereqs: aug.prereqs,
    hackingBoost: aug.hackingBoost,
    repBoost: aug.repBoost,
    available: true
  }));

  // ns.print(JSON.stringify(augmentsForOptimizer, null, 2));
  // return;

  // Calculate total available budget including cash and stock portfolio
  const currentCash = player.money;
  const portfolio = calculatePortfolioValue(ns);
  const totalBudget = currentCash + portfolio.totalValue;

  // Optimize the purchase order
  const result = optimizeAugmentPurchases(augmentsForOptimizer, totalBudget);

  // Display the optimal purchase order
  ns.print('\n');
  ns.print('=== OPTIMAL AUGMENTATION PURCHASE ORDER ===');
  ns.print(`Cost multiplier per purchase: 1.9x`);
  ns.print('Legend: 🧠 = Improves hacking, 📈 = Improves reputation');
  ns.print('\n');

  for (let i = 0; i < result.purchaseOrder.length; i++) {
    const aug = result.purchaseOrder[i];
    const hackingMark = aug.hackingBoost ? ' 🧠' : '';
    const repMark = aug.repBoost ? ' 📈' : '';
    const prereqInfo = aug.prereqs.length > 0 ? `\n      - Requires: ${aug.prereqs.join(', ')}` : '';
    ns.print(`${i+1}. [${aug.faction}] $${ns.formatNumber(aug.currentCost * 1000000)} [Base: $${ns.formatNumber(aug.cost * 1000000)}] - ${aug.name}${hackingMark}${repMark}${prereqInfo}`);
  }

  // Display unpurchased augments if any exist
  if (result.unpurchasedAugments && result.unpurchasedAugments.length > 0) {
    ns.print('');
    ns.print('=== AUGMENTS NOT PURCHASED (INSUFFICIENT BUDGET) ===');
    for (let i = 0; i < result.unpurchasedAugments.length; i++) {
      const aug = result.unpurchasedAugments[i];
      const hackingMark = aug.hackingBoost ? ' 🧠' : '';
      const repMark = aug.repBoost ? ' 📈' : '';
      const prereqInfo = aug.prereqs.length > 0 ? `\n      - Requires: ${aug.prereqs.join(', ')}` : '';
      ns.print(`${i+1}. [${aug.faction}] $${ns.formatNumber(aug.currentCost * 1000000)} [Base: $${ns.formatNumber(aug.cost * 1000000)}] - ${aug.name}${hackingMark}${repMark}${prereqInfo}`);
    }
  }

  ns.print('\n');
  ns.print('=== BUDGET SUMMARY ===');
  ns.print(`Current cash: $${ns.formatNumber(currentCash)}`);
  if (portfolio.hasPositions) {
    ns.print(`Stock portfolio value: $${ns.formatNumber(portfolio.totalValue)}`);
    ns.print(`Stock portfolio P&L: ${portfolio.totalProfit >= 0 ? '+' : ''}$${ns.formatNumber(portfolio.totalProfit)}`);
  } else {
    ns.print(`Stock portfolio value: $0 (no positions)`);
  }
  ns.print(`Total available budget: $${ns.formatNumber(totalBudget)}`);
  ns.print('\n');
  ns.print('=== PURCHASE SUMMARY ===');
  ns.print(`Total augments to purchase: ${result.purchaseOrder.length}`);
  if (result.unpurchasedAugments && result.unpurchasedAugments.length > 0) {
    ns.print(`Augments not purchased due to budget: ${result.unpurchasedAugments.length}`);
  }
  ns.print(`Total cost: $${ns.formatNumber(result.totalCost * 1000000)}`);
  ns.print(`Remaining budget: $${ns.formatNumber(totalBudget - (result.totalCost * 1000000))}`);

  ns.print('\n');
  ns.print(`Total cost of all augments: $${ns.formatNumber(result.totalCostOfAll * 1000000)}`);
  if (result.nextUnaffordableItem) {
    ns.print(`Next unaffordable item: ${result.nextUnaffordableItem.name} - $${ns.formatNumber(result.nextUnaffordableItem.currentCost * 1000000)}`);
    ns.print(`Total budget needed for next item: $${ns.formatNumber(result.nextUnaffordableItem.totalCostToAfford * 1000000)}`);
  }
  ns.print('\n');
  ns.print(`Hacking augments: ${result.purchaseOrder.filter(aug => aug.hackingBoost).length}`);
  ns.print(`Reputation augments: ${result.purchaseOrder.filter(aug => aug.repBoost).length}`);

  if (shouldPurchase) {
    ns.ui.openTail();
    ns.print("\n")
    ns.print("=== Liquidating Stocks ===")
    await ns.exec("./liquidate.js", "home");
    await ns.sleep(100);
    ns.print('\n');
    ns.print('=== PURCHASING AUGMENTS ===');
    ns.print(`Purchasing ${result.purchaseOrder.length} augments`);
    for (const aug of result.purchaseOrder) {
      const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
      if (success) {
        ns.print(`Purchased ${aug.name} from ${aug.faction} for $${ns.formatNumber(ns.singularity.getAugmentationPrice(aug.name))}`);
      } else {
        ns.print(`Failed to purchase ${aug.name} from ${aug.faction}`);
      }
    }
  }
}

// Allowable values: "NeuroFlux Governor", "Augmented Targeting I", "Augmented Targeting II", "Augmented Targeting III", "Synthetic Heart", "Synfibril Muscle", "Combat Rib I", "Combat Rib II", "Combat Rib III", "Nanofiber Weave", "NEMEAN Subdermal Weave", "Wired Reflexes", "Graphene Bone Lacings", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Speech Processor Implant", "TITN-41 Gene-Modification Injection", "Enhanced Social Interaction Implant", "BitWire", "Artificial Bio-neural Network Implant", "Artificial Synaptic Potentiation", "Enhanced Myelin Sheathing", "Synaptic Enhancement Implant", "Neural-Retention Enhancement", "DataJack", "Embedded Netburner Module", "Embedded Netburner Module Core Implant", "Embedded Netburner Module Core V2 Upgrade", "Embedded Netburner Module Core V3 Upgrade", "Embedded Netburner Module Analyze Engine", "Embedded Netburner Module Direct Memory Access Upgrade", "Neuralstimulator", "Neural Accelerator", "Cranial Signal Processors - Gen I", "Cranial Signal Processors - Gen II", "Cranial Signal Processors - Gen III", "Cranial Signal Processors - Gen IV", "Cranial Signal Processors - Gen V", "Neuronal Densification", "Neuroreceptor Management Implant", "Nuoptimal Nootropic Injector Implant", "Speech Enhancement", "FocusWire", "PC Direct-Neural Interface", "PC Direct-Neural Interface Optimization Submodule", "PC Direct-Neural Interface NeuroNet Injector", "PCMatrix", "ADR-V1 Pheromone Gene", "ADR-V2 Pheromone Gene", "The Shadow's Simulacrum", "Hacknet Node CPU Architecture Neural-Upload", "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload", "Hacknet Node Kernel Direct-Neural Interface", "Hacknet Node Core Direct-Neural Interface", "Neurotrainer I", "Neurotrainer II", "Neurotrainer III", "HyperSight Corneal Implant", "LuminCloaking-V1 Skin Implant", "LuminCloaking-V2 Skin Implant", "HemoRecirculator", "SmartSonar Implant", "Power Recirculation Core", "QLink", "The Red Pill", "SPTN-97 Gene Modification", "ECorp HVMind Implant", "CordiARC Fusion Reactor", "SmartJaw", "Neotra", "Xanipher", "nextSENS Gene Modification", "OmniTek InfoLoad", "Photosynthetic Cells", "BitRunners Neurolink", "The Black Hand", "Unstable Circadian Modulator", "CRTX42-AA Gene Modification", "Neuregen Gene Modification", "CashRoot Starter Kit", "NutriGen Implant", "INFRARET Enhancement", "DermaForce Particle Barrier", "Graphene BrachiBlades Upgrade", "Graphene Bionic Arms Upgrade", "BrachiBlades", "Bionic Arms", "Social Negotiation Assistant (S.N.A)", "violet Congruity Implant", "Hydroflame Left Arm", "BigD's Big ... Brain", "Z.O.Ë.", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2", "GOLEM Serum", "Vangelis Virus", "Vangelis Virus 3.0", "I.N.T.E.R.L.I.N.K.E.D", "Blade's Runners", "BLADE-51b Tesla Armor", "BLADE-51b Tesla Armor: Power Cells Upgrade", "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Unibeam Upgrade", "BLADE-51b Tesla Armor: Omnibeam Upgrade", "BLADE-51b Tesla Armor: IPU Upgrade", "The Blade's Simulacrum", "Stanek's Gift - Genesis", "Stanek's Gift - Awakening", "Stanek's Gift - Serenity", "SoA - Might of Ares", "SoA - Wisdom of Athena", "SoA - Trickery of Hermes", "SoA - Beauty of Aphrodite", "SoA - Chaos of Dionysus", "SoA - Flood of Poseidon", "SoA - Hunt of Artemis", "SoA - Knowledge of Apollo", "SoA - phyzical WKS harmonizer"