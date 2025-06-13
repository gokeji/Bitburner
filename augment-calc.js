// BitBurner Augmentation Purchase Optimizer - New Augmentations
const augments = [
    // Unavailable items (marked as "No" in Eligible column)
    // { name: 'BitRunners Neurolink', cost: 4375, faction: 'BitRunners', available: false, prereqs: [], hackingBoost: true },
    // { name: 'Embedded Netburner Module Core V2 Upgrade', cost: 4500, faction: 'BitRunners', available: false, prereqs: [], hackingBoost: true },

    // Chongqing
    { name: 'NeuroFlux Governor - Level 43', cost: 184.105, faction: 'Chongqing', available: true, prereqs: [], hackingBoost: true },
    { name: 'Neuregen Gene Modification', cost: 375, faction: 'Chongqing', available: true, prereqs: [], hackingBoost: true },

    // Ishima
    { name: 'INFRARET Enhancement', cost: 30, faction: 'Ishima', available: true, prereqs: [], hackingBoost: true },
    { name: 'NeuroFlux Governor - Level 43', cost: 184.105, faction: 'Ishima', available: true, prereqs: [], hackingBoost: true },

    // BitRunners (updating with available ones)
    { name: 'NeuroFlux Governor - Level 43', cost: 184.105, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'BitRunners Neurolink', cost: 4375, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core V2 Upgrade', cost: 4500, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },

    // Daedalus
    { name: 'The Red Pill', cost: 0, faction: 'Daedalus', available: true, prereqs: [], hackingBoost: false },
    { name: 'NeuroFlux Governor - Level 43', cost: 184.105, faction: 'Daedalus', available: true, prereqs: [], hackingBoost: true },
    { name: 'Synfibril Muscle', cost: 1125, faction: 'Daedalus', available: true, prereqs: [], hackingBoost: false },
    { name: 'Synthetic Heart', cost: 2875, faction: 'Daedalus', available: true, prereqs: [], hackingBoost: false },
    { name: 'NEMEAN Subdermal Weave', cost: 3250, faction: 'Daedalus', available: true, prereqs: [], hackingBoost: false },
    { name: 'Embedded Netburner Module Analyze Engine', cost: 6000, faction: 'Daedalus', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Direct Memory Access Upgrade', cost: 7000, faction: 'Daedalus', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core V3 Upgrade', cost: 7500, faction: 'Daedalus', available: true, prereqs: ['Embedded Netburner Module Core V2 Upgrade'], hackingBoost: true },

    // The Syndicate
    { name: 'BrachiBlades', cost: 90, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: false },
    { name: 'Augmented Targeting III', cost: 115, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: false },
    { name: 'Combat Rib III', cost: 120, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: false },
    { name: 'Bionic Spine', cost: 125, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: false },
    { name: 'NeuroFlux Governor - Level 43', cost: 184.105, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: true },
    { name: 'Bionic Legs', cost: 375, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: false },
    { name: 'The Shadow\'s Simulacrum', cost: 400, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: false },
    { name: 'NEMEAN Subdermal Weave', cost: 3250, faction: 'The Syndicate', available: true, prereqs: [], hackingBoost: false },
];

const COST_MULTIPLIER = 1.9;

// Let's assume you have enough money to buy everything - we'll calculate total needed
function formatNumber(num) {
    if (num >= 1e9) return (num/1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num/1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num/1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function canPurchase(augment, purchasedAugments) {
    return augment.available && augment.prereqs.every(prereq =>
        purchasedAugments.some(purchased => purchased.name === prereq)
    );
}

function calculateCombinedCost(augmentName, augments) {
    // Find the augment and its dependency chain
    const augment = augments.find(aug => aug.name === augmentName);
    if (!augment) return 0;

    let totalCost = augment.cost;
    let multiplier = 1;

    // Add prerequisite costs (they get bought first, so no multiplier)
    for (const prereqName of augment.prereqs) {
        const prereq = augments.find(aug => aug.name === prereqName);
        if (prereq) {
            totalCost += prereq.cost;
            multiplier *= COST_MULTIPLIER; // Each prereq increases the multiplier for the final item
        }
    }

    // The final item in the chain gets the accumulated multiplier
    totalCost = augment.cost + (augment.prereqs.reduce((sum, prereqName) => {
        const prereq = augments.find(aug => aug.name === prereqName);
        return sum + (prereq ? prereq.cost : 0);
    }, 0));

    return totalCost;
}

function calculateOptimalOrder() {
    // Remove duplicates - keep the one from the preferred faction (or first occurrence)
    const deduplicatedAugments = [];
    const seenNames = new Set();

    for (const aug of augments) {
        if (!seenNames.has(aug.name) && aug.available) {
            deduplicatedAugments.push({
                ...aug,
                originalCost: aug.cost,
                currentCost: aug.cost,
                combinedCost: calculateCombinedCost(aug.name, augments)
            });
            seenNames.add(aug.name);
        }
    }

    console.log('=== DEDUPLICATED AUGMENTATIONS WITH COMBINED COSTS ===');
    deduplicatedAugments.forEach(aug => {
        const hackingMark = aug.hackingBoost ? ' 🧠' : '';
        const prereqInfo = aug.prereqs.length > 0 ? ` (requires: ${aug.prereqs.join(', ')})` : '';
        const combinedInfo = aug.combinedCost !== aug.cost ? ` [Combined: $${formatNumber(aug.combinedCost * 1000000)}]` : '';
        console.log(`${aug.name}${hackingMark} - $${formatNumber(aug.cost * 1000000)}${combinedInfo} [${aug.faction}]${prereqInfo}`);
    });
    console.log('');

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

                // Calculate combined cost for priority (first item + second item * 1.9)
                const combinedCost = chain.reduce((sum, item, index) => {
                    return sum + (item.cost * Math.pow(COST_MULTIPLIER, index));
                }, 0);

                priorityItems.push({
                    type: 'chain',
                    augments: chain,
                    priorityCost: combinedCost
                });
            }
        }
        // If this augment has a dependent, skip it - it will be processed as part of the chain
    }

    // Sort priority items by their priority cost (descending)
    priorityItems.sort((a, b) => b.priorityCost - a.priorityCost);

    console.log('=== PRIORITY ORDER CALCULATION ===');
    priorityItems.forEach((item, index) => {
        if (item.type === 'single') {
            console.log(`${index + 1}. ${item.augments[0].name} - $${formatNumber(item.priorityCost * 1000000)}`);
        } else {
            console.log(`${index + 1}. ${item.augments.map(a => a.name).join(' → ')} - $${formatNumber(item.priorityCost * 1000000)} (chain)`);
        }
    });
    console.log('');

    // Now execute purchases in this priority order
    let purchaseOrder = [];
    let totalCost = 0;
    let multiplier = 1;

    for (const item of priorityItems) {
        for (const aug of item.augments) {
            const actualCost = aug.cost * multiplier;
            purchaseOrder.push({
                ...aug,
                currentCost: actualCost
            });
            totalCost += actualCost;
            multiplier *= COST_MULTIPLIER;
        }
    }

    return { purchaseOrder, totalCost };
}

