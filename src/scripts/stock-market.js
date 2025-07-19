// file: stock-market.js
// Comprehensive stock market report showing market cap, forecasts, and stock details

// import { NS } from "@ns";

const commission = 100000;

/**
 * Calculate the total portfolio value and profit/loss
 * @param {NS} ns - The NetScript API
 * @returns {Object} Portfolio summary with totalValue, totalProfit, and positions
 */
export function calculatePortfolioValue(ns) {
    const stocks = getAllStockData(ns);
    const positionsHeld = stocks.filter((stock) => stock.longShares > 0 || stock.shortShares > 0);

    let totalValue = 0;
    let totalProfit = 0;
    const positions = [];

    for (const stock of positionsHeld) {
        if (stock.longShares > 0) {
            const currentValue = stock.bidPrice * stock.longShares;
            const costBasis = stock.longPrice * stock.longShares;
            const profit = currentValue - costBasis - commission;

            totalValue += currentValue;
            totalProfit += profit;

            positions.push({
                symbol: stock.sym,
                type: "LONG",
                shares: stock.longShares,
                currentValue: currentValue,
                profit: profit,
                forecast: stock.forecast,
            });
        }

        if (stock.shortShares > 0) {
            const currentValue = stock.askPrice * stock.shortShares;
            const costBasis = stock.shortPrice * stock.shortShares;
            const profit = costBasis - currentValue - commission;

            totalValue += costBasis + profit;
            totalProfit += profit;

            positions.push({
                symbol: stock.sym,
                type: "SHORT",
                shares: stock.shortShares,
                currentValue: costBasis + profit,
                profit: profit,
                forecast: stock.forecast,
            });
        }
    }

    return {
        totalValue: totalValue,
        totalProfit: totalProfit,
        positions: positions,
        hasPositions: positions.length > 0,
    };
}

export async function main(ns) {
    ns.disableLog("ALL");

    const onlyPrintPlayerPositions = ns.args.includes("--player");

    const stocks = getAllStockData(ns);

    // Calculate market statistics
    const marketStats = calculateMarketStats(stocks);

    if (!onlyPrintPlayerPositions) {
        ns.tprint("=== STOCK MARKET REPORT ===");

        // Print forecast summary
        printForecastSummary(ns, stocks);

        // Print detailed stock information
        printDetailedStockInfo(ns, stocks);
    }

    // Print market overview
    printMarketOverview(ns, marketStats);

    // Print player positions if any
    printPlayerPositions(ns, stocks);
}

function getAllStockData(ns) {
    const stockSymbols = ns.stock.getSymbols();
    const stocks = [];

    for (const sym of stockSymbols) {
        const pos = ns.stock.getPosition(sym);
        const maxShares = ns.stock.getMaxShares(sym);
        const askPrice = ns.stock.getAskPrice(sym);
        const bidPrice = ns.stock.getBidPrice(sym);
        const organization = ns.stock.getOrganization(sym);
        let forecast = 0;
        let volatility = 0;

        if (ns.stock.has4SDataTIXAPI()) {
            forecast = ns.stock.getForecast(sym);
            volatility = ns.stock.getVolatility(sym);
        } else {
            forecast = null;
            volatility = null;
        }

        const stock = {
            sym: sym,
            organization: organization,
            askPrice: askPrice,
            bidPrice: bidPrice,
            price: (askPrice + bidPrice) / 2, // Average price
            maxShares: maxShares,
            marketCap: ((askPrice + bidPrice) / 2) * maxShares,
            forecast: forecast,
            volatility: volatility,
            longShares: pos[0],
            longPrice: pos[1],
            shortShares: pos[2],
            shortPrice: pos[3],
        };

        stocks.push(stock);
    }

    // Sort by market cap (descending)
    stocks.sort((a, b) => b.marketCap - a.marketCap);

    return stocks;
}

function calculateMarketStats(stocks) {
    const totalMarketCap = stocks.reduce((sum, stock) => sum + stock.marketCap, 0);
    const avgForecast = stocks.reduce((sum, stock) => sum + stock.forecast, 0) / stocks.length;
    const avgVolatility = stocks.reduce((sum, stock) => sum + stock.volatility, 0) / stocks.length;

    const bullishStocks = stocks.filter((stock) => stock.forecast > 0.5).length;
    const bearishStocks = stocks.filter((stock) => stock.forecast <= 0.5).length;

    const highVolatilityStocks = stocks.filter((stock) => stock.volatility > avgVolatility).length;

    // Calculate market cap by sentiment
    const bullishMarketCap = stocks
        .filter((stock) => stock.forecast > 0.5)
        .reduce((sum, stock) => sum + stock.marketCap, 0);

    const bearishMarketCap = stocks
        .filter((stock) => stock.forecast <= 0.5)
        .reduce((sum, stock) => sum + stock.marketCap, 0);

    return {
        totalMarketCap,
        avgForecast,
        avgVolatility,
        bullishStocks,
        bearishStocks,
        highVolatilityStocks,
        bullishMarketCap,
        bearishMarketCap,
        totalStocks: stocks.length,
    };
}

