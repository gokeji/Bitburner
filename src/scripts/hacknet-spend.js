import { NS } from "@ns";

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
    // ["money", false],
    ["corporationFunds", false],
    ["minSecurity", false],
    ["maxMoney", false],
    ["studying", false],
    ["gym", false],
    ["corporationResearch", false],
    ["bladeburnerRank", false],
    ["bladeburnerSP", false],
    ["codingContract", false],
    // ["companyFavor", false],
    ["target", null],
    ["limit", null],
];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    return [];
}

const MIN_HACK_DIFFICULTY = 10;
const MAX_MONEY = 10e12;

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    const flags = ns.flags(argsSchema);

    const money = flags["money"];
    const minSecurity = flags["minSecurity"];
    const maxMoney = flags["maxMoney"];
    const studying = flags["studying"];
    const gym = flags["gym"];
    const corporationFunds = flags["corporationFunds"];
    const corporationResearch = flags["corporationResearch"];
    const bladeburnerRank = flags["bladeburnerRank"];
    const bladeburnerSP = flags["bladeburnerSP"];
    const codingContract = flags["codingContract"];
    // const companyFavor = flags["companyFavor"];

    ns.ui.openTail();

    let stillNeedMaxMoney = true;
    let stillNeedMinSecurity = true;
    let stillNeedCorporationFunds = true;
    let stillNeedCorporationResearch = true;
    let stillNeedCodingContract = true;

    const manualTarget = flags["target"];
    const limit = flags["limit"];
    let targetServer = null;

    while (true) {
        targetServer = manualTarget || getMaxMoneyServer(ns, targetServer);

        if (studying) {
            const { cost, success, level, count } = spendHashesOnUpgrade(ns, hashUpgrades.studying, null, null, true);
            const studyingBonus = level * 20;

            if (success) {
                logUpgradeSuccess(ns, hashUpgrades.studying, `${ns.formatNumber(studyingBonus)}%`, cost, count);
            }
        }

        if (gym) {
            const { cost, success, level } = spendHashesOnUpgrade(ns, hashUpgrades.gym);
            const gymBonus = level * 20;

            if (success) {
                logUpgradeSuccess(ns, hashUpgrades.gym, `${ns.formatNumber(gymBonus)}%`, cost);
            }
        }

        if (corporationFunds) {
            const { cost, success, level } = spendHashesOnUpgrade(ns, hashUpgrades.corporationFunds, null, limit);

            if (limit && cost > limit) {
                stillNeedCorporationFunds = false;
            }

            if (success) {
                logUpgradeSuccess(ns, "Corporation Funds", `${ns.formatNumber(level)}`, cost);
            }
        }

        if (corporationResearch) {
            const { cost, success, level } = spendHashesOnUpgrade(ns, hashUpgrades.corporationResearch, null, limit);

            if (limit && cost > limit) {
                stillNeedCorporationResearch = false;
            }

            if (success) {
                logUpgradeSuccess(ns, "Exchange for Corporation Research", `${ns.formatNumber(level)}`, cost);
            }
        }

        if (codingContract) {
            const { cost, success, level } = spendHashesOnUpgrade(ns, hashUpgrades.codingContract, null, limit);

            if (limit && cost > limit) {
                stillNeedCodingContract = false;
            }

            if (success) {
                logUpgradeSuccess(ns, "Generate Coding Contract", `${ns.formatNumber(level)}`, cost);
            }
        }

        if (bladeburnerRank) {
            const { cost, success, level, count } = spendHashesOnUpgrade(
                ns,
                hashUpgrades.bladeburnerRank,
                null,
                limit,
                true,
            );

            if (success) {
                logUpgradeSuccess(ns, "Exchange for Bladeburner Rank", `${ns.formatNumber(level)}`, cost, count);
            }
        }

        if (bladeburnerSP) {
            const { cost, success, level, count } = spendHashesOnUpgrade(
                ns,
                hashUpgrades.bladeburnerSP,
                null,
                limit,
                true,
            );

            if (success) {
                logUpgradeSuccess(ns, "Exchange for Bladeburner SP", `${ns.formatNumber(level)}`, cost, count);
            }
        }

        if (maxMoney) {
            const startingMoney = ns.getServerMaxMoney(targetServer);
            // Server max money is soft capped at 10t
            if (startingMoney < MAX_MONEY) {
                const { cost, success, level } = spendHashesOnUpgrade(ns, "Increase Maximum Money", targetServer);

                if (success) {
                    const endingMoney = ns.getServerMaxMoney(targetServer);
                    logUpgradeSuccess(
                        ns,
                        "Max Money",
                        `${targetServer} | ${ns.formatNumber(startingMoney)} -> ${ns.formatNumber(endingMoney)}`,
                        cost,
                    );
                }
            } else {
                stillNeedMaxMoney = false;
            }
        }

        if (minSecurity) {
            const startingSecurity = ns.getServerMinSecurityLevel(targetServer);
            if (ns.getServer(targetServer).hackDifficulty > MIN_HACK_DIFFICULTY) {
                const { cost, success, level } = spendHashesOnUpgrade(ns, "Reduce Minimum Security", targetServer);

                if (success) {
                    const endingSecurity = ns.getServerMinSecurityLevel(targetServer);
                    logUpgradeSuccess(
                        ns,
                        "Min Security",
                        `${targetServer} | ${ns.formatNumber(startingSecurity)} -> ${ns.formatNumber(endingSecurity)}`,
                        cost,
                    );
                }
            } else {
                stillNeedMinSecurity = false;
            }
        }

        if (
            studying ||
            gym ||
            bladeburnerRank ||
            bladeburnerSP ||
            (corporationFunds && stillNeedCorporationFunds) ||
            (corporationResearch && stillNeedCorporationResearch) ||
            (codingContract && stillNeedCodingContract) ||
            (minSecurity && stillNeedMinSecurity) ||
            (maxMoney && stillNeedMaxMoney)
        ) {
            await ns.sleep(100);
            continue;
        } else {
            ns.print(`No more upgrades needed, targeting ${targetServer}`);
            break;
        }
    }
}

