// import { configurations as stockConfigs } from "../examples/testStockInfluenceConfigurations.js";
// import { testConfigs } from "../examples/testServerHackConfigurations.js";
// import { testConfigs2 } from "../examples/testServerHackConfigurations2.js";
import { testConfigs3 } from "../examples/testServerHackConfigurations3.js";

/**
 * Fast greedy solution for the knapsack problem.
 * Sorts configurations by value/weight ratio and fills the knapsack greedily.
 * Only one configuration per server allowed.
 */
function knapsackGreedy(configurations, weightLimit) {
    // Sort by throughput (descending)
    const sortedConfigsWithThroughput = configurations.sort((a, b) => b.throughput - a.throughput);

    let remainingWeight = weightLimit;
    const selected = [];
    const usedServers = new Set(); // Track servers already used
    let totalValue = 0;
    let totalWeight = 0;

    // Greedily select configurations
    for (const config of sortedConfigsWithThroughput) {
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
 * Bucketed Dynamic Programming solution for the 0/1 Knapsack problem.
 * Uses adaptive bucketing based on actual weight distribution.
 * Only one configuration per server allowed.
 */
function knapsackBucketed(configurations, weightLimit, numBuckets = 100) {
    // Group configurations by server.
    const configsByServer = new Map();
    for (const config of configurations) {
        if (!configsByServer.has(config.server)) {
            configsByServer.set(config.server, []);
        }
        configsByServer.get(config.server).push(config);
    }
    const serverGroups = Array.from(configsByServer.values());

    const bucketSize = Math.max(1, Math.ceil(weightLimit / numBuckets));

    // dp[w] will be an object { maxValue, selectedConfigs, actualWeight }
    let dp = new Array(numBuckets + 1).fill(null).map(() => ({
        maxValue: 0,
        selectedConfigs: [],
        actualWeight: 0,
    }));

    for (const group of serverGroups) {
        const nextDp = dp.map((item) => ({ ...item, selectedConfigs: [...item.selectedConfigs] }));

        const bucketedGroup = group.map((config) => ({
            ...config,
            bucketWeight: Math.floor(config.ramUsageForSustainedThroughput / bucketSize),
            originalWeight: config.ramUsageForSustainedThroughput,
        }));

        for (let w = numBuckets; w >= 0; w--) {
            // The value if we don't select any configuration from the current group
            let bestForW = dp[w];

            for (const config of bucketedGroup) {
                if (config.bucketWeight <= w) {
                    const remainingState = dp[w - config.bucketWeight];
                    const newActualWeight = remainingState.actualWeight + config.originalWeight;

                    if (newActualWeight <= weightLimit) {
                        const newValue = remainingState.maxValue + config.throughput;
                        if (newValue > bestForW.maxValue) {
                            bestForW = {
                                maxValue: newValue,
                                selectedConfigs: [...remainingState.selectedConfigs, config],
                                actualWeight: newActualWeight,
                            };
                        }
                    }
                }
            }
            nextDp[w] = bestForW;
        }
        dp = nextDp;
    }

    const result = dp[numBuckets];
    const { maxValue, selectedConfigs, actualWeight } = result;

    return {
        selected: selectedConfigs,
        totalValue: maxValue,
        totalWeight: actualWeight,
        remainingWeight: weightLimit - actualWeight,
        bucketSize,
        bucketsUsed: actualWeight > 0 ? Math.floor(actualWeight / bucketSize) : 0,
        uniqueServers: new Set(selectedConfigs.map((c) => c.server)).size,
        totalConfigurations: configurations.length,
    };
}

const configsToTest = testConfigs3.filter((c) => c.batchSustainRatio >= 1);
const weightLimit = 510e3;
console.log("Number of configurations:", configsToTest.length);
console.log("Weight limit:", weightLimit);

console.log("\n=== Greedy Approach ===");
const greedyStart = performance.now();
const greedyResult = knapsackGreedy(configsToTest, weightLimit);
const greedyEnd = performance.now();
const greedyTime = greedyEnd - greedyStart;

console.log("Total value:", greedyResult.totalValue);
console.log("Total weight:", greedyResult.totalWeight);
console.log("Remaining weight:", greedyResult.remainingWeight);
console.log("Number of selected configurations:", greedyResult.selected.length);
console.log(`Performance time: ${greedyTime.toFixed(2)}ms`);

for (const config of greedyResult.selected) {
    console.log(
        `${config.server} - ${config.hackThreads}H (${config.actualHackPercentage}) - ${config.ramRequired}GB/batch, max ${config.batchLimitForSustainedThroughput} concurrent = ${config.ramUsageForSustainedThroughput}GB (${config.batchSustainRatio}) priority - ${config.priority}`,
    );
}

/**
 * Runs a benchmark for the knapsackBucketed function for a given number of runs.
 * @param {object[]} configs - The configurations to test.
 * @param {number} weightLimit - The maximum weight for the knapsack.
 * @param {number} numBuckets - The number of buckets to use.
 * @param {number} numRuns - The number of times to run the benchmark.
 * @returns {object} An object containing the benchmark statistics and the result of the last run.
 */
function runBenchmark(configs, weightLimit, numBuckets, numRuns = 10) {
    const times = [];
    let lastResult = null;

    for (let i = 0; i < numRuns; i++) {
        const start = performance.now();
        lastResult = knapsackBucketed(configs, weightLimit, numBuckets);
        const end = performance.now();
        times.push(end - start);
    }

    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / numRuns;
    const min = Math.min(...times);
    const max = Math.max(...times);

    // Sort times to find median
    times.sort((a, b) => a - b);
    const mid = Math.floor(numRuns / 2);
    const median = numRuns % 2 === 0 ? (times[mid - 1] + times[mid]) / 2 : times[mid];

    // Calculate standard deviation
    const stdDev = Math.sqrt(times.map((x) => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / numRuns);

    return {
        lastResult,
        avgTime: avg,
        minTime: min,
        maxTime: max,
        medianTime: median,
        stdDev,
        numRuns,
    };
}

// JIT warm-up run to ensure consistent performance measurement
console.log("\n--- JIT Warm-up for Bucketed DP ---");
knapsackBucketed(configsToTest, weightLimit, 100);
console.log("Warm-up complete. Starting benchmark...");

const bucketSizesToTest = [50, 80, 90, 100, 500, 1000, 5000];
const numBenchmarkRuns = 10;

console.log(`\n=== Running Bucketed DP Benchmarks (${numBenchmarkRuns} runs each) ===`);

for (const numBuckets of bucketSizesToTest) {
    const benchmarkResult = runBenchmark(configsToTest, weightLimit, numBuckets, numBenchmarkRuns);
    const { lastResult, avgTime, minTime, maxTime, medianTime, stdDev } = benchmarkResult;

    console.log(`\n--- Results for ${numBuckets} buckets ---`);
    console.log(
        `Performance (avg): ${avgTime.toFixed(2)}ms | (median): ${medianTime.toFixed(2)}ms | (min): ${minTime.toFixed(
            2,
        )}ms | (max): ${maxTime.toFixed(2)}ms | (stdDev): ${stdDev.toFixed(2)}ms`,
    );
    console.log("Total value:", lastResult.totalValue);
    console.log("Total weight:", lastResult.totalWeight);
    console.log("Remaining weight:", lastResult.remainingWeight);
    console.log("Number of selected configurations:", lastResult.selected.length);
    console.log("... (details from last run) ...");
    for (const config of lastResult.selected) {
        console.log(
            `  ${config.server} - ${config.hackThreads}H (${config.actualHackPercentage}) - ${config.ramRequired}GB/batch, max ${config.batchLimitForSustainedThroughput} concurrent = ${config.ramUsageForSustainedThroughput}GB (${config.batchSustainRatio}) priority - ${config.priority}`,
        );
    }
}
