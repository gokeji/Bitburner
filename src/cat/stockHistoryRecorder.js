import { MAX_STOCK_HISTORY_RECORD, STOCK_HISTORY_LOGS_PREFIX } from "./libs/constants";
import { NetscriptExtension } from "./libs/NetscriptExtension";
let nsx;
async function main(ns) {
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    ns.disableLog("ALL");
    ns.tail();
    const stockSymbols = ns.stock.getSymbols();
    const stockTraderData = {
        stockPrices: {},
        stockForecasts: {},
    };
    let rotateLog = true;
    let logFilename = "";
    while (true) {
        if (ns.ls("home", STOCK_HISTORY_LOGS_PREFIX).length >= 10) {
            break;
        }
        if (rotateLog) {
            stockSymbols.forEach((symbol) => {
                stockTraderData.stockPrices[symbol] = [ns.stock.getPrice(symbol)];
                stockTraderData.stockForecasts[symbol] = [ns.stock.getForecast(symbol)];
            });
            logFilename = `${STOCK_HISTORY_LOGS_PREFIX}${Date.now()}.txt`;
            rotateLog = false;
        }
        const isPriceChanged = stockSymbols.some((symbol) => {
            const records = stockTraderData.stockPrices[symbol];
            return records[records.length - 1] !== ns.stock.getPrice(symbol);
        });
        if (!isPriceChanged) {
            await ns.sleep(2e3);
            continue;
        }
        stockSymbols.forEach((symbol) => {
            const records = stockTraderData.stockPrices[symbol];
            records.push(ns.stock.getPrice(symbol));
            stockTraderData.stockForecasts[symbol].push(ns.stock.getForecast(symbol));
            if (records.length === MAX_STOCK_HISTORY_RECORD) {
                rotateLog = true;
            }
        });
        ns.write(logFilename, JSON.stringify(stockTraderData), "w");
        await ns.sleep(2e3);
    }
}
export { main };
