import { NS } from "@ns";

// file: stock-trader.js

// requires 4s Market Data TIX API Access

// defines if stocks can be shorted (see BitNode 8)
const shortAvailable = true;

const commission = 100000;
const reserveCash = 0.5e9;

const BUY_LONG_THRESHOLD = 0.6;
const SELL_LONG_THRESHOLD = 0.55;
const BUY_SHORT_THRESHOLD = 0.4;
const SELL_SHORT_THRESHOLD = 0.45;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    while (true) {
        tendStocks(ns);
        await ns.stock.nextUpdate();
    }
}

/** @param {NS} ns */
function customPrint(ns, message) {
    ns.print(`INFO ${message}`);
}

/** @param {NS} ns */
function tendStocks(ns) {
    ns.print("");
    var stocks = getAllStocks(ns);

    stocks.sort((a, b) => b.profitPotential - a.profitPotential);

    var longStocks = new Map();
    var shortStocks = new Map();
    var overallValue = 0;
    var totalProfit = 0;

    const shouldOwnStocks = stocks.filter(
        (stock) => stock.forecast > BUY_LONG_THRESHOLD || stock.forecast < BUY_SHORT_THRESHOLD,
    );
    const ownedStocks = stocks.filter((stock) => stock.longShares > 0 || stock.shortShares > 0);
    const ownedStocksCount = ownedStocks.length;

    // Find stocks we should own but don't currently own
    let shouldBuyStocks = shouldOwnStocks.filter((stock) => !ownedStocks.includes(stock));

    // Only consider the top N stocks where N is the number of stocks we currently own
    const maxPositionsToConsider = ownedStocksCount;
    shouldBuyStocks = shouldBuyStocks.slice(0, maxPositionsToConsider);

    for (const stock of stocks) {
        if (stock.longShares > 0) {
            if (stock.forecast > BUY_LONG_THRESHOLD) {
                longStocks.set(stock.sym, stock);
                const shareOwnership = stock.longShares / stock.maxShares;
                customPrint(
                    ns,
                    `${stock.summary} LONG ${ns.formatNumber(stock.value, 1)} ${ns.formatPercent(stock.value / stock.cost, 2)} {${ns.formatPercent(shareOwnership, 2)}}`,
                );
                overallValue += stock.value;
                totalProfit += stock.profit;
            } else {
                shortStocks.set(stock.sym, stock);

                if (stock.forecast < SELL_LONG_THRESHOLD) {
                    const salePrice = ns.stock.sellStock(stock.sym, stock.longShares);
                    const saleTotal = salePrice * stock.longShares;
                    const saleCost = stock.longPrice * stock.longShares;
                    const saleProfit = saleTotal - saleCost - 2 * commission;
                    stock.shares = 0;
                    ns.print(`WARN ${stock.summary} SOLD for ${ns.formatNumber(saleProfit, 1)} profit`);
                }
            }
        }
        if (stock.shortShares > 0) {
            if (stock.forecast < BUY_SHORT_THRESHOLD) {
                shortStocks.set(stock.sym, stock);
                const shareOwnership = stock.shortShares / stock.maxShares;
                customPrint(
                    ns,
                    `${stock.summary} SHORT ${ns.formatNumber(stock.value, 1)} ${ns.formatPercent(stock.value / stock.cost, 2)} {${ns.formatPercent(shareOwnership, 2)}}`,
                );
                overallValue += stock.value;
                totalProfit += stock.profit;
            } else {
                longStocks.set(stock.sym, stock);

                if (stock.forecast > SELL_SHORT_THRESHOLD) {
                    const salePrice = ns.stock.sellShort(stock.sym, stock.shortShares);
                    const saleTotal = salePrice * stock.shortShares;
                    const saleCost = stock.shortPrice * stock.shortShares;
                    const saleProfit = saleTotal - saleCost - 2 * commission;
                    stock.shares = 0;
                    ns.print(`WARN ${stock.summary} SHORT SOLD for ${ns.formatNumber(saleProfit, 1)} profit`);
                }
            }
        }
    }

    for (const stock of stocks) {
        var money = ns.getServerMoneyAvailable("home") - reserveCash;
        //ns.print(`INFO ${stock.summary}`);
        if (stock.forecast > BUY_LONG_THRESHOLD) {
            //ns.print(`INFO ${stock.summary}`);
            if (money > 500 * commission) {
                const sharesToBuy = Math.min(stock.maxShares, Math.floor((money - commission) / stock.askPrice));
                if (ns.stock.buyStock(stock.sym, sharesToBuy) > 0) {
                    ns.print(`WARN ${stock.summary} LONG BOUGHT ${ns.formatNumber(sharesToBuy, 1)}`);
                }
            }
        } else if (stock.forecast < BUY_SHORT_THRESHOLD && shortAvailable) {
            //ns.print(`INFO ${stock.summary}`);
            if (money > 500 * commission) {
                const sharesToBuy = Math.min(stock.maxShares, Math.floor((money - commission) / stock.bidPrice));
                if (ns.stock.buyShort(stock.sym, sharesToBuy) > 0) {
                    ns.print(`WARN ${stock.summary} SHORT BOUGHT ${ns.formatNumber(sharesToBuy, 1)}`);
                }
            }
        }
    }
    ns.print("Stock value: " + ns.formatNumber(overallValue, 1));
    ns.print("Total P&L: " + (totalProfit >= 0 ? "+" : "") + ns.formatNumber(totalProfit, 1));

    for (const stock of shouldBuyStocks) {
        customPrint(ns, `NEED ${stock.summary}`);
    }

    // send stock market manipulation orders to hack manager
    var growStockPort = ns.getPortHandle(1); // port 1 is grow
    var hackStockPort = ns.getPortHandle(2); // port 2 is hack

    for (const stock of longStocks.values()) {
        //ns.print("INFO grow " + sym);
        // Prioritize volatile stocks
        growStockPort.write(`${getSymServer(stock.sym)}:${stock.value * stock.volatility * 100}`);
    }
    if (shortStocks.size === 0) {
        hackStockPort.write("EMPTY");
    }
    for (const stock of shortStocks.values()) {
        //ns.print("INFO hack " + sym);
        // Prioritize volatile stocks
        hackStockPort.write(`${getSymServer(stock.sym)}:${stock.value * stock.volatility * 100}`);
    }
    if (longStocks.size === 0) {
        growStockPort.write("EMPTY");
    }

    ns.print("longStocks: " + Array.from(longStocks.keys()).join(", "));
    ns.print("shortStocks: " + Array.from(shortStocks.keys()).join(", "));
}

