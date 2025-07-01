import { NS } from "@ns";

const hashUpgrades = {
    SellForMoney: "Sell for Money",
    SellForCorporationFunds: "Sell for Corporation Funds",
    ReduceMinimumSecurity: "Reduce Minimum Security",
    IncreaseMaximumMoney: "Increase Maximum Money",
    ImproveStudying: "Improve Studying",
    ImproveGymTraining: "Improve Gym Training",
    ExchangeForCorporationResearch: "Exchange for Corporation Research",
    ExchangeForBladeburnerRank: "Exchange for Bladeburner Rank",
    ExchangeForBladeburnerSP: "Exchange for Bladeburner SP",
    GenerateCodingContract: "Generate Coding Contract",
    CompanyFavor: "Company Favor",
};

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    while (true) {
        const improveStudyingSuccess = ns.hacknet.spendHashes("Improve Gym Training");
        const studyingBonus = ns.hacknet.getHashUpgradeLevel("Improve Gym Training") * 20;

        if (improveStudyingSuccess) {
            ns.print(
                `SUCCESS: ${new Date().toLocaleTimeString()} Improve Gym Training | ${ns.formatNumber(studyingBonus)}%`,
            );
            ns.toast(`Improve Gym Training | ${ns.formatNumber(studyingBonus)}%`);
        }

        // const targetServer = "megacorp";
        // const startingMoney = ns.getServerMaxMoney(targetServer);
        // const startingSecurity = ns.getServerMinSecurityLevel(targetServer);
        // const increaseMaxMoneySuccess = ns.hacknet.spendHashes("Increase Maximum Money", targetServer);

        // if (increaseMaxMoneySuccess) {
        //     const endingMoney = ns.getServerMaxMoney(targetServer);
        //     ns.print(
        //         `SUCCESS: ${new Date().toLocaleTimeString()} Max Money | ${targetServer} | ${ns.formatNumber(startingMoney)} -> ${ns.formatNumber(endingMoney)}`,
        //     );
        //     ns.toast(
        //         `Increased Max Money on ${targetServer} from ${ns.formatNumber(startingMoney)} to ${ns.formatNumber(endingMoney)}`,
        //     );
        // }

        // if (ns.getServer(targetServer).hackDifficulty > 1) {
        //     const reduceMinSecuritySuccess = ns.hacknet.spendHashes("Reduce Minimum Security", targetServer);

        //     if (reduceMinSecuritySuccess) {
        //         const endingSecurity = ns.getServerMinSecurityLevel(targetServer);
        //         ns.print(
        //             `SUCCESS: ${new Date().toLocaleTimeString()} Min Security | ${targetServer} | ${ns.formatNumber(startingSecurity)} -> ${ns.formatNumber(endingSecurity)}`,
        //         );
        //         ns.toast(
        //             `Reduced Min Security on ${targetServer} from ${ns.formatNumber(startingSecurity)} to ${ns.formatNumber(endingSecurity)}`,
        //         );
        //     }
        // }
        await ns.sleep(5000);
    }
}
