import { getSafeBitNodeMultipliers } from "./bitnode-multipliers.js";
import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    let maxPaybackHours = parseFloat(ns.args[0]) || 0.2; // Stop upgrading if payback time > 12 minutes
    let prioritizeNetburnersRequirement = ns.args.includes("--netburners"); // If true, prioritize buying 8 nodes
    let continuousMode = ns.args.includes("--continuous"); // If true, continue upgrading as long as spending < 1% of player money
    let HACKNET_SPEND_PERCENTAGE = 0.001;

    const HACKNET_MAX_SPEND = 2e12; // 2 trillion

    ns.ui.openTail();

    const currentBitnode = ns.getResetInfo().currentNode;

    // Get BitNode multipliers with fallback support
    let bitNodeMultipliers = getSafeBitNodeMultipliers(ns, currentBitnode); // Default to BitNode 4 if unavailable
    let bitnodeHacknetNodeMoneyMultiplier = bitNodeMultipliers.HacknetNodeMoney;
    const playerHacknetMultipliers = ns.getHacknetMultipliers();
    let totalHacknetProdMult = bitnodeHacknetNodeMoneyMultiplier * playerHacknetMultipliers.production;

    const isUsingHacknetServers = true; // TODO: Do not hardcode

    const startingMessage = continuousMode
        ? `Starting hacknet manager. Prioritize Netburners (Buy 8 nodes): ${prioritizeNetburnersRequirement}. Continuous mode: ${continuousMode}`
        : `Starting hacknet manager. Max payback time: ${maxPaybackHours} hours. Prioritize Netburners (Buy 8 nodes): ${prioritizeNetburnersRequirement}`;
    ns.print(startingMessage);
    ns.tprint(startingMessage);

    if (isUsingHacknetServers) {
        ns.print("Using hacknet servers");
    } else {
        ns.print("Not using hacknet servers");
    }

    // Initialize upgrade tallies
    let upgradeTally = {
        level: 0,
        ram: 0,
        core: 0,
        node: 0,
    };

    function printUpgradeSummary() {
        const bitnodeHacknetSpend = Math.abs(ns.getMoneySources().sinceInstall.hacknet_expenses);
        const totalUpgrades = upgradeTally.level + upgradeTally.ram + upgradeTally.core + upgradeTally.node;
        if (totalUpgrades === 0) return;

        // ANSI Color Reference:
        // Basic colors: 30-37 (foreground), 40-47 (background)
        // Bright colors: 90-97 (foreground), 100-107 (background)
        // 31=red, 32=green, 33=yellow, 34=blue, 35=magenta, 36=cyan, 37=white
        // 91=bright red, 92=bright green, 93=bright yellow, etc.

        const cyan = "\u001b[36m"; // Standard cyan
        const green = "\u001b[32m"; // Standard green
        const yellow = "\u001b[33m"; // Standard yellow
        const magenta = "\u001b[35m"; // Standard magenta
        const reset = "\u001b[0m"; // Reset all formatting

        // Additional color examples:
        const red = "\u001b[31m";
        const blue = "\u001b[34m";
        const brightRed = "\u001b[91m";
        // const brightGreen = "\u001b[92m";
        // const bold = "\u001b[1m";
        // const underline = "\u001b[4m";

        ns.print(`\n=== UPGRADE SUMMARY ===`);
        ns.print(`${new Date().toLocaleString()}`);
        ns.print(`Total upgrades: ${totalUpgrades}`);
        if (upgradeTally.level > 0) ns.print(`${green}Level upgrades: ${upgradeTally.level}${reset}`);
        if (upgradeTally.ram > 0) ns.print(`${magenta}RAM upgrades: ${upgradeTally.ram}${reset}`);
        if (upgradeTally.core > 0) ns.print(`${yellow}Core upgrades: ${upgradeTally.core}${reset}`);
        if (upgradeTally.node > 0) ns.print(`${red}New nodes: ${upgradeTally.node}${reset}`);
        ns.print(`Total bitnode hacknet spend: $${ns.formatNumber(bitnodeHacknetSpend)}`);
        ns.print(`=======================\n`);
    }

    function convertHashToMoney(hashes) {
        const sellForMoneyLevel = ns.hacknet.getHashUpgradeLevel("Sell for Money");
        if (isUsingHacknetServers) {
            return hashes * 0.25e6; // 250k hashes per second
        } else {
            return hashes;
        }
    }

    let hasPrintedWaitingMessage = false;

    while (true) {
        /** @type {Array<{value: number, cost: number, valueMoney: number, ratio: number, paybackTime: number, paybackHours: number, index: number, type: string}>} */
        let currentNodeUpgrades = [];
        /** @type {Array<HacknetServer>} */
        let hacknetServers = [];

        const bitnodeHacknetSpend = Math.abs(ns.getMoneySources().sinceInstall.hacknet_expenses);
        const continuousSpendLimit = ns.getPlayer().money * HACKNET_SPEND_PERCENTAGE;
        if (bitnodeHacknetSpend > HACKNET_MAX_SPEND || bitnodeHacknetSpend > continuousSpendLimit) {
            if (continuousMode) {
                if (!hasPrintedWaitingMessage) {
                    printUpgradeSummary(); // Print summary before waiting
                    ns.print(
                        `Exceeded max spend of ${ns.formatNumber(continuousSpendLimit)}. Waiting for more money...`,
                    );
                    hasPrintedWaitingMessage = true;
                }
                await ns.sleep(10000); // Wait 10 seconds before checking again
                continue;
            } else {
                printUpgradeSummary(); // Print summary before stopping
                ns.print(
                    `Bitnode hacknet spend exceeds max spend of ${ns.formatNumber(HACKNET_MAX_SPEND)}. Stopping upgrades.`,
                );
                ns.tprint(
                    `Bitnode hacknet spend exceeds max spend of ${ns.formatNumber(HACKNET_MAX_SPEND)}. Stopping upgrades.`,
                );
                break;
            }
        }
        hasPrintedWaitingMessage = false;

        // Update the current list of hacknet servers
        for (let i = 0; i < ns.hacknet.numNodes(); i++) {
            const nodeStats = ns.hacknet.getNodeStats(i);
            hacknetServers.push(
                new HacknetServer(
                    nodeStats.name,
                    nodeStats.level,
                    nodeStats.ram,
                    nodeStats.cores,
                    nodeStats.production,
                    nodeStats.timeOnline,
                    nodeStats.totalProduction,
                    nodeStats.cache,
                    nodeStats.hashCapacity,
                    nodeStats.ramUsed,
                ),
            );
        }

        // Add a new node to the list of upgrades
        let nodeValue = HacknetServer.newBaseServer().getProd(totalHacknetProdMult);
        let nodeCost = ns.hacknet.getPurchaseNodeCost();
        let nodeValueMoney = convertHashToMoney(nodeValue);

        // Calculate payback time for new node
        let nodePaybackTime = nodeCost / nodeValueMoney;
        let nodePaybackHours = nodePaybackTime / 3600;

        const nodePurchaseUpgrade = {
            value: nodeValue,
            cost: nodeCost,
            valueMoney: nodeValueMoney,
            ratio: nodeValueMoney / nodeCost,
            paybackTime: nodePaybackTime,
            paybackHours: nodePaybackHours,
            index: ns.hacknet.numNodes(),
            type: "node",
        };
        currentNodeUpgrades.push(nodePurchaseUpgrade);

        if (prioritizeNetburnersRequirement) {
            // Purchase 8 nodes if we have the money, otherwise wait
            while (ns.hacknet.numNodes() < 8) {
                if (ns.getServerMoneyAvailable("home") < ns.hacknet.getPurchaseNodeCost()) {
                    await ns.sleep(10000);
                } else {
                    ns.hacknet.purchaseNode();
                    upgradeTally.node++;
                }
            }
        }

        for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
            let hacknetServer = hacknetServers[idx];

            let levelCost = ns.hacknet.getLevelUpgradeCost(idx, 1);
            let ramCost = ns.hacknet.getRamUpgradeCost(idx, 1);
            let coreCost = ns.hacknet.getCoreUpgradeCost(idx, 1);

            let levelValue =
                hacknetServer.plusLevel(1).getProd(totalHacknetProdMult) - hacknetServer.getProd(totalHacknetProdMult);
            let ramValue =
                hacknetServer.plusRam(1).getProd(totalHacknetProdMult) - hacknetServer.getProd(totalHacknetProdMult);
            let coreValue =
                hacknetServer.plusCores(1).getProd(totalHacknetProdMult) - hacknetServer.getProd(totalHacknetProdMult);

            let levelValueMoney = convertHashToMoney(levelValue);
            let ramValueMoney = convertHashToMoney(ramValue);
            let coreValueMoney = convertHashToMoney(coreValue);

            // Calculate payback times in seconds
            let levelPaybackTime = levelCost / levelValueMoney;
            let ramPaybackTime = ramCost / ramValueMoney;
            let corePaybackTime = coreCost / coreValueMoney;

            currentNodeUpgrades.push(
                {
                    value: levelValue,
                    cost: levelCost,
                    valueMoney: levelValueMoney,
                    ratio: levelValueMoney / levelCost,
                    paybackTime: levelPaybackTime,
                    paybackHours: levelPaybackTime / 3600, // Convert to hours
                    index: idx,
                    type: "level",
                },
                {
                    value: ramValue,
                    cost: ramCost,
                    valueMoney: ramValueMoney,
                    ratio: ramValueMoney / ramCost,
                    paybackTime: ramPaybackTime,
                    paybackHours: ramPaybackTime / 3600,
                    index: idx,
                    type: "ram",
                },
                {
                    value: coreValue,
                    cost: coreCost,
                    valueMoney: coreValueMoney,
                    ratio: coreValueMoney / coreCost,
                    paybackTime: corePaybackTime,
                    paybackHours: corePaybackTime / 3600,
                    index: idx,
                    type: "core",
                },
            );
        }

        currentNodeUpgrades.sort((a, b) => a.paybackTime - b.paybackTime);
        let bestUpgrade = currentNodeUpgrades[0];

        // Buy a new node if we have the money and are in continuous mode
        if (continuousMode && nodePurchaseUpgrade.cost < HACKNET_MAX_SPEND / 5) {
            bestUpgrade = nodePurchaseUpgrade;
        }

        // Debug all of the upgrade types before returning
        // for (let upgrade of currentNodeUpgrades) {
        //     ns.print(
        //         `Node ${upgrade.index} ${upgrade.type.padEnd(5)}: production: ${ns.formatNumber(upgrade.value, 5).padStart(8)}, cost: ${ns.formatNumber(upgrade.cost).padStart(6)}, moneyValue: ${ns.formatNumber(upgrade.valueMoney).padStart(6)}, ratio: ${upgrade.ratio.toFixed(6).padStart(10)}, payback: ${(upgrade.paybackTime / 3600).toFixed(2).padStart(6)}h`,
        //     );
        // }

        // Log the best upgrade with payback time info
        let nodeInfo = bestUpgrade.type === "node" ? "" : ` on node ${bestUpgrade.index}`;
        let productionInfo =
            bestUpgrade.type === "node"
                ? `Production: $${ns.formatNumber(bestUpgrade.value)}/sec`
                : `Additional $/sec: ${ns.formatNumber(bestUpgrade.value)}`;

        // ns.print(
        //     `Best upgrade: ${bestUpgrade.type.toUpperCase()}${nodeInfo} | Cost: $${ns.formatNumber(bestUpgrade.cost, 2)} | ${productionInfo} | Payback: ${ns.tFormat(bestUpgrade.paybackTime * 1000)}`,
        // );

        // Check if payback time is too long
        if (bestUpgrade.paybackHours > maxPaybackHours && !continuousMode) {
            let upgradeType = bestUpgrade.type === "node" ? "New hacknet node" : `Hacknet ${bestUpgrade.type} upgrade`;

            let printMessage = `${upgradeType} payback time (${bestUpgrade.paybackHours} hours) exceeds maximum (${maxPaybackHours} hours). Stopping upgrades.`;

            printUpgradeSummary(); // Print summary before stopping
            ns.print(printMessage);
            ns.tprint(printMessage);
            break;
        }

        while (ns.getServerMoneyAvailable("home") < bestUpgrade.cost) {
            await ns.sleep(10000);
        }

        // Perform the upgrade and tally it
        switch (bestUpgrade.type) {
            case "level":
                ns.hacknet.upgradeLevel(bestUpgrade.index, 1);
                upgradeTally.level++;
                break;
            case "ram":
                ns.hacknet.upgradeRam(bestUpgrade.index, 1);
                upgradeTally.ram++;
                break;
            case "core":
                ns.hacknet.upgradeCore(bestUpgrade.index, 1);
                upgradeTally.core++;
                break;
            case "node":
                ns.hacknet.purchaseNode();
                upgradeTally.node++;
                break;
        }

        // await ns.sleep(100);
    }

    // Print final summary when script ends
    printUpgradeSummary();
}

