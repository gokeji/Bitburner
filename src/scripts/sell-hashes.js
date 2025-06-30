import { NS } from "@ns";

/**
 * @param {NS} ns
 */
export async function main(ns) {
    let hashesToSell = parseFloat(ns.args[0]) || 0;
    let sellAll = ns.args.includes("--all");

    if (sellAll) {
        hashesToSell = ns.hacknet.numHashes();
    } else {
        hashesToSell = Math.min(hashesToSell, ns.hacknet.numHashes());
    }

    const hashCost = ns.hacknet.hashCost("Sell for Money");
    const sellForMoneyCount = Math.floor(hashesToSell / hashCost);
    const success = ns.hacknet.spendHashes("Sell for Money", "", sellForMoneyCount);

    if (success) {
        ns.tprint(`Sold ${hashesToSell} hashes for $${ns.formatNumber(sellForMoneyCount * 1e6)}`);
    } else {
        ns.tprint("Failed to sell hashes");
    }
}
