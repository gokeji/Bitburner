// file: early-stock-trader.js

// does not require 4s Market Data TIX API Access
import { NS } from "@ns";

// defines if stocks can be shorted (see BitNode 8)
const shortAvailable = true;

const commission = 100000;
const samplingLength = 30;
const minSamplingLength = 10;

function predictState(samples) {
    const limits = [
        null,
        null,
        null,
        null,
        5,
        6,
        6,
        7,
        8,
        8,
        9,
        10,
        10,
        11,
        11,
        12,
        12,
        13,
        14,
        14,
        15,
        15,
        16,
        16,
        17,
        17,
        18,
        19,
        19,
        20,
    ];
    let inc = 0;
    for (let i = 0; i < samples.length; ++i) {
        const total = i + 1;
        const idx = samples.length - total;
        if (samples[idx] > 1) {
            ++inc;
        }
        const limit = limits[i];
        if (limit === null) {
            continue;
        }
        if (inc >= limit) {
            return 1;
        }
        if (total - inc >= limit) {
            return -1;
        }
    }
    return 0;
}

function format(money) {
    const prefixes = ["", "k", "m", "b", "t", "q"];
    for (let i = 0; i < prefixes.length; i++) {
        if (Math.abs(money) < 1000) {
            return `${Math.floor(money * 10) / 10}${prefixes[i]}`;
        } else {
            money /= 1000;
        }
    }
    return `${Math.floor(money * 10) / 10}${prefixes[prefixes.length - 1]}`;
}

function posNegDiff(samples) {
    const pos = samples.reduce((acc, curr) => acc + (curr > 1 ? 1 : 0), 0);
    return Math.abs(samples.length - 2 * pos);
}

function posNegRatio(samples) {
    const pos = samples.reduce((acc, curr) => acc + (curr > 1 ? 1 : 0), 0);
    return Math.round(100 * ((2 * pos) / samples.length - 1));
}

