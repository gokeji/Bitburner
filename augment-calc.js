/* eslint-env node */
// BitBurner Augmentation Purchase Optimizer - New Augmentations
// Usage: node augment-calc.js [maxBudget]
// Example: node augment-calc.js 1000000000 (for $1B budget)

const args = process.argv.slice(2);
const maxBudget = args.length > 0 ? parseFloat(args[0]) / 1000000 : null; // Convert to millions for internal calculations

const neurofluxToPurchase = 10;

let augments = [
    // Aevum
    { name: 'Wired Reflexes', cost: 2.5, faction: 'Aevum', available: true, prereqs: [], hackingBoost: false },
    { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'Aevum', available: true, prereqs: [], hackingBoost: true },
    { name: 'Neuralstimulator', cost: 3000, faction: 'Aevum', available: false, prereqs: [], hackingBoost: false }, // Missing rep
    { name: 'PCMatrix', cost: 2000, faction: 'Aevum', available: false, prereqs: [], hackingBoost: false }, // Missing rep

    // Sector-12
    { name: 'Wired Reflexes', cost: 2.5, faction: 'Sector-12', available: true, prereqs: [], hackingBoost: false },
    // { name: 'Augmented Targeting I', cost: 15, faction: 'Sector-12', available: true, prereqs: [], hackingBoost: false },
    // { name: 'Augmented Targeting II', cost: 42.5, faction: 'Sector-12', available: true, prereqs: ['Augmented Targeting I'], hackingBoost: false },
    { name: 'CashRoot Starter Kit', cost: 125, faction: 'Sector-12', available: true, prereqs: [], hackingBoost: false },
    { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'Sector-12', available: true, prereqs: [], hackingBoost: true },
    { name: 'Neuralstimulator', cost: 3000, faction: 'Sector-12', available: false, prereqs: [], hackingBoost: false }, // Missing rep

    // NiteSec
    { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'NiteSec', available: true, prereqs: [], hackingBoost: true },
    { name: 'DataJack', cost: 450000, faction: 'NiteSec', available: true, prereqs: [], hackingBoost: true },

    // Slum Snakes
    // { name: 'Wired Reflexes', cost: 2.5, faction: 'Slum Snakes', available: true, prereqs: [], hackingBoost: false },
    // { name: 'Augmented Targeting I', cost: 15, faction: 'Slum Snakes', available: true, prereqs: [], hackingBoost: false },
    // { name: 'LuminCloaking-V2 Skin Implant', cost: 30, faction: 'Slum Snakes', available: true, prereqs: [], hackingBoost: false },
    // { name: 'Combat Rib I', cost: 23750, faction: 'Slum Snakes', available: true, prereqs: [], hackingBoost: false },
    // { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'Slum Snakes', available: true, prereqs: [], hackingBoost: true },
    // { name: 'SmartSonar Implant', cost: 75000, faction: 'Slum Snakes', available: true, prereqs: [], hackingBoost: false },

    // Tetrads
    { name: 'LuminCloaking-V2 Skin Implant', cost: 30, faction: 'Tetrads', available: true, prereqs: [], hackingBoost: false },
    // { name: 'HemoRecirculator', cost: 45, faction: 'Tetrads', available: true, prereqs: [], hackingBoost: false },
    { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'Tetrads', available: true, prereqs: [], hackingBoost: true },
    { name: 'Power Recirculation Core', cost: 180, faction: 'Tetrads', available: true, prereqs: [], hackingBoost: false },
    // { name: 'Bionic Arms', cost: 275, faction: 'Tetrads', available: true, prereqs: [], hackingBoost: false },

    // Netburners
    // { name: 'Hacknet Node CPU Architecture Neural-Upload', cost: 11, faction: 'Netburners', available: true, prereqs: [], hackingBoost: true },
    // { name: 'Hacknet Node Kernel Direct-Neural Interface', cost: 40, faction: 'Netburners', available: true, prereqs: [], hackingBoost: true },
    // { name: 'Hacknet Node Core Direct-Neural Interface', cost: 60, faction: 'Netburners', available: true, prereqs: [], hackingBoost: true },
    // { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'Netburners', available: true, prereqs: [], hackingBoost: true },

    // Tian Di Hui
    { name: 'Wired Reflexes', cost: 2.5, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },
    { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: true },
    { name: 'Nanofiber Weave', cost: 125, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },
    { name: 'Neuroreceptor Management Implant', cost: 550, faction: 'Tian Di Hui', available: true, prereqs: [], hackingBoost: false },

    // The Black Hand
    { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'The Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'Neuralstimulator', cost: 3000, faction: 'The Black Hand', available: true, prereqs: [], hackingBoost: false },
    { name: 'Enhanced Myelin Sheathing', cost: 1375, faction: 'The Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'The Black Hand', cost: 550, faction: 'The Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'DataJack', cost: 450, faction: 'The Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'Cranial Signal Processors - Gen IV', cost: 1100, faction: 'The Black Hand', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core Implant', cost: 2500, faction: 'The Black Hand', available: true, prereqs: [], hackingBoost: true },

    // BitRunners
    { name: 'NeuroFlux Governor - Level 27', cost: 22.625, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Enhanced Myelin Sheathing', cost: 1375, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'DataJack', cost: 450, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Cranial Signal Processors - Gen IV', cost: 1100, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core Implant', cost: 2500, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Neural Accelerator', cost: 1750, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Cranial Signal Processors - Gen V', cost: 2250, faction: 'BitRunners', available: true, prereqs: ['Cranial Signal Processors - Gen IV'], hackingBoost: true },
    { name: 'Artificial Bio-neural Network Implant', cost: 3000, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'BitRunners Neurolink', cost: 4375, faction: 'BitRunners', available: true, prereqs: [], hackingBoost: true },
    { name: 'Embedded Netburner Module Core V2 Upgrade', cost: 4500, faction: 'BitRunners', available: true, prereqs: ['Embedded Netburner Module Core Implant'], hackingBoost: true },
];

const neurofluxName = augments.find(aug => aug.name.includes('NeuroFlux Governor')).name;
const nameParts = neurofluxName.split(' ');
const neurofluxCurrentLevel = parseInt(nameParts[nameParts.length - 1]);

console.log(neurofluxCurrentLevel);
augments = addNeoruFluxGovernors(augments, neurofluxToPurchase);

function addNeoruFluxGovernors(augments, count) {
    const neuroFluxGovernors = [];
    for (let i = neurofluxCurrentLevel; i <= neurofluxCurrentLevel + count; i++) {
        neuroFluxGovernors.push({ name: `NeuroFlux Governor - Level ${i}`, cost: 22.625 * Math.pow(1.9, i - neurofluxCurrentLevel), faction: 'BitRunners', available: true, prereqs: [`NeuroFlux Governor - Level ${i - 1}`], hackingBoost: true });
    }
    return [...augments, ...neuroFluxGovernors];
}

const COST_MULTIPLIER = 1.9;

// Let's assume you have enough money to buy everything - we'll calculate total needed
function formatNumber(num) {
    if (num >= 1e15) return (num/1e15).toFixed(2) + 'Q';
    if (num >= 1e12) return (num/1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num/1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num/1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num/1e3).toFixed(2) + 'K';
    return num.toFixed(2);
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
                let combinedCost = chain.reduce((sum, item, index) => {
                    return sum + (item.cost * Math.pow(COST_MULTIPLIER, index));
                }, 0);

                // if (chain.some(item => item.name.includes('NeuroFlux Governor'))) {
                //     combinedCost = 0;
                // }

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
