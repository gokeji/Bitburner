import { getSafeBitNodeMultipliers } from "./bitnode-multipliers.js";
import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    let maxPaybackHours = parseInt(ns.args[0]) || 0.2; // Stop upgrading if payback time > 12 minutes
    let prioritizeNetburnersRequirement = ns.args.includes("--netburners"); // If true, prioritize buying 8 nodes

    const currentBitnode = ns.getResetInfo().currentNode;

    // Get BitNode multipliers with fallback support
    let bitNodeMultipliers = getSafeBitNodeMultipliers(ns, currentBitnode); // Default to BitNode 4 if unavailable
    let bitnodeHacknetNodeMoneyMultiplier = bitNodeMultipliers.HacknetNodeMoney;
    const playerHacknetMultipliers = ns.getHacknetMultipliers();
    let totalHacknetProdMult = bitnodeHacknetNodeMoneyMultiplier * playerHacknetMultipliers.production;

    const isUsingHacknetServers = ns.hacknet.getNodeStats(0).hashCapacity > 0;

    /** @type {Array<HacknetServer>} */
    let hacknetServers = [];
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

    ns.print(`Hacknet hash capacity: ${ns.hacknet.hashCapacity(0)}`);
    // ns.print(`Hacknet hash cost: ${ns.hacknet.hashCost()}`);
    ns.print(`Hacknet node count: ${ns.hacknet.numNodes()}`);
    ns.print(`Hacknet num hashes: ${ns.hacknet.numHashes()}`);
    ns.print(`Hacknet max num nodes: ${ns.hacknet.maxNumNodes()}`); // 100
    const nodeStats0 = ns.hacknet.getNodeStats(0);
    ns.print(`Hacknet node stats 0: ${JSON.stringify(nodeStats0)}`);
    ns.print(`Production calc: ${hacknetServers[0].getProd(totalHacknetProdMult)}`);
    const nodeStats1 = ns.hacknet.getNodeStats(1);
    ns.print(`Hacknet node stats 1: ${JSON.stringify(nodeStats1)}`);
    ns.print(`Production calc: ${hacknetServers[1].getProd(totalHacknetProdMult)}`);

    ns.print(
        `Starting hacknet manager. Max payback time: ${maxPaybackHours} hours. Prioritize Netburners (Buy 8 nodes): ${prioritizeNetburnersRequirement}`,
    );
    ns.tprint(
        `Starting hacknet manager. Max payback time: ${maxPaybackHours} hours. Prioritize Netburners (Buy 8 nodes): ${prioritizeNetburnersRequirement}`,
    );

    if (isUsingHacknetServers) {
        ns.print("Using hacknet servers");
    } else {
        ns.print("Not using hacknet servers");
    }

    while (true) {
        let currentNodeStats = [];

        let nodeValue = HacknetServer.newBaseServer().getProd(totalHacknetProdMult);
        let nodeCost = ns.hacknet.getPurchaseNodeCost();

        // Calculate payback time for new node
        let nodePaybackTime = nodeCost / nodeValue;
        let nodePaybackHours = nodePaybackTime / 3600;

        currentNodeStats.push({
            value: nodeValue,
            cost: nodeCost,
            ratio: nodeValue / nodeCost,
            paybackTime: nodePaybackTime,
            paybackHours: nodePaybackHours,
            index: ns.hacknet.numNodes(),
            type: "node",
        });

        if (prioritizeNetburnersRequirement) {
            // Purchase 8 nodes if we have the money, otherwise wait
            while (ns.hacknet.numNodes() < 8) {
                if (ns.getServerMoneyAvailable("home") < ns.hacknet.getPurchaseNodeCost()) {
                    await ns.sleep(10000);
                } else {
                    ns.hacknet.purchaseNode();
                }
            }
        }

        for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
            let hacknetServer = hacknetServers[idx];

            let levelCost = ns.hacknet.getLevelUpgradeCost(idx, 1);
            let ramCost = ns.hacknet.getRamUpgradeCost(idx, 1);
            let coreCost = ns.hacknet.getCoreUpgradeCost(idx, 1);

            ns.print(
                `hacknetServer.plusLevel(1).getProd(totalHacknetProdMult): ${hacknetServer.plusLevel(1).getProd(totalHacknetProdMult)}`,
            );
            ns.print(`hacknetServer.getProd(totalHacknetProdMult): ${hacknetServer.getProd(totalHacknetProdMult)}`);

            let levelValue =
                hacknetServer.plusLevel(1).getProd(totalHacknetProdMult) - hacknetServer.getProd(totalHacknetProdMult);
            let ramValue =
                hacknetServer.plusRam(1).getProd(totalHacknetProdMult) - hacknetServer.getProd(totalHacknetProdMult);
            let coreValue =
                hacknetServer.plusCores(1).getProd(totalHacknetProdMult) - hacknetServer.getProd(totalHacknetProdMult);

            ns.print(`Level value: ${levelValue}`);
            ns.print(`Ram value: ${ramValue}`);
            ns.print(`Core value: ${coreValue}`);

            // Calculate payback times in seconds
            let levelPaybackTime = levelCost / levelValue;
            let ramPaybackTime = ramCost / ramValue;
            let corePaybackTime = coreCost / coreValue;

            currentNodeStats.push(
                {
                    value: levelValue,
                    cost: levelCost,
                    ratio: levelValue / levelCost,
                    paybackTime: levelPaybackTime,
                    paybackHours: levelPaybackTime / 3600, // Convert to hours
                    index: idx,
                    type: "level",
                },
                {
                    value: ramValue,
                    cost: ramCost,
                    ratio: ramValue / ramCost,
                    paybackTime: ramPaybackTime,
                    paybackHours: ramPaybackTime / 3600,
                    index: idx,
                    type: "ram",
                },
                {
                    value: coreValue,
                    cost: coreCost,
                    ratio: coreValue / coreCost,
                    paybackTime: corePaybackTime,
                    paybackHours: corePaybackTime / 3600,
                    index: idx,
                    type: "core",
                },
            );
        }

        currentNodeStats.sort((a, b) => a.paybackTime - b.paybackTime);
        let bestUpgrade = currentNodeStats[0];

        // Debug all of the upgrade types before returning
        for (let upgrade of currentNodeStats) {
            ns.print(
                `Node ${upgrade.index} ${upgrade.type.padEnd(5)}: production: ${ns.formatNumber(upgrade.value).padStart(8)}, cost: ${ns.formatNumber(upgrade.cost).padStart(10)}, ratio: ${upgrade.ratio.toFixed(6).padStart(10)}, payback: ${(upgrade.paybackTime / 3600).toFixed(2).padStart(6)}h`,
            );
        }

        // Log the best upgrade with payback time info
        let nodeInfo = bestUpgrade.type === "node" ? "" : ` on node ${bestUpgrade.index}`;
        let productionInfo =
            bestUpgrade.type === "node"
                ? `Production: $${ns.formatNumber(bestUpgrade.value)}/sec`
                : `Additional $/sec: ${ns.formatNumber(bestUpgrade.value)}`;

        ns.print(
            `Best upgrade: ${bestUpgrade.type.toUpperCase()}${nodeInfo}, ` +
                `Cost: $${ns.formatNumber(bestUpgrade.cost, 2)}, ` +
                `${productionInfo}, ` +
                `Payback time: ${ns.tFormat(bestUpgrade.paybackTime * 1000)}`,
        );

        // Check if payback time is too long
        if (bestUpgrade.paybackHours > maxPaybackHours) {
            let upgradeType = bestUpgrade.type === "node" ? "New hacknet node" : `Hacknet ${bestUpgrade.type} upgrade`;

            let printMessage = `${upgradeType} payback time (${bestUpgrade.paybackHours} hours) exceeds maximum (${maxPaybackHours} hours). Stopping upgrades.`;

            ns.print(printMessage);
            ns.tprint(printMessage);
            break;
        }

        return;

        // while (ns.getServerMoneyAvailable("home") < bestUpgrade.cost) {
        //     await ns.sleep(10000);
        // }

        // switch (bestUpgrade.type) {
        //     case "level":
        //         ns.hacknet.upgradeLevel(bestUpgrade.index, 1);
        //         ns.print(`Upgraded level on node ${bestUpgrade.index}`);
        //         break;
        //     case "ram":
        //         ns.hacknet.upgradeRam(bestUpgrade.index, 1);
        //         ns.print(`Upgraded ram on node ${bestUpgrade.index}`);
        //         break;
        //     case "core":
        //         ns.hacknet.upgradeCore(bestUpgrade.index, 1);
        //         ns.print(`Upgraded core on node ${bestUpgrade.index}`);
        //         break;
        //     case "node":
        //         ns.hacknet.purchaseNode();
        //         ns.print(`Purchased node`);
        //         break;
        // }

        // await ns.sleep(10000);
    }
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
        return new HacknetServer("hacknet-server-test", 1, 1, 1, 0, 0, 0, 1, 0, 0);
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
