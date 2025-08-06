import { STOCK_MARKET_COMMISSION_FEE } from "./libs/constants";
import { NetscriptExtension } from "./libs/NetscriptExtension";
const defaultConfig = {
    reservedMoney: 1e6,
    buyLongThreshold: 0.6,
    sellLongThreshold: 0.55,
    buyShortThreshold: 0.4,
    sellShortThreshold: 0.45,
    enableShort: false,
};
let customConfig = null;
customConfig = {
    reservedMoney: 1e6,
    buyLongThreshold: 0.55,
    sellLongThreshold: 0.53,
    buyShortThreshold: defaultConfig.buyShortThreshold,
    sellShortThreshold: defaultConfig.sellShortThreshold,
    enableShort: true,
};
function printStockData(ns) {
    const stockStats = nsx.calculateStockStats();
    ns.print(`Current profit: ${ns.formatNumber(stockStats.currentProfit)}`);
    ns.print(`Estimated total profit: ${ns.formatNumber(stockStats.estimatedTotalProfit)}`);
    ns.print(`Current worth: ${ns.formatNumber(stockStats.currentWorth)}`);
}
async function tradeStocksWithS4MarketData(ns, config) {
    while (true) {
        const stockSymbols = ns.stock.getSymbols().sort(function (a, b) {
            return Math.abs(0.5 - ns.stock.getForecast(b)) - Math.abs(0.5 - ns.stock.getForecast(a));
        });
        for (const stockSymbol of stockSymbols) {
            let availableMoney = ns.getPlayer().money - config.reservedMoney;
            if (availableMoney <= 0) {
                break;
            }
            const position = ns.stock.getPosition(stockSymbol);
            const sharesLong = position[0];
            const forecast = ns.stock.getForecast(stockSymbol);
            if (forecast < config.sellLongThreshold && sharesLong > 0) {
                ns.stock.sellStock(stockSymbol, sharesLong);
                availableMoney = ns.getPlayer().money - config.reservedMoney;
            }
            if (forecast > config.buyLongThreshold) {
                const maxSharesForBuying = ns.stock.getMaxShares(stockSymbol) - sharesLong;
                const askPrice = ns.stock.getAskPrice(stockSymbol);
                const affordableShares = Math.floor((availableMoney - STOCK_MARKET_COMMISSION_FEE) / askPrice);
                const shares = Math.min(affordableShares, maxSharesForBuying);
                if (shares <= 0) {
                    continue;
                }
                ns.stock.buyStock(stockSymbol, shares);
                availableMoney = ns.getPlayer().money - config.reservedMoney;
            }
        }
        ns.clearLog();
        printStockData(ns);
        await ns.sleep(2e3);
    }
}
async function tradeStocksWithoutS4MarketData(ns, config) {
    function getForecast(priceChanges) {
        const numberOfTimesPriceIncreased = priceChanges.reduce((accumulator, currentValue) => {
            return accumulator + (currentValue > 1 ? 1 : 0);
        }, 0);
        return numberOfTimesPriceIncreased / priceChanges.length;
    }
    const stockPrices = /* @__PURE__ */ new Map();
    const stockPriceChanges = /* @__PURE__ */ new Map();
    let stockSymbols = ns.stock.getSymbols();
    stockSymbols.forEach((symbol) => {
        stockPrices.set(symbol, [ns.stock.getPrice(symbol)]);
        stockPriceChanges.set(symbol, []);
    });
    while (true) {
        const numberOfSamples = 15;
        const isPriceChanged = stockSymbols.some((symbol) => {
            const symbolPrices = stockPrices.get(symbol);
            return symbolPrices[symbolPrices.length - 1] !== ns.stock.getPrice(symbol);
        });
        if (!isPriceChanged) {
            ns.clearLog();
            printStockData(ns);
            await ns.sleep(1e3);
            continue;
        }
        const haveEnoughSamples = stockSymbols.every((symbol) => {
            return stockPriceChanges.get(symbol).length > numberOfSamples;
        });
        stockSymbols.forEach((symbol) => {
            const symbolPrices = stockPrices.get(symbol);
            const symbolPriceChanges = stockPriceChanges.get(symbol);
            symbolPrices.push(ns.stock.getPrice(symbol));
            if (symbolPrices.length > 1) {
                symbolPriceChanges.push(symbolPrices[symbolPrices.length - 1] / symbolPrices[symbolPrices.length - 2]);
            }
            if (haveEnoughSamples) {
                symbolPrices.shift();
                symbolPriceChanges.shift();
            }
        });
        if (!haveEnoughSamples) {
            ns.clearLog();
            printStockData(ns);
            await ns.sleep(1e3);
            continue;
        }
        stockSymbols = stockSymbols.sort(function (a, b) {
            return (
                Math.abs(0.5 - getForecast(stockPriceChanges.get(b))) -
                Math.abs(0.5 - getForecast(stockPriceChanges.get(a)))
            );
        });
        for (const stockSymbol of stockSymbols) {
            let availableMoney = ns.getPlayer().money - config.reservedMoney;
            if (availableMoney <= 0) {
                break;
            }
            const position = ns.stock.getPosition(stockSymbol);
            const sharesLong = position[0];
            const sharesShort = position[2];
            const forecast = getForecast(stockPriceChanges.get(stockSymbol));
            if (forecast < 0.4 && sharesLong > 0) {
                ns.stock.sellStock(stockSymbol, sharesLong);
                availableMoney = ns.getPlayer().money - config.reservedMoney;
            }
            if (forecast > 0.5 && sharesShort > 0 && config.enableShort) {
                ns.stock.sellShort(stockSymbol, sharesShort);
                availableMoney = ns.getPlayer().money - config.reservedMoney;
            }
            if (forecast > 0.7) {
                const maxSharesForBuying = ns.stock.getMaxShares(stockSymbol) - sharesLong;
                const askPrice = ns.stock.getAskPrice(stockSymbol);
                const affordableShares = Math.floor((availableMoney - STOCK_MARKET_COMMISSION_FEE) / askPrice);
                const shares = Math.min(affordableShares, maxSharesForBuying);
                if (shares <= 0) {
                    continue;
                }
                ns.stock.buyStock(stockSymbol, shares);
                availableMoney = ns.getPlayer().money - config.reservedMoney;
            }
            if (forecast < 0.3 && config.enableShort) {
                const maxSharesForBuying = ns.stock.getMaxShares(stockSymbol) - sharesShort;
                const bidPrice = ns.stock.getBidPrice(stockSymbol);
                const affordableShares = Math.floor((availableMoney - STOCK_MARKET_COMMISSION_FEE) / bidPrice);
                const shares = Math.min(affordableShares, maxSharesForBuying);
                if (shares <= 0) {
                    continue;
                }
                ns.stock.buyShort(stockSymbol, shares);
            }
        }
        ns.clearLog();
        printStockData(ns);
        await ns.sleep(1e3);
    }
}
let nsx;
async function main(ns) {
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    const config = customConfig !== null ? customConfig : defaultConfig;
    ns.disableLog("ALL");
    if (!ns.stock.hasWSEAccount()) {
        ns.tprint("Please buy WSE account");
        return;
    }
    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("Please buy TIX API access");
        return;
    }
    if (ns.stock.has4SDataTIXAPI()) {
        await tradeStocksWithS4MarketData(ns, config);
    } else {
        await tradeStocksWithoutS4MarketData(ns, config);
    }
}
export { main };
