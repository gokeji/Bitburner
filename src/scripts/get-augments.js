import { NS } from "@ns";
import { optimizeAugmentPurchases } from "./augment-calc.js";
import { calculatePortfolioValue } from "./stock-market.js";

const argsSchema = [
    ["buy", false], // Set to true to actually purchase the augmentations
    ["force-buy", false], // Set to true to force purchase the augmentations in order
    ["hacking-rep-only", false], // Set to true to only show augments that boost hacking or reputation
    ["hacking-rep-and-combat", false], // Set to true to only show augments that boost hacking, reputation, and combat
    ["hacking-only", false], // Set to true to only show augments that boost hacking
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
 * @param {boolean} forceBuy - Whether the user is forcing the purchase
 */
function displayNeuroFluxStatus(ns, validation, isPurchasing, forceBuy) {
    if (validation.maxRepReq === 0) return; // No NeuroFlux to purchase

    if (!validation.canPurchase) {
        ns.print(
            `\n❌ NeuroFlux Governor Level ${validation.finalLevel}: Need ${ns.formatNumber(validation.maxRepReq)} rep, have ${ns.formatNumber(validation.maxAvailableRep)} (${validation.bestFaction || "no faction"})`,
        );
        if (isPurchasing && !forceBuy) {
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

function getCurrentNeuroFluxPurchaseLevel(ns) {
    const currentlyPurchasedAugments =
        ns.singularity.getOwnedAugmentations(true).length - ns.singularity.getOwnedAugmentations(false).length;
    const priceMultiplier = 1.9 ** currentlyPurchasedAugments;
    const currentNeuroFluxGovernorPrice = ns.singularity.getAugmentationPrice("NeuroFlux Governor") / priceMultiplier;
    const neuroFluxGovernorBasePrice = ns.singularity.getAugmentationBasePrice("NeuroFlux Governor");
    const currentNeuroFluxLevel = Math.round(
        1 + Math.log(currentNeuroFluxGovernorPrice / neuroFluxGovernorBasePrice) / Math.log(1.14),
    );
    return currentNeuroFluxLevel;
}

/**
 * Calculates total stat increases from a list of augmentations (hacking, combat, and reputation)
 * @param {NS} ns - NetScript object
 * @param {Array} augmentations - Array of augmentation objects with names
 * @returns {Object} Object with all stat multipliers and original values
 */
function calculateTotalStatIncrease(ns, augmentations) {
    let neuroFluxToBuy = 0;
    const player = ns.getPlayer();

    // Start with current player multipliers - Hacking
    let hackingMultiplier = player.mults.hacking;
    let hackingChanceMultiplier = player.mults.hacking_chance;
    let hackingSpeedMultiplier = player.mults.hacking_speed;
    let hackingMoneyMultiplier = player.mults.hacking_money;
    let hackingGrowMultiplier = player.mults.hacking_grow;
    let hackingExpMultiplier = player.mults.hacking_exp;

    // Combat stats
    let strengthMultiplier = player.mults.strength;
    let strengthExpMultiplier = player.mults.strength_exp;
    let defenseMultiplier = player.mults.defense;
    let defenseExpMultiplier = player.mults.defense_exp;
    let dexterityMultiplier = player.mults.dexterity;
    let dexterityExpMultiplier = player.mults.dexterity_exp;
    let agilityMultiplier = player.mults.agility;
    let agilityExpMultiplier = player.mults.agility_exp;

    // Other stats
    let repMultiplier = player.mults.faction_rep;
    let charismaMultiplier = player.mults.charisma;
    let charismaExpMultiplier = player.mults.charisma_exp;

    // Apply each augmentation multiplicatively
    for (const aug of augmentations) {
        let augName = aug.name;

        // Handle NeuroFlux Governor special case
        if (aug.name.startsWith("NeuroFlux Governor - Level")) {
            augName = "NeuroFlux Governor";
            neuroFluxToBuy++;
        }

        const stats = ns.singularity.getAugmentationStats(augName);

        // Multiply each stat by the augmentation's multiplier
        hackingMultiplier *= stats.hacking;
        hackingChanceMultiplier *= stats.hacking_chance;
        hackingSpeedMultiplier *= stats.hacking_speed;
        hackingMoneyMultiplier *= stats.hacking_money;
        hackingGrowMultiplier *= stats.hacking_grow;
        hackingExpMultiplier *= stats.hacking_exp;

        strengthMultiplier *= stats.strength;
        strengthExpMultiplier *= stats.strength_exp;
        defenseMultiplier *= stats.defense;
        defenseExpMultiplier *= stats.defense_exp;
        dexterityMultiplier *= stats.dexterity;
        dexterityExpMultiplier *= stats.dexterity_exp;
        agilityMultiplier *= stats.agility;
        agilityExpMultiplier *= stats.agility_exp;

        repMultiplier *= stats.faction_rep;
        charismaMultiplier *= stats.charisma;
        charismaExpMultiplier *= stats.charisma_exp;
    }

    // Calculate average multipliers
    const averageHackingBoost =
        (hackingMultiplier +
            hackingChanceMultiplier +
            hackingSpeedMultiplier +
            hackingMoneyMultiplier +
            hackingGrowMultiplier +
            hackingExpMultiplier) /
        6;
    const averageCombatBoost = (strengthMultiplier + defenseMultiplier + dexterityMultiplier + agilityMultiplier) / 4;

    // Calculate relative multipliers (final / original)
    const relativeHackingLevelBoost = hackingMultiplier / player.mults.hacking;
    const relativeHackingBoost =
        averageHackingBoost /
        ((player.mults.hacking +
            player.mults.hacking_chance +
            player.mults.hacking_speed +
            player.mults.hacking_money +
            player.mults.hacking_grow +
            player.mults.hacking_exp) /
            6);
    const relativeCombatBoost =
        averageCombatBoost /
        ((player.mults.strength + player.mults.defense + player.mults.dexterity + player.mults.agility) / 4);
    const relativeRepBoost = repMultiplier / player.mults.faction_rep;

    return {
        totalHacking: {
            hackingLevel: hackingMultiplier,
            hackingChance: hackingChanceMultiplier,
            hackingSpeed: hackingSpeedMultiplier,
            hackingMoney: hackingMoneyMultiplier,
            hackingGrow: hackingGrowMultiplier,
            hackingExp: hackingExpMultiplier,
        },
        totalCombat: {
            strength: strengthMultiplier,
            strengthExp: strengthExpMultiplier,
            defense: defenseMultiplier,
            defenseExp: defenseExpMultiplier,
            dexterity: dexterityMultiplier,
            dexterityExp: dexterityExpMultiplier,
            agility: agilityMultiplier,
            agilityExp: agilityExpMultiplier,
        },
        totalOther: {
            rep: repMultiplier,
            charisma: charismaMultiplier,
            charismaExp: charismaExpMultiplier,
        },
        // Average boost calculations
        averageHackingBoost: averageHackingBoost,
        averageCombatBoost: averageCombatBoost,
        // Relative multipliers (how much better compared to original)
        relativeHackingLevelBoost: relativeHackingLevelBoost,
        relativeHackingBoost: relativeHackingBoost,
        relativeCombatBoost: relativeCombatBoost,
        relativeRepBoost: relativeRepBoost,
        neurofluxLevels: neuroFluxToBuy,
        // Store original values for comparison
        originalHacking: {
            hackingLevel: player.mults.hacking,
            hackingChance: player.mults.hacking_chance,
            hackingSpeed: player.mults.hacking_speed,
            hackingMoney: player.mults.hacking_money,
            hackingGrow: player.mults.hacking_grow,
            hackingExp: player.mults.hacking_exp,
        },
        originalCombat: {
            strength: player.mults.strength,
            strengthExp: player.mults.strength_exp,
            defense: player.mults.defense,
            defenseExp: player.mults.defense_exp,
            dexterity: player.mults.dexterity,
            dexterityExp: player.mults.dexterity_exp,
            agility: player.mults.agility,
            agilityExp: player.mults.agility_exp,
        },
        originalOther: {
            rep: player.mults.faction_rep,
            charisma: player.mults.charisma,
            charismaExp: player.mults.charisma_exp,
        },
    };
}

/**
 * Calculates optimization score based on the specified criteria
 * @param {Object} statIncrease - Result from calculateTotalStatIncrease
 * @param {string} optimizeFor - What to optimize for ("hackingLevel", "hackingAndRep", "hackingAndRepAndCombat", "all", )
 * @returns {number} The optimization score
 */
function getOptimizationScore(statIncrease, optimizeFor) {
    if (optimizeFor === "hackingLevel") {
        return statIncrease.relativeHackingLevelBoost;
    } else if (optimizeFor === "hackingAndRep") {
        return statIncrease.relativeHackingLevelBoost * statIncrease.relativeRepBoost;
    } else if (optimizeFor === "hackingAndRepAndCombat") {
        return (
            statIncrease.relativeHackingLevelBoost * statIncrease.relativeRepBoost * statIncrease.relativeCombatBoost
        );
    } else if (optimizeFor === "all") {
        return (
            statIncrease.relativeHackingLevelBoost * statIncrease.relativeCombatBoost * statIncrease.relativeRepBoost
        );
    }
    // Default to hacking + rep for backward compatibility
    return statIncrease.relativeHackingLevelBoost * statIncrease.relativeRepBoost;
}

/**
 * Displays comprehensive stat increases in a formatted way
 * @param {NS} ns - NetScript object
 * @param {Object} statIncrease - Result from calculateTotalStatIncrease
 */
function displayStatIncreases(ns, statIncrease) {
    ns.print("\n");
    ns.print("=== TOTAL STAT INCREASES FROM ALL AUGMENTS ===");

    // Hacking Stats Section
    ns.print("\n🧠 HACKING STATS:");
    const hackingStats = [
        {
            name: "Hacking Level",
            original: statIncrease.originalHacking.hackingLevel,
            final: statIncrease.totalHacking.hackingLevel,
        },
        {
            name: "Hacking Chance",
            original: statIncrease.originalHacking.hackingChance,
            final: statIncrease.totalHacking.hackingChance,
        },
        {
            name: "Hacking Speed",
            original: statIncrease.originalHacking.hackingSpeed,
            final: statIncrease.totalHacking.hackingSpeed,
        },
        {
            name: "Hacking Money",
            original: statIncrease.originalHacking.hackingMoney,
            final: statIncrease.totalHacking.hackingMoney,
        },
        {
            name: "Hacking Grow",
            original: statIncrease.originalHacking.hackingGrow,
            final: statIncrease.totalHacking.hackingGrow,
        },
        {
            name: "Hacking Exp",
            original: statIncrease.originalHacking.hackingExp,
            final: statIncrease.totalHacking.hackingExp,
        },
    ];

    for (const stat of hackingStats) {
        const increase = stat.final / stat.original;
        const percentIncrease = (increase - 1) * 100;
        ns.print(
            `  ${stat.name.padEnd(14)}: ${ns.formatPercent(stat.original)} -> ${ns.formatPercent(stat.final)} (+${percentIncrease.toFixed(1)}%, ${increase.toFixed(2)}X)`,
        );
    }

    // Combat Stats Section
    ns.print("\n💪 COMBAT STATS:");
    const combatStats = [
        { name: "Strength", original: statIncrease.originalCombat.strength, final: statIncrease.totalCombat.strength },
        {
            name: "Strength Exp",
            original: statIncrease.originalCombat.strengthExp,
            final: statIncrease.totalCombat.strengthExp,
        },
        { name: "Defense", original: statIncrease.originalCombat.defense, final: statIncrease.totalCombat.defense },
        {
            name: "Defense Exp",
            original: statIncrease.originalCombat.defenseExp,
            final: statIncrease.totalCombat.defenseExp,
        },
        {
            name: "Dexterity",
            original: statIncrease.originalCombat.dexterity,
            final: statIncrease.totalCombat.dexterity,
        },
        {
            name: "Dexterity Exp",
            original: statIncrease.originalCombat.dexterityExp,
            final: statIncrease.totalCombat.dexterityExp,
        },
        { name: "Agility", original: statIncrease.originalCombat.agility, final: statIncrease.totalCombat.agility },
        {
            name: "Agility Exp",
            original: statIncrease.originalCombat.agilityExp,
            final: statIncrease.totalCombat.agilityExp,
        },
    ];

    for (const stat of combatStats) {
        const increase = stat.final / stat.original;
        const percentIncrease = (increase - 1) * 100;
        ns.print(
            `  ${stat.name.padEnd(14)}: ${ns.formatPercent(stat.original)} -> ${ns.formatPercent(stat.final)} (+${percentIncrease.toFixed(1)}%, ${increase.toFixed(2)}X)`,
        );
    }

    // Other Stats Section
    ns.print("\n📈 OTHER STATS:");
    const otherStats = [
        { name: "Reputation", original: statIncrease.originalOther.rep, final: statIncrease.totalOther.rep },
        { name: "Charisma", original: statIncrease.originalOther.charisma, final: statIncrease.totalOther.charisma },
        {
            name: "Charisma Exp",
            original: statIncrease.originalOther.charismaExp,
            final: statIncrease.totalOther.charismaExp,
        },
    ];

    for (const stat of otherStats) {
        const increase = stat.final / stat.original;
        const percentIncrease = (increase - 1) * 100;
        ns.print(
            `  ${stat.name.padEnd(14)}: ${ns.formatPercent(stat.original)} -> ${ns.formatPercent(stat.final)} (+${percentIncrease.toFixed(1)}%, ${increase.toFixed(2)}X)`,
        );
    }

    if (statIncrease.neurofluxLevels > 0) {
        ns.print("");
        ns.print(`🔋 NeuroFlux Levels: ${statIncrease.neurofluxLevels} (1% boost each to all stats)`);
    }
}

/**
 * Performs iterative price filtering optimization to find the best combination of augmentations
 * @param {NS} ns - NetScript object
 * @param {Array} augmentsForOptimizer - Available augmentations
 * @param {number} totalBudget - Total available budget
 * @param {"hacking" | "rep" | "combat" | "all"} optimizeFor - What to optimize for (hacking, rep, combat, all)
 * @returns {Object} Best optimization result with additional stat information
 */
function optimizeWithPriceFiltering(ns, augmentsForOptimizer, totalBudget, optimizeFor) {
    // Get all unique prices and sort them descending
    const allPrices = [...new Set(augmentsForOptimizer.map((aug) => aug.cost))].sort((a, b) => b - a);

    let bestResult = null;
    let bestTotalStats = 0;
    let bestMaxPrice = null;

    // Use the shared optimization scoring function

    ns.print("\n=== ITERATIVE PRICE FILTERING OPTIMIZATION ===");
    ns.print(`Finding the best price filter that maximizes ${optimizeFor} stats...`);
    ns.print(`Testing ${allPrices.length} different price thresholds...`);

    // Try each price threshold
    for (let i = 0; i < allPrices.length; i++) {
        const maxPrice = allPrices[i];
        const filteredAugments = augmentsForOptimizer.filter((aug) => aug.cost <= maxPrice);

        if (filteredAugments.length === 0) continue;

        // Run optimization on filtered list
        const result = optimizeAugmentPurchases(filteredAugments, totalBudget);

        // Calculate total stat increase for this result
        const statIncrease = calculateTotalStatIncrease(ns, result.purchaseOrder);
        const totalStatScore = getOptimizationScore(statIncrease, optimizeFor);

        ns.print(
            `Max price: $${ns.formatNumber(maxPrice * 1000000)} | Augments: ${result.purchaseOrder.length} | Hacking: ${statIncrease.relativeHackingLevelBoost.toFixed(2)}X | Rep: ${statIncrease.relativeRepBoost.toFixed(2)}X | Combat: ${statIncrease.relativeCombatBoost.toFixed(2)}X | Score: ${totalStatScore.toFixed(3)}X`,
        );

        // Update best result if this is better
        if (totalStatScore > bestTotalStats) {
            bestTotalStats = totalStatScore;
            bestResult = result;
            bestMaxPrice = maxPrice;

            bestResult.statIncrease = statIncrease;
            bestResult.totalStatScore = totalStatScore;
            bestResult.maxPriceFilter = maxPrice;
        }
    }

    if (bestResult) {
        ns.print(`\n✅ Optimization complete!`);
        ns.print(`   Best filter: Max price $${ns.formatNumber(bestMaxPrice * 1000000)}`);
        ns.print(`   Augments: ${bestResult.purchaseOrder.length}`);
        ns.print(
            `   Hacking Level: +${((bestResult.statIncrease.relativeHackingLevelBoost - 1) * 100).toFixed(1)}% (${bestResult.statIncrease.relativeHackingLevelBoost.toFixed(2)}X)`,
        );
        ns.print(
            `   Hacking boost: +${((bestResult.statIncrease.relativeHackingBoost - 1) * 100).toFixed(1)}% (${bestResult.statIncrease.relativeHackingBoost.toFixed(2)}X)`,
        );
        ns.print(
            `   Rep boost: +${((bestResult.statIncrease.relativeRepBoost - 1) * 100).toFixed(1)}% (${bestResult.statIncrease.relativeRepBoost.toFixed(2)}X)`,
        );
        ns.print(
            `   Combat boost: +${((bestResult.statIncrease.relativeCombatBoost - 1) * 100).toFixed(1)}% (${bestResult.statIncrease.relativeCombatBoost.toFixed(2)}X)`,
        );
        ns.print(`   Total stat score: ${bestTotalStats.toFixed(3)}`);
    }

    return bestResult;
}

/** @param {NS} ns **/
export async function main(ns) {
    // const hackingMultiplier = ns.getPlayer().
    // const hackingMultiplier = ns.singularity.getHackingLevelMultiplier();
    // const hackingLevel = Math.floor(14.14 * (32 * Math.log(100000000000 + 534.6) - 200))

    const flags = ns.flags(argsSchema);
    const shouldPurchase = flags.buy;
    const hackingRepOnly = flags["hacking-rep-only"];
    const hackingOnly = flags["hacking-only"];
    const hackingRepAndCombat = flags["hacking-rep-and-combat"];
    const forceBuy = flags["force-buy"];

    ns.ui.openTail(); // Open tail because there's a lot of good output
    ns.ui.resizeTail(1000, 600);

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

    const currentNeuroFluxPurchaseLevel = getCurrentNeuroFluxPurchaseLevel(ns);
    ns.print(`Current NeuroFlux Governor Level: ${currentNeuroFluxPurchaseLevel}`);

    const portfolio = ns.stock.hasTIXAPIAccess() ? calculatePortfolioValue(ns) : { totalValue: 0, totalProfit: 0 };
    const totalBudget = player.money + portfolio.totalValue;

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

    function hasCombatBoost(stats) {
        return stats.strength > 1 || stats.defense > 1 || stats.dexterity > 1 || stats.agility > 1;
    }

    // Check which augmentations we can afford (both price and reputation) - separate entry for each qualifying faction
    const affordableAugmentations = [];
    let unaffordableAugmentations = [];
    const affordableButFilteredOut = [];

    for (const augmentation of availableAugmentations) {
        const price = ns.singularity.getAugmentationPrice(augmentation);
        const repReq = ns.singularity.getAugmentationRepReq(augmentation);
        const augFactions = ns.singularity.getAugmentationFactions(augmentation);
        const stats = ns.singularity.getAugmentationStats(augmentation);
        const prereqs = ns.singularity.getAugmentationPrereq(augmentation);

        // Check if we have enough money (using total budget including stocks)
        const canAffordPrice = totalBudget >= price;

        const alwaysIncludeList = [
            "NeuroFlux Governor",
            "Neuroreceptor Management Implant", // Removes penalty for not focusing on task
        ];

        // Check each faction separately - create separate entries for each qualifying faction
        for (const faction of augFactions) {
            if (player.factions.includes(faction)) {
                const factionRep = ns.singularity.getFactionRep(faction);

                const hackingBoost = hasHackingBoost(stats);
                const repBoost = hasRepBoost(stats);
                const combatBoost = hasCombatBoost(stats);

                const aug = {
                    name: augmentation,
                    cost: price / 1000000, // Convert to millions for easier reading
                    faction: faction,
                    prereqs: prereqs,
                    hackingBoost: hackingBoost,
                    repBoost: repBoost,
                    combatBoost: combatBoost,
                    repReq: repReq,
                    stats: stats,
                };

                if (factionRep >= repReq && canAffordPrice) {
                    // If --hacking-rep-only flag is set, skip augments that don't boost hacking or rep
                    // Exception: Always include NeuroFlux Governor as it provides hacking boost
                    if (hackingRepOnly && !hackingBoost && !repBoost && !alwaysIncludeList.includes(augmentation)) {
                        affordableButFilteredOut.push(aug);
                        continue;
                    }

                    if (hackingOnly && !hackingBoost && !alwaysIncludeList.includes(augmentation)) {
                        affordableButFilteredOut.push(aug);
                        continue;
                    }

                    if (
                        hackingRepAndCombat &&
                        !hackingBoost &&
                        !repBoost &&
                        !combatBoost &&
                        !alwaysIncludeList.includes(augmentation)
                    ) {
                        affordableButFilteredOut.push(aug);
                        continue;
                    }

                    affordableAugmentations.push(aug);
                } else {
                    unaffordableAugmentations.push(aug);
                }
            }
        }
    }

    ns.print(`\n=== Affordable Augments: ${affordableAugmentations.length} ===`);
    for (const aug of affordableAugmentations.sort((a, b) => b.cost - a.cost)) {
        const hasHackingBoost = aug.hackingBoost;
        const hasRepBoost = aug.repBoost;
        const hasCombatBoost = aug.combatBoost;
        ns.print(
            `$${ns.formatNumber(aug.cost * 1000000)} - ${aug.name} - ${aug.faction} ${hasHackingBoost ? "- 🧠 " : ""}${hasRepBoost ? "- 📈" : ""}${hasCombatBoost ? "- 💪" : ""}`,
        );
    }

    ns.print(`\n=== Affordable but filtered out: ${affordableButFilteredOut.length} ===`);
    for (const aug of affordableButFilteredOut.sort((a, b) => b.cost - a.cost)) {
        ns.print(`$${ns.formatNumber(aug.cost * 1000000)} - ${aug.name} - ${aug.faction}`);
    }

    ns.print(`\n=== Unaffordable Augments: ${unaffordableAugmentations.length} ===`);
    for (const aug of unaffordableAugmentations.sort((a, b) => b.cost - a.cost)) {
        ns.print(`$${ns.formatNumber(aug.cost * 1000000)} - ${aug.name} - ${aug.faction}`);
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
                ? `NeuroFlux Governor - Level ${currentNeuroFluxPurchaseLevel}`
                : aug.name,
        cost: aug.cost, // Already in millions
        faction: aug.faction,
        prereqs: aug.prereqs,
        hackingBoost: aug.hackingBoost,
        repBoost: aug.repBoost,
        combatBoost: aug.combatBoost,
        available: true,
    }));

    // Optimize the purchase order
    let result = optimizeAugmentPurchases(augmentsForOptimizer, totalBudget);

    const optimizeFor = hackingRepOnly
        ? "hackingAndRep"
        : hackingOnly
          ? "hackingLevel"
          : hackingRepAndCombat
            ? "hackingAndRepAndCombat"
            : "all";

    // Calculate total stat increases for the current result
    if (result.purchaseOrder.length > 0) {
        result.statIncrease = calculateTotalStatIncrease(ns, result.purchaseOrder);
        result.totalStatScore = getOptimizationScore(result.statIncrease, optimizeFor);
    }

    // If we can't afford all augments, try price filtering optimization
    if (result.unpurchasedAugments && result.unpurchasedAugments.length > 0) {
        ns.print("🔍 Cannot afford all augments with hacking-rep-only filter. Trying price filtering optimization...");

        const optimizedResult = optimizeWithPriceFiltering(ns, augmentsForOptimizer, totalBudget, optimizeFor);
        if (optimizedResult) {
            const optimizedTotalStats = optimizedResult.totalStatScore;

            ns.print(`\n📊 COMPARISON:`);
            ns.print(
                `   Original plan: ${result.purchaseOrder.length} augments, stat score: ${result.totalStatScore.toFixed(3)}`,
            );
            ns.print(
                `   Optimized plan: ${optimizedResult.purchaseOrder.length} augments, stat score: ${optimizedTotalStats.toFixed(3)}`,
            );
            ns.print(
                `   Improvement: ${((optimizedTotalStats - result.totalStatScore) * 100).toFixed(1)}% better stat increase`,
            );

            result = optimizedResult;
        }
    }

    // Display the optimal purchase order
    ns.print("\n");
    ns.print("=== OPTIMAL AUGMENTATION PURCHASE ORDER ===");
    ns.print(`Cost multiplier per purchase: 1.9x`);
    ns.print("Legend: 🧠 = Improves hacking, 📈 = Improves reputation, 💪 = Improves combat");
    if (hackingRepOnly) {
        ns.print("INFO Filter: Only showing hacking/reputation augments");
    }
    if (hackingOnly) {
        ns.print("INFO Filter: Only showing hacking augments");
    }
    if (hackingRepAndCombat) {
        ns.print("INFO Filter: Only showing hacking/reputation/combat augments");
    }
    if (result.maxPriceFilter) {
        ns.print(`INFO Price filter applied: Max $${ns.formatNumber(result.maxPriceFilter * 1000000)}`);
    }
    ns.print("");

    for (let i = 0; i < result.purchaseOrder.length; i++) {
        const aug = result.purchaseOrder[i];
        const hackingMark = aug.hackingBoost ? " 🧠" : "";
        const repMark = aug.repBoost ? " 📈" : "";
        const combatMark = aug.combatBoost ? " 💪" : "";
        const prereqInfo = aug.prereqs.length > 0 ? `\n      - Requires: ${aug.prereqs.join(", ")}` : "";
        ns.print(
            `${i + 1}. [${aug.faction}] $${ns.formatNumber(aug.currentCost * 1000000)} [Base: $${ns.formatNumber(aug.cost * 1000000)}] - ${aug.name}${hackingMark}${repMark}${combatMark}${prereqInfo}`,
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
            const combatMark = aug.combatBoost ? " 💪" : "";
            const prereqInfo = aug.prereqs.length > 0 ? `\n      - Requires: ${aug.prereqs.join(", ")}` : "";
            ns.print(
                `${i + 1}. [${aug.faction}] $${ns.formatNumber(aug.currentCost * 1000000)} [Base: $${ns.formatNumber(aug.cost * 1000000)}] - ${aug.name}${hackingMark}${repMark}${combatMark}${prereqInfo}`,
            );
        }
    }

    ns.print("\n");
    ns.print("=== BUDGET SUMMARY ===");
    ns.print(`Current cash: $${ns.formatNumber(player.money)}`);
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

    // Display comprehensive stat increases if available
    if (result.statIncrease) {
        displayStatIncreases(ns, result.statIncrease);
    }

    // === NEUROFLUX GOVERNOR REPUTATION VALIDATION ===
    const neuroFluxValidation = validateNeuroFluxReputation(
        ns,
        player,
        currentNeuroFluxPurchaseLevel,
        result.neurofluxCount,
    );
    displayNeuroFluxStatus(ns, neuroFluxValidation, shouldPurchase, forceBuy);

    if (shouldPurchase) {
        // Check if we should proceed with purchase
        if (!neuroFluxValidation.canPurchase && result.neurofluxCount > 0 && !forceBuy) {
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