function getVolatility(samples) {
    if (samples.length < 2) {
        return 0;
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    return Math.sqrt(variance);
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    let symLastPrice = {};
    let symChanges = {};
    for (const sym of ns.stock.getSymbols()) {
        symLastPrice[sym] = ns.stock.getPrice(sym);
        symChanges[sym] = [];
    }

    while (true) {
        await ns.stock.nextUpdate();

        var longStocks = new Set();
        var shortStocks = new Set();

        for (const sym of ns.stock.getSymbols()) {
            const current = ns.stock.getPrice(sym);
            symChanges[sym].push(current / symLastPrice[sym]);
            symLastPrice[sym] = current;
            if (symChanges[sym].length > samplingLength) {
                symChanges[sym] = symChanges[sym].slice(symChanges[sym].length - samplingLength);
            }
        }

        // Print in log when waiting for sampling to complete
        if (symChanges["FSIG"].length < minSamplingLength) {
            ns.print(`Sampling ${symChanges["FSIG"].length} of ${samplingLength}`);
            continue;
        }

        const stocks = ns.stock.getSymbols().map((sym) => {
            const positions = ns.stock.getPosition(sym);
            const stock = {
                sym: sym,
                longShares: positions[0],
                longPrice: positions[1],
                shortShares: positions[2],
                shortPrice: positions[3],
                volatility: getVolatility(symChanges[sym]),
            };
            const predictionStrength = Math.abs(posNegRatio(symChanges[sym]) / 100);
            stock.profitPotential = predictionStrength * (stock.volatility * 100) ** 2;
            return stock;
        });

        stocks.sort((a, b) => b.profitPotential - a.profitPotential);

        ns.print("");
        // only consider the first most profitable stocks for buying
        var sold = false;
        for (const stock of stocks) {
            const { sym, longShares, longPrice, shortShares, shortPrice } = stock;
            const ratio = posNegRatio(symChanges[sym]);
            stock.summary = `${sym} (${ratio}% ±${ns.formatPercent(stock.volatility)} p:${ns.formatNumber(
                stock.profitPotential,
            )})`;

            const state = predictState(symChanges[sym]);
            const bidPrice = ns.stock.getBidPrice(sym);
            const askPrice = ns.stock.getAskPrice(sym);

            if (longShares > 0) {
                const cost = longShares * longPrice;
                const value = longShares * bidPrice;
                const profit = value - cost - commission;
                stock.cost = cost;
                stock.value = value;
                stock.profit = profit;

                if (state < 0) {
                    const sellPrice = ns.stock.sellStock(sym, longShares);
                    if (sellPrice > 0) {
                        sold = true;
                        ns.print(`WARN SOLD (long) ${sym}. Profit: ${format(profit)}`);
                    }
                } else {
                    longStocks.add(sym);
                }
            } else if (shortShares > 0) {
                const cost = shortShares * shortPrice;
                const profit = shortShares * (shortPrice - askPrice) - commission;
                const value = cost + profit;
                stock.cost = cost;
                stock.value = value;
                stock.profit = profit;

                if (state > 0) {
                    const sellPrice = ns.stock.sellShort(sym, shortShares);
                    if (sellPrice > 0) {
                        sold = true;
                        ns.print(`WARN SOLD (short) ${sym}. Profit: ${format(profit)}`);
                    }
                } else {
                    shortStocks.add(sym);
                }
            }
            const money = ns.getServerMoneyAvailable("home");
            if (money >= commission * 1000) {
                if (state > 0 && !sold) {
                    const sharesToBuy = Math.min(
                        ns.stock.getMaxShares(sym),
                        Math.floor((money - commission) / askPrice),
                    );
                    if (ns.stock.buyStock(sym, sharesToBuy) > 0) {
                        longStocks.add(sym);
                        ns.print(`WARN BOUGHT (long) ${sym}.`);
                    }
                } else if (state < 0 && !sold && shortAvailable) {
                    const sharesToBuy = Math.min(
                        ns.stock.getMaxShares(sym),
                        Math.floor((money - commission) / bidPrice),
                    );
                    if (ns.stock.buyShort(sym, sharesToBuy) > 0) {
                        shortStocks.add(sym);
                        ns.print(`WARN BOUGHT (short) ${sym}.`);
                    }
                }
            }
        }

        // send stock market manipulation orders to hack manager
        var growStockPort = ns.getPortHandle(1); // port 1 is grow
        var hackStockPort = ns.getPortHandle(2); // port 2 is hack
        if (growStockPort.empty() && hackStockPort.empty()) {
            // only write to ports if empty
            for (const sym of longStocks) {
                const stock = stocks.find((s) => s.sym === sym);
                if (stock && stock.value) {
                    growStockPort.write(`${getSymServer(sym)}:${stock.value * stock.volatility * 100}`);
                }
            }
            for (const sym of shortStocks) {
                const stock = stocks.find((s) => s.sym === sym);
                if (stock && stock.value) {
                    hackStockPort.write(`${getSymServer(sym)}:${stock.value * stock.volatility * 100}`);
                }
            }
        }

        for (const stock of stocks) {
            if (stock.longShares > 0) {
                ns.print(
                    `INFO ${stock.summary} LONG: ${format(stock.value)} / ${format(stock.profit)} (${
                        Math.round((stock.profit / stock.cost) * 10000) / 100
                    }%)`,
                );
            } else if (stock.shortShares > 0) {
                ns.print(
                    `INFO ${stock.summary} SHORT: ${format(stock.value)} / ${format(stock.profit)} (${
                        Math.round((stock.profit / stock.cost) * 10000) / 100
                    }%)`,
                );
            } else {
                ns.print(`INFO ${stock.summary}`);
            }
        }

        ns.print(`long stocks: ${Array.from(longStocks).join(", ")}`);
        ns.print(`short stocks: ${Array.from(shortStocks).join(", ")}`);
        // while manipulating the stock market is nice, the early game effect is negligible
        // since "interesting" stocks can typically not be attacked yet due to low hacking skill
        // in my experience actively manipulating "low hack skill" stocks is less effective than trading megacorps
        // It has more impact starting mid-game where access to 4s is there (use a trader with 4s data)
        // main use case is the BN8 challenge
    }
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
