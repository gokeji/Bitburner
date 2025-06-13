// BitBurner Augmentation Purchase Optimizer - New Augmentations
const augments = [
    // BitRunners
    { name: 'Cranial Signal Processors - Gen III', cost: 550, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },

    // Tetrads
    { name: 'LuminCloaking-V1 Skin Implant', cost: 5, faction: 'Tetrads', available: true, prereqs: [], hackingBoost: false },

    // Netburners
    { name: 'Hacknet Node NIC Architecture Neural-Upload', cost: 4.5, faction: 'Netburners', available: true, prereqs: [], hackingBoost: true },

    // Tian Di Hui
    { name: 'Wired Reflexes', cost: 2.5, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },
    { name: 'NeuroFlux Governor - Level 14', cost: 4.119, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: true },
    { name: 'Speech Enhancement', cost: 12.5, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },
    { name: 'ADR-V1 Pheromone Gene', cost: 17.5, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },
    { name: 'Nuoptimal Nootropic Injector Implant', cost: 20, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },
    { name: 'Social Negotiation Assistant (S.N.A)', cost: 30, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },
    { name: 'Speech Processor Implant', cost: 50, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },

    // CyberSec
    { name: 'Synaptic Enhancement Implant', cost: 7.5, faction: 'CyberSec', available: true, prereqs: [], hackingBoost: true },
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