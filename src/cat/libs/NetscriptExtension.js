import { RESERVED_RAM_ON_HOME_SERVER, SHARE_SCRIPT_NAME, STOCK_MARKET_COMMISSION_FEE } from "./constants";
class NetscriptExtension {
    ns;
    atExitCallbacks = [];
    constructor(nsContext) {
        this.ns = nsContext;
        this.ns.atExit(() => {
            for (const callback of this.atExitCallbacks) {
                callback();
            }
        });
    }
    addAtExitCallback(callback) {
        this.atExitCallbacks.push(callback);
    }
    scanDFS(startingHostname, action = (_) => {}) {
        const hosts = [];
        const hostnames = /* @__PURE__ */ new Set();
        const scan = (currentHostname, previousHostname, depth, actionOfInternalScan) => {
            hostnames.add(currentHostname);
            const currentHost = {
                hostname: currentHostname,
                depth,
                canAccessFrom: previousHostname,
            };
            hosts.push(currentHost);
            actionOfInternalScan(currentHost);
            const nextHostnames = this.ns.scan(currentHostname);
            nextHostnames.forEach((hostname) => {
                if (hostnames.has(hostname)) {
                    return;
                }
                scan(hostname, currentHostname, depth + 1, actionOfInternalScan);
            });
        };
        scan(startingHostname, "", 0, action);
        return hosts;
    }
    scanBFS(startingHostname, action = (_) => {}) {
        const startingHost = {
            hostname: startingHostname,
            depth: 0,
            canAccessFrom: "",
        };
        const hosts = [startingHost];
        const hostnames = /* @__PURE__ */ new Set();
        hostnames.add(startingHostname);
        action(startingHost);
        let current = 0;
        while (current < hosts.length) {
            const currentServer = hosts[current];
            const nextHostnames = this.ns.scan(currentServer.hostname);
            nextHostnames.forEach((hostname) => {
                if (hostnames.has(hostname)) {
                    return;
                }
                const host = {
                    hostname,
                    depth: currentServer.depth + 1,
                    canAccessFrom: currentServer.hostname,
                };
                hosts.push(host);
                hostnames.add(hostname);
                action(host);
            });
            ++current;
        }
        return hosts;
    }
    /**
     *
     * @param runners
     * @param killScriptBeforeRunning
     * @param scriptName This script must exist on home, it will be scp to each runner
     * @param threadOrOptions
     * @param scriptArgs
     */
    runScriptOnRunners(runners, killScriptBeforeRunning = true, scriptName, threadOrOptions, ...scriptArgs) {
        const ramPerThread = this.ns.getScriptRam(scriptName, "home");
        let requiredThreads;
        if (typeof threadOrOptions === "number") {
            requiredThreads = threadOrOptions;
        } else {
            requiredThreads = threadOrOptions.threads;
        }
        if (requiredThreads === void 0) {
            throw new Error(`Invalid param threadOrOptions: ${JSON.stringify(threadOrOptions)}`);
        }
        const runnerProcesses = [];
        for (const runner of runners) {
            let availableRAM = this.ns.getServerMaxRam(runner) - this.ns.getServerUsedRam(runner);
            if (runner === "home") {
                availableRAM -= RESERVED_RAM_ON_HOME_SERVER;
            }
            if (availableRAM <= 0) {
                continue;
            }
            const availableThreads = Math.floor(availableRAM / ramPerThread);
            if (availableThreads <= 0) {
                continue;
            }
            if (killScriptBeforeRunning) {
                this.ns.scriptKill(scriptName, runner);
            }
            this.ns.scp(scriptName, runner, "home");
            const threads = Math.min(availableThreads, requiredThreads);
            const pid = this.ns.exec(scriptName, runner, threads, ...scriptArgs);
            if (pid === 0) {
                continue;
            }
            runnerProcesses.push({
                hostname: runner,
                availableThreads,
                scriptName,
                threads,
                scriptArgs,
                pid,
            });
            requiredThreads -= threads;
            if (requiredThreads === 0) {
                break;
            }
        }
        return {
            success: requiredThreads === 0,
            remainingThreads: requiredThreads,
            runnerProcesses,
        };
    }
    runScriptOnAllAvailableRunners(killScriptBeforeRunning = true, scriptName, threadOrOptions, ...scriptArgs) {
        const runners = this.scanBFS("home")
            .filter((host) => {
                return this.ns.getServerMaxRam(host.hostname) > 0 && this.ns.hasRootAccess(host.hostname);
            })
            .sort((a, b) => {
                return this.ns.getServerMaxRam(b.hostname) - this.ns.getServerMaxRam(a.hostname);
            })
            .map((host) => {
                return host.hostname;
            });
        return this.runScriptOnRunners(runners, killScriptBeforeRunning, scriptName, threadOrOptions, ...scriptArgs);
    }
    /**
     * "Private runners" means all purchased server and home server (if allowHomeServer set to true).
     *
     * @param reverseRunnerList If reverse, we only reverse list of purchased servers. Home server (if used) will always be
     * at the last of runner list
     * @param allowHomeServer
     * @param killScriptBeforeRunning
     * @param scriptName
     * @param threadOrOptions
     * @param scriptArgs
     */
    runScriptOnAvailablePrivateRunners(
        reverseRunnerList = false,
        allowHomeServer = true,
        killScriptBeforeRunning = true,
        scriptName,
        threadOrOptions,
        ...scriptArgs
    ) {
        const runners = this.ns.getPurchasedServers();
        if (reverseRunnerList) {
            runners.reverse();
        }
        if (allowHomeServer) {
            runners.push("home");
        }
        return this.runScriptOnRunners(runners, killScriptBeforeRunning, scriptName, threadOrOptions, ...scriptArgs);
    }
    checkRunningProcesses(logFilename) {
        let runnerProcessesInfoFromLog = [];
        try {
            const logData = this.ns.read(logFilename);
            if (logData !== "") {
                runnerProcessesInfoFromLog = JSON.parse(this.ns.read(logFilename));
            } else {
                return {
                    stillHaveRunningProcess: false,
                    runningProcesses: [],
                };
            }
        } catch (ex) {
            this.ns.tprint(ex);
        }
        const runnerProcesses = runnerProcessesInfoFromLog.filter((runnerProcess) => {
            return this.ns.isRunning(runnerProcess.pid);
        });
        this.ns.write(logFilename, JSON.stringify(runnerProcesses), "w");
        return {
            stillHaveRunningProcess: runnerProcesses.length > 0,
            runningProcesses: runnerProcesses,
        };
    }
    printShareRAMEffect(minThreads, maxThreads, step) {
        for (let threads = minThreads; threads <= maxThreads; threads += step) {
            const ramPerThread = this.ns.getScriptRam(SHARE_SCRIPT_NAME, "home");
            const effect = 1 + Math.log(1 + threads) / 25;
            this.ns.tprint(
                `Threads: ${threads}:. RAM: ${this.ns.formatRam(ramPerThread * threads)}. Effect: ${effect.toFixed(4)}`,
            );
        }
    }
    getPrivateServersCost() {
        let cost = 0;
        this.ns.getPurchasedServers().forEach((hostname) => {
            cost += this.ns.getPurchasedServerCost(this.ns.getServerMaxRam(hostname));
        });
        return cost;
    }
    getMoneyPerSecondHWGW(hostname) {
        const hackMoneyRatio = 0.99;
        const increasedSecurityFor1ThreadHacking = 2e-3;
        const increasedSecurityFor1ThreadGrowing = 4e-3;
        const server = this.ns.getServer(hostname);
        const player = this.ns.getPlayer();
        let weakenTime1 = 0;
        let growTime = 0;
        let weakenTime2 = 0;
        let hackTime = 0;
        server.hackDifficulty = server.minDifficulty;
        server.moneyAvailable = server.moneyMax;
        const hackRequiredThreads = hackMoneyRatio / this.ns.formulas.hacking.hackPercent(server, player);
        let increasedSecurity = increasedSecurityFor1ThreadHacking * hackRequiredThreads;
        server.hackDifficulty = server.minDifficulty + increasedSecurity;
        server.moneyAvailable = server.moneyMax * (1 - hackMoneyRatio);
        weakenTime1 = this.ns.formulas.hacking.weakenTime(server, player);
        server.hackDifficulty = server.minDifficulty;
        growTime = this.ns.formulas.hacking.growTime(server, player);
        const growRequiredThreads = this.ns.formulas.hacking.growThreads(server, player, server.moneyMax);
        increasedSecurity = increasedSecurityFor1ThreadGrowing * growRequiredThreads;
        server.hackDifficulty = server.minDifficulty + increasedSecurity;
        server.moneyAvailable = server.moneyMax;
        weakenTime2 = this.ns.formulas.hacking.weakenTime(server, player);
        server.hackDifficulty = server.minDifficulty;
        hackTime = this.ns.formulas.hacking.hackTime(server, player);
        this.ns.print(`${hostname}: HWGW time: ${this.ns.tFormat(weakenTime1 + growTime + weakenTime2 + hackTime)}`);
        return (server.moneyMax * hackMoneyRatio) / (weakenTime1 + growTime + weakenTime2 + hackTime);
    }
    getMoneyPerSecondHGW(hostname) {
        const hackMoneyRatio = 0.99;
        const increasedSecurityFor1ThreadHacking = 2e-3;
        const increasedSecurityFor1ThreadGrowing = 4e-3;
        const server = this.ns.getServer(hostname);
        const player = this.ns.getPlayer();
        let growTime = 0;
        let weakenTime = 0;
        let hackTime = 0;
        server.hackDifficulty = server.minDifficulty;
        server.moneyAvailable = server.moneyMax;
        const hackRequiredThreads = hackMoneyRatio / this.ns.formulas.hacking.hackPercent(server, player);
        let increasedSecurity = increasedSecurityFor1ThreadHacking * hackRequiredThreads;
        this.ns.print(`${hostname}: HGW increasedSecurity: ${increasedSecurity}`);
        server.hackDifficulty = server.minDifficulty + increasedSecurity;
        server.moneyAvailable = server.moneyMax * (1 - hackMoneyRatio);
        growTime = this.ns.formulas.hacking.growTime(server, player);
        const growRequiredThreads = this.ns.formulas.hacking.growThreads(server, player, server.moneyMax);
        increasedSecurity = increasedSecurityFor1ThreadGrowing * growRequiredThreads;
        server.hackDifficulty = server.minDifficulty + increasedSecurity;
        server.moneyAvailable = server.moneyMax;
        weakenTime = this.ns.formulas.hacking.weakenTime(server, player);
        server.hackDifficulty = server.minDifficulty;
        hackTime = this.ns.formulas.hacking.hackTime(server, player);
        this.ns.print(`${hostname}: HGW time: ${this.ns.tFormat(growTime + weakenTime + hackTime)}`);
        return (server.moneyMax * hackMoneyRatio) / (growTime + weakenTime + hackTime);
    }
    killProcessesSpawnFromSameScript() {
        const currentScriptName = this.ns.getScriptName();
        this.ns.ps().forEach((process) => {
            if (process.filename !== currentScriptName || process.pid === this.ns.pid) {
                return;
            }
            this.ns.kill(process.pid);
        });
    }
    calculateStockStats() {
        let currentProfit = 0;
        let currentWorth = 0;
        this.ns.stock.getSymbols().forEach((stockSymbol) => {
            const position = this.ns.stock.getPosition(stockSymbol);
            const sharesLong = position[0];
            const avgLongPrice = position[1];
            const sharesShort = position[2];
            const avgShortPrice = position[3];
            if (sharesLong === 0 && sharesShort === 0) {
                return;
            }
            if (sharesLong > 0) {
                const longSharesProfit =
                    sharesLong * (this.ns.stock.getBidPrice(stockSymbol) - avgLongPrice) -
                    2 * STOCK_MARKET_COMMISSION_FEE;
                const longSharesWorth = this.ns.stock.getSaleGain(stockSymbol, sharesLong, "Long");
                currentProfit += longSharesProfit;
                currentWorth += longSharesWorth;
            }
            if (sharesShort > 0) {
                const shortSharesProfit =
                    sharesShort * (avgShortPrice - this.ns.stock.getAskPrice(stockSymbol)) -
                    2 * STOCK_MARKET_COMMISSION_FEE;
                const shortSharesWorth = this.ns.stock.getSaleGain(stockSymbol, sharesShort, "Short");
                currentProfit += shortSharesProfit;
                currentWorth += shortSharesWorth;
            }
        });
        const privateServersCost = this.getPrivateServersCost();
        const estimatedTotalProfit =
            this.ns.getPlayer().money +
            currentWorth -
            this.ns.getMoneySources().sinceInstall.hacking +
            privateServersCost;
        return {
            currentProfit,
            estimatedTotalProfit,
            currentWorth,
        };
    }
}
function parseAutoCompleteDataFromDefaultConfig(data, defaultConfig) {
    data.flags(defaultConfig);
    return ["true", "false"];
}
export { NetscriptExtension, parseAutoCompleteDataFromDefaultConfig };
