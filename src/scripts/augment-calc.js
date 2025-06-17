/* eslint-env node */
// BitBurner Augmentation Purchase Optimizer - New Augmentations
// Usage: node augment-calc.js [maxBudget]
// Example: node augment-calc.js 1000000000 (for $1B budget)

const COST_MULTIPLIER = 1.9;
let NEUROFlUX_TO_PURCHASE = 1; // Only used if no max budget is provided

let initialAugments = [
    // BitRunners
    { name: 'NeuroFlux Governor - Level 36', cost: 73.575, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Enhanced Myelin Sheathing', cost: 1375, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'DataJack', cost: 450, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Cranial Signal Processors - Gen IV', cost: 1100, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core Implant', cost: 2500, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Neural Accelerator', cost: 1750, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Cranial Signal Processors - Gen V', cost: 2250, faction: 'BitRunners', available: true, prereqs: ['Cranial Signal Processors - Gen IV'], hackingBoost: true },
    { name: 'Artificial Bio-neural Network Implant', cost: 3000, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'BitRunners Neurolink', cost: 4375, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core V2 Upgrade', cost: 4500, faction: 'BitRunners', available: true, prereqs: ['Embedded Netburner Module Core Implant'], hackingBoost: true },

    // Black Hand
    { name: 'NeuroFlux Governor - Level 36', cost: 73.575, faction: 'Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'Enhanced Myelin Sheathing', cost: 1375, faction: 'Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'The Black Hand', cost: 550, faction: 'Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'DataJack', cost: 450, faction: 'Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'Cranial Signal Processors - Gen IV', cost: 1100, faction: 'Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core Implant', cost: 2500, faction: 'Black Hand', available: true, prereqs: ['DataJack'], hackingBoost: true },

    // NiteSec
    { name: 'CRTX42-AA Gene Modification', cost: 225, faction: 'NiteSec', available: true, prereqs: [], hackingBoost: true },
    { name: 'NeuroFlux Governor - Level 36', cost: 73.575, faction: 'NiteSec', available: true, prereqs: [], hackingBoost: true },
    { name: 'DataJack', cost: 450, faction: 'NiteSec', available: true, prereqs: [], hackingBoost: true },

    // Tian Di Hui
    { name: 'Neuroreceptor Management Implant', cost: 550, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: true },
];

function addNeoruFluxGovernors(augments, count) {
    const neurofluxByLevel = augments
        .filter(aug => aug.name.includes('NeuroFlux Governor'))
        .sort((a, b) => {
            const namePartsA = a.name.split(' ');
            const namePartsB = b.name.split(' ');
            return parseInt(namePartsB[namePartsB.length - 1]) - parseInt(namePartsA[namePartsA.length - 1]);
        });

    if (neurofluxByLevel.length === 0) return augments;

    const highestLevelNeuroFluxGovernor = neurofluxByLevel[0];
    const nameParts = highestLevelNeuroFluxGovernor.name.split(' ');
    const neurofluxCurrentLevel = parseInt(nameParts[nameParts.length - 1]);

    const neuroFluxGovernors = [];

    for (let i = neurofluxCurrentLevel + 1; i <= neurofluxCurrentLevel + count; i++) {
        neuroFluxGovernors.push({
            name: `NeuroFlux Governor - Level ${i}`,
            cost: highestLevelNeuroFluxGovernor.cost * Math.pow(1.14, i - neurofluxCurrentLevel),
            faction: 'BitRunners',
            available: true,
            prereqs: [`NeuroFlux Governor - Level ${i - 1}`],
            hackingBoost: true
        });
    }
    return [...augments, ...neuroFluxGovernors];
}

function calculateOptimalOrder(augments, maxBudget = null) {
    // Remove duplicates - keep the one from the preferred faction (or first occurrence)
    const deduplicatedAugments = [];
    const seenNames = new Set();

    for (const aug of augments) {
        if (!seenNames.has(aug.name) && aug.available) {
            deduplicatedAugments.push(aug);
            seenNames.add(aug.name);
        }
    }

    // Create a priority list by treating dependency chains as single units
    const priorityItems = [];
    const processedAugments = new Set();

    for (const aug of deduplicatedAugments) {
        if (processedAugments.has(aug.name)) continue;

        // Check if this augment is the END of a dependency chain
        const dependentAugment = deduplicatedAugments.find(a => a.prereqs.includes(aug.name));

        if (!dependentAugment) {
            // This is either standalone or the final item in a chain
            if (aug.prereqs.length === 0) {
                // Standalone item
                priorityItems.push({
                    type: 'single',
                    augments: [aug],
                    priorityCost: aug.cost
                });
                processedAugments.add(aug.name);
            } else {
                // Final item in a chain - build the full chain
                const chain = [];
                let current = aug;

                // Build the chain backwards from the final item
                while (current) {
                    chain.unshift(current);
                    processedAugments.add(current.name);

                    if (current.prereqs.length > 0) {
                        current = deduplicatedAugments.find(a => a.name === current.prereqs[0]);
                    } else {
                        current = null;
                    }
                }

                // Calculate cost of last item in chain
                let lastItemCost = chain[chain.length - 1].cost;

                priorityItems.push({
                    type: 'chain',
                    augments: chain,
                    priorityCost: lastItemCost
                });
            }
        }
        // If this augment has a dependent, skip it - it will be processed as part of the chain
    }

    // Sort priority items by their priority cost (descending)
    priorityItems.sort((a, b) => b.priorityCost - a.priorityCost);

    // Flatten all augments into a single ordered list
    const flattenedAugments = [];
    for (const item of priorityItems) {
        for (const aug of item.augments) {
            flattenedAugments.push(aug);
        }
    }

    // Smart loop to maximize augments purchased within budget
    let purchaseOrder = [];
    let unpurchasedAugments = [];
    let totalCost = 0;
    let totalCostOfAll = 0;
    let multiplier = 1;
    let nextUnaffordableItem = null;
    let remainingAugments = [...flattenedAugments];

    // First pass: calculate total cost of all augments
    for (const aug of flattenedAugments) {
        const actualCost = aug.cost * multiplier;
        totalCostOfAll += actualCost;
        multiplier *= COST_MULTIPLIER;
    }

    // Reset multiplier for purchase logic
    multiplier = 1;
    let purchaseIndex = 0;

    // Continue purchasing until no more items can be afforded
    while (remainingAugments.length > 0) {
        let foundAffordableItem = false;

        for (let i = 0; i < remainingAugments.length; i++) {
            const aug = remainingAugments[i];
            const actualCost = aug.cost * multiplier;

            if (maxBudget === null || totalCost + actualCost <= maxBudget) {
                // Can afford this augment
                purchaseOrder.push({
                    ...aug,
                    currentCost: actualCost,
                    purchaseOrder: purchaseIndex + 1
                });
                totalCost += actualCost;
                multiplier *= COST_MULTIPLIER;
                purchaseIndex++;

                // Remove this item from remaining list
                remainingAugments.splice(i, 1);
                foundAffordableItem = true;
                break; // Start over from the beginning of the list
            }
        }

        // If we couldn't find any affordable item, we're done
        if (!foundAffordableItem) {
            break;
        }
    }

    // Add remaining items to unpurchased list with their costs
    multiplier = 1;
    for (const aug of flattenedAugments) {
        const actualCost = aug.cost * multiplier;

        // Check if this item was purchased
        const wasPurchased = purchaseOrder.some(purchased => purchased.name === aug.name);

        if (!wasPurchased) {
            unpurchasedAugments.push({
                ...aug,
                currentCost: actualCost
            });

            // Track the first unaffordable item (by original priority order)
            if (nextUnaffordableItem === null) {
                nextUnaffordableItem = {
                    ...aug,
                    currentCost: actualCost,
                    totalCostToAfford: totalCost + actualCost
                };
            }
        }
        multiplier *= COST_MULTIPLIER;
    }

    return { purchaseOrder, unpurchasedAugments, totalCost, totalCostOfAll, nextUnaffordableItem };
}

export function optimizeAugmentPurchases(initialAugments, maxBudgetInDollars) {
    const maxBudget = maxBudgetInDollars ? maxBudgetInDollars / 1000000 : null;

    let result;
    if (maxBudget !== null) {
        // If we have a max budget, keep adding neuroflux governors until we can't afford the next one
        let augments = [...initialAugments];
        let bestResult = calculateOptimalOrder(augments, maxBudget);
        let neurofluxCount = 1;

        // Only try to add more NeuroFlux if we can afford all current augments
        while (bestResult.unpurchasedAugments.length === 0 && bestResult.totalCost < maxBudget) {
            augments = addNeoruFluxGovernors(augments, 1);
            const tempResult = calculateOptimalOrder(augments, maxBudget);

            // If we can still afford everything, use this result
            if (tempResult.unpurchasedAugments.length === 0) {
                bestResult = tempResult;
                neurofluxCount++;
            } else {
                // If we can't afford everything with the new NeuroFlux, break
                break;
            }
        }

        result = bestResult;
        NEUROFlUX_TO_PURCHASE = neurofluxCount;
    } else {
        // If we don't have a max budget, just add the specified number of neuroflux governors
        const augments = addNeoruFluxGovernors(initialAugments, NEUROFlUX_TO_PURCHASE - 1);
        result = calculateOptimalOrder(augments);
    }

    return {
        purchaseOrder: result.purchaseOrder,
        unpurchasedAugments: result.unpurchasedAugments || [],
        totalCost: result.totalCost,
        totalCostOfAll: result.totalCostOfAll,
        neurofluxCount: NEUROFlUX_TO_PURCHASE,
        nextUnaffordableItem: result.nextUnaffordableItem
    };
}

function formatNumber(num) {
    if (num >= 1e15) return (num/1e15).toFixed(2) + 'Q';
    if (num >= 1e12) return (num/1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num/1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num/1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num/1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// === MAIN PROGRAM ===

// If running standalone, run the main program
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const maxBudget = args.length > 0 ? parseFloat(args[0]) / 1000000 : null;

    const result = optimizeAugmentPurchases(initialAugments, maxBudget ? maxBudget * 1000000 : null);

    // Calculate and display results
    console.log('');
    console.log('=== BITBURNER AUGMENTATION PURCHASE OPTIMIZER ===');
    console.log(`Cost multiplier per purchase: ${COST_MULTIPLIER}x`);
    console.log('Legend: 🧠 = Improves hacking');
    console.log('Note: Dependency chains are prioritized by cost of the last item in the chain');
    console.log('');

    console.log('=== OPTIMAL PURCHASE ORDER (WITH DEPENDENCY CHAIN PRIORITY) ===');
    for (let i = 0; i < result.purchaseOrder.length; i++) {
        const aug = result.purchaseOrder[i];
        const hackingMark = aug.hackingBoost ? ' 🧠' : '';
        const prereqInfo = aug.prereqs.length > 0 ? ` (required: ${aug.prereqs.join(', ')})` : '';
        console.log(`${i+1}. ${aug.name}${hackingMark} - $${formatNumber(aug.currentCost * 1000000)} [${aug.faction}]${prereqInfo}`);
    }

    // Display unpurchased augments if any exist
    if (result.unpurchasedAugments && result.unpurchasedAugments.length > 0) {
        console.log('');
        console.log('=== AUGMENTS NOT PURCHASED (INSUFFICIENT BUDGET) ===');
        for (let i = 0; i < result.unpurchasedAugments.length; i++) {
            const aug = result.unpurchasedAugments[i];
            const hackingMark = aug.hackingBoost ? ' 🧠' : '';
            const prereqInfo = aug.prereqs.length > 0 ? ` (required: ${aug.prereqs.join(', ')})` : '';
            console.log(`${i+1}. ${aug.name}${hackingMark} - $${formatNumber(aug.currentCost * 1000000)} [${aug.faction}]${prereqInfo}`);
        }
    }

    console.log('');
    console.log('=== SUMMARY ===');
    console.log(`Total augments to purchase: ${result.purchaseOrder.length}`);
    if (result.unpurchasedAugments && result.unpurchasedAugments.length > 0) {
        console.log(`Augments not purchased due to budget: ${result.unpurchasedAugments.length}`);
    }
    console.log(`Total cost: $${formatNumber(result.totalCost * 1000000)}`);
    if (maxBudget !== null) {
        console.log(`Total budget: $${formatNumber(maxBudget * 1000000)}`);
        const remainingBudget = maxBudget - result.totalCost;
        console.log(`Remaining budget: $${formatNumber(remainingBudget * 1000000)}`);
    }
    console.log(`Total cost of all augments: $${formatNumber(result.totalCostOfAll * 1000000)}`);
    if (result.nextUnaffordableItem && maxBudget !== null) {
        console.log(`Next unaffordable item: ${result.nextUnaffordableItem.name} - $${formatNumber(result.nextUnaffordableItem.currentCost * 1000000)}`);
        console.log(`Total budget needed for next item: $${formatNumber(result.nextUnaffordableItem.totalCostToAfford * 1000000)}`);
    }
    console.log('');
    console.log(`NeuroFlux Governors: ${result.neurofluxCount}`);
    console.log(`Hacking augments: ${result.purchaseOrder.filter(aug => aug.hackingBoost).length}`);

}
