import { testConfigs } from "../examples/testServerHackConfigurations.js";

/**
 * Fast greedy solution for the knapsack problem.
 * Sorts configurations by value/weight ratio and fills the knapsack greedily.
 * Only one configuration per server allowed.
 */
function knapsackGreedy(configurations, weightLimit) {
    // Calculate value/weight ratio for each configuration
    const configsWithRatio = configurations.map((config) => ({
        ...config,
        ratio: config.throughput / config.ramUsageForSustainedThroughput,
    }));

    // Sort by value/weight ratio (descending)
    configsWithRatio.sort((a, b) => b.ratio - a.ratio);

    let remainingWeight = weightLimit;
    const selected = [];
    const usedServers = new Set(); // Track servers already used
    let totalValue = 0;
    let totalWeight = 0;

    // Greedily select configurations
    for (const config of configsWithRatio) {
        // Skip if server already used or doesn't fit
        if (usedServers.has(config.server) || config.ramUsageForSustainedThroughput > remainingWeight) {
            continue;
        }

        selected.push(config);
        usedServers.add(config.server);
        totalValue += config.throughput;
        totalWeight += config.ramUsageForSustainedThroughput;
        remainingWeight -= config.ramUsageForSustainedThroughput;
    }

    return { selected, totalValue, totalWeight, remainingWeight };
}

/**
 * Even faster approach: just take the top N configurations by value/weight ratio
 * that fit within the weight limit, without trying to optimize further.
 * Only one configuration per server allowed.
 */
function knapsackTopN(configurations, weightLimit, maxConfigs = 100) {
    // Calculate value/weight ratio for each configuration
    const configsWithRatio = configurations.map((config) => ({
        ...config,
        ratio: config.throughput / config.ramUsageForSustainedThroughput,
    }));

    // Sort by value/weight ratio (descending)
    configsWithRatio.sort((a, b) => b.ratio - a.ratio);

    let remainingWeight = weightLimit;
    const selected = [];
    const usedServers = new Set(); // Track servers already used
    let totalValue = 0;
    let totalWeight = 0;

    // Take top N configurations that fit
    for (let i = 0; i < configsWithRatio.length && selected.length < maxConfigs; i++) {
        const config = configsWithRatio[i];
        // Skip if server already used or doesn't fit
        if (usedServers.has(config.server) || config.ramUsageForSustainedThroughput > remainingWeight) {
            continue;
        }

        selected.push(config);
        usedServers.add(config.server);
        totalValue += config.throughput;
        totalWeight += config.ramUsageForSustainedThroughput;
        remainingWeight -= config.ramUsageForSustainedThroughput;
    }

    return {
        selected,
        totalValue,
        totalWeight,
        remainingWeight,
    };
}

/**
 * Bucketed Dynamic Programming solution for the 0/1 Knapsack problem.
 * Uses adaptive bucketing based on actual weight distribution.
 * Only one configuration per server allowed.
 */
function knapsackBucketed(configurations, weightLimit, numBuckets = 100) {
    // Find unique servers and their best configuration (highest priority per server)
    const serverBestConfigs = new Map();

    for (const config of configurations) {
        const existing = serverBestConfigs.get(config.server);
        if (!existing || config.throughput > existing.throughput) {
            serverBestConfigs.set(config.server, config);
        }
    }

    // Use only the best configuration per server
    const uniqueConfigs = Array.from(serverBestConfigs.values());

    const bucketSize = Math.ceil(weightLimit / numBuckets);

    // Convert weights to bucket indices
    const bucketedConfigs = uniqueConfigs.map((config) => ({
        ...config,
        bucketWeight: Math.ceil(config.ramUsageForSustainedThroughput / bucketSize),
        originalWeight: config.ramUsageForSustainedThroughput,
    }));

    // Initialize DP table: dp[bucket][item] = {maxValue, selectedConfigs}
    const dp = new Array(numBuckets + 1).fill(0).map(() =>
        new Array(uniqueConfigs.length + 1).fill(0).map(() => ({
            maxValue: 0,
            selectedConfigs: [],
        })),
    );

    // Fill the DP table
    for (let i = 1; i <= uniqueConfigs.length; i++) {
        const config = bucketedConfigs[i - 1];
        for (let w = 1; w <= numBuckets; w++) {
            // Option 1: Don't include current item
            dp[w][i] = {
                maxValue: dp[w][i - 1].maxValue,
                selectedConfigs: [...dp[w][i - 1].selectedConfigs],
            };

            // Option 2: Include current item (if it fits)
            if (config.bucketWeight <= w) {
                const valueWithItem = dp[w - config.bucketWeight][i - 1].maxValue + config.throughput;
                if (valueWithItem > dp[w][i].maxValue) {
                    dp[w][i] = {
                        maxValue: valueWithItem,
                        selectedConfigs: [...dp[w - config.bucketWeight][i - 1].selectedConfigs, config],
                    };
                }
            }
        }
    }

    // Find the actual total weight
    const selected = dp[numBuckets][uniqueConfigs.length].selectedConfigs;
    const actualWeight = selected.reduce((sum, config) => sum + config.originalWeight, 0);

    return {
        selected,
        totalValue: dp[numBuckets][uniqueConfigs.length].maxValue,
        totalWeight: actualWeight,
        remainingWeight: weightLimit - actualWeight,
        bucketSize,
        bucketsUsed: numBuckets,
        uniqueServers: uniqueConfigs.length,
        totalConfigurations: configurations.length,
    };
}