/**
 * Attempts to spend hashes on an upgrade and returns upgrade information
 * @param {NS} ns - NetScript namespace
 * @param {string} upgradeName - Name of the hash upgrade
 * @param {string} [target] - Optional target for upgrades that require one
 * @returns {{cost: number, success: boolean, level: number}} Upgrade information
 */
export function spendHashesOnUpgrade(ns, upgradeName, target = null, limit = null, asManyAsPossible = false) {
    let count = 1;
    if (asManyAsPossible) {
        while (ns.hacknet.hashCost(upgradeName, count + 1) < ns.hacknet.numHashes()) {
            count++;
        }
    }

    const cost = ns.hacknet.hashCost(upgradeName, count);

    if (limit && cost > limit) {
        return { cost: 0, success: false, level: 0, count: 0 };
    }

    if (cost > ns.hacknet.hashCapacity() / 100000) {
        let hacknetWithLowestCache = null;
        let lowestCacheServerIndex = null;

        for (let i = 0; i < ns.hacknet.numNodes(); i++) {
            const node = ns.hacknet.getNodeStats(i);
            if (hacknetWithLowestCache === null || node.cache < hacknetWithLowestCache.cache) {
                hacknetWithLowestCache = node;
                lowestCacheServerIndex = i;
            }
        }

        if (hacknetWithLowestCache) {
            ns.hacknet.upgradeCache(lowestCacheServerIndex);
        }
    }

    // TODO: Buy more cache if needed
    const success =
        target !== null
            ? ns.hacknet.spendHashes(upgradeName, target, count)
            : ns.hacknet.spendHashes(upgradeName, "", count);
    const level = ns.hacknet.getHashUpgradeLevel(upgradeName);

    return { cost, success, level, count };
}

/**
 * Displays success messages for hash upgrades
 * @param {NS} ns - NetScript namespace
 * @param {string} upgradeName - Name of the upgrade
 * @param {string} effectString - Description of the upgrade effect
 * @param {number} cost - Cost of the upgrade
 */
export function logUpgradeSuccess(ns, upgradeName, effectString, cost, count = 1) {
    const timestamp = new Date().toLocaleTimeString();
    const message = `SUCCESS: ${timestamp} ${upgradeName} | ${effectString} | ${cost}h | ${count}x`;
    const toastMessage = `${upgradeName} | ${effectString} | ${cost}h | ${count}x`;

    ns.print(message);
    // ns.toast(toastMessage);
    // ns.tprint(message);
}

/**
 * Finds the server with the highest max money
 * @param {NS} ns - NetScript namespace
 * @returns {string | null} The server with the highest max money, or null if there are no servers
 */
function getMaxMoneyServer(ns, previousMaxMoneyServer) {
    const servers = getHackableServers(ns);
    if (servers.length === 0) {
        return null;
    }
    let max = servers.reduce((max, server) => {
        return ns.getServerMaxMoney(server) > ns.getServerMaxMoney(max) &&
            ns.getServerMaxMoney(server) < MAX_MONEY &&
            ns.getServerSecurityLevel(server) > MIN_HACK_DIFFICULTY
            ? server
            : max;
    }, servers[0]);

    if (previousMaxMoneyServer === null) {
        return max;
    }

    const securityDiff = ns.getServerSecurityLevel(max) - ns.getServerSecurityLevel(previousMaxMoneyServer);
    // const securityDiffRatio = securityDiff / ns.getServerSecurityLevel(max);
    // const moneyDiff = ns.getServerMaxMoney(max) / ns.getServerMaxMoney(previousMaxMoneyServer);

    return securityDiff < 10 || ns.getServerMaxMoney(max) > ns.getServerMaxMoney(previousMaxMoneyServer) * 1.5
        ? max
        : previousMaxMoneyServer;
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
