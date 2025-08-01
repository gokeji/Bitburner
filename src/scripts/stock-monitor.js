import { NS } from "@ns";

const commission = 100000;

/**
 * Calculate the total portfolio value and profit/loss
 * @param {NS} ns - The NetScript API
 * @returns {Object} Portfolio summary with totalValue, totalProfit, and positions
 */
function calculatePortfolioValue(ns) {
    const stockSymbols = ns.stock.getSymbols();

    let totalValue = 0;
    let totalProfit = 0;
    const positions = [];

    for (const sym of stockSymbols) {
        const pos = ns.stock.getPosition(sym);
        const longShares = pos[0];
        const longPrice = pos[1];
        const shortShares = pos[2];
        const shortPrice = pos[3];

        if (longShares > 0 || shortShares > 0) {
            const askPrice = ns.stock.getAskPrice(sym);
            const bidPrice = ns.stock.getBidPrice(sym);
            let forecast = 0.5;

            if (ns.stock.has4SDataTIXAPI()) {
                forecast = ns.stock.getForecast(sym);
            }

            if (longShares > 0) {
                const currentValue = bidPrice * longShares;
                const costBasis = longPrice * longShares;
                const profit = currentValue - costBasis - 2 * commission;

                totalValue += costBasis + profit;
                totalProfit += profit;

                positions.push({
                    symbol: sym,
                    type: "LONG",
                    shares: longShares,
                    profit: profit,
                    totalValue: costBasis + profit,
                    forecast: forecast,
                });
            }

            if (shortShares > 0) {
                const currentValue = askPrice * shortShares;
                const costBasis = shortPrice * shortShares;
                const profit = costBasis - currentValue - 2 * commission;

                totalValue += costBasis + profit;
                totalProfit += profit;

                positions.push({
                    symbol: sym,
                    type: "SHORT",
                    shares: shortShares,
                    profit: profit,
                    totalValue: costBasis + profit,
                    forecast: forecast,
                });
            }
        }
    }

    return {
        totalValue: totalValue,
        totalProfit: totalProfit,
        positions: positions,
        hasPositions: positions.length > 0,
    };
}

/**
 * Calculate total market cap of all stocks
 * @param {NS} ns - The NetScript API
 * @returns {number} Total market cap
 */
function calculateTotalMarketCap(ns) {
    const stockSymbols = ns.stock.getSymbols();
    let totalMarketCap = 0;

    for (const sym of stockSymbols) {
        const askPrice = ns.stock.getAskPrice(sym);
        const bidPrice = ns.stock.getBidPrice(sym);
        const avgPrice = (askPrice + bidPrice) / 2;
        const maxShares = ns.stock.getMaxShares(sym);
        totalMarketCap += avgPrice * maxShares;
    }

    return totalMarketCap;
}

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");

    ns.ps(ns.getHostname())
        .filter((p) => p.filename === "scripts/stock-monitor.js")
        .forEach((p) => {
            if (p.pid !== ns.pid) {
                ns.ui.closeTail(p.pid);
                ns.kill(p.pid);
            }
        });

    ns.ui.openTail(); // Log Window
    ns.ui.resizeTail(320, 260);
    const windowSize = ns.ui.windowSize();
    ns.ui.moveTail(windowSize[0] - 560, 40);

    var portfolioHistory = [];

    let hasResized = false;

    while (true) {
        var portfolio = calculatePortfolioValue(ns);
        var totalMarketCap = calculateTotalMarketCap(ns);
        var now = Date.now();
        var bitnodeStockValue = ns.getMoneySources().sinceInstall.stock;
        var totalStockValueSinceInstall = portfolio.totalValue + bitnodeStockValue;

        // Keep 60 seconds of history
        portfolioHistory.push({
            totalValue: portfolio.totalValue,
            totalProfit: portfolio.totalProfit,
            marketCap: totalMarketCap,
            totalStockValueSinceInstall: totalStockValueSinceInstall,
            time: now,
        });
        portfolioHistory = portfolioHistory.filter((entry) => now - entry.time <= 60000);

        ns.clearLog(); // Clear the Log window

        // Calculate rates from oldest entry
        var valueRate = 0;
        var profitRate = 0;
        var totalStockRate = 0;
        if (portfolioHistory.length >= 2) {
            var oldest = portfolioHistory[0];
            var timeElapsed = (now - oldest.time) / 1000;
            valueRate = (portfolio.totalValue - oldest.totalValue) / timeElapsed;
            // profitRate = (portfolio.totalProfit - oldest.totalProfit) / timeElapsed;
            // totalStockRate = (totalStockValueSinceInstall - oldest.totalStockValueSinceInstall) / timeElapsed;
        }
        const timeSinceReset = ns.getTimeSinceLastAug() / 1000;
        totalStockRate = totalStockValueSinceInstall / timeSinceReset;

        ns.print("💰 Market Cap: " + ns.formatNumber(totalMarketCap, 1));
        ns.print("🏦 Bitnode Returns: " + ns.formatNumber(totalStockValueSinceInstall, 1));
        ns.print("🏦 Bitnode Rate: " + (totalStockRate >= 0 ? "+" : "") + ns.formatNumber(totalStockRate, 1) + "/s");
        ns.print("\n");

        if (portfolio.hasPositions) {
            ns.print("📊 Portfolio Value: " + ns.formatNumber(portfolio.totalValue, 1));
            ns.print("📊 Portfolio Change: " + (valueRate >= 0 ? "+" : "") + ns.formatNumber(valueRate, 1) + "/s");

            ns.print(
                "💹 Total P&L: " + (portfolio.totalProfit >= 0 ? "+" : "") + ns.formatNumber(portfolio.totalProfit, 1),
            );
            ns.print("\n");

            // Show individual positions (limit to top 3 by value)
            var sortedPositions = portfolio.positions.sort((a, b) => b.totalValue - a.totalValue);
            ns.print("🔹 Top Positions:");
            const showNPositions = 4;
            for (let i = 0; i < Math.min(showNPositions, sortedPositions.length); i++) {
                const pos = sortedPositions[i];
                const typeStr = pos.type === "LONG" ? "🟢" : "🔻";
                const profitStr = (pos.profit >= 0 ? "+" : "") + ns.formatNumber(pos.profit, 1);
                const profitPercentStr =
                    (pos.profit >= 0 ? "+" : "") + ns.formatPercent(pos.profit / (pos.totalValue - pos.profit), 1);
                const valueStr = ns.formatNumber(pos.totalValue, 1);
                ns.print(`  ${typeStr} ${pos.symbol}: ${valueStr} (${profitStr}) ${profitPercentStr}`);
            }

            if (!hasResized) {
                ns.ui.resizeTail(340, (9 + showNPositions) * 28);
                hasResized = true;
            }
        } else {
            ns.print("📊 No positions held");
        }

        await ns.stock.nextUpdate();
    }
}