/**
 * Dynamic Programming solution for the 0/1 Knapsack problem.
 * This function finds the optimal selection of configurations that maximizes the total value
 * while staying under the given weight limit.
 *
 * @param {Array<{value: number, weight: number}>} configurations - Array of configurations with their values and weights.
 * @param {number} weightLimit - The maximum weight the selection can have.
 * @returns {{selected: Array<{value: number, weight: number}>, totalValue: number}} - The optimal selection and its total value.
 */
function knapsack(configurations, weightLimit) {
    // Initialize a 2D array to store the maximum value that can be obtained with a given weight
    const dp = new Array(weightLimit + 1).fill(0).map(() => new Array(configurations.length + 1).fill(0));

    // Iterate through each configuration and each possible weight from 1 to weightLimit
    for (let i = 1; i <= configurations.length; i++) {
        for (let w = 1; w <= weightLimit; w++) {
            // If the current configuration's weight is less than or equal to the current weight
            if (configurations[i - 1].ramUsageForSustainedThroughput <= w) {
                // Choose the maximum value between including the current configuration and excluding it
                dp[w][i] = Math.max(
                    dp[w][i - 1],
                    dp[w - configurations[i - 1].ramUsageForSustainedThroughput][i - 1] +
                        configurations[i - 1].priority,
                );
            } else {
                // If the current configuration's weight exceeds the current weight, exclude it
                dp[w][i] = dp[w][i - 1];
            }
        }
    }

    // Backtrack to find the selected configurations
    let w = weightLimit;
    let i = configurations.length;
    const selected = [];
    while (i > 0 && w > 0) {
        // If the value at dp[w][i] is different from dp[w][i - 1], it means the current configuration was included
        if (dp[w][i] !== dp[w][i - 1]) {
            selected.push(configurations[i - 1]);
            w -= configurations[i - 1].ramUsageForSustainedThroughput;
        }
        i--;
    }

    // Return the selected configurations and their total value
    return { selected, totalValue: dp[weightLimit][configurations.length] };
}

const weightLimit = 264e3;
console.log("Number of configurations:", testConfigs.length);
console.log("Weight limit:", weightLimit);

console.log("\n=== Greedy Approach ===");
const greedyResult = knapsackGreedy(testConfigs, weightLimit);
console.log("Total value:", greedyResult.totalValue);
console.log("Total weight:", greedyResult.totalWeight);
console.log("Remaining weight:", greedyResult.remainingWeight);
console.log("Number of selected configurations:", greedyResult.selected.length);

console.log("\n=== Top 100 Approach ===");
const topNResult = knapsackTopN(testConfigs, weightLimit, 100);
console.log("Total value:", topNResult.totalValue);
console.log("Total weight:", topNResult.totalWeight);
console.log("Remaining weight:", topNResult.remainingWeight);
console.log("Number of selected configurations:", topNResult.selected.length);

function testBucketed(numBuckets) {
    const performanceStart = performance.now();
    const bucketedResult = knapsackBucketed(testConfigs, weightLimit, numBuckets);
    const performanceEnd = performance.now();
    const performanceTime = performanceEnd - performanceStart;
    console.log(`\n=== Bucketed DP Approach (${numBuckets} buckets) ===`);
    console.log("Total value:", bucketedResult.totalValue);
    console.log("Total weight:", bucketedResult.totalWeight);
    console.log("Remaining weight:", bucketedResult.remainingWeight);
    console.log("Number of selected configurations:", bucketedResult.selected.length);
    console.log("Bucket size:", bucketedResult.bucketSize);
    console.log("Buckets used:", bucketedResult.bucketsUsed);
    console.log("Unique servers:", bucketedResult.uniqueServers);
    console.log("Total configurations:", bucketedResult.totalConfigurations);
    console.log(`Performance time: ${performanceTime.toFixed(2)}ms`);
}

testBucketed(100);
testBucketed(500);
testBucketed(1000);
testBucketed(5000);
testBucketed(10000);
