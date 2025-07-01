import { NS } from "@ns";
import { getServers } from "./hacker.js";

const hashUpgrades = {
    money: "Sell for Money",
    corporationFunds: "Sell for Corporation Funds",
    minSecurity: "Reduce Minimum Security",
    maxMoney: "Increase Maximum Money",
    studying: "Improve Studying",
    gym: "Improve Gym Training",
    corporationResearch: "Exchange for Corporation Research",
    bladeburnerRank: "Exchange for Bladeburner Rank",
    bladeburnerSP: "Exchange for Bladeburner SP",
    codingContract: "Generate Coding Contract",
    companyFavor: "Company Favor",
};

const argsSchema = [
    ["money", false],
    ["corporationFunds", false],
    ["minSecurity", false],
    ["maxMoney", false],
    ["studying", false],
    ["gym", false],
    ["corporationResearch", false],
    ["bladeburnerRank", false],
    ["bladeburnerSP", false],
    ["codingContract", false],
    ["companyFavor", false],
];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    return [];
}

let maxMoneyServer = null;

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    const flags = ns.flags(argsSchema);
    const money = flags["money"];
    // const corporationFunds = flags["corporationFunds"];
    const minSecurity = flags["minSecurity"];
    const maxMoney = flags["maxMoney"];
    const studying = flags["studying"];
    const gym = flags["gym"];
    // const corporationResearch = flags["corporationResearch"];
    // const bladeburnerRank = flags["bladeburnerRank"];
    // const bladeburnerSP = flags["bladeburnerSP"];
    // const codingContract = flags["codingContract"];
    // const companyFavor = flags["companyFavor"];

    ns.ui.openTail();

    while (true) {
        if (studying) {
            const { cost, success, level } = spendHashesOnUpgrade(ns, hashUpgrades.studying);
            const studyingBonus = level * 20;

            if (success) {
                logUpgradeSuccess(ns, hashUpgrades.studying, `${ns.formatNumber(studyingBonus)}%`, cost);
            }
        }

        if (gym) {
            const { cost, success, level } = spendHashesOnUpgrade(ns, hashUpgrades.gym);
            const gymBonus = level * 20;

            if (success) {
                logUpgradeSuccess(ns, hashUpgrades.gym, `${ns.formatNumber(gymBonus)}%`, cost);
            }
        }

        if (maxMoney) {
            if (maxMoneyServer === null) {
                maxMoneyServer = getMaxMoneyServer(ns);
                ns.print(`Max money server: ${maxMoneyServer}`);
            }

            const startingMoney = ns.getServerMaxMoney(maxMoneyServer);
            const { cost, success, level } = spendHashesOnUpgrade(ns, "Increase Maximum Money", maxMoneyServer);

            if (success) {
                const endingMoney = ns.getServerMaxMoney(maxMoneyServer);
                logUpgradeSuccess(
                    ns,
                    "Max Money",
                    `${maxMoneyServer} | ${ns.formatNumber(startingMoney)} -> ${ns.formatNumber(endingMoney)}`,
                    cost,
                );
            }
        }

        if (minSecurity) {
            if (maxMoneyServer === null) {
                maxMoneyServer = getMaxMoneyServer(ns);
                ns.print(`Max money server: ${maxMoneyServer}`);
            }

            const startingSecurity = ns.getServerMinSecurityLevel(maxMoneyServer);
            if (ns.getServer(maxMoneyServer).hackDifficulty > 1) {
                const { cost, success, level } = spendHashesOnUpgrade(ns, "Reduce Minimum Security", maxMoneyServer);

                if (success) {
                    const endingSecurity = ns.getServerMinSecurityLevel(maxMoneyServer);
                    logUpgradeSuccess(
                        ns,
                        "Min Security",
                        `${maxMoneyServer} | ${ns.formatNumber(startingSecurity)} -> ${ns.formatNumber(endingSecurity)}`,
                        cost,
                    );
                }
            }
        }
        await ns.sleep(5000);
    }
}

/**
 * Attempts to spend hashes on an upgrade and returns upgrade information
 * @param {NS} ns - NetScript namespace
 * @param {string} upgradeName - Name of the hash upgrade
 * @param {string} [target] - Optional target for upgrades that require one
 * @returns {{cost: number, success: boolean, level: number}} Upgrade information
 */
function spendHashesOnUpgrade(ns, upgradeName, target = undefined) {
    const cost = ns.hacknet.hashCost(upgradeName);
    const success = ns.hacknet.spendHashes(upgradeName, target);
    const level = ns.hacknet.getHashUpgradeLevel(upgradeName);

    return { cost, success, level };
}

/**
 * Displays success messages for hash upgrades
 * @param {NS} ns - NetScript namespace
 * @param {string} upgradeName - Name of the upgrade
 * @param {string} effectString - Description of the upgrade effect
 * @param {number} cost - Cost of the upgrade
 */
function logUpgradeSuccess(ns, upgradeName, effectString, cost) {
    const timestamp = new Date().toLocaleTimeString();
    const message = `SUCCESS: ${timestamp} ${upgradeName} | ${effectString} | ${ns.formatNumber(cost)} Hashes`;
    const toastMessage = `${upgradeName} | ${effectString} | ${ns.formatNumber(cost, 0)} Hashes`;

    ns.print(message);
    ns.toast(toastMessage);
}

/**
 * Finds the server with the highest max money
 * @param {NS} ns - NetScript namespace
 * @returns {string | null} The server with the highest max money, or null if there are no servers
 */
function getMaxMoneyServer(ns) {
    const servers = getHackableServers(ns);
    if (servers.length === 0) {
        return null;
    }
    return servers.reduce((max, server) => {
        return ns.getServerMaxMoney(server) > ns.getServerMaxMoney(max) ? server : max;
    }, servers[0]);
}

/**
 * Gets all servers that are accessible to the player.
 * Also handles nuking servers, backdooring faction servers, and solving contracts.
 * Uses caching to avoid expensive BFS traversals on every call.
 * @param {NS} ns - The Netscript API.
 * @returns {string[]} - List of server names.
 */
function getHackableServers(ns) {
    // Cache miss - perform BFS traversal
    const discovered = new Set(["home"]); // Track all discovered servers
    const toScan = ["home"]; // Queue of servers to scan
    const resultSet = new Set();

    const isHackable = (server) => {
        if (!ns.hasRootAccess(server)) return false;
        if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) return false;
        if (ns.getServerMaxMoney(server) === 0) return false;
        if (server === "home") return false;
        return true;
    };
    // BFS traversal of the server network
    while (toScan.length > 0) {
        const server = toScan.shift(); // Process next server in queue

        if (isHackable(server)) {
            resultSet.add(server);
        }

        // Scan for connected servers and add new ones to the queue
        const connectedServers = ns.scan(server);
        for (const connectedServer of connectedServers) {
            if (!discovered.has(connectedServer)) {
                toScan.push(connectedServer);
                discovered.add(connectedServer);
            }
        }
    }

    // Move home server to end of list so leftover free RAM can be used for "home" server
    const result = Array.from(resultSet);
    const homeIndex = result.indexOf("home");
    if (homeIndex > -1) {
        const homeServer = result.splice(homeIndex, 1)[0];
        result.push(homeServer);
    }

    return result;
}
