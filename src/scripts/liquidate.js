// file: liquidate.js
// Script to sell stock positions - all positions or a specific amount from biggest position

const commission = 100000;

export async function main(ns) {
    ns.disableLog("ALL");

    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: TIX API access required");
        return;
    }

    const targetAmount = ns.args[0] ? parseFloat(ns.args[0]) : null;

    if (targetAmount) {
        await sellFromBiggestPosition(ns, targetAmount);
    } else {
        await sellAllPositions(ns);
    }
}

async function sellFromBiggestPosition(ns, targetAmount) {
    ns.tprint(`=== SELLING $${ns.nFormat(targetAmount, "0.0a")} FROM BIGGEST POSITION ===`);

    const stocks = getAllStocks(ns);

    if (stocks.length === 0) {
        ns.tprint("No stock positions found.");
        return;
    }

    // Find the biggest position by current value
    let biggestPosition = null;
    let biggestValue = 0;
    let isShort = false;

    for (const stock of stocks) {
        // Check long position value
        if (stock.longShares > 0) {
            const longValue = stock.longShares * stock.bidPrice;
            if (longValue > biggestValue) {
                biggestValue = longValue;
                biggestPosition = stock;
                isShort = false;
            }
        }

        // Check short position value
        if (stock.shortShares > 0) {
            const shortValue = stock.shortShares * stock.askPrice;
            if (shortValue > biggestValue) {
                biggestValue = shortValue;
                biggestPosition = stock;
                isShort = true;
            }
        }
    }

    if (!biggestPosition) {
        ns.tprint("No positions found to sell.");
        return;
    }

    // Calculate shares to sell based on target amount
    let sharesToSell;
    let currentPrice;
    let totalShares;

    if (isShort) {
        currentPrice = biggestPosition.askPrice; // Price to cover short
        totalShares = biggestPosition.shortShares;
        sharesToSell = Math.min(Math.floor(targetAmount / currentPrice), totalShares);

        if (sharesToSell > 0) {
            const salePrice = ns.stock.sellShort(biggestPosition.sym, sharesToSell);
            const saleTotal = salePrice * sharesToSell;
            const saleCost = biggestPosition.shortPrice * sharesToSell;
            const saleProfit = saleCost - saleTotal - 2 * commission;

            const prefix = saleProfit < 0 ? "WARN SOLD SHORT" : "GAIN SOLD SHORT";
            ns.tprint(
                `${prefix}: ${biggestPosition.sym} | Shares: ${ns.nFormat(sharesToSell, "0,0")} | ` +
                    `Short Price: ${ns.nFormat(biggestPosition.shortPrice, "$0.00")} | Cover Price: ${ns.nFormat(salePrice, "$0.00")} | ` +
                    `Value Sold: ${ns.nFormat(saleTotal, "$0.0a")} | Profit: ${ns.nFormat(saleProfit, "$0.0a")}`,
            );
        }
    } else {
        currentPrice = biggestPosition.bidPrice; // Price to sell long
        totalShares = biggestPosition.longShares;
        sharesToSell = Math.min(Math.floor(targetAmount / currentPrice), totalShares);

        if (sharesToSell > 0) {
            const salePrice = ns.stock.sellStock(biggestPosition.sym, sharesToSell);
            const saleTotal = salePrice * sharesToSell;
            const saleCost = biggestPosition.longPrice * sharesToSell;
            const saleProfit = saleTotal - saleCost - 2 * commission;

            const prefix = saleProfit < 0 ? "WARN SOLD LONG" : "GAIN SOLD LONG";
            ns.tprint(
                `${prefix}: ${biggestPosition.sym} | Shares: ${ns.nFormat(sharesToSell, "0,0")} | ` +
                    `Buy Price: ${ns.nFormat(biggestPosition.longPrice, "$0.00")} | Sell Price: ${ns.nFormat(salePrice, "$0.00")} | ` +
                    `Value Sold: ${ns.nFormat(saleTotal, "$0.0a")} | Profit: ${ns.nFormat(saleProfit, "$0.0a")}`,
            );
        }
    }

    if (sharesToSell === 0) {
        ns.tprint(
            `Target amount $${ns.nFormat(targetAmount, "0.0a")} is too small to sell any shares at current price $${ns.nFormat(currentPrice, "0.00")}`,
        );
    }
}

async function sellAllPositions(ns) {
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
