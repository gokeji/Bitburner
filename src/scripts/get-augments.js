import { NS } from "@ns";
import { optimizeAugmentPurchases } from "./augment-calc.js";
import { calculatePortfolioValue } from "./stock-market.js";

const argsSchema = [
    ["buy", false], // Set to true to actually purchase the augmentations
    ["hacking-rep-only", false], // Set to true to only show augments that boost hacking or reputation
];

/**
 * Validates NeuroFlux Governor reputation requirements
 * @param {NS} ns - NetScript object
 * @param {Object} player - Player object
 * @param {number} currentNeuroFluxGovernorLevel - Current NeuroFlux level
 * @param {number} neurofluxCount - Number of NeuroFlux to purchase
 * @returns {Object} Validation result with canPurchase, error, bestFaction, and maxRepReq
 */
function validateNeuroFluxReputation(ns, player, currentNeuroFluxGovernorLevel, neurofluxCount) {
    if (neurofluxCount <= 0) {
        return { canPurchase: true, error: "", bestFaction: null, maxRepReq: 0 };
    }

    const baseNeuroFluxRepReq = ns.singularity.getAugmentationRepReq("NeuroFlux Governor");
    const finalNeuroFluxLevel = currentNeuroFluxGovernorLevel + neurofluxCount - 1;
    const maxNeuroFluxRepReq = baseNeuroFluxRepReq * 1.14 ** (finalNeuroFluxLevel - currentNeuroFluxGovernorLevel);

    const neuroFluxFactions = ns.singularity.getAugmentationFactions("NeuroFlux Governor");
    let maxFactionRep = 0;
    let bestNeuroFluxFaction = null;

    for (const faction of neuroFluxFactions) {
        if (player.factions.includes(faction)) {
            const factionRep = ns.singularity.getFactionRep(faction);
            if (factionRep > maxFactionRep) {
                maxFactionRep = factionRep;
                bestNeuroFluxFaction = faction;
            }
        }
    }

    const canPurchase = maxFactionRep >= maxNeuroFluxRepReq;
    const error = canPurchase
        ? ""
        : `Insufficient reputation for final NeuroFlux Governor (Level ${finalNeuroFluxLevel}). Required: ${ns.formatNumber(maxNeuroFluxRepReq)}, Available: ${ns.formatNumber(maxFactionRep)} from ${bestNeuroFluxFaction || "no faction"}`;

    return {
        canPurchase,
        error,
        bestFaction: bestNeuroFluxFaction,
        maxRepReq: maxNeuroFluxRepReq,
        maxAvailableRep: maxFactionRep,
        finalLevel: finalNeuroFluxLevel,
    };
}

/**
 * Displays NeuroFlux reputation warning or success message
 * @param {NS} ns - NetScript object
 * @param {Object} validation - Validation result from validateNeuroFluxReputation
 * @param {boolean} isPurchasing - Whether the user is attempting to purchase
 */
function displayNeuroFluxStatus(ns, validation, isPurchasing) {
    if (validation.maxRepReq === 0) return; // No NeuroFlux to purchase

    if (!validation.canPurchase) {
        ns.print(
            `\n❌ NeuroFlux Governor Level ${validation.finalLevel}: Need ${ns.formatNumber(validation.maxRepReq)} rep, have ${ns.formatNumber(validation.maxAvailableRep)} (${validation.bestFaction || "no faction"})`,
        );
        if (isPurchasing) {
            ns.print("=== PURCHASE ABORTED ===");
            ns.print("Purchase cancelled to prevent reputation shortage for NeuroFlux Governor upgrades.");
        } else {
            ns.print("⚠️  Use --buy with caution - NeuroFlux purchases may fail due to insufficient reputation.");
        }
    } else {
        ns.print(
            `\n✅ NeuroFlux Governor Level ${validation.finalLevel}: Rep sufficient (${ns.formatNumber(validation.maxAvailableRep)} from ${validation.bestFaction})`,
        );
    }
}

