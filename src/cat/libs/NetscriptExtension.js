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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2xpYnMvTmV0c2NyaXB0RXh0ZW5zaW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge0F1dG9jb21wbGV0ZURhdGEsIE5TLCBSdW5PcHRpb25zLCBTY3JpcHRBcmd9IGZyb20gXCJAbnNcIjtcbmltcG9ydCB7UkVTRVJWRURfUkFNX09OX0hPTUVfU0VSVkVSLCBTSEFSRV9TQ1JJUFRfTkFNRSwgU1RPQ0tfTUFSS0VUX0NPTU1JU1NJT05fRkVFfSBmcm9tIFwiL2xpYnMvY29uc3RhbnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NhblNlcnZlckluZm8ge1xuICAgIHJlYWRvbmx5IGhvc3RuYW1lOiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgZGVwdGg6IG51bWJlcjtcbiAgICByZWFkb25seSBjYW5BY2Nlc3NGcm9tOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUnVubmVyUHJvY2VzcyB7XG4gICAgcmVhZG9ubHkgaG9zdG5hbWU6IHN0cmluZyxcbiAgICByZWFkb25seSBhdmFpbGFibGVUaHJlYWRzOiBudW1iZXIsXG4gICAgcmVhZG9ubHkgc2NyaXB0TmFtZTogc3RyaW5nLFxuICAgIHJlYWRvbmx5IHRocmVhZHM6IG51bWJlcixcbiAgICByZWFkb25seSBzY3JpcHRBcmdzOiAoc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbilbXVxuICAgIHJlYWRvbmx5IHBpZDogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUnVuU2NyaXB0UmVzdWx0IHtcbiAgICByZWFkb25seSBzdWNjZXNzOiBib29sZWFuLFxuICAgIHJlYWRvbmx5IHJlbWFpbmluZ1RocmVhZHM6IG51bWJlciwgLy8gTnVtYmVyIG9mIHRocmVhZCB0aGF0IHdlIGNhbm5vdCBydW5cbiAgICByZWFkb25seSBydW5uZXJQcm9jZXNzZXM6IFJ1bm5lclByb2Nlc3NbXVxufVxuXG5leHBvcnQgdHlwZSBOZXRzY3JpcHRGbGFnc1NjaGVtYSA9IFtzdHJpbmcsIHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfCBzdHJpbmdbXV1bXTtcbmV4cG9ydCB0eXBlIE5ldHNjcmlwdEZsYWdzID0geyBba2V5OiBzdHJpbmddOiBTY3JpcHRBcmcgfCBzdHJpbmdbXSB9O1xuXG5leHBvcnQgY2xhc3MgTmV0c2NyaXB0RXh0ZW5zaW9uIHtcbiAgICBuczogTlM7XG4gICAgcHJpdmF0ZSBhdEV4aXRDYWxsYmFja3M6ICgoKSA9PiB2b2lkKVtdID0gW107XG5cbiAgICBjb25zdHJ1Y3Rvcihuc0NvbnRleHQ6IE5TKSB7XG4gICAgICAgIHRoaXMubnMgPSBuc0NvbnRleHQ7XG4gICAgICAgIHRoaXMubnMuYXRFeGl0KCgpID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5hdEV4aXRDYWxsYmFja3MpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBhZGRBdEV4aXRDYWxsYmFjayhjYWxsYmFjazogKCkgPT4gdm9pZCkge1xuICAgICAgICB0aGlzLmF0RXhpdENhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBzY2FuREZTKFxuICAgICAgICBzdGFydGluZ0hvc3RuYW1lOiBzdHJpbmcsXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICAgICAgYWN0aW9uID0gKF86IFNjYW5TZXJ2ZXJJbmZvKSA9PiB7XG4gICAgICAgIH1cbiAgICApIHtcbiAgICAgICAgY29uc3QgaG9zdHM6IFNjYW5TZXJ2ZXJJbmZvW10gPSBbXTtcbiAgICAgICAgY29uc3QgaG9zdG5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IHNjYW4gPSAoXG4gICAgICAgICAgICBjdXJyZW50SG9zdG5hbWU6IHN0cmluZyxcbiAgICAgICAgICAgIHByZXZpb3VzSG9zdG5hbWU6IHN0cmluZywgZGVwdGg6IG51bWJlcixcbiAgICAgICAgICAgIGFjdGlvbk9mSW50ZXJuYWxTY2FuOiAoaG9zdG5hbWU6IFNjYW5TZXJ2ZXJJbmZvKSA9PiB2b2lkXG4gICAgICAgICkgPT4ge1xuICAgICAgICAgICAgaG9zdG5hbWVzLmFkZChjdXJyZW50SG9zdG5hbWUpO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudEhvc3QgPSA8U2NhblNlcnZlckluZm8+e1xuICAgICAgICAgICAgICAgIGhvc3RuYW1lOiBjdXJyZW50SG9zdG5hbWUsXG4gICAgICAgICAgICAgICAgZGVwdGg6IGRlcHRoLFxuICAgICAgICAgICAgICAgIGNhbkFjY2Vzc0Zyb206IHByZXZpb3VzSG9zdG5hbWVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBob3N0cy5wdXNoKGN1cnJlbnRIb3N0KTtcbiAgICAgICAgICAgIGFjdGlvbk9mSW50ZXJuYWxTY2FuKGN1cnJlbnRIb3N0KTtcblxuICAgICAgICAgICAgLy8gU2NhbiBhZGphY2VudCBob3N0c1xuICAgICAgICAgICAgY29uc3QgbmV4dEhvc3RuYW1lcyA9IHRoaXMubnMuc2NhbihjdXJyZW50SG9zdG5hbWUpO1xuICAgICAgICAgICAgbmV4dEhvc3RuYW1lcy5mb3JFYWNoKGhvc3RuYW1lID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaG9zdG5hbWVzLmhhcyhob3N0bmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY2FuKGhvc3RuYW1lLCBjdXJyZW50SG9zdG5hbWUsIGRlcHRoICsgMSwgYWN0aW9uT2ZJbnRlcm5hbFNjYW4pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2NhbihzdGFydGluZ0hvc3RuYW1lLCBcIlwiLCAwLCBhY3Rpb24pO1xuICAgICAgICByZXR1cm4gaG9zdHM7XG4gICAgfVxuXG4gICAgc2NhbkJGUyhcbiAgICAgICAgc3RhcnRpbmdIb3N0bmFtZTogc3RyaW5nLFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgICAgIGFjdGlvbiA9IChfOiBTY2FuU2VydmVySW5mbykgPT4ge1xuICAgICAgICB9XG4gICAgKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0aW5nSG9zdCA9IDxTY2FuU2VydmVySW5mbz57XG4gICAgICAgICAgICBob3N0bmFtZTogc3RhcnRpbmdIb3N0bmFtZSxcbiAgICAgICAgICAgIGRlcHRoOiAwLFxuICAgICAgICAgICAgY2FuQWNjZXNzRnJvbTogXCJcIlxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBob3N0czogU2NhblNlcnZlckluZm9bXSA9IFtzdGFydGluZ0hvc3RdO1xuICAgICAgICBjb25zdCBob3N0bmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgaG9zdG5hbWVzLmFkZChzdGFydGluZ0hvc3RuYW1lKTtcbiAgICAgICAgYWN0aW9uKHN0YXJ0aW5nSG9zdCk7XG5cbiAgICAgICAgbGV0IGN1cnJlbnQgPSAwO1xuICAgICAgICB3aGlsZSAoY3VycmVudCA8IGhvc3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFNlcnZlciA9IGhvc3RzW2N1cnJlbnRdO1xuICAgICAgICAgICAgLy8gU2NhbiBhZGphY2VudCBob3N0c1xuICAgICAgICAgICAgY29uc3QgbmV4dEhvc3RuYW1lcyA9IHRoaXMubnMuc2NhbihjdXJyZW50U2VydmVyLmhvc3RuYW1lKTtcbiAgICAgICAgICAgIG5leHRIb3N0bmFtZXMuZm9yRWFjaChob3N0bmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGhvc3RuYW1lcy5oYXMoaG9zdG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgaG9zdCA9IDxTY2FuU2VydmVySW5mbz57XG4gICAgICAgICAgICAgICAgICAgIGhvc3RuYW1lOiBob3N0bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IGN1cnJlbnRTZXJ2ZXIuZGVwdGggKyAxLFxuICAgICAgICAgICAgICAgICAgICBjYW5BY2Nlc3NGcm9tOiBjdXJyZW50U2VydmVyLmhvc3RuYW1lXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBob3N0cy5wdXNoKGhvc3QpO1xuICAgICAgICAgICAgICAgIGhvc3RuYW1lcy5hZGQoaG9zdG5hbWUpO1xuICAgICAgICAgICAgICAgIGFjdGlvbihob3N0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgKytjdXJyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBob3N0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBydW5uZXJzXG4gICAgICogQHBhcmFtIGtpbGxTY3JpcHRCZWZvcmVSdW5uaW5nXG4gICAgICogQHBhcmFtIHNjcmlwdE5hbWUgVGhpcyBzY3JpcHQgbXVzdCBleGlzdCBvbiBob21lLCBpdCB3aWxsIGJlIHNjcCB0byBlYWNoIHJ1bm5lclxuICAgICAqIEBwYXJhbSB0aHJlYWRPck9wdGlvbnNcbiAgICAgKiBAcGFyYW0gc2NyaXB0QXJnc1xuICAgICAqL1xuICAgIHJ1blNjcmlwdE9uUnVubmVycyhcbiAgICAgICAgcnVubmVyczogc3RyaW5nW10sXG4gICAgICAgIGtpbGxTY3JpcHRCZWZvcmVSdW5uaW5nID0gdHJ1ZSxcbiAgICAgICAgc2NyaXB0TmFtZTogc3RyaW5nLFxuICAgICAgICB0aHJlYWRPck9wdGlvbnM6IG51bWJlciB8IFJ1bk9wdGlvbnMsXG4gICAgICAgIC4uLnNjcmlwdEFyZ3M6IChzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuKVtdKTogUnVuU2NyaXB0UmVzdWx0IHtcbiAgICAgICAgY29uc3QgcmFtUGVyVGhyZWFkID0gdGhpcy5ucy5nZXRTY3JpcHRSYW0oc2NyaXB0TmFtZSwgXCJob21lXCIpO1xuICAgICAgICBsZXQgcmVxdWlyZWRUaHJlYWRzOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gICAgICAgIGlmICh0eXBlb2YgdGhyZWFkT3JPcHRpb25zID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICByZXF1aXJlZFRocmVhZHMgPSB0aHJlYWRPck9wdGlvbnM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXF1aXJlZFRocmVhZHMgPSB0aHJlYWRPck9wdGlvbnMudGhyZWFkcztcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVxdWlyZWRUaHJlYWRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwYXJhbSB0aHJlYWRPck9wdGlvbnM6ICR7SlNPTi5zdHJpbmdpZnkodGhyZWFkT3JPcHRpb25zKX1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBydW5uZXJQcm9jZXNzZXMgPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBydW5uZXIgb2YgcnVubmVycykge1xuICAgICAgICAgICAgbGV0IGF2YWlsYWJsZVJBTSA9IHRoaXMubnMuZ2V0U2VydmVyTWF4UmFtKHJ1bm5lcikgLSB0aGlzLm5zLmdldFNlcnZlclVzZWRSYW0ocnVubmVyKTtcbiAgICAgICAgICAgIGlmIChydW5uZXIgPT09IFwiaG9tZVwiKSB7XG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlUkFNIC09IFJFU0VSVkVEX1JBTV9PTl9IT01FX1NFUlZFUjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhdmFpbGFibGVSQU0gPD0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVGhyZWFkcyA9IE1hdGguZmxvb3IoYXZhaWxhYmxlUkFNIC8gcmFtUGVyVGhyZWFkKTtcbiAgICAgICAgICAgIGlmIChhdmFpbGFibGVUaHJlYWRzIDw9IDApIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChraWxsU2NyaXB0QmVmb3JlUnVubmluZykge1xuICAgICAgICAgICAgICAgIHRoaXMubnMuc2NyaXB0S2lsbChzY3JpcHROYW1lLCBydW5uZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ucy5zY3Aoc2NyaXB0TmFtZSwgcnVubmVyLCBcImhvbWVcIik7XG4gICAgICAgICAgICBjb25zdCB0aHJlYWRzID0gTWF0aC5taW4oYXZhaWxhYmxlVGhyZWFkcywgcmVxdWlyZWRUaHJlYWRzKTtcbiAgICAgICAgICAgIGNvbnN0IHBpZCA9IHRoaXMubnMuZXhlYyhzY3JpcHROYW1lLCBydW5uZXIsIHRocmVhZHMsIC4uLnNjcmlwdEFyZ3MpO1xuICAgICAgICAgICAgaWYgKHBpZCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcnVubmVyUHJvY2Vzc2VzLnB1c2goPFJ1bm5lclByb2Nlc3M+e1xuICAgICAgICAgICAgICAgIGhvc3RuYW1lOiBydW5uZXIsXG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlVGhyZWFkczogYXZhaWxhYmxlVGhyZWFkcyxcbiAgICAgICAgICAgICAgICBzY3JpcHROYW1lOiBzY3JpcHROYW1lLFxuICAgICAgICAgICAgICAgIHRocmVhZHM6IHRocmVhZHMsXG4gICAgICAgICAgICAgICAgc2NyaXB0QXJnczogc2NyaXB0QXJncyxcbiAgICAgICAgICAgICAgICBwaWQ6IHBpZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVxdWlyZWRUaHJlYWRzIC09IHRocmVhZHM7XG4gICAgICAgICAgICBpZiAocmVxdWlyZWRUaHJlYWRzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDxSdW5TY3JpcHRSZXN1bHQ+e1xuICAgICAgICAgICAgc3VjY2VzczogcmVxdWlyZWRUaHJlYWRzID09PSAwLFxuICAgICAgICAgICAgcmVtYWluaW5nVGhyZWFkczogcmVxdWlyZWRUaHJlYWRzLFxuICAgICAgICAgICAgcnVubmVyUHJvY2Vzc2VzOiBydW5uZXJQcm9jZXNzZXNcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBydW5TY3JpcHRPbkFsbEF2YWlsYWJsZVJ1bm5lcnMoXG4gICAgICAgIGtpbGxTY3JpcHRCZWZvcmVSdW5uaW5nID0gdHJ1ZSxcbiAgICAgICAgc2NyaXB0TmFtZTogc3RyaW5nLFxuICAgICAgICB0aHJlYWRPck9wdGlvbnM6IG51bWJlciB8IFJ1bk9wdGlvbnMsXG4gICAgICAgIC4uLnNjcmlwdEFyZ3M6IChzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuKVtdKTogUnVuU2NyaXB0UmVzdWx0IHtcbiAgICAgICAgLy8gRmluZCBydW5uZXJzXG4gICAgICAgIGNvbnN0IHJ1bm5lcnMgPSB0aGlzLnNjYW5CRlMoXCJob21lXCIpXG4gICAgICAgICAgICAuZmlsdGVyKGhvc3QgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm5zLmdldFNlcnZlck1heFJhbShob3N0Lmhvc3RuYW1lKSA+IDAgJiYgdGhpcy5ucy5oYXNSb290QWNjZXNzKGhvc3QuaG9zdG5hbWUpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubnMuZ2V0U2VydmVyTWF4UmFtKGIuaG9zdG5hbWUpIC0gdGhpcy5ucy5nZXRTZXJ2ZXJNYXhSYW0oYS5ob3N0bmFtZSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm1hcDxzdHJpbmc+KGhvc3QgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBob3N0Lmhvc3RuYW1lO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0aGlzLnJ1blNjcmlwdE9uUnVubmVycyhcbiAgICAgICAgICAgIHJ1bm5lcnMsXG4gICAgICAgICAgICBraWxsU2NyaXB0QmVmb3JlUnVubmluZyxcbiAgICAgICAgICAgIHNjcmlwdE5hbWUsXG4gICAgICAgICAgICB0aHJlYWRPck9wdGlvbnMsXG4gICAgICAgICAgICAuLi5zY3JpcHRBcmdzXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXCJQcml2YXRlIHJ1bm5lcnNcIiBtZWFucyBhbGwgcHVyY2hhc2VkIHNlcnZlciBhbmQgaG9tZSBzZXJ2ZXIgKGlmIGFsbG93SG9tZVNlcnZlciBzZXQgdG8gdHJ1ZSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcmV2ZXJzZVJ1bm5lckxpc3QgSWYgcmV2ZXJzZSwgd2Ugb25seSByZXZlcnNlIGxpc3Qgb2YgcHVyY2hhc2VkIHNlcnZlcnMuIEhvbWUgc2VydmVyIChpZiB1c2VkKSB3aWxsIGFsd2F5cyBiZVxuICAgICAqIGF0IHRoZSBsYXN0IG9mIHJ1bm5lciBsaXN0XG4gICAgICogQHBhcmFtIGFsbG93SG9tZVNlcnZlclxuICAgICAqIEBwYXJhbSBraWxsU2NyaXB0QmVmb3JlUnVubmluZ1xuICAgICAqIEBwYXJhbSBzY3JpcHROYW1lXG4gICAgICogQHBhcmFtIHRocmVhZE9yT3B0aW9uc1xuICAgICAqIEBwYXJhbSBzY3JpcHRBcmdzXG4gICAgICovXG4gICAgcnVuU2NyaXB0T25BdmFpbGFibGVQcml2YXRlUnVubmVycyhcbiAgICAgICAgcmV2ZXJzZVJ1bm5lckxpc3QgPSBmYWxzZSxcbiAgICAgICAgYWxsb3dIb21lU2VydmVyID0gdHJ1ZSxcbiAgICAgICAga2lsbFNjcmlwdEJlZm9yZVJ1bm5pbmcgPSB0cnVlLFxuICAgICAgICBzY3JpcHROYW1lOiBzdHJpbmcsXG4gICAgICAgIHRocmVhZE9yT3B0aW9uczogbnVtYmVyIHwgUnVuT3B0aW9ucyxcbiAgICAgICAgLi4uc2NyaXB0QXJnczogKHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4pW10pOiBSdW5TY3JpcHRSZXN1bHQge1xuICAgICAgICBjb25zdCBydW5uZXJzID0gdGhpcy5ucy5nZXRQdXJjaGFzZWRTZXJ2ZXJzKCk7XG4gICAgICAgIGlmIChyZXZlcnNlUnVubmVyTGlzdCkge1xuICAgICAgICAgICAgcnVubmVycy5yZXZlcnNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFsbG93SG9tZVNlcnZlcikge1xuICAgICAgICAgICAgcnVubmVycy5wdXNoKFwiaG9tZVwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5ydW5TY3JpcHRPblJ1bm5lcnMoXG4gICAgICAgICAgICBydW5uZXJzLFxuICAgICAgICAgICAga2lsbFNjcmlwdEJlZm9yZVJ1bm5pbmcsXG4gICAgICAgICAgICBzY3JpcHROYW1lLFxuICAgICAgICAgICAgdGhyZWFkT3JPcHRpb25zLFxuICAgICAgICAgICAgLi4uc2NyaXB0QXJnc1xuICAgICAgICApO1xuICAgIH1cblxuICAgIGNoZWNrUnVubmluZ1Byb2Nlc3NlcyhcbiAgICAgICAgbG9nRmlsZW5hbWU6IHN0cmluZyk6XG4gICAgICAgIHtcbiAgICAgICAgICAgIHN0aWxsSGF2ZVJ1bm5pbmdQcm9jZXNzOiBib29sZWFuLFxuICAgICAgICAgICAgcnVubmluZ1Byb2Nlc3NlczogUnVubmVyUHJvY2Vzc1tdXG4gICAgICAgIH0ge1xuICAgICAgICBsZXQgcnVubmVyUHJvY2Vzc2VzSW5mb0Zyb21Mb2c6IFJ1bm5lclByb2Nlc3NbXSA9IFtdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbG9nRGF0YSA9IHRoaXMubnMucmVhZChsb2dGaWxlbmFtZSk7XG4gICAgICAgICAgICBpZiAobG9nRGF0YSAhPT0gXCJcIikge1xuICAgICAgICAgICAgICAgIHJ1bm5lclByb2Nlc3Nlc0luZm9Gcm9tTG9nID0gSlNPTi5wYXJzZSh0aGlzLm5zLnJlYWQobG9nRmlsZW5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RpbGxIYXZlUnVubmluZ1Byb2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBydW5uaW5nUHJvY2Vzc2VzOiBbXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICB0aGlzLm5zLnRwcmludChleCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcnVubmVyUHJvY2Vzc2VzID0gcnVubmVyUHJvY2Vzc2VzSW5mb0Zyb21Mb2cuZmlsdGVyKHJ1bm5lclByb2Nlc3MgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubnMuaXNSdW5uaW5nKHJ1bm5lclByb2Nlc3MucGlkKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMubnMud3JpdGUobG9nRmlsZW5hbWUsIEpTT04uc3RyaW5naWZ5KHJ1bm5lclByb2Nlc3NlcyksIFwid1wiKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0aWxsSGF2ZVJ1bm5pbmdQcm9jZXNzOiBydW5uZXJQcm9jZXNzZXMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgIHJ1bm5pbmdQcm9jZXNzZXM6IHJ1bm5lclByb2Nlc3Nlc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaW50U2hhcmVSQU1FZmZlY3QobWluVGhyZWFkczogbnVtYmVyLCBtYXhUaHJlYWRzOiBudW1iZXIsIHN0ZXA6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCB0aHJlYWRzID0gbWluVGhyZWFkczsgdGhyZWFkcyA8PSBtYXhUaHJlYWRzOyB0aHJlYWRzICs9IHN0ZXApIHtcbiAgICAgICAgICAgIGNvbnN0IHJhbVBlclRocmVhZCA9IHRoaXMubnMuZ2V0U2NyaXB0UmFtKFNIQVJFX1NDUklQVF9OQU1FLCBcImhvbWVcIik7XG4gICAgICAgICAgICBjb25zdCBlZmZlY3QgPSAxICsgKE1hdGgubG9nKDEgKyB0aHJlYWRzKSAvIDI1KTtcbiAgICAgICAgICAgIHRoaXMubnMudHByaW50KFxuICAgICAgICAgICAgICAgIGBUaHJlYWRzOiAke3RocmVhZHN9Oi4gUkFNOiAke3RoaXMubnMuZm9ybWF0UmFtKHJhbVBlclRocmVhZCAqIHRocmVhZHMpfWBcbiAgICAgICAgICAgICAgICArIGAuIEVmZmVjdDogJHsoZWZmZWN0KS50b0ZpeGVkKDQpfWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRQcml2YXRlU2VydmVyc0Nvc3QoKTogbnVtYmVyIHtcbiAgICAgICAgbGV0IGNvc3QgPSAwO1xuICAgICAgICB0aGlzLm5zLmdldFB1cmNoYXNlZFNlcnZlcnMoKS5mb3JFYWNoKGhvc3RuYW1lID0+IHtcbiAgICAgICAgICAgIGNvc3QgKz0gdGhpcy5ucy5nZXRQdXJjaGFzZWRTZXJ2ZXJDb3N0KHRoaXMubnMuZ2V0U2VydmVyTWF4UmFtKGhvc3RuYW1lKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY29zdDtcbiAgICB9XG5cbiAgICBnZXRNb25leVBlclNlY29uZEhXR1coaG9zdG5hbWU6IHN0cmluZykge1xuICAgICAgICBjb25zdCBoYWNrTW9uZXlSYXRpbyA9IDAuOTk7XG5cbiAgICAgICAgLy8gaW5jcmVhc2VkU2VjdXJpdHlGb3IxVGhyZWFkSGFja2luZyBpcyBzYW1lIGZvciBhbGwgc2VydmVyc1xuICAgICAgICBjb25zdCBpbmNyZWFzZWRTZWN1cml0eUZvcjFUaHJlYWRIYWNraW5nID0gMC4wMDI7XG4gICAgICAgIC8vIGluY3JlYXNlZFNlY3VyaXR5Rm9yMVRocmVhZEdyb3dpbmcgaXMgc2FtZSBmb3IgYWxsIHNlcnZlcnMsIGl0J3MgMCBpZiBzZXJ2ZXIgcmVhY2hlcyBtYXggbW9uZXlcbiAgICAgICAgY29uc3QgaW5jcmVhc2VkU2VjdXJpdHlGb3IxVGhyZWFkR3Jvd2luZyA9IDAuMDA0O1xuXG4gICAgICAgIGNvbnN0IHNlcnZlciA9IHRoaXMubnMuZ2V0U2VydmVyKGhvc3RuYW1lKTtcbiAgICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5ucy5nZXRQbGF5ZXIoKTtcblxuICAgICAgICAvLyBGbG93OlxuICAgICAgICAvLyAtIFN0ZXAgMDogSGFjayAocHJldmlvdXMgY3ljbGUpOiBvY2N1cnMgYXQgbWF4IG1vbmV5IGFuZCBtaW4gc2VjdXJpdHlcbiAgICAgICAgLy8gLSBTdGVwIDE6IFdlYWtlbjogbmVlZCB0byBmaW5kIHNlcnZlcidzIHNlY3VyaXR5IGFmdGVyIHByZXZpb3VzIFwiSGFja1wiIGJlZm9yZSBjYWxsaW5nIG5zLmZvcm11bGFzLmhhY2tpbmcud2Vha2VuVGltZSgpXG4gICAgICAgIC8vIC0gU3RlcCAyOiBHcm93XG4gICAgICAgIC8vIC0gU3RlcCAzOiBXZWFrZW5cbiAgICAgICAgLy8gLSBTdGVwIDQ6IEhhY2s6IG9jY3VycyBhdCBtYXggbW9uZXkgYW5kIG1pbiBzZWN1cml0eVxuICAgICAgICBsZXQgd2Vha2VuVGltZTEgPSAwO1xuICAgICAgICBsZXQgZ3Jvd1RpbWUgPSAwO1xuICAgICAgICBsZXQgd2Vha2VuVGltZTIgPSAwO1xuICAgICAgICBsZXQgaGFja1RpbWUgPSAwO1xuXG4gICAgICAgIC8vIFN0ZXAgMDogSGFja1xuICAgICAgICBzZXJ2ZXIuaGFja0RpZmZpY3VsdHkgPSBzZXJ2ZXIubWluRGlmZmljdWx0eTtcbiAgICAgICAgc2VydmVyLm1vbmV5QXZhaWxhYmxlID0gc2VydmVyLm1vbmV5TWF4O1xuICAgICAgICBjb25zdCBoYWNrUmVxdWlyZWRUaHJlYWRzID0gaGFja01vbmV5UmF0aW8gLyB0aGlzLm5zLmZvcm11bGFzLmhhY2tpbmcuaGFja1BlcmNlbnQoc2VydmVyLCBwbGF5ZXIpO1xuICAgICAgICBsZXQgaW5jcmVhc2VkU2VjdXJpdHkgPSBpbmNyZWFzZWRTZWN1cml0eUZvcjFUaHJlYWRIYWNraW5nICogaGFja1JlcXVpcmVkVGhyZWFkcztcblxuICAgICAgICAvLyBTdGVwIDE6IFdlYWtlblxuICAgICAgICBzZXJ2ZXIuaGFja0RpZmZpY3VsdHkgPSBzZXJ2ZXIubWluRGlmZmljdWx0eSEgKyBpbmNyZWFzZWRTZWN1cml0eTtcbiAgICAgICAgLy8gTW9uZXkgaGFzIGJlZW4gcmVkdWNlZCBhZnRlciBzdGVwIDBcbiAgICAgICAgc2VydmVyLm1vbmV5QXZhaWxhYmxlID0gc2VydmVyLm1vbmV5TWF4ISAqICgxIC0gaGFja01vbmV5UmF0aW8pO1xuICAgICAgICB3ZWFrZW5UaW1lMSA9IHRoaXMubnMuZm9ybXVsYXMuaGFja2luZy53ZWFrZW5UaW1lKHNlcnZlciwgcGxheWVyKTtcblxuICAgICAgICAvLyBTdGVwIDI6IEdyb3dcbiAgICAgICAgc2VydmVyLmhhY2tEaWZmaWN1bHR5ID0gc2VydmVyLm1pbkRpZmZpY3VsdHk7XG4gICAgICAgIGdyb3dUaW1lID0gdGhpcy5ucy5mb3JtdWxhcy5oYWNraW5nLmdyb3dUaW1lKHNlcnZlciwgcGxheWVyKTtcbiAgICAgICAgY29uc3QgZ3Jvd1JlcXVpcmVkVGhyZWFkcyA9IHRoaXMubnMuZm9ybXVsYXMuaGFja2luZy5ncm93VGhyZWFkcyhzZXJ2ZXIsIHBsYXllciwgc2VydmVyLm1vbmV5TWF4ISk7XG4gICAgICAgIGluY3JlYXNlZFNlY3VyaXR5ID0gaW5jcmVhc2VkU2VjdXJpdHlGb3IxVGhyZWFkR3Jvd2luZyAqIGdyb3dSZXF1aXJlZFRocmVhZHM7XG5cbiAgICAgICAgLy8gU3RlcCAzOiBXZWFrZW5cbiAgICAgICAgc2VydmVyLmhhY2tEaWZmaWN1bHR5ID0gc2VydmVyLm1pbkRpZmZpY3VsdHkhICsgaW5jcmVhc2VkU2VjdXJpdHk7XG4gICAgICAgIHNlcnZlci5tb25leUF2YWlsYWJsZSA9IHNlcnZlci5tb25leU1heDtcbiAgICAgICAgd2Vha2VuVGltZTIgPSB0aGlzLm5zLmZvcm11bGFzLmhhY2tpbmcud2Vha2VuVGltZShzZXJ2ZXIsIHBsYXllcik7XG5cbiAgICAgICAgLy8gU3RlcCA0OiBIYWNrXG4gICAgICAgIHNlcnZlci5oYWNrRGlmZmljdWx0eSA9IHNlcnZlci5taW5EaWZmaWN1bHR5O1xuICAgICAgICBoYWNrVGltZSA9IHRoaXMubnMuZm9ybXVsYXMuaGFja2luZy5oYWNrVGltZShzZXJ2ZXIsIHBsYXllcik7XG5cbiAgICAgICAgdGhpcy5ucy5wcmludChgJHtob3N0bmFtZX06IEhXR1cgdGltZTogJHt0aGlzLm5zLnRGb3JtYXQod2Vha2VuVGltZTEgKyBncm93VGltZSArIHdlYWtlblRpbWUyICsgaGFja1RpbWUpfWApO1xuXG4gICAgICAgIHJldHVybiAoc2VydmVyLm1vbmV5TWF4ISAqIGhhY2tNb25leVJhdGlvKSAvICh3ZWFrZW5UaW1lMSArIGdyb3dUaW1lICsgd2Vha2VuVGltZTIgKyBoYWNrVGltZSk7XG4gICAgfVxuXG4gICAgZ2V0TW9uZXlQZXJTZWNvbmRIR1coaG9zdG5hbWU6IHN0cmluZykge1xuICAgICAgICBjb25zdCBoYWNrTW9uZXlSYXRpbyA9IDAuOTk7XG5cbiAgICAgICAgLy8gaW5jcmVhc2VkU2VjdXJpdHlGb3IxVGhyZWFkSGFja2luZyBpcyBzYW1lIGZvciBhbGwgc2VydmVyc1xuICAgICAgICBjb25zdCBpbmNyZWFzZWRTZWN1cml0eUZvcjFUaHJlYWRIYWNraW5nID0gMC4wMDI7XG4gICAgICAgIC8vIGluY3JlYXNlZFNlY3VyaXR5Rm9yMVRocmVhZEdyb3dpbmcgaXMgc2FtZSBmb3IgYWxsIHNlcnZlcnMsIGl0J3MgMCBpZiBzZXJ2ZXIgcmVhY2hlcyBtYXggbW9uZXlcbiAgICAgICAgY29uc3QgaW5jcmVhc2VkU2VjdXJpdHlGb3IxVGhyZWFkR3Jvd2luZyA9IDAuMDA0O1xuXG4gICAgICAgIGNvbnN0IHNlcnZlciA9IHRoaXMubnMuZ2V0U2VydmVyKGhvc3RuYW1lKTtcbiAgICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5ucy5nZXRQbGF5ZXIoKTtcblxuICAgICAgICAvLyBGbG93OlxuICAgICAgICAvLyAtIFN0ZXAgMDogSGFjayAocHJldmlvdXMgY3ljbGUpOiBvY2N1cnMgYXQgbWF4IG1vbmV5IGFuZCBtaW4gc2VjdXJpdHlcbiAgICAgICAgLy8gLSBTdGVwIDE6IEdyb3c6IG5lZWQgdG8gZmluZCBzZXJ2ZXIncyBzZWN1cml0eSBhZnRlciBwcmV2aW91cyBcIkhhY2tcIiBiZWZvcmUgY2FsbGluZyBucy5mb3JtdWxhcy5oYWNraW5nLmdyb3dUaW1lXG4gICAgICAgIC8vIC0gU3RlcCAyOiBXZWFrZW5cbiAgICAgICAgLy8gLSBTdGVwIDM6IEhhY2s6IG9jY3VycyBhdCBtYXggbW9uZXkgYW5kIG1pbiBzZWN1cml0eVxuICAgICAgICAvLyBsZXQgd2Vha2VuVGltZTEgPSAwO1xuICAgICAgICBsZXQgZ3Jvd1RpbWUgPSAwO1xuICAgICAgICBsZXQgd2Vha2VuVGltZSA9IDA7XG4gICAgICAgIGxldCBoYWNrVGltZSA9IDA7XG5cbiAgICAgICAgLy8gU3RlcCAwOiBIYWNrXG4gICAgICAgIHNlcnZlci5oYWNrRGlmZmljdWx0eSA9IHNlcnZlci5taW5EaWZmaWN1bHR5O1xuICAgICAgICBzZXJ2ZXIubW9uZXlBdmFpbGFibGUgPSBzZXJ2ZXIubW9uZXlNYXg7XG4gICAgICAgIGNvbnN0IGhhY2tSZXF1aXJlZFRocmVhZHMgPSBoYWNrTW9uZXlSYXRpbyAvIHRoaXMubnMuZm9ybXVsYXMuaGFja2luZy5oYWNrUGVyY2VudChzZXJ2ZXIsIHBsYXllcik7XG4gICAgICAgIGxldCBpbmNyZWFzZWRTZWN1cml0eSA9IGluY3JlYXNlZFNlY3VyaXR5Rm9yMVRocmVhZEhhY2tpbmcgKiBoYWNrUmVxdWlyZWRUaHJlYWRzO1xuICAgICAgICB0aGlzLm5zLnByaW50KGAke2hvc3RuYW1lfTogSEdXIGluY3JlYXNlZFNlY3VyaXR5OiAke2luY3JlYXNlZFNlY3VyaXR5fWApO1xuXG4gICAgICAgIC8vIFN0ZXAgMTogR3Jvd1xuICAgICAgICBzZXJ2ZXIuaGFja0RpZmZpY3VsdHkgPSBzZXJ2ZXIubWluRGlmZmljdWx0eSEgKyBpbmNyZWFzZWRTZWN1cml0eTtcbiAgICAgICAgLy8gTW9uZXkgaGFzIGJlZW4gcmVkdWNlZCBhZnRlciBzdGVwIDBcbiAgICAgICAgc2VydmVyLm1vbmV5QXZhaWxhYmxlID0gc2VydmVyLm1vbmV5TWF4ISAqICgxIC0gaGFja01vbmV5UmF0aW8pO1xuICAgICAgICBncm93VGltZSA9IHRoaXMubnMuZm9ybXVsYXMuaGFja2luZy5ncm93VGltZShzZXJ2ZXIsIHBsYXllcik7XG4gICAgICAgIGNvbnN0IGdyb3dSZXF1aXJlZFRocmVhZHMgPSB0aGlzLm5zLmZvcm11bGFzLmhhY2tpbmcuZ3Jvd1RocmVhZHMoc2VydmVyLCBwbGF5ZXIsIHNlcnZlci5tb25leU1heCEpO1xuICAgICAgICBpbmNyZWFzZWRTZWN1cml0eSA9IGluY3JlYXNlZFNlY3VyaXR5Rm9yMVRocmVhZEdyb3dpbmcgKiBncm93UmVxdWlyZWRUaHJlYWRzO1xuXG4gICAgICAgIC8vIFN0ZXAgMjogV2Vha2VuXG4gICAgICAgIHNlcnZlci5oYWNrRGlmZmljdWx0eSA9IHNlcnZlci5taW5EaWZmaWN1bHR5ISArIGluY3JlYXNlZFNlY3VyaXR5O1xuICAgICAgICBzZXJ2ZXIubW9uZXlBdmFpbGFibGUgPSBzZXJ2ZXIubW9uZXlNYXg7XG4gICAgICAgIHdlYWtlblRpbWUgPSB0aGlzLm5zLmZvcm11bGFzLmhhY2tpbmcud2Vha2VuVGltZShzZXJ2ZXIsIHBsYXllcik7XG5cbiAgICAgICAgLy8gU3RlcCAzOiBIYWNrXG4gICAgICAgIHNlcnZlci5oYWNrRGlmZmljdWx0eSA9IHNlcnZlci5taW5EaWZmaWN1bHR5O1xuICAgICAgICBoYWNrVGltZSA9IHRoaXMubnMuZm9ybXVsYXMuaGFja2luZy5oYWNrVGltZShzZXJ2ZXIsIHBsYXllcik7XG5cbiAgICAgICAgdGhpcy5ucy5wcmludChgJHtob3N0bmFtZX06IEhHVyB0aW1lOiAke3RoaXMubnMudEZvcm1hdChncm93VGltZSArIHdlYWtlblRpbWUgKyBoYWNrVGltZSl9YCk7XG5cbiAgICAgICAgcmV0dXJuIChzZXJ2ZXIubW9uZXlNYXghICogaGFja01vbmV5UmF0aW8pIC8gKGdyb3dUaW1lICsgd2Vha2VuVGltZSArIGhhY2tUaW1lKTtcbiAgICB9XG5cbiAgICBraWxsUHJvY2Vzc2VzU3Bhd25Gcm9tU2FtZVNjcmlwdCgpIHtcbiAgICAgICAgY29uc3QgY3VycmVudFNjcmlwdE5hbWUgPSB0aGlzLm5zLmdldFNjcmlwdE5hbWUoKTtcbiAgICAgICAgdGhpcy5ucy5wcygpLmZvckVhY2gocHJvY2VzcyA9PiB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5maWxlbmFtZSAhPT0gY3VycmVudFNjcmlwdE5hbWUgfHwgcHJvY2Vzcy5waWQgPT09IHRoaXMubnMucGlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ucy5raWxsKHByb2Nlc3MucGlkKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlU3RvY2tTdGF0cygpOiB7XG4gICAgICAgIGN1cnJlbnRQcm9maXQ6IG51bWJlcixcbiAgICAgICAgZXN0aW1hdGVkVG90YWxQcm9maXQ6IG51bWJlcixcbiAgICAgICAgY3VycmVudFdvcnRoOiBudW1iZXJcbiAgICB9IHtcbiAgICAgICAgbGV0IGN1cnJlbnRQcm9maXQgPSAwO1xuICAgICAgICBsZXQgY3VycmVudFdvcnRoID0gMDtcbiAgICAgICAgdGhpcy5ucy5zdG9jay5nZXRTeW1ib2xzKCkuZm9yRWFjaChzdG9ja1N5bWJvbCA9PiB7XG4gICAgICAgICAgICBjb25zdCBwb3NpdGlvbiA9IHRoaXMubnMuc3RvY2suZ2V0UG9zaXRpb24oc3RvY2tTeW1ib2wpO1xuICAgICAgICAgICAgY29uc3Qgc2hhcmVzTG9uZyA9IHBvc2l0aW9uWzBdO1xuICAgICAgICAgICAgY29uc3QgYXZnTG9uZ1ByaWNlID0gcG9zaXRpb25bMV07XG4gICAgICAgICAgICBjb25zdCBzaGFyZXNTaG9ydCA9IHBvc2l0aW9uWzJdO1xuICAgICAgICAgICAgY29uc3QgYXZnU2hvcnRQcmljZSA9IHBvc2l0aW9uWzNdO1xuICAgICAgICAgICAgaWYgKHNoYXJlc0xvbmcgPT09IDAgJiYgc2hhcmVzU2hvcnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2hhcmVzTG9uZyA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsb25nU2hhcmVzUHJvZml0ID0gc2hhcmVzTG9uZyAqICh0aGlzLm5zLnN0b2NrLmdldEJpZFByaWNlKHN0b2NrU3ltYm9sKSAtIGF2Z0xvbmdQcmljZSkgLSAoMiAqIFNUT0NLX01BUktFVF9DT01NSVNTSU9OX0ZFRSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9uZ1NoYXJlc1dvcnRoID0gdGhpcy5ucy5zdG9jay5nZXRTYWxlR2FpbihzdG9ja1N5bWJvbCwgc2hhcmVzTG9uZywgXCJMb25nXCIpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRQcm9maXQgKz0gbG9uZ1NoYXJlc1Byb2ZpdDtcbiAgICAgICAgICAgICAgICBjdXJyZW50V29ydGggKz0gbG9uZ1NoYXJlc1dvcnRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNoYXJlc1Nob3J0ID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNob3J0U2hhcmVzUHJvZml0ID0gc2hhcmVzU2hvcnQgKiAoYXZnU2hvcnRQcmljZSAtIHRoaXMubnMuc3RvY2suZ2V0QXNrUHJpY2Uoc3RvY2tTeW1ib2wpKSAtICgyICogU1RPQ0tfTUFSS0VUX0NPTU1JU1NJT05fRkVFKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaG9ydFNoYXJlc1dvcnRoID0gdGhpcy5ucy5zdG9jay5nZXRTYWxlR2FpbihzdG9ja1N5bWJvbCwgc2hhcmVzU2hvcnQsIFwiU2hvcnRcIik7XG4gICAgICAgICAgICAgICAgY3VycmVudFByb2ZpdCArPSBzaG9ydFNoYXJlc1Byb2ZpdDtcbiAgICAgICAgICAgICAgICBjdXJyZW50V29ydGggKz0gc2hvcnRTaGFyZXNXb3J0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIC8vIFdlIGlnbm9yZTpcbiAgICAgICAgLy8gLSBBbGwgb3RoZXIgaW5jb21lc1xuICAgICAgICAvLyAtIEFsbCBleHBlbnNlcyBleGNlcHQgcHJpdmF0ZSBzZXJ2ZXJzJyBjb3N0XG4gICAgICAgIC8vIEZvcm11bGE6IGN1cnJlbnRNb25leSArIGN1cnJlbnRXb3J0aCA9IGhhY2tpbmdQcm9maXQgKyBzdG9ja1RyYWRpbmdQcm9maXQgLSBleHBlbnNlc1xuICAgICAgICBjb25zdCBwcml2YXRlU2VydmVyc0Nvc3QgPSB0aGlzLmdldFByaXZhdGVTZXJ2ZXJzQ29zdCgpO1xuICAgICAgICBjb25zdCBlc3RpbWF0ZWRUb3RhbFByb2ZpdCA9IHRoaXMubnMuZ2V0UGxheWVyKCkubW9uZXkgKyBjdXJyZW50V29ydGggLSB0aGlzLm5zLmdldE1vbmV5U291cmNlcygpLnNpbmNlSW5zdGFsbC5oYWNraW5nXG4gICAgICAgICAgICArIHByaXZhdGVTZXJ2ZXJzQ29zdDtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGN1cnJlbnRQcm9maXQ6IGN1cnJlbnRQcm9maXQsXG4gICAgICAgICAgICBlc3RpbWF0ZWRUb3RhbFByb2ZpdDogZXN0aW1hdGVkVG90YWxQcm9maXQsXG4gICAgICAgICAgICBjdXJyZW50V29ydGg6IGN1cnJlbnRXb3J0aCxcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUF1dG9Db21wbGV0ZURhdGFGcm9tRGVmYXVsdENvbmZpZyhkYXRhOiBBdXRvY29tcGxldGVEYXRhLCBkZWZhdWx0Q29uZmlnOiBOZXRzY3JpcHRGbGFnc1NjaGVtYSkge1xuICAgIGRhdGEuZmxhZ3MoZGVmYXVsdENvbmZpZyk7XG4gICAgcmV0dXJuIFtcInRydWVcIiwgXCJmYWxzZVwiXTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJB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
