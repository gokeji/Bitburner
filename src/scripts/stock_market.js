// file: stock_market.js
// Comprehensive stock market report showing market cap, forecasts, and stock details

const commission = 100000;

export async function main(ns) {
    ns.disableLog("ALL");

    // Check if we have access to required APIs
    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: TIX API access required for this script");
        return;
    }

    ns.tprint("=== STOCK MARKET REPORT ===");

    const stocks = getAllStockData(ns);

    // Calculate market statistics
    const marketStats = calculateMarketStats(stocks);

    // Print market overview
    printMarketOverview(ns, marketStats);

    // Print forecast summary
    printForecastSummary(ns, stocks);

    // Print detailed stock information
    printDetailedStockInfo(ns, stocks);

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
        const forecast = ns.stock.getForecast(sym);
        const volatility = ns.stock.getVolatility(sym);
        const organization = ns.stock.getOrganization(sym);

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

    const bullishStocks = stocks.filter(stock => stock.forecast > 0.5).length;
    const bearishStocks = stocks.filter(stock => stock.forecast < 0.5).length;
    const neutralStocks = stocks.filter(stock => stock.forecast === 0.5).length;

    const highVolatilityStocks = stocks.filter(stock => stock.volatility > avgVolatility).length;

    return {
        totalMarketCap,
        avgForecast,
        avgVolatility,
        bullishStocks,
        bearishStocks,
        neutralStocks,
        highVolatilityStocks,
        totalStocks: stocks.length
    };
}

function printMarketOverview(ns, stats) {
    ns.tprint("\n=== MARKET OVERVIEW ===");
    ns.tprint(`Total Market Cap: ${ns.nFormat(stats.totalMarketCap, "$0.0a")}`);
    ns.tprint(`Total Stocks: ${stats.totalStocks}`);
    ns.tprint(`Average Forecast: ${(stats.avgForecast * 100).toFixed(1)}%`);
    ns.tprint(`Average Volatility: ${(stats.avgVolatility * 100).toFixed(2)}%`);
    ns.tprint("");
    ns.tprint("Market Sentiment:");
    ns.tprint(`  Bullish (>50%): ${stats.bullishStocks} stocks`);
    ns.tprint(`  Bearish (<50%): ${stats.bearishStocks} stocks`);
    ns.tprint(`  Neutral (=50%): ${stats.neutralStocks} stocks`);
    ns.tprint(`  High Volatility: ${stats.highVolatilityStocks} stocks`);
}

function printForecastSummary(ns, stocks) {
    ns.tprint("\n=== FORECAST SUMMARY ===");

    // Sort by forecast (descending)
    const sortedByForecast = [...stocks].sort((a, b) => b.forecast - a.forecast);

    ns.tprint("Most Bullish Stocks:");
    for (let i = 0; i < Math.min(5, sortedByForecast.length); i++) {
        const stock = sortedByForecast[i];
        ns.tprint(`  ${stock.sym}: ${(stock.forecast * 100).toFixed(1)}% (${stock.organization})`);
    }

    ns.tprint("\nMost Bearish Stocks:");
    for (let i = sortedByForecast.length - 1; i >= Math.max(0, sortedByForecast.length - 5); i--) {
        const stock = sortedByForecast[i];
        ns.tprint(`  ${stock.sym}: ${(stock.forecast * 100).toFixed(1)}% (${stock.organization})`);
    }
}

function printDetailedStockInfo(ns, stocks) {
    ns.tprint("\n=== DETAILED STOCK INFORMATION ===");
    ns.tprint("Symbol | Organization | Price | Market Cap | Forecast | Volatility | Max Shares");
    ns.tprint("-".repeat(90));

    for (const stock of stocks) {
        const forecastStr = `${(stock.forecast * 100).toFixed(1)}%`;
        const volatilityStr = `${(stock.volatility * 100).toFixed(2)}%`;

        ns.tprint(`${stock.sym.padEnd(6)} | ${stock.organization.padEnd(12)} | ` +
                 `${ns.nFormat(stock.price, "$0.00").padStart(8)} | ` +
                 `${ns.nFormat(stock.marketCap, "$0.0a").padStart(10)} | ` +
                 `${forecastStr.padStart(7)} | ` +
                 `${volatilityStr.padStart(8)} | ` +
                 `${ns.nFormat(stock.maxShares, "0.0a")}`);
    }
}

function printPlayerPositions(ns, stocks) {
    const positionsHeld = stocks.filter(stock => stock.longShares > 0 || stock.shortShares > 0);

    if (positionsHeld.length === 0) {
        ns.tprint("\n=== PLAYER POSITIONS ===");
        ns.tprint("No stock positions currently held.");
        return;
    }

    ns.tprint("\n=== PLAYER POSITIONS ===");

    let totalValue = 0;
    let totalProfit = 0;

    for (const stock of positionsHeld) {
        if (stock.longShares > 0) {
            const currentValue = stock.bidPrice * stock.longShares;
            const costBasis = stock.longPrice * stock.longShares;
            const profit = currentValue - costBasis - 2 * commission;

            totalValue += currentValue;
            totalProfit += profit;

            const profitStr = profit >= 0 ? `+${ns.nFormat(profit, "$0.0a")}` : ns.nFormat(profit, "$0.0a");
            ns.tprint(`LONG ${stock.sym}: ${ns.nFormat(stock.longShares, "0,0")} shares | ` +
                     `Value: ${ns.nFormat(currentValue, "$0.0a")} | ` +
                     `P&L: ${profitStr} | ` +
                     `Forecast: ${(stock.forecast * 100).toFixed(1)}%`);
        }

        if (stock.shortShares > 0) {
            const currentValue = stock.askPrice * stock.shortShares;
            const costBasis = stock.shortPrice * stock.shortShares;
            const profit = costBasis - currentValue - 2 * commission;

            totalValue += currentValue;
            totalProfit += profit;

            const profitStr = profit >= 0 ? `+${ns.nFormat(profit, "$0.0a")}` : ns.nFormat(profit, "$0.0a");
            ns.tprint(`SHORT ${stock.sym}: ${ns.nFormat(stock.shortShares, "0,0")} shares | ` +
                     `Value: ${ns.nFormat(currentValue, "$0.0a")} | ` +
                     `P&L: ${profitStr} | ` +
                     `Forecast: ${(stock.forecast * 100).toFixed(1)}%`);
        }
    }

    ns.tprint("\n=== PORTFOLIO SUMMARY ===");
    ns.tprint(`Total Portfolio Value: ${ns.nFormat(totalValue, "$0.0a")}`);
    ns.tprint(`Total P&L: ${totalProfit >= 0 ? '+' : ''}${ns.nFormat(totalProfit, "$0.0a")}`);
}