/** @param {NS} ns */
export function getAllStocks(ns) {
    // make a lookup table of all stocks and all their properties
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
            forecast: ns.stock.getForecast(sym),
            volatility: ns.stock.getVolatility(sym),
            askPrice: ns.stock.getAskPrice(sym),
            bidPrice: ns.stock.getBidPrice(sym),
            maxShares: ns.stock.getMaxShares(sym),
        };

        var longProfit = stock.longShares * (stock.bidPrice - stock.longPrice) - 2 * commission;
        var shortProfit = stock.shortShares * (stock.shortPrice - stock.askPrice) - 2 * commission;
        stock.profit = longProfit + shortProfit;
        stock.cost = stock.longShares * stock.longPrice + stock.shortShares * stock.shortPrice;
        stock.value = stock.cost + stock.profit;

        // profit potential as chance for profit * effect of profit
        var profitChance = 2 * Math.abs(stock.forecast - 0.5);
        var profitPotential = profitChance * (stock.volatility * 100) ** 2;
        stock.profitPotential = profitPotential;

        stock.summary = `${stock.sym}: ${ns.formatPercent(stock.forecast)} ±${ns.formatPercent(stock.volatility)} p${ns.formatNumber(stock.profitPotential, 2)}`;
        stocks.push(stock);
    }
    return stocks;
}

function getSymServer(sym) {
    const symServer = {
        WDS: "",
        ECP: "ecorp",
        MGCP: "megacorp",
        BLD: "blade",
        CLRK: "clarkinc",
        OMTK: "omnitek",
        FSIG: "4sigma",
        KGI: "kuai-gong",
        DCOMM: "defcomm",
        VITA: "vitalife",
        ICRS: "icarus",
        UNV: "univ-energy",
        AERO: "aerocorp",
        SLRS: "solaris",
        GPH: "global-pharm",
        NVMD: "nova-med",
        LXO: "lexo-corp",
        RHOC: "rho-construction",
        APHE: "alpha-ent",
        SYSC: "syscore",
        CTK: "computek",
        NTLK: "netlink",
        OMGA: "omega-net",
        JGN: "joesguns",
        SGC: "sigma-cosmetics",
        CTYS: "catalyst",
        MDYN: "microdyne",
        TITN: "titan-labs",
        FLCM: "fulcrumtech",
        STM: "stormtech",
        HLS: "helios",
        OMN: "omnia",
        FNS: "foodnstuff",
    };

    return symServer[sym];
}