export function autocomplete(data, args) {
    data.flags(argsSchema);
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    // const hackingMultiplier = ns.getPlayer().
    // const hackingMultiplier = ns.singularity.getHackingLevelMultiplier();
    // const hackingLevel = Math.floor(14.14 * (32 * Math.log(100000000000 + 534.6) - 200))

    const flags = ns.flags(argsSchema);
    const shouldPurchase = flags.buy;
    const hackingRepOnly = flags["hacking-rep-only"];

    ns.ui.openTail(); // Open tail because there's a lot of good output
    ns.ui.resizeTail(800, 600);

    ns.print("\n\n\n\n\n\n\n\n\n");

    const player = ns.getPlayer();
    const factions = player.factions;
    let allAugmentations = new Set();

    for (const faction of factions) {
        const factionAugmentations = ns.singularity.getAugmentationsFromFaction(faction);

        factionAugmentations.forEach((augmentation) => {
            allAugmentations.add(augmentation);
        });

        factionAugmentations.push({
            faction,
            augmentations: factionAugmentations,
        });
    }

    const currentlyPurchasedAugments =
        ns.singularity.getOwnedAugmentations(true).length - ns.singularity.getOwnedAugmentations(false).length;
    const priceMultiplier = 1.9 ** currentlyPurchasedAugments;
    const currentNeuroFluxGovernorPrice = ns.singularity.getAugmentationPrice("NeuroFlux Governor") / priceMultiplier;
    const neuroFluxGovernorBasePrice = ns.singularity.getAugmentationBasePrice("NeuroFlux Governor");

    // How many exponents of 1.14 do we need to get to the current price? the exponent is the level
    const currentNeuroFluxGovernorLevel = Math.round(
        1 + Math.log(currentNeuroFluxGovernorPrice / neuroFluxGovernorBasePrice) / Math.log(1.14),
    );
    ns.print(`Current NeuroFlux Governor Level: ${currentNeuroFluxGovernorLevel}`);

    const ownedAndPurchasedAugmentations = ns.singularity.getOwnedAugmentations(true);
    const availableAugmentations = Array.from(allAugmentations)
        .filter((augmentation) => !ownedAndPurchasedAugmentations.includes(augmentation))
        .concat("NeuroFlux Governor");

    // Helper function to check if an augmentation has hacking boost
    function hasHackingBoost(stats) {
        return (
            stats.hacking > 1 ||
            stats.hacking_chance > 1 ||
            stats.hacking_speed > 1 ||
            stats.hacking_money > 1 ||
            stats.hacking_grow > 1 ||
            stats.hacking_exp > 1
        );
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
                        const hackingBoost = hasHackingBoost(stats);
                        const repBoost = hasRepBoost(stats);

                        // If --hacking-rep-only flag is set, skip augments that don't boost hacking or rep
                        // Exception: Always include NeuroFlux Governor as it provides hacking boost
                        if (hackingRepOnly && !hackingBoost && !repBoost && augmentation !== "NeuroFlux Governor") {
                            continue;
                        }

                        affordableAugmentations.push({
                            name: augmentation,
                            cost: price / 1000000, // Convert to millions for easier reading
                            faction: faction,
                            prereqs: prereqs,
                            hackingBoost: hackingBoost,
                            repBoost: repBoost,
                            repReq: repReq,
                            stats: stats,
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
    affordableAugmentations.forEach((aug) => {
        if (!augmentationsByFaction[aug.faction]) {
            augmentationsByFaction[aug.faction] = [];
        }
        augmentationsByFaction[aug.faction].push(aug);
    });

    // Convert to format expected by optimizeAugmentPurchases
    const augmentsForOptimizer = affordableAugmentations.map((aug) => ({
        name:
            aug.name === "NeuroFlux Governor"
                ? `NeuroFlux Governor - Level ${currentNeuroFluxGovernorLevel}`
                : aug.name,
        cost: aug.cost, // Already in millions
        faction: aug.faction,
        prereqs: aug.prereqs,
        hackingBoost: aug.hackingBoost,
        repBoost: aug.repBoost,
        available: true,
    }));

    // Calculate total available budget including cash and stock portfolio
    const currentCash = player.money;
    const portfolio = calculatePortfolioValue(ns);
    const totalBudget = currentCash + portfolio.totalValue;

    // Optimize the purchase order
    const result = optimizeAugmentPurchases(augmentsForOptimizer, totalBudget);

    // Display the optimal purchase order
    ns.print("\n");
    ns.print("=== OPTIMAL AUGMENTATION PURCHASE ORDER ===");
    ns.print(`Cost multiplier per purchase: 1.9x`);
    ns.print("Legend: 🧠 = Improves hacking, 📈 = Improves reputation");
    if (hackingRepOnly) {
        ns.print("INFO Filter: Only showing hacking/reputation augments");
    }
    ns.print("\n");

    for (let i = 0; i < result.purchaseOrder.length; i++) {
        const aug = result.purchaseOrder[i];
        const hackingMark = aug.hackingBoost ? " 🧠" : "";
        const repMark = aug.repBoost ? " 📈" : "";
        const prereqInfo = aug.prereqs.length > 0 ? `\n      - Requires: ${aug.prereqs.join(", ")}` : "";
        ns.print(
            `${i + 1}. [${aug.faction}] $${ns.formatNumber(aug.currentCost * 1000000)} [Base: $${ns.formatNumber(aug.cost * 1000000)}] - ${aug.name}${hackingMark}${repMark}${prereqInfo}`,
        );
    }

    // Display unpurchased augments if any exist
    if (result.unpurchasedAugments && result.unpurchasedAugments.length > 0) {
        ns.print("");
        ns.print("=== AUGMENTS NOT PURCHASED (INSUFFICIENT BUDGET) ===");
        for (let i = 0; i < result.unpurchasedAugments.length; i++) {
            const aug = result.unpurchasedAugments[i];
            const hackingMark = aug.hackingBoost ? " 🧠" : "";
            const repMark = aug.repBoost ? " 📈" : "";
            const prereqInfo = aug.prereqs.length > 0 ? `\n      - Requires: ${aug.prereqs.join(", ")}` : "";
            ns.print(
                `${i + 1}. [${aug.faction}] $${ns.formatNumber(aug.currentCost * 1000000)} [Base: $${ns.formatNumber(aug.cost * 1000000)}] - ${aug.name}${hackingMark}${repMark}${prereqInfo}`,
            );
        }
    }

    ns.print("\n");
    ns.print("=== BUDGET SUMMARY ===");
    ns.print(`Current cash: $${ns.formatNumber(currentCash)}`);
    if (portfolio.hasPositions) {
        ns.print(`Stock portfolio value: $${ns.formatNumber(portfolio.totalValue)}`);
        ns.print(
            `Stock portfolio P&L: ${portfolio.totalProfit >= 0 ? "+" : ""}$${ns.formatNumber(portfolio.totalProfit)}`,
        );
    } else {
        ns.print(`Stock portfolio value: $0 (no positions)`);
    }
    ns.print(`Total available budget: $${ns.formatNumber(totalBudget)}`);
    ns.print("\n");
    ns.print("=== PURCHASE SUMMARY ===");
    ns.print(`Total augments to purchase: ${result.purchaseOrder.length}`);

    const hackingAugmentsCount = result.purchaseOrder.filter((aug) => aug.hackingBoost).length - result.neurofluxCount;
    const repAugmentsCount = result.purchaseOrder.filter((aug) => aug.repBoost).length - result.neurofluxCount;
    ns.print(`  - NeuroFlux Governors: ${result.neurofluxCount}`);
    ns.print(`  - Hacking augments: ${hackingAugmentsCount}`);
    ns.print(`  - Reputation augments: ${repAugmentsCount}`);
    ns.print(`\n`);

    if (result.unpurchasedAugments && result.unpurchasedAugments.length > 0) {
        ns.print(`Augments not purchased due to budget: ${result.unpurchasedAugments.length}`);
    }
    ns.print(`Total cost: $${ns.formatNumber(result.totalCost * 1000000)}`);
    ns.print(`Remaining budget: $${ns.formatNumber(totalBudget - result.totalCost * 1000000)}`);

    ns.print("\n");
    ns.print(`Total cost of all augments: $${ns.formatNumber(result.totalCostOfAll * 1000000)}`);
    if (result.nextUnaffordableItem) {
        ns.print(
            `Next unaffordable item: ${result.nextUnaffordableItem.name} - $${ns.formatNumber(result.nextUnaffordableItem.currentCost * 1000000)}`,
        );
        ns.print(
            `Total budget needed for next item: $${ns.formatNumber(result.nextUnaffordableItem.totalCostToAfford * 1000000)}`,
        );
    }

    // === NEUROFLUX GOVERNOR REPUTATION VALIDATION ===
    const neuroFluxValidation = validateNeuroFluxReputation(
        ns,
        player,
        currentNeuroFluxGovernorLevel,
        result.neurofluxCount,
    );
    displayNeuroFluxStatus(ns, neuroFluxValidation, shouldPurchase);

    if (shouldPurchase) {
        // Check if we should proceed with purchase
        if (!neuroFluxValidation.canPurchase && result.neurofluxCount > 0) {
            return;
        }

        ns.print("\n");
        ns.print("=== Liquidating Stocks ===");
        await ns.exec("./liquidate.js", "home");
        await ns.sleep(100);
        ns.print("\n");
        ns.print("=== PURCHASING AUGMENTS ===");
        ns.print(`Purchasing ${result.purchaseOrder.length} augments`);
        for (let i = 0; i < result.purchaseOrder.length; i++) {
            const aug = result.purchaseOrder[i];

            // Parse out the base augmentation name (remove level info for NeuroFlux Governor)
            let augmentationName = aug.name;
            let factionToUse = aug.faction;

            if (aug.name.startsWith("NeuroFlux Governor - Level")) {
                augmentationName = "NeuroFlux Governor";
                // Use the faction with the highest reputation for NeuroFlux Governor
                if (neuroFluxValidation.bestFaction) {
                    factionToUse = neuroFluxValidation.bestFaction;
                }
            }

            const success = ns.singularity.purchaseAugmentation(factionToUse, augmentationName);
            if (success) {
                ns.print(
                    `${i + 1}. Purchased ${augmentationName} from ${factionToUse} for $${ns.formatNumber(ns.singularity.getAugmentationPrice(augmentationName))}`,
                );
            } else {
                ns.print(`Failed to purchase ${augmentationName} from ${factionToUse}`);
            }
        }
    }
}

// Allowable values: "NeuroFlux Governor", "Augmented Targeting I", "Augmented Targeting II", "Augmented Targeting III", "Synthetic Heart", "Synfibril Muscle", "Combat Rib I", "Combat Rib II", "Combat Rib III", "Nanofiber Weave", "NEMEAN Subdermal Weave", "Wired Reflexes", "Graphene Bone Lacings", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Speech Processor Implant", "TITN-41 Gene-Modification Injection", "Enhanced Social Interaction Implant", "BitWire", "Artificial Bio-neural Network Implant", "Artificial Synaptic Potentiation", "Enhanced Myelin Sheathing", "Synaptic Enhancement Implant", "Neural-Retention Enhancement", "DataJack", "Embedded Netburner Module", "Embedded Netburner Module Core Implant", "Embedded Netburner Module Core V2 Upgrade", "Embedded Netburner Module Core V3 Upgrade", "Embedded Netburner Module Analyze Engine", "Embedded Netburner Module Direct Memory Access Upgrade", "Neuralstimulator", "Neural Accelerator", "Cranial Signal Processors - Gen I", "Cranial Signal Processors - Gen II", "Cranial Signal Processors - Gen III", "Cranial Signal Processors - Gen IV", "Cranial Signal Processors - Gen V", "Neuronal Densification", "Neuroreceptor Management Implant", "Nuoptimal Nootropic Injector Implant", "Speech Enhancement", "FocusWire", "PC Direct-Neural Interface", "PC Direct-Neural Interface Optimization Submodule", "PC Direct-Neural Interface NeuroNet Injector", "PCMatrix", "ADR-V1 Pheromone Gene", "ADR-V2 Pheromone Gene", "The Shadow's Simulacrum", "Hacknet Node CPU Architecture Neural-Upload", "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload", "Hacknet Node Kernel Direct-Neural Interface", "Hacknet Node Core Direct-Neural Interface", "Neurotrainer I", "Neurotrainer II", "Neurotrainer III", "HyperSight Corneal Implant", "LuminCloaking-V1 Skin Implant", "LuminCloaking-V2 Skin Implant", "HemoRecirculator", "SmartSonar Implant", "Power Recirculation Core", "QLink", "The Red Pill", "SPTN-97 Gene Modification", "ECorp HVMind Implant", "CordiARC Fusion Reactor", "SmartJaw", "Neotra", "Xanipher", "nextSENS Gene Modification", "OmniTek InfoLoad", "Photosynthetic Cells", "BitRunners Neurolink", "The Black Hand", "Unstable Circadian Modulator", "CRTX42-AA Gene Modification", "Neuregen Gene Modification", "CashRoot Starter Kit", "NutriGen Implant", "INFRARET Enhancement", "DermaForce Particle Barrier", "Graphene BrachiBlades Upgrade", "Graphene Bionic Arms Upgrade", "BrachiBlades", "Bionic Arms", "Social Negotiation Assistant (S.N.A)", "violet Congruity Implant", "Hydroflame Left Arm", "BigD's Big ... Brain", "Z.O.Ë.", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2", "GOLEM Serum", "Vangelis Virus", "Vangelis Virus 3.0", "I.N.T.E.R.L.I.N.K.E.D", "Blade's Runners", "BLADE-51b Tesla Armor", "BLADE-51b Tesla Armor: Power Cells Upgrade", "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Unibeam Upgrade", "BLADE-51b Tesla Armor: Omnibeam Upgrade", "BLADE-51b Tesla Armor: IPU Upgrade", "The Blade's Simulacrum", "Stanek's Gift - Genesis", "Stanek's Gift - Awakening", "Stanek's Gift - Serenity", "SoA - Might of Ares", "SoA - Wisdom of Athena", "SoA - Trickery of Hermes", "SoA - Beauty of Aphrodite", "SoA - Chaos of Dionysus", "SoA - Flood of Poseidon", "SoA - Hunt of Artemis", "SoA - Knowledge of Apollo", "SoA - phyzical WKS harmonizer"