function printMarketOverview(ns, stats) {
    ns.tprint("");
    ns.tprint("=== MARKET OVERVIEW ===");
    ns.tprint(`Total Market Cap: ${ns.nFormat(stats.totalMarketCap, "$0.0a")}`);
    ns.tprint(`Total Stocks: ${stats.totalStocks}`);
    ns.tprint(`Average Forecast: ${(stats.avgForecast * 100).toFixed(1)}%`);
    ns.tprint(`Average Volatility: ${(stats.avgVolatility * 100).toFixed(2)}%`);
    ns.tprint("");
    ns.tprint("Market Sentiment:");
    ns.tprint(`  Bullish (>50%): ${stats.bullishStocks} stocks`);
    ns.tprint(`  Bearish (<50%): ${stats.bearishStocks} stocks`);
    ns.tprint(`  High Volatility: ${stats.highVolatilityStocks} stocks`);
    ns.tprint("");
    ns.tprint("Market Cap by Sentiment:");
    const bullishPercent = ((stats.bullishMarketCap / stats.totalMarketCap) * 100).toFixed(1);
    const bearishPercent = ((stats.bearishMarketCap / stats.totalMarketCap) * 100).toFixed(1);

    ns.tprint(`  Bullish: ${ns.nFormat(stats.bullishMarketCap, "$0.0a")} (${bullishPercent}%)`);
    ns.tprint(`  Bearish: ${ns.nFormat(stats.bearishMarketCap, "$0.0a")} (${bearishPercent}%)`);
}

function printForecastSummary(ns, stocks) {
    ns.tprint("");
    ns.tprint("=== FORECAST SUMMARY ===");

    // Sort by forecast (descending)
    const sortedByForecast = [...stocks].sort((a, b) => b.forecast - a.forecast);

    ns.tprint("Most Bullish Stocks:");
    for (let i = 0; i < Math.min(5, sortedByForecast.length); i++) {
        const stock = sortedByForecast[i];
        ns.tprint(`  ${stock.sym}: ${(stock.forecast * 100).toFixed(1)}% (${stock.organization})`);
    }

    ns.tprint("");
    ns.tprint("Most Bearish Stocks:");
    for (let i = sortedByForecast.length - 1; i >= Math.max(0, sortedByForecast.length - 5); i--) {
        const stock = sortedByForecast[i];
        ns.tprint(`  ${stock.sym}: ${(stock.forecast * 100).toFixed(1)}% (${stock.organization})`);
    }
}

function printDetailedStockInfo(ns, stocks) {
    ns.tprint("");
    ns.tprint("=== DETAILED STOCK INFORMATION ===");
    ns.tprint("Symbol | Organization | Price | Market Cap | Forecast | Volatility | Max Shares");
    ns.tprint("-".repeat(90));

    for (const stock of stocks) {
        const forecastStr = `${(stock.forecast * 100).toFixed(1)}%`;
        const volatilityStr = `${(stock.volatility * 100).toFixed(2)}%`;

        ns.tprint(
            `${stock.sym.padEnd(6)} | ${stock.organization.padEnd(12)} | ` +
                `${ns.nFormat(stock.price, "$0.00").padStart(8)} | ` +
                `${ns.nFormat(stock.marketCap, "$0.0a").padStart(10)} | ` +
                `${forecastStr.padStart(7)} | ` +
                `${volatilityStr.padStart(8)} | ` +
                `${ns.nFormat(stock.maxShares, "0.0a")}`,
        );
    }
}

function printPlayerPositions(ns, stocks) {
    const portfolio = calculatePortfolioValue(ns);

    if (!portfolio.hasPositions) {
        ns.tprint("");
        ns.tprint("=== PLAYER POSITIONS ===");
        ns.tprint("No stock positions currently held.");
        return;
    }

    ns.tprint("");
    ns.tprint("=== PLAYER POSITIONS ===");

    for (const position of portfolio.positions) {
        const profitStr =
            position.profit >= 0 ? `+${ns.nFormat(position.profit, "$0.0a")}` : ns.nFormat(position.profit, "$0.0a");
        ns.tprint(
            `${position.type} ${position.symbol}: ${ns.nFormat(position.shares, "0,0")} shares | ` +
                `Value: ${ns.nFormat(position.currentValue, "$0.0a")} | ` +
                `P&L: ${profitStr} | ` +
                `Forecast: ${(position.forecast * 100).toFixed(1)}%`,
        );
    }

    ns.tprint("");
    ns.tprint("=== PORTFOLIO SUMMARY ===");
    ns.tprint(`Total Portfolio Value: ${ns.nFormat(portfolio.totalValue, "$0.0a")}`);
    ns.tprint(`Total P&L: ${portfolio.totalProfit >= 0 ? "+" : ""}${ns.nFormat(portfolio.totalProfit, "$0.0a")}`);
}
