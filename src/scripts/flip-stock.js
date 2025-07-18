import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    const ticker = ns.args[0];
    let position = ns.stock.getPosition(ticker);
    let startforecast = ns.stock.getForecast(ticker);
    let cost = 0;
    const maxShares = ns.stock.getMaxShares(ticker);

    while (ns.stock.getForecast(ticker) < 0.445) {
        let spread = ns.stock.getAskPrice(ticker) - ns.stock.getBidPrice(ticker);
        position = ns.stock.getPosition(ticker);
        if (
            ns.stock.getPurchaseCost(ticker, Math.max(1, maxShares - position[2]), "Short") <
            ns.getServerMoneyAvailable("home")
        ) {
            ns.stock.buyShort(ticker, maxShares - position[2]);
            ns.stock.sellShort(ticker, maxShares);
            cost += spread * maxShares + 100000;
        } else {
            ns.print("Not enough money");
            break;
        }
    }
    ns.tprint(
        "Forecast flipping " +
            ticker +
            " complete, cost: $" +
            ns.formatNumber(cost) +
            " changed from " +
            ns.formatPercent(startforecast) +
            " to " +
            ns.formatPercent(ns.stock.getForecast(ticker)),
    );
}
