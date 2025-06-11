// BitBurner Augmentation Purchase Optimizer - Updated with Prerequisites
const augments = [
    { name: 'NeuroFlux Governor - Level 9', cost: 2.139, rep: 1.426, available: true, prereqs: [] },
    { name: 'BitWire', cost: 10.000, rep: 3.750, available: true, prereqs: [] },
    { name: 'Artificial Synaptic Potentiation', cost: 80.000, rep: 6.250, available: true, prereqs: [] },
    { name: 'Neural-Retention Enhancement', cost: 250.000, rep: 20.000, available: true, prereqs: [] },
    { name: 'DataJack', cost: 450.000, rep: 112.500, available: true, prereqs: [] }, // Now available!
    { name: 'Embedded Netburner Module', cost: 250.000, rep: 15.000, available: true, prereqs: [] },
    { name: 'Cranial Signal Processors - Gen I', cost: 70.000, rep: 10.000, available: true, prereqs: [] },
    { name: 'Cranial Signal Processors - Gen II', cost: 125.000, rep: 18.750, available: true, prereqs: ['Cranial Signal Processors - Gen I'] },
    { name: 'Cranial Signal Processors - Gen III', cost: 550.000, rep: 50.000, available: true, prereqs: ['Cranial Signal Processors - Gen II'] },
    { name: 'Neurotrainer II', cost: 45.000, rep: 10.000, available: true, prereqs: [] },
    { name: 'CRTX42-AA Gene Modification', cost: 225.000, rep: 45.000, available: true, prereqs: [] }
];

const COST_MULTIPLIER = 1.9;
const STARTING_MONEY = 240000; // 240B in millions

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

function calculateOptimalOrder(prioritizeCranial = false) {
    let availableAugments = augments.filter(aug => aug.available).map(aug => ({
        ...aug,
        originalCost: aug.cost,
        currentCost: aug.cost
    }));

    let remainingMoney = STARTING_MONEY;
    let purchaseOrder = [];
    let totalCost = 0;
    let cranialChainComplete = false;

    while (true) {
        let purchasableAugments = availableAugments.filter(aug =>
            canPurchase(aug, purchaseOrder)
        );

        if (purchasableAugments.length === 0) {
            break;
        }

        // Special logic for cranial-first strategy
        if (prioritizeCranial && !cranialChainComplete) {
            // Check if we still have cranial processors to buy
            const cranialAugments = purchasableAugments.filter(aug =>
                aug.name.includes('Cranial Signal Processors')
            );

            if (cranialAugments.length > 0) {
                // Sort cranial by generation (I, II, III) - buy in order
                cranialAugments.sort((a, b) => {
                    const genA = a.name.includes('Gen I') ? 1 : a.name.includes('Gen II') ? 2 : 3;
                    const genB = b.name.includes('Gen I') ? 1 : b.name.includes('Gen II') ? 2 : 3;
                    return genA - genB;
                });

                // Only consider the next cranial processor in the chain
                purchasableAugments = [cranialAugments[0]];
            } else {
                // No more cranial processors available, chain is complete
                cranialChainComplete = true;
                // Now apply normal strategy (most expensive first) to remaining augments
                purchasableAugments.sort((a, b) => b.currentCost - a.currentCost);
            }
        } else {
            // Normal strategy: sort by current cost descending (most expensive first)
            purchasableAugments.sort((a, b) => b.currentCost - a.currentCost);
        }

        let affordableAugment = null;
        let augmentIndex = -1;

        for (let i = 0; i < purchasableAugments.length; i++) {
            if (purchasableAugments[i].currentCost <= remainingMoney) {
                affordableAugment = purchasableAugments[i];
                augmentIndex = availableAugments.findIndex(aug => aug.name === affordableAugment.name);
                break;
            }
        }

        if (!affordableAugment) {
            break;
        }

        purchaseOrder.push(affordableAugment);
        remainingMoney -= affordableAugment.currentCost;
        totalCost += affordableAugment.currentCost;

        availableAugments.splice(augmentIndex, 1);

        for (let aug of availableAugments) {
            aug.currentCost *= COST_MULTIPLIER;
        }
    }

    return { purchaseOrder, totalCost, remainingMoney };
}

