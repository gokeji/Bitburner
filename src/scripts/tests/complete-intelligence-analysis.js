import { getBladeburnerIntGain, getSuccessesNeededForNextLevel, calculateSkill, calculateExp } from "../formulas.js";

/**
 * Complete intelligence farming analysis including:
 * - Rank rewards from operations
 * - Skill points from ranks
 * - Hyperdrive upgrades from skill points
 * - Compounding experience multipliers
 */

class CompleteBladeburnerModel {
    constructor(startingIntLevel = 1, startingAssassinationLevel = 1) {
        this.intLevel = startingIntLevel;
        this.intExp = calculateExp(startingIntLevel);
        this.assassinationLevel = startingAssassinationLevel;
        this.assassinationSuccesses = 0;
        this.totalOperations = 0;

        // Rank and skill system
        this.totalRanks = 0;
        this.skillPoints = 0;
        this.hyperdriveLevel = 0;

        // Constants for assassination operation
        this.rewardFac = 1.14;
        this.baseRankReward = 44;

        // Hyperdrive skill constants
        this.hyperdriveBaseCost = 1;
        this.hyperdriveCostInc = 2.5;

        // Data collection for plotting
        this.plotData = [];
    }

    /**
     * Calculate rank reward for an assassination operation
     */
    getRankReward() {
        return this.baseRankReward * Math.pow(this.rewardFac, this.assassinationLevel - 1);
    }

    /**
     * Calculate cost for hyperdrive upgrades
     */
    calculateHyperdriveCost(currentLevel, count = 1) {
        const actualCount = currentLevel + count - currentLevel;
        return Math.round(
            actualCount * (this.hyperdriveBaseCost + this.hyperdriveCostInc * (currentLevel + (actualCount - 1) / 2)),
        );
    }

    calculateMaxUpgradeCount(currentLevel, skillPoints) {
        const m = -this.hyperdriveBaseCost - this.hyperdriveCostInc * currentLevel + this.hyperdriveCostInc / 2;
        const delta = Math.sqrt(m * m + 2 * this.hyperdriveCostInc * skillPoints);
        const result = Math.round((m + delta) / this.hyperdriveCostInc);

        // Verify the result due to floating-point precision
        const costOfResultPlus1 = this.calculateHyperdriveCost(currentLevel, result + 1);
        if (costOfResultPlus1 <= skillPoints) {
            return result + 1;
        }
        const costOfResult = this.calculateHyperdriveCost(currentLevel, result);
        if (costOfResult <= skillPoints) {
            return result;
        }
        return result - 1;
    }

    /**
     * Buy as many hyperdrive upgrades as possible with current skill points
     */
    buyHyperdriveUpgrades() {
        const maxUpgrades = this.calculateMaxUpgradeCount(this.hyperdriveLevel, this.skillPoints);
        if (maxUpgrades > 0) {
            const cost = this.calculateHyperdriveCost(this.hyperdriveLevel, maxUpgrades);
            this.skillPoints -= cost;
            this.hyperdriveLevel += maxUpgrades;
            return maxUpgrades;
        }
        return 0;
    }

    /**
     * Perform one assassination operation with all rewards
     */
    performOperation() {
        this.totalOperations++;
        this.assassinationSuccesses++;

        // Get rank reward
        const rankReward = this.getRankReward();
        this.totalRanks += rankReward;

        // Convert ranks to skill points (simplified calculation)
        const newSkillPoints = Math.floor(rankReward / 3);
        this.skillPoints += newSkillPoints;

        // Buy hyperdrive upgrades
        this.buyHyperdriveUpgrades();

        // Get intelligence gain with hyperdrive multiplier
        const baseGains = getBladeburnerIntGain(this.assassinationLevel, this.hyperdriveLevel, true);
        this.intExp += baseGains.intExp;

        // Update intelligence level
        const newIntLevel = calculateSkill(this.intExp);
        this.intLevel = newIntLevel;

        // Check if assassination level increases
        const successesNeeded = getSuccessesNeededForNextLevel(this.assassinationLevel);
        if (this.assassinationSuccesses >= successesNeeded) {
            this.assassinationLevel++;
        }

        // Collect data for plotting (every 1000 operations to avoid too much data)
        if (this.totalOperations % 1000 === 0) {
            this.plotData.push({
                operations: this.totalOperations,
                intLevel: this.intLevel,
                assassinationLevel: this.assassinationLevel,
                hyperdriveLevel: this.hyperdriveLevel,
                intExp: this.intExp,
            });
        }
    }

    formatLargeNumber(number, decimals = 3) {
        // Support up to nonillion, then use scientific notation
        const suffixes = [
            { value: 1e30, symbol: "n" }, // nonillion
            { value: 1e27, symbol: "o" }, // octillion
            { value: 1e24, symbol: "S" }, // septillion
            { value: 1e21, symbol: "s" }, // sextillion
            { value: 1e18, symbol: "Q" }, // quintillion
            { value: 1e15, symbol: "q" }, // quadrillion
            { value: 1e12, symbol: "t" }, // trillion
            { value: 1e9, symbol: "b" }, // billion
            { value: 1e6, symbol: "m" }, // million
            { value: 1e3, symbol: "k" }, // thousand
        ];
        for (const { value, symbol } of suffixes) {
            if (number >= value) {
                return (number / value).toFixed(decimals) + symbol;
            }
        }
        // If number is less than 1e3, just show as is
        if (Math.abs(number) < 1e3) {
            return number.toFixed(decimals);
        }
        // If number is above nonillion, use scientific notation
        return number.toExponential(decimals);
    }

    /**
     * Simulate progression for specified number of operations
     */
    simulateOperations(operationCount) {
        console.log(`Running ${operationCount.toLocaleString()} operations\n`);

        for (let i = 0; i < operationCount; i++) {
            this.performOperation();

            // Progress indicator every 10,000 operations
            if ((i + 1) % 10000 === 0 || i === operationCount - 1) {
                if (i === operationCount - 1) {
                    console.log(`\n\nSimulation complete! Final stats:\n`);
                }
                const progressMsg =
                    `Operations: ${(i + 1).toLocaleString()}/${operationCount.toLocaleString()}, ` +
                    `Int Level: ${this.intLevel}, Assassination Level: ${this.assassinationLevel}, ` +
                    `Int Exp: ${this.formatLargeNumber(this.intExp)}, ` +
                    `Hyperdrive: ${this.formatLargeNumber(this.hyperdriveLevel)}`;

                // Use console.log for progress to ensure it shows up
                console.log(progressMsg);
            }
        }
    }

    /**
     * Generate CSV data for plotting
     */
    generatePlotData() {
        const csvHeader = "Operations,IntLevel,AssassinationLevel,HyperdriveLevel,IntExp\n";
        const csvData = this.plotData
            .map(
                (point) =>
                    `${point.operations},${point.intLevel},${point.assassinationLevel},${point.hyperdriveLevel},${point.intExp}`,
            )
            .join("\n");

        return csvHeader + csvData;
    }

    /**
     * Create a simple ASCII plot of intelligence level vs operations
     */
    createAsciiPlot() {
        if (this.plotData.length === 0) {
            console.log("No plot data available");
            return;
        }

        const width = 80;
        const height = 20;
        const plot = Array(height)
            .fill()
            .map(() => Array(width).fill(" "));

        // Find min/max values
        const minOps = this.plotData[0].operations;
        const maxOps = this.plotData[this.plotData.length - 1].operations;
        const minLevel = Math.min(...this.plotData.map((p) => p.intLevel));
        const maxLevel = Math.max(...this.plotData.map((p) => p.intLevel));

        // Plot points
        this.plotData.forEach((point) => {
            const x = Math.floor(((point.operations - minOps) / (maxOps - minOps)) * (width - 1));
            const y = height - 1 - Math.floor(((point.intLevel - minLevel) / (maxLevel - minLevel)) * (height - 1));

            if (x >= 0 && x < width && y >= 0 && y < height) {
                plot[y][x] = "*";
            }
        });

        // Add labels
        console.log(`\nIntelligence Level vs Operations (${minOps.toLocaleString()} - ${maxOps.toLocaleString()} ops)`);
        console.log(`Level range: ${minLevel.toLocaleString()} - ${maxLevel.toLocaleString()}\n`);

        // Draw the plot
        plot.forEach((row, i) => {
            const level = maxLevel - (i / (height - 1)) * (maxLevel - minLevel);
            const levelLabel = i === 0 ? maxLevel.toLocaleString() : i === height - 1 ? minLevel.toLocaleString() : "";
            console.log(`${levelLabel.padStart(8)} |${row.join("")}|`);
        });

        // Add x-axis labels
        const xLabels = [];
        for (let i = 0; i < width; i += width / 4) {
            const ops = minOps + (i / (width - 1)) * (maxOps - minOps);
            xLabels.push(ops.toLocaleString());
        }
        console.log(`         |${xLabels.map((label, i) => label.padStart(width / 4)).join("")}|`);
    }
}

// Run the analysis
async function main(operationCount = 100000) {
    console.log("=== COMPLETE BITBURNER INTELLIGENCE FARMING ANALYSIS ===");
    console.log("Including rank rewards, skill points, and hyperdrive upgrades\n");

    const model = new CompleteBladeburnerModel(1, 1);

    // Simulate specified number of operations
    model.simulateOperations(operationCount);

    // Generate plot data and create ASCII plot
    console.log("\n" + "=".repeat(60));
    console.log("PLOTTING INTELLIGENCE LEVEL PROGRESSION");
    console.log("=".repeat(60));

    model.createAsciiPlot();

    // Also save CSV data for external plotting
    const csvData = model.generatePlotData();
    const fs = await import("fs");
    const filename = `int-progression-${operationCount}.csv`;
    fs.writeFileSync(filename, csvData);
    console.log(`\nCSV data saved to: ${filename}`);
    console.log("You can use this file with external plotting tools like Python matplotlib, R, or Excel");
}

// Export for testing
export { CompleteBladeburnerModel };

// Run if executed directly
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
    const operationCount = process.argv[2] ? parseInt(process.argv[2]) : 100000;
    main(operationCount).catch(console.error);
}