// Calculate and display results
console.log('=== BITBURNER AUGMENTATION PURCHASE OPTIMIZER ===');
console.log(`Cost multiplier per purchase: ${COST_MULTIPLIER}x`);
console.log('Legend: 🧠 = Improves hacking');
console.log('Note: Dependency chains are prioritized by their combined cost');
console.log('');

const result = calculateOptimalOrder();

console.log('=== OPTIMAL PURCHASE ORDER (WITH DEPENDENCY CHAIN PRIORITY) ===');
for (let i = 0; i < result.purchaseOrder.length; i++) {
    const aug = result.purchaseOrder[i];
    const hackingMark = aug.hackingBoost ? ' 🧠' : '';
    const prereqInfo = aug.prereqs.length > 0 ? ` (required: ${aug.prereqs.join(', ')})` : '';
    console.log(`${i+1}. ${aug.name}${hackingMark} - $${formatNumber(aug.currentCost * 1000000)} [${aug.faction}]${prereqInfo}`);
}

console.log('');
console.log('=== SUMMARY ===');
console.log(`Total augments to purchase: ${result.purchaseOrder.length}`);
console.log(`Total cost: $${formatNumber(result.totalCost * 1000000)}`);
console.log(`Hacking augments: ${result.purchaseOrder.filter(aug => aug.hackingBoost).length}`);

console.log('');
console.log('=== COST BREAKDOWN BY ORIGINAL PRICE ===');
const costBreakdown = result.purchaseOrder.map((aug, index) => ({
    name: aug.name,
    originalCost: aug.originalCost,
    actualCost: aug.currentCost,
    multiplier: aug.currentCost / aug.originalCost,
    order: index + 1
}));

costBreakdown.sort((a, b) => b.originalCost - a.originalCost);
costBreakdown.forEach(item => {
    console.log(`${item.name}: $${formatNumber(item.originalCost * 1000000)} → $${formatNumber(item.actualCost * 1000000)} (${item.multiplier.toFixed(2)}x, bought ${item.order}${item.order === 1 ? 'st' : item.order === 2 ? 'nd' : item.order === 3 ? 'rd' : 'th'})`);
});

console.log('');
console.log('=== DEPENDENCY CHAIN ANALYSIS ===');
console.log('Combat Rib I + II chain:');
console.log(`- Combat Rib I: $23.75M (base cost)`);
console.log(`- Combat Rib II: $65M × 1.9 = $123.50M (after Combat Rib I purchase)`);
console.log(`- Combined chain cost: $147.25M`);
console.log(`- This combined cost ranks it above Nanofiber Weave ($125M)`);

console.log('');
console.log('=== KEY INSIGHTS ===');
console.log('1. Dependency chains are prioritized by their COMBINED cost');
console.log('2. Combat Rib I+II combined ($147.25M) > Nanofiber Weave ($125M)');
console.log('3. Most expensive individual augments still purchased first');
console.log('4. Dependencies must be bought in order within their priority slot');
console.log(`5. You need approximately $${formatNumber(result.totalCost * 1000000)} total to buy all available augments`);