class HacknetServer {
    constructor(name, level, ram, cores, production, timeOnline, totalProduction, cache, hashCapacity, ramUsed) {
        this.name = name;
        this.level = level;
        this.ram = ram;
        this.cores = cores;
        this.production = production;
        this.timeOnline = timeOnline;
        this.totalProduction = totalProduction;
        this.cache = cache;
        this.hashCapacity = hashCapacity;
        this.ramUsed = ramUsed;
    }

    static newBaseServer() {
        return new HacknetServer("hacknet-server-test", 1, 1, 1, 0, 0, 0, 1, 32 * Math.pow(2, 1), 0);
    }

    isHacknetServer() {
        return this.hashCapacity > 0;
    }

    plusLevel(amount) {
        return new HacknetServer(
            this.name,
            this.level + amount,
            this.ram,
            this.cores,
            this.production,
            this.timeOnline,
            this.totalProduction,
            this.cache,
            this.hashCapacity,
            this.ramUsed,
        );
    }

    plusRam(amount) {
        return new HacknetServer(
            this.name,
            this.level,
            this.ram + amount,
            this.cores,
            this.production,
            this.timeOnline,
            this.totalProduction,
            this.cache,
            this.hashCapacity,
            this.ramUsed,
        );
    }

    plusCores(amount) {
        return new HacknetServer(
            this.name,
            this.level,
            this.ram,
            this.cores + amount,
            this.production,
            this.timeOnline,
            this.totalProduction,
            this.cache,
            this.hashCapacity,
            this.ramUsed,
        );
    }