console.log('=== AUGMENTATION PURCHASE OPTIMIZER (COMPARISON) ===');
console.log(`Starting money: $${formatNumber(STARTING_MONEY * 1000000)}`);
console.log(`Cost multiplier per purchase: ${COST_MULTIPLIER}x`);
console.log('');

// Calculate optimal strategy
console.log('=== STRATEGY 1: OPTIMAL ORDER (Most Expensive First) ===');
const optimal = calculateOptimalOrder(false);
for (let i = 0; i < optimal.purchaseOrder.length; i++) {
    const aug = optimal.purchaseOrder[i];
    console.log(`${i+1}. ${aug.name} - $${formatNumber(aug.currentCost * 1000000)}`);
}
console.log(`Total cost: $${formatNumber(optimal.totalCost * 1000000)}`);
console.log(`Remaining: $${formatNumber(optimal.remainingMoney * 1000000)}`);
console.log(`Augments purchased: ${optimal.purchaseOrder.length}`);
console.log('');

// Calculate cranial-first strategy
console.log('=== STRATEGY 2: CRANIAL PROCESSORS FIRST ===');
const cranialFirst = calculateOptimalOrder(true);
for (let i = 0; i < cranialFirst.purchaseOrder.length; i++) {
    const aug = cranialFirst.purchaseOrder[i];
    const isCranial = aug.name.includes('Cranial Signal Processors');
    const marker = isCranial ? ' 🧠' : '';
    console.log(`${i+1}. ${aug.name}${marker} - $${formatNumber(aug.currentCost * 1000000)}`);
}
console.log(`Total cost: $${formatNumber(cranialFirst.totalCost * 1000000)}`);
console.log(`Remaining: $${formatNumber(cranialFirst.remainingMoney * 1000000)}`);
console.log(`Augments purchased: ${cranialFirst.purchaseOrder.length}`);
console.log('');

// Calculate the difference
const costDifference = cranialFirst.totalCost - optimal.totalCost;
const augmentDifference = optimal.purchaseOrder.length - cranialFirst.purchaseOrder.length;

console.log('=== COMPARISON RESULTS ===');
console.log(`Optimal strategy: ${optimal.purchaseOrder.length} augments for $${formatNumber(optimal.totalCost * 1000000)}`);
console.log(`Cranial-first strategy: ${cranialFirst.purchaseOrder.length} augments for $${formatNumber(cranialFirst.totalCost * 1000000)}`);
console.log('');
console.log(`Cost difference: $${formatNumber(Math.abs(costDifference) * 1000000)} ${costDifference > 0 ? 'MORE expensive' : 'LESS expensive'}`);
console.log(`Augment difference: ${Math.abs(augmentDifference)} ${augmentDifference > 0 ? 'FEWER' : 'MORE'} augments`);

if (augmentDifference !== 0) {
    console.log('');
    console.log('=== AUGMENTS MISSED IN CRANIAL-FIRST STRATEGY ===');
    const optimalNames = new Set(optimal.purchaseOrder.map(aug => aug.name));
    const cranialNames = new Set(cranialFirst.purchaseOrder.map(aug => aug.name));

    for (let aug of optimal.purchaseOrder) {
        if (!cranialNames.has(aug.name)) {
            console.log(`- ${aug.name} (would cost too much after cranial purchases)`);
        }
    }
}

console.log('');
console.log('=== KEY INSIGHTS ===');
console.log('1. Buying expensive augments first minimizes the impact of the 1.9x multiplier');
console.log('2. The cranial chain gets VERY expensive if other augments are bought first');
console.log('3. But other expensive augments become unaffordable if cranial chain is prioritized');
console.log('4. The optimal strategy balances chain completion timing with cost minimization');