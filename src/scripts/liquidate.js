// file: sell_all_stocks.js
// Simple script to sell all stock positions and print details

const commission = 100000;

export async function main(ns) {
    ns.disableLog("ALL");

    ns.tprint("=== SELLING ALL STOCK POSITIONS ===");

    const stocks = getAllStocks(ns);
    let totalProfit = 0;
    let totalValueSold = 0;
    let positionsSold = 0;

    for (const stock of stocks) {
        // Sell long positions
        if (stock.longShares > 0) {
            const salePrice = ns.stock.sellStock(stock.sym, stock.longShares);
            const saleTotal = salePrice * stock.longShares;
            const saleCost = stock.longPrice * stock.longShares;
            const saleProfit = saleTotal - saleCost - 2 * commission;

            totalProfit += saleProfit;
            totalValueSold += saleTotal;
            positionsSold++;

            const prefix = saleProfit < 0 ? "WARN SOLD LONG" : "GAIN SOLD LONG";
            ns.tprint(
                `${prefix}: ${stock.sym} | Shares: ${ns.nFormat(stock.longShares, "0,0")} | ` +
                    `Buy Price: ${ns.nFormat(stock.longPrice, "$0.00")} | Sell Price: ${ns.nFormat(salePrice, "$0.00")} | ` +
                    `Profit: ${ns.nFormat(saleProfit, "$0.0a")}`,
            );
        }

        // Sell short positions
        if (stock.shortShares > 0) {
            const salePrice = ns.stock.sellShort(stock.sym, stock.shortShares);
            const saleTotal = salePrice * stock.shortShares;
            const saleCost = stock.shortPrice * stock.shortShares;
            const saleProfit = saleCost - saleTotal - 2 * commission; // Note: profit calculation is different for shorts

            totalProfit += saleProfit;
            totalValueSold += saleTotal;
            positionsSold++;

            const prefix = saleProfit < 0 ? "WARN SOLD SHORT" : "GAIN SOLD SHORT";
            ns.tprint(
                `${prefix}: ${stock.sym} | Shares: ${ns.nFormat(stock.shortShares, "0,0")} | ` +
                    `Short Price: ${ns.nFormat(stock.shortPrice, "$0.00")} | Cover Price: ${ns.nFormat(salePrice, "$0.00")} | ` +
                    `Profit: ${ns.nFormat(saleProfit, "$0.0a")}`,
            );
        }
    }

    ns.tprint("=== SUMMARY ===");
    ns.tprint(`Total positions sold: ${positionsSold}`);
    ns.tprint(`Total value sold: ${ns.nFormat(totalValueSold, "$0.0a")}`);
    ns.tprint(`Total profit/loss: ${ns.nFormat(totalProfit, "$0.0a")}`);

    if (positionsSold === 0) {
        ns.tprint("No stock positions found to sell.");
    }
}

function getAllStocks(ns) {
    // Get all stock symbols and their current positions
    const stockSymbols = ns.stock.getSymbols();
    const stocks = [];

    for (const sym of stockSymbols) {
        const pos = ns.stock.getPosition(sym);
        const stock = {
            sym: sym,
            longShares: pos[0],
            longPrice: pos[1],
            shortShares: pos[2],
            shortPrice: pos[3],
            askPrice: ns.stock.getAskPrice(sym),
            bidPrice: ns.stock.getBidPrice(sym),
        };

        // Only include stocks where we have positions
        if (stock.longShares > 0 || stock.shortShares > 0) {
            stocks.push(stock);
        }
    }

    return stocks;
}