    getProd(totalHacknetProdMult) {
        if (this.isHacknetServer()) {
            return calculateHashGainRate(
                this.level,
                0, // assume no used ram for optimal production calculation
                this.ram,
                this.cores,
                totalHacknetProdMult,
            );
        } else {
            return this.level * 1.5 * Math.pow(1.035, this.ram - 1) * ((this.cores + 5) / 6) * totalHacknetProdMult;
        }
    }
}

const HashesPerLevel = 0.001;
function calculateHashGainRate(level, ramUsed, maxRam, cores, totalHacknetProdMult) {
    const baseGain = HashesPerLevel * level;
    const ramMultiplier = Math.pow(1.07, Math.log2(maxRam));
    const coreMultiplier = 1 + (cores - 1) / 5;
    const ramRatio = 1 - ramUsed / maxRam;

    return baseGain * ramMultiplier * coreMultiplier * ramRatio * totalHacknetProdMult;
}

// enum HashUpgradeEnum {
//   SellForMoney = "Sell for Money",
//   SellForCorporationFunds = "Sell for Corporation Funds",
//   ReduceMinimumSecurity = "Reduce Minimum Security",
//   IncreaseMaximumMoney = "Increase Maximum Money",
//   ImproveStudying = "Improve Studying",
//   ImproveGymTraining = "Improve Gym Training",
//   ExchangeForCorporationResearch = "Exchange for Corporation Research",
//   ExchangeForBladeburnerRank = "Exchange for Bladeburner Rank",
//   ExchangeForBladeburnerSP = "Exchange for Bladeburner SP",
//   GenerateCodingContract = "Generate Coding Contract",
//   CompanyFavor = "Company Favor",
// }
