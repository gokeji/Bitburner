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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3N0b2NrVHJhZGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge05TfSBmcm9tIFwiQG5zXCI7XG5pbXBvcnQge1NUT0NLX01BUktFVF9DT01NSVNTSU9OX0ZFRX0gZnJvbSBcIi9saWJzL2NvbnN0YW50c1wiO1xuaW1wb3J0IHtOZXRzY3JpcHRFeHRlbnNpb259IGZyb20gXCIvbGlicy9OZXRzY3JpcHRFeHRlbnNpb25cIjtcblxuaW50ZXJmYWNlIENvbmZpZyB7XG4gICAgcmVzZXJ2ZWRNb25leTogbnVtYmVyO1xuICAgIGJ1eUxvbmdUaHJlc2hvbGQ6IG51bWJlcjtcbiAgICBzZWxsTG9uZ1RocmVzaG9sZDogbnVtYmVyO1xuICAgIGJ1eVNob3J0VGhyZXNob2xkOiBudW1iZXI7XG4gICAgc2VsbFNob3J0VGhyZXNob2xkOiBudW1iZXI7XG4gICAgZW5hYmxlU2hvcnQ6IGJvb2xlYW47XG59XG5cbmNvbnN0IGRlZmF1bHRDb25maWc6IENvbmZpZyA9IHtcbiAgICByZXNlcnZlZE1vbmV5OiAxZTYsXG4gICAgYnV5TG9uZ1RocmVzaG9sZDogMC42LFxuICAgIHNlbGxMb25nVGhyZXNob2xkOiAwLjU1LFxuICAgIGJ1eVNob3J0VGhyZXNob2xkOiAwLjQsXG4gICAgc2VsbFNob3J0VGhyZXNob2xkOiAwLjQ1LFxuICAgIGVuYWJsZVNob3J0OiBmYWxzZSxcbn07XG5cbmxldCBjdXN0b21Db25maWc6IENvbmZpZyB8IG51bGwgPSBudWxsO1xuY3VzdG9tQ29uZmlnID0gPENvbmZpZz57XG4gICAgcmVzZXJ2ZWRNb25leTogMWU2LFxuICAgIGJ1eUxvbmdUaHJlc2hvbGQ6IDAuNTUsXG4gICAgc2VsbExvbmdUaHJlc2hvbGQ6IDAuNTMsXG4gICAgYnV5U2hvcnRUaHJlc2hvbGQ6IGRlZmF1bHRDb25maWcuYnV5U2hvcnRUaHJlc2hvbGQsXG4gICAgc2VsbFNob3J0VGhyZXNob2xkOiBkZWZhdWx0Q29uZmlnLnNlbGxTaG9ydFRocmVzaG9sZCxcbiAgICBlbmFibGVTaG9ydDogdHJ1ZSxcbn07XG5cbmZ1bmN0aW9uIHByaW50U3RvY2tEYXRhKG5zOiBOUykge1xuICAgIGNvbnN0IHN0b2NrU3RhdHMgPSBuc3guY2FsY3VsYXRlU3RvY2tTdGF0cygpO1xuICAgIG5zLnByaW50KGBDdXJyZW50IHByb2ZpdDogJHtucy5mb3JtYXROdW1iZXIoc3RvY2tTdGF0cy5jdXJyZW50UHJvZml0KX1gKTtcbiAgICBucy5wcmludChgRXN0aW1hdGVkIHRvdGFsIHByb2ZpdDogJHtucy5mb3JtYXROdW1iZXIoc3RvY2tTdGF0cy5lc3RpbWF0ZWRUb3RhbFByb2ZpdCl9YCk7XG4gICAgbnMucHJpbnQoYEN1cnJlbnQgd29ydGg6ICR7bnMuZm9ybWF0TnVtYmVyKHN0b2NrU3RhdHMuY3VycmVudFdvcnRoKX1gKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJhZGVTdG9ja3NXaXRoUzRNYXJrZXREYXRhKG5zOiBOUywgY29uZmlnOiBDb25maWcpIHtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCBzdG9ja1N5bWJvbHMgPSBucy5zdG9jay5nZXRTeW1ib2xzKClcbiAgICAgICAgICAgIC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGguYWJzKDAuNSAtIG5zLnN0b2NrLmdldEZvcmVjYXN0KGIpKSAtIE1hdGguYWJzKDAuNSAtIG5zLnN0b2NrLmdldEZvcmVjYXN0KGEpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICBmb3IgKGNvbnN0IHN0b2NrU3ltYm9sIG9mIHN0b2NrU3ltYm9scykge1xuICAgICAgICAgICAgbGV0IGF2YWlsYWJsZU1vbmV5ID0gbnMuZ2V0UGxheWVyKCkubW9uZXkgLSBjb25maWcucmVzZXJ2ZWRNb25leTtcbiAgICAgICAgICAgIGlmIChhdmFpbGFibGVNb25leSA8PSAwKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5zLnN0b2NrLmdldFBvc2l0aW9uKHN0b2NrU3ltYm9sKTtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlc0xvbmcgPSBwb3NpdGlvblswXTtcbiAgICAgICAgICAgIGNvbnN0IGZvcmVjYXN0ID0gbnMuc3RvY2suZ2V0Rm9yZWNhc3Qoc3RvY2tTeW1ib2wpO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB3ZSB3YW50IHRvIHNlbGwgbG9uZ1xuICAgICAgICAgICAgaWYgKGZvcmVjYXN0IDwgY29uZmlnLnNlbGxMb25nVGhyZXNob2xkICYmIHNoYXJlc0xvbmcgPiAwKSB7XG4gICAgICAgICAgICAgICAgbnMuc3RvY2suc2VsbFN0b2NrKHN0b2NrU3ltYm9sLCBzaGFyZXNMb25nKTtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVNb25leSA9IG5zLmdldFBsYXllcigpLm1vbmV5IC0gY29uZmlnLnJlc2VydmVkTW9uZXk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHdlIHdhbnQgdG8gYnV5IGxvbmdcbiAgICAgICAgICAgIGlmIChmb3JlY2FzdCA+IGNvbmZpZy5idXlMb25nVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF4U2hhcmVzRm9yQnV5aW5nID0gbnMuc3RvY2suZ2V0TWF4U2hhcmVzKHN0b2NrU3ltYm9sKSAtIHNoYXJlc0xvbmc7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNrUHJpY2UgPSBucy5zdG9jay5nZXRBc2tQcmljZShzdG9ja1N5bWJvbCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYWZmb3JkYWJsZVNoYXJlcyA9IE1hdGguZmxvb3IoXG4gICAgICAgICAgICAgICAgICAgIChhdmFpbGFibGVNb25leSAtIFNUT0NLX01BUktFVF9DT01NSVNTSU9OX0ZFRSkgLyBhc2tQcmljZVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2hhcmVzID0gTWF0aC5taW4oYWZmb3JkYWJsZVNoYXJlcywgbWF4U2hhcmVzRm9yQnV5aW5nKTtcbiAgICAgICAgICAgICAgICBpZiAoc2hhcmVzIDw9IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5zLnN0b2NrLmJ1eVN0b2NrKHN0b2NrU3ltYm9sLCBzaGFyZXMpO1xuICAgICAgICAgICAgICAgIGF2YWlsYWJsZU1vbmV5ID0gbnMuZ2V0UGxheWVyKCkubW9uZXkgLSBjb25maWcucmVzZXJ2ZWRNb25leTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBucy5jbGVhckxvZygpO1xuICAgICAgICBwcmludFN0b2NrRGF0YShucyk7XG4gICAgICAgIGF3YWl0IG5zLnNsZWVwKDIwMDApO1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJhZGVTdG9ja3NXaXRob3V0UzRNYXJrZXREYXRhKG5zOiBOUywgY29uZmlnOiBDb25maWcpIHtcbiAgICBmdW5jdGlvbiBnZXRGb3JlY2FzdChwcmljZUNoYW5nZXM6IG51bWJlcltdKSB7XG4gICAgICAgIGNvbnN0IG51bWJlck9mVGltZXNQcmljZUluY3JlYXNlZCA9IHByaWNlQ2hhbmdlcy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBjdXJyZW50VmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhY2N1bXVsYXRvciArICgoY3VycmVudFZhbHVlID4gMSkgPyAxIDogMCk7XG4gICAgICAgIH0sIDApO1xuICAgICAgICByZXR1cm4gbnVtYmVyT2ZUaW1lc1ByaWNlSW5jcmVhc2VkIC8gcHJpY2VDaGFuZ2VzLmxlbmd0aDtcbiAgICB9XG5cbiAgICBjb25zdCBzdG9ja1ByaWNlcyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXJbXT4oKTtcbiAgICBjb25zdCBzdG9ja1ByaWNlQ2hhbmdlcyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXJbXT4oKTtcbiAgICBsZXQgc3RvY2tTeW1ib2xzID0gbnMuc3RvY2suZ2V0U3ltYm9scygpO1xuICAgIC8vIEluaXRcbiAgICBzdG9ja1N5bWJvbHMuZm9yRWFjaChzeW1ib2wgPT4ge1xuICAgICAgICBzdG9ja1ByaWNlcy5zZXQoc3ltYm9sLCBbbnMuc3RvY2suZ2V0UHJpY2Uoc3ltYm9sKV0pO1xuICAgICAgICBzdG9ja1ByaWNlQ2hhbmdlcy5zZXQoc3ltYm9sLCBbXSk7XG4gICAgfSk7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyT2ZTYW1wbGVzID0gMTU7XG4gICAgICAgIC8vIENoZWNrIGlmIHN0b2NrIHByaWNlIGNoYW5nZWRcbiAgICAgICAgY29uc3QgaXNQcmljZUNoYW5nZWQgPSBzdG9ja1N5bWJvbHMuc29tZShzeW1ib2wgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc3ltYm9sUHJpY2VzID0gc3RvY2tQcmljZXMuZ2V0KHN5bWJvbCkhO1xuICAgICAgICAgICAgcmV0dXJuIHN5bWJvbFByaWNlc1tzeW1ib2xQcmljZXMubGVuZ3RoIC0gMV0gIT09IG5zLnN0b2NrLmdldFByaWNlKHN5bWJvbCk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWlzUHJpY2VDaGFuZ2VkKSB7XG4gICAgICAgICAgICBucy5jbGVhckxvZygpO1xuICAgICAgICAgICAgcHJpbnRTdG9ja0RhdGEobnMpO1xuICAgICAgICAgICAgYXdhaXQgbnMuc2xlZXAoMTAwMCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBzYW1wbGVzXG4gICAgICAgIGNvbnN0IGhhdmVFbm91Z2hTYW1wbGVzID0gc3RvY2tTeW1ib2xzLmV2ZXJ5KChzeW1ib2wpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBzdG9ja1ByaWNlQ2hhbmdlcy5nZXQoc3ltYm9sKSEubGVuZ3RoID4gbnVtYmVyT2ZTYW1wbGVzO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gUmVjb3JkIG5ldyBwcmljZVxuICAgICAgICBzdG9ja1N5bWJvbHMuZm9yRWFjaChzeW1ib2wgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc3ltYm9sUHJpY2VzID0gc3RvY2tQcmljZXMuZ2V0KHN5bWJvbCkhO1xuICAgICAgICAgICAgY29uc3Qgc3ltYm9sUHJpY2VDaGFuZ2VzID0gc3RvY2tQcmljZUNoYW5nZXMuZ2V0KHN5bWJvbCkhO1xuICAgICAgICAgICAgc3ltYm9sUHJpY2VzLnB1c2gobnMuc3RvY2suZ2V0UHJpY2Uoc3ltYm9sKSk7XG4gICAgICAgICAgICBpZiAoc3ltYm9sUHJpY2VzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBzeW1ib2xQcmljZUNoYW5nZXMucHVzaChzeW1ib2xQcmljZXNbc3ltYm9sUHJpY2VzLmxlbmd0aCAtIDFdIC8gc3ltYm9sUHJpY2VzW3N5bWJvbFByaWNlcy5sZW5ndGggLSAyXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaGF2ZUVub3VnaFNhbXBsZXMpIHtcbiAgICAgICAgICAgICAgICBzeW1ib2xQcmljZXMuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICBzeW1ib2xQcmljZUNoYW5nZXMuc2hpZnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIC8vIE9ubHkgcHJvY2VlZCBpZiB3ZSBoYXZlIGVub3VnaCBzYW1wbGVzXG4gICAgICAgIGlmICghaGF2ZUVub3VnaFNhbXBsZXMpIHtcbiAgICAgICAgICAgIG5zLmNsZWFyTG9nKCk7XG4gICAgICAgICAgICBwcmludFN0b2NrRGF0YShucyk7XG4gICAgICAgICAgICBhd2FpdCBucy5zbGVlcCgxMDAwKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RvY2tTeW1ib2xzID0gc3RvY2tTeW1ib2xzXG4gICAgICAgICAgICAuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLmFicygwLjUgLSBnZXRGb3JlY2FzdChzdG9ja1ByaWNlQ2hhbmdlcy5nZXQoYikhKSkgLSBNYXRoLmFicygwLjUgLSBnZXRGb3JlY2FzdChzdG9ja1ByaWNlQ2hhbmdlcy5nZXQoYSkhKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgZm9yIChjb25zdCBzdG9ja1N5bWJvbCBvZiBzdG9ja1N5bWJvbHMpIHtcbiAgICAgICAgICAgIGxldCBhdmFpbGFibGVNb25leSA9IG5zLmdldFBsYXllcigpLm1vbmV5IC0gY29uZmlnLnJlc2VydmVkTW9uZXk7XG4gICAgICAgICAgICBpZiAoYXZhaWxhYmxlTW9uZXkgPD0gMCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcG9zaXRpb24gPSBucy5zdG9jay5nZXRQb3NpdGlvbihzdG9ja1N5bWJvbCk7XG4gICAgICAgICAgICBjb25zdCBzaGFyZXNMb25nID0gcG9zaXRpb25bMF07XG4gICAgICAgICAgICBjb25zdCBzaGFyZXNTaG9ydCA9IHBvc2l0aW9uWzJdO1xuICAgICAgICAgICAgY29uc3QgZm9yZWNhc3QgPSBnZXRGb3JlY2FzdChzdG9ja1ByaWNlQ2hhbmdlcy5nZXQoc3RvY2tTeW1ib2wpISk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHdlIHdhbnQgdG8gc2VsbCBsb25nXG4gICAgICAgICAgICBpZiAoZm9yZWNhc3QgPCAwLjQgJiYgc2hhcmVzTG9uZyA+IDApIHtcbiAgICAgICAgICAgICAgICBucy5zdG9jay5zZWxsU3RvY2soc3RvY2tTeW1ib2wsIHNoYXJlc0xvbmcpO1xuICAgICAgICAgICAgICAgIGF2YWlsYWJsZU1vbmV5ID0gbnMuZ2V0UGxheWVyKCkubW9uZXkgLSBjb25maWcucmVzZXJ2ZWRNb25leTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHdlIHdhbnQgdG8gc2VsbCBzaG9ydFxuICAgICAgICAgICAgaWYgKGZvcmVjYXN0ID4gMC41ICYmIHNoYXJlc1Nob3J0ID4gMCAmJiBjb25maWcuZW5hYmxlU2hvcnQpIHtcbiAgICAgICAgICAgICAgICBucy5zdG9jay5zZWxsU2hvcnQoc3RvY2tTeW1ib2wsIHNoYXJlc1Nob3J0KTtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVNb25leSA9IG5zLmdldFBsYXllcigpLm1vbmV5IC0gY29uZmlnLnJlc2VydmVkTW9uZXk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHdlIHdhbnQgdG8gYnV5IGxvbmdcbiAgICAgICAgICAgIGlmIChmb3JlY2FzdCA+IDAuNykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1heFNoYXJlc0ZvckJ1eWluZyA9IG5zLnN0b2NrLmdldE1heFNoYXJlcyhzdG9ja1N5bWJvbCkgLSBzaGFyZXNMb25nO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFza1ByaWNlID0gbnMuc3RvY2suZ2V0QXNrUHJpY2Uoc3RvY2tTeW1ib2wpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFmZm9yZGFibGVTaGFyZXMgPSBNYXRoLmZsb29yKFxuICAgICAgICAgICAgICAgICAgICAoYXZhaWxhYmxlTW9uZXkgLSBTVE9DS19NQVJLRVRfQ09NTUlTU0lPTl9GRUUpIC8gYXNrUHJpY2VcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoYXJlcyA9IE1hdGgubWluKGFmZm9yZGFibGVTaGFyZXMsIG1heFNoYXJlc0ZvckJ1eWluZyk7XG4gICAgICAgICAgICAgICAgaWYgKHNoYXJlcyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBucy5zdG9jay5idXlTdG9jayhzdG9ja1N5bWJvbCwgc2hhcmVzKTtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVNb25leSA9IG5zLmdldFBsYXllcigpLm1vbmV5IC0gY29uZmlnLnJlc2VydmVkTW9uZXk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHdlIHdhbnQgdG8gYnV5IHNob3J0XG4gICAgICAgICAgICBpZiAoZm9yZWNhc3QgPCAwLjMgJiYgY29uZmlnLmVuYWJsZVNob3J0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF4U2hhcmVzRm9yQnV5aW5nID0gbnMuc3RvY2suZ2V0TWF4U2hhcmVzKHN0b2NrU3ltYm9sKSAtIHNoYXJlc1Nob3J0O1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpZFByaWNlID0gbnMuc3RvY2suZ2V0QmlkUHJpY2Uoc3RvY2tTeW1ib2wpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFmZm9yZGFibGVTaGFyZXMgPSBNYXRoLmZsb29yKFxuICAgICAgICAgICAgICAgICAgICAoYXZhaWxhYmxlTW9uZXkgLSBTVE9DS19NQVJLRVRfQ09NTUlTU0lPTl9GRUUpIC8gYmlkUHJpY2VcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoYXJlcyA9IE1hdGgubWluKGFmZm9yZGFibGVTaGFyZXMsIG1heFNoYXJlc0ZvckJ1eWluZyk7XG4gICAgICAgICAgICAgICAgaWYgKHNoYXJlcyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBucy5zdG9jay5idXlTaG9ydChzdG9ja1N5bWJvbCwgc2hhcmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBucy5jbGVhckxvZygpO1xuICAgICAgICBwcmludFN0b2NrRGF0YShucyk7XG4gICAgICAgIGF3YWl0IG5zLnNsZWVwKDEwMDApO1xuICAgIH1cbn1cblxubGV0IG5zeDogTmV0c2NyaXB0RXh0ZW5zaW9uO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihuczogTlMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBuc3ggPSBuZXcgTmV0c2NyaXB0RXh0ZW5zaW9uKG5zKTtcbiAgICBuc3gua2lsbFByb2Nlc3Nlc1NwYXduRnJvbVNhbWVTY3JpcHQoKTtcblxuICAgIGNvbnN0IGNvbmZpZyA9IChjdXN0b21Db25maWcgIT09IG51bGwpID8gY3VzdG9tQ29uZmlnIDogZGVmYXVsdENvbmZpZztcblxuICAgIG5zLmRpc2FibGVMb2coXCJBTExcIik7XG5cbiAgICBpZiAoIW5zLnN0b2NrLmhhc1dTRUFjY291bnQoKSkge1xuICAgICAgICBucy50cHJpbnQoXCJQbGVhc2UgYnV5IFdTRSBhY2NvdW50XCIpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghbnMuc3RvY2suaGFzVElYQVBJQWNjZXNzKCkpIHtcbiAgICAgICAgbnMudHByaW50KFwiUGxlYXNlIGJ1eSBUSVggQVBJIGFjY2Vzc1wiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBucy50YWlsKCk7XG4gICAgLy8gbnMucmVzaXplVGFpbCgzMzAsIDExMCk7XG4gICAgLy8gbnMubW92ZVRhaWwoMjAwMCwgMCk7XG5cbiAgICBpZiAobnMuc3RvY2suaGFzNFNEYXRhVElYQVBJKCkpIHtcbiAgICAgICAgYXdhaXQgdHJhZGVTdG9ja3NXaXRoUzRNYXJrZXREYXRhKG5zLCBjb25maWcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHRyYWRlU3RvY2tzV2l0aG91dFM0TWFya2V0RGF0YShucywgY29uZmlnKTtcbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFDQSxTQUFRLG1DQUFrQztBQUMxQyxTQUFRLDBCQUF5QjtBQVdqQyxNQUFNLGdCQUF3QjtBQUFBLEVBQzFCLGVBQWU7QUFBQSxFQUNmLGtCQUFrQjtBQUFBLEVBQ2xCLG1CQUFtQjtBQUFBLEVBQ25CLG1CQUFtQjtBQUFBLEVBQ25CLG9CQUFvQjtBQUFBLEVBQ3BCLGFBQWE7QUFDakI7QUFFQSxJQUFJLGVBQThCO0FBQ2xDLGVBQXVCO0FBQUEsRUFDbkIsZUFBZTtBQUFBLEVBQ2Ysa0JBQWtCO0FB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
