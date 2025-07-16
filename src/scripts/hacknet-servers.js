import { getSafeBitNodeMultipliers } from "./bitnode-multipliers.js";
import { NS } from "@ns";

const argsSchema = [
    // ["maxPaybackHours", 0.2],
    ["netburners", false],
    ["continuous", false],
];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    const flags = ns.flags(argsSchema);

    const maxPaybackHours = parseFloat(ns.args[0]) || 0.2; // Stop upgrading if payback time > 12 minutes
    const prioritizeNetburnersRequirement = flags["netburners"]; // If true, prioritize buying 8 nodes
    const continuousMode = flags["continuous"]; // If true, continue upgrading as long as spending < 1% of player money
    const HACKNET_SPEND_PERCENTAGE = 0.01;

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

        // Reset the upgrade tally after printing
        upgradeTally = {
            level: 0,
            ram: 0,
            core: 0,
            node: 0,
        };
    }

    function convertHashToMoney(hashes) {
        const sellForMoneyLevel = ns.hacknet.getHashUpgradeLevel("Sell for Money");
        if (isUsingHacknetServers) {
            return hashes * 0.25e6; // 250k hashes per second
        } else {
            return hashes;
        }
    }

    // Function to calculate upgrade options for a specific hacknet node
    function getNodeUpgradeOptions(nodeIndex, hacknetServer) {
        let levelCost = ns.hacknet.getLevelUpgradeCost(nodeIndex, 1);
        let ramCost = ns.hacknet.getRamUpgradeCost(nodeIndex, 1);
        let coreCost = ns.hacknet.getCoreUpgradeCost(nodeIndex, 1);

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

        return [
            {
                value: levelValue,
                cost: levelCost,
                valueMoney: levelValueMoney,
                ratio: levelValueMoney / levelCost,
                paybackTime: levelPaybackTime,
                paybackHours: levelPaybackTime / 3600,
                index: nodeIndex,
                type: "level",
            },
            {
                value: ramValue,
                cost: ramCost,
                valueMoney: ramValueMoney,
                ratio: ramValueMoney / ramCost,
                paybackTime: ramPaybackTime,
                paybackHours: ramPaybackTime / 3600,
                index: nodeIndex,
                type: "ram",
            },
            {
                value: coreValue,
                cost: coreCost,
                valueMoney: coreValueMoney,
                ratio: coreValueMoney / coreCost,
                paybackTime: corePaybackTime,
                paybackHours: corePaybackTime / 3600,
                index: nodeIndex,
                type: "core",
            },
        ];
    }

    // Function to perform a hacknet upgrade and update tally
    function performUpgrade(upgrade) {
        switch (upgrade.type) {
            case "level":
                ns.hacknet.upgradeLevel(upgrade.index, 1);
                upgradeTally.level++;
                break;
            case "ram":
                ns.hacknet.upgradeRam(upgrade.index, 1);
                upgradeTally.ram++;
                break;
            case "core":
                ns.hacknet.upgradeCore(upgrade.index, 1);
                upgradeTally.core++;
                break;
            case "node":
                const newNodeIndex = ns.hacknet.purchaseNode();
                upgradeTally.node++;
                return newNodeIndex;
        }
        return null;
    }

    // Function to upgrade a newly purchased server to 4-hour payback time
    async function upgradeNewServerToPaybackTime(nodeIndex, maxPaybackHours) {
        ns.print(`Upgrading newly purchased server ${nodeIndex} to ${maxPaybackHours}h payback time...`);

        let upgradesMade = 0;

        while (true) {
            const nodeStats = ns.hacknet.getNodeStats(nodeIndex);
            const hacknetServer = new HacknetServer(
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
            );

            // Get upgrade options for this node and find valid upgrades
            let upgradeOptions = getNodeUpgradeOptions(nodeIndex, hacknetServer);
            let validUpgrades = upgradeOptions.filter(
                (upgrade) =>
                    upgrade.paybackHours <= maxPaybackHours && upgrade.cost <= ns.getServerMoneyAvailable("home"),
            );

            if (validUpgrades.length === 0) {
                // No more upgrades under the payback threshold or not enough money
                break;
            }

            // Sort by payback time (best first) and perform the best upgrade
            validUpgrades.sort((a, b) => a.paybackHours - b.paybackHours);
            const bestUpgrade = validUpgrades[0];

            // Perform the upgrade using shared function
            performUpgrade(bestUpgrade);

            upgradesMade++;
        }

        ns.print(`INFO Completed initial upgrades for server ${nodeIndex}. Made ${upgradesMade} upgrades.`);
    }

    let hasPrintedWaitingMessage = false;

    while (true) {
        /** @type {Array<{value: number, cost: number, valueMoney: number, ratio: number, paybackTime: number, paybackHours: number, index: number, type: string}>} */
        let currentNodeUpgrades = [];
        /** @type {Array<HacknetServer>} */
        let hacknetServers = [];

        const bitnodeHacknetSpend = Math.abs(ns.getMoneySources().sinceInstall.hacknet_expenses);

        const bitnodeTotalEarnings =
            ns.getMoneySources().sinceInstall.total -
            ns.getMoneySources().sinceInstall.gang_expenses -
            ns.getMoneySources().sinceInstall.servers -
            ns.getMoneySources().sinceInstall.hacknet_expenses -
            ns.getMoneySources().sinceInstall.augmentations;
        const hacknetMaxSpend = Math.max(
            2e9,
            ns.getPlayer().money * HACKNET_SPEND_PERCENTAGE,
            bitnodeTotalEarnings * HACKNET_SPEND_PERCENTAGE,
        ); // 2 billion or 1% of player money

        // Upgrade cache if one of the improvements is about to exceed it
        if (continuousMode) {
            const allHashUpgrades = ns.hacknet.getHashUpgrades();
            const highestUpgradeCost = allHashUpgrades.reduce(
                (max, upgrade) => Math.max(max, ns.hacknet.hashCost(upgrade)),
                0,
            );
            if (highestUpgradeCost > ns.hacknet.hashCapacity()) {
                let hacknetWithLowestCache = null;
                let lowestCacheServerIndex = null;

                for (let i = 0; i < ns.hacknet.numNodes(); i++) {
                    const node = ns.hacknet.getNodeStats(i);
                    if (hacknetWithLowestCache === null || node.cache < hacknetWithLowestCache.cache) {
                        hacknetWithLowestCache = node;
                        lowestCacheServerIndex = i;
                    }
                }

                if (
                    hacknetWithLowestCache &&
                    ns.hacknet.getCacheUpgradeCost(lowestCacheServerIndex) < ns.getPlayer().money / 5
                ) {
                    ns.hacknet.upgradeCache(lowestCacheServerIndex);
                    ns.print(`Upgraded cache on node ${lowestCacheServerIndex}`);
                }
            }
        }

        if (continuousMode && bitnodeHacknetSpend > hacknetMaxSpend) {
            if (!hasPrintedWaitingMessage) {
                printUpgradeSummary(); // Print summary before waiting
                ns.print(`Exceeded max spend of ${ns.formatNumber(hacknetMaxSpend)}. Waiting for more money...`);
                hasPrintedWaitingMessage = true;
            }
            await ns.sleep(10000); // Wait 10 seconds before checking again
            continue;
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
                    const newNodeIndex = ns.hacknet.purchaseNode();
                    upgradeTally.node++;
                    // Immediately upgrade the newly purchased server to 4-hour payback time
                    await upgradeNewServerToPaybackTime(newNodeIndex, maxPaybackHours);
                }
            }
        }

        for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
            let hacknetServer = hacknetServers[idx];
            let upgradeOptions = getNodeUpgradeOptions(idx, hacknetServer);
            currentNodeUpgrades.push(...upgradeOptions);
        }

        currentNodeUpgrades.sort((a, b) => a.paybackTime - b.paybackTime);
        let bestUpgrade = currentNodeUpgrades[0];

        // Buy a new node if we have the money and are in continuous mode
        if (
            continuousMode &&
            nodePurchaseUpgrade.cost < hacknetMaxSpend / 2 &&
            nodePurchaseUpgrade.cost < ns.getPlayer().money &&
            hacknetServers.length < ns.hacknet.maxNumNodes()
        ) {
            bestUpgrade = nodePurchaseUpgrade;

            // Purchase the node first, then upgrade it
            const newNodeIndex = performUpgrade(bestUpgrade);
            await upgradeNewServerToPaybackTime(newNodeIndex, 2);
            continue; // Skip the normal upgrade flow since we already handled this upgrade
        }

        // Check if payback time is too long
        if (bestUpgrade.paybackHours > maxPaybackHours && !continuousMode) {
            let upgradeType = bestUpgrade.type === "node" ? "New hacknet node" : `Hacknet ${bestUpgrade.type} upgrade`;

            let printMessage = `${upgradeType} payback time (${bestUpgrade.paybackHours} hours) exceeds maximum (${maxPaybackHours} hours). Stopping upgrades.`;

            printUpgradeSummary(); // Print summary before stopping
            ns.print(printMessage);
            ns.tprint(printMessage);
            break;
        }

        if (bestUpgrade.cost != Infinity) {
            while (ns.getServerMoneyAvailable("home") < bestUpgrade.cost) {
                ns.print(
                    `Waiting for ${ns.formatNumber(bestUpgrade.cost)} to upgrade ${bestUpgrade.type} on node ${bestUpgrade.index}...`,
                );
                await ns.sleep(10000);
            }

            // Perform the upgrade and tally it
            performUpgrade(bestUpgrade);
        } else {
            // All hacknet servers are maxed out, wait for cache upgrades.
            await ns.sleep(1000);
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
