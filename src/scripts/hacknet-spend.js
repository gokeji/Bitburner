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
    const targetServer = ns.args.filter((arg) => arg.startsWith("target="))[0]?.split("=")[1];

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
            const startingMoney = ns.getServerMaxMoney(targetServer);
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
        }

        if (minSecurity) {
            const startingSecurity = ns.getServerMinSecurityLevel(targetServer);
            if (ns.getServer(targetServer).hackDifficulty > 3) {
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
    // TODO: Buy more cache if needed
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
    const message = `SUCCESS: ${timestamp} ${upgradeName} | ${effectString} | ${ns.formatNumber(cost, 2)}h`;
    const toastMessage = `${upgradeName} | ${effectString} | ${ns.formatNumber(cost, 2)}h`;

    ns.print(message);
    ns.toast(toastMessage);
}
