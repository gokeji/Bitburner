import { assertIsString } from "./libs/utils";
import { GROW_SCRIPT_NAME, HACK_SCRIPT_NAME, LOG_FOLDER, WEAKEN_SCRIPT_NAME } from "./libs/constants";
import { CompletedProgramName } from "./libs/Enums";
import { parseNumber } from "./libs/utils";
import { NetscriptExtension } from "./libs/NetscriptExtension";
function autocomplete(data, flags) {
    return [...data.servers];
}
var Action = /* @__PURE__ */ ((Action2) => {
    Action2["UNKNOWN"] = "UNKNOWN";
    Action2["SKIP"] = "SKIP";
    Action2["WEAKEN"] = "WEAKEN";
    Action2["GROW"] = "GROW";
    Action2["HACK"] = "HACK";
    return Action2;
})(Action || {});
const defaultConfig = {
    hackingSkillMultiplierWhenChoosingTarget: 0.3,
    hackMoneyRatio: 0.5,
    blacklistServers: /* @__PURE__ */ new Set(["n00dles", "foodnstuff", "fulcrumassets"]),
    forceKillAllScripts: true,
    influenceStock: false,
};
let customConfig = null;
customConfig = {
    // hackingSkillMultiplierWhenChoosingTarget: 0.5,
    hackingSkillMultiplierWhenChoosingTarget: 1,
    // hackMoneyRatio: .6,
    hackMoneyRatio: 0.99,
    blacklistServers: /* @__PURE__ */ new Set([
        "n00dles",
        "foodnstuff",
        "joesguns",
        // Use this for simple exp-farming script
        "fulcrumassets",
    ]),
    forceKillAllScripts: defaultConfig.forceKillAllScripts,
    influenceStock: false,
    // influenceStock: true,
};
function isInfluenceStock(config, action) {
    if (!config.influenceStock) {
        return false;
    }
    return action === "GROW" /* GROW */;
}
function printLog(ns, targets) {
    const hostnameMaxLength = 18;
    const actionMaxLength = 10;
    const threadMaxLength = 7;
    const timeMaxLength = 25;
    const hackMoneyMaxLength = 10;
    const latestPidMaxLength = 10;
    ns.print(
        `${"Hostname".padEnd(hostnameMaxLength)}${"Action".padStart(actionMaxLength)}${"Thread".padStart(threadMaxLength)}${"HackMoney".padStart(hackMoneyMaxLength)}${"Time".padStart(timeMaxLength)}${"LatestPid".padStart(latestPidMaxLength)}`,
    );
    targets
        .filter((target) => {
            return !target.skip;
        })
        .forEach((target) => {
            let remainingTime = target.currentActionCompleteAt - Date.now();
            if (remainingTime < 0) {
                remainingTime = 0;
            }
            ns.print(
                `${target.hostname.padEnd(hostnameMaxLength)}${target.currentAction.padStart(actionMaxLength)}${target.currentThreads.toString().padStart(threadMaxLength)}${(target.hackMoney > 0 ? ns.formatNumber(target.hackMoney) : "").padStart(hackMoneyMaxLength)}${ns.tFormat(remainingTime).padStart(timeMaxLength)}${target.currentActionLatestPid !== 0 ? target.currentActionLatestPid.toString().padStart(latestPidMaxLength) : ""}`,
            );
        });
}
function checkRunningProcessesAndUpdateTargetInfo(ns, logFilename, target) {
    const resultOfCheckRunningProcesses = nsx.checkRunningProcesses(logFilename);
    if (resultOfCheckRunningProcesses.stillHaveRunningProcess) {
        const latestProcess =
            resultOfCheckRunningProcesses.runningProcesses[resultOfCheckRunningProcesses.runningProcesses.length - 1];
        const loggingParams = latestProcess.scriptArgs[3].toString().split("|");
        target.currentAction = loggingParams[1];
        target.currentThreads = parseNumber(loggingParams[2]);
        target.currentActionCompleteAt = parseNumber(loggingParams[3]);
        target.currentActionLatestPid = latestProcess.pid;
        if (loggingParams[4] !== "") {
            target.hackMoney = parseNumber(loggingParams[4]);
        }
    } else {
        target.currentActionLatestPid = 0;
    }
    return resultOfCheckRunningProcesses.stillHaveRunningProcess;
}
let nsx;
async function main(ns) {
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    const config = customConfig !== null ? customConfig : defaultConfig;
    ns.disableLog("ALL");
    ns.tail();
    ns.resizeTail(800, 300);
    const securityReducedPerWeakenThead = ns.weakenAnalyze(1);
    const allHosts = nsx.scanBFS("home", function (host) {
        const hostname = host.hostname;
        if (config.forceKillAllScripts) {
            ns.scriptKill(WEAKEN_SCRIPT_NAME, hostname);
            ns.scriptKill(GROW_SCRIPT_NAME, hostname);
            ns.scriptKill(HACK_SCRIPT_NAME, hostname);
        }
        if (hostname === "home") {
            return;
        }
        ns.scp([HACK_SCRIPT_NAME, GROW_SCRIPT_NAME, WEAKEN_SCRIPT_NAME], host.hostname, "home");
    });
    let targets = allHosts
        .filter((host) => {
            return ns.getServerMaxMoney(host.hostname) > 0 && !config.blacklistServers.has(host.hostname);
        })
        .sort((a, b) => {
            return ns.getServerRequiredHackingLevel(b.hostname) - ns.getServerRequiredHackingLevel(a.hostname);
        })
        .map((host) => {
            return {
                hostname: host.hostname,
                requiredHackingSkill: ns.getServerRequiredHackingLevel(host.hostname),
                maxMoney: ns.getServerMaxMoney(host.hostname),
                maxSecurity: ns.getServerBaseSecurityLevel(host.hostname),
                minSecurity: ns.getServerMinSecurityLevel(host.hostname),
                skip: false,
                currentAction: "UNKNOWN" /* UNKNOWN */,
                currentActionCompleteAt: 0,
                currentThreads: 0,
                currentActionLatestPid: 0,
                previousAction: "UNKNOWN" /* UNKNOWN */,
                hackMoney: 0,
                totalWeakenTime: 0,
                totalGrowTime: 0,
                totalHackTime: 0,
                totalHackMoney: 0,
            };
        });
    if (ns.args.length > 0) {
        ns.tprint(`Force using targets: ${ns.args}`);
        targets = [];
        ns.args.forEach((hostname) => {
            assertIsString(hostname);
            targets.push({
                hostname,
                requiredHackingSkill: ns.getServerRequiredHackingLevel(hostname),
                maxMoney: ns.getServerMaxMoney(hostname),
                maxSecurity: ns.getServerBaseSecurityLevel(hostname),
                minSecurity: ns.getServerMinSecurityLevel(hostname),
                skip: false,
                currentAction: "UNKNOWN" /* UNKNOWN */,
                currentActionCompleteAt: 0,
                currentThreads: 0,
                currentActionLatestPid: 0,
                previousAction: "UNKNOWN" /* UNKNOWN */,
                hackMoney: 0,
                totalWeakenTime: 0,
                totalGrowTime: 0,
                totalHackTime: 0,
                totalHackMoney: 0,
            });
        });
    }
    while (true) {
        if (ns.fileExists(CompletedProgramName.formulas, "home")) {
            const targetsMoneyPerSecond = /* @__PURE__ */ new Map();
            targets.forEach((target) => {
                targetsMoneyPerSecond.set(target.hostname, nsx.getMoneyPerSecondHGW(target.hostname));
            });
            targets.sort((a, b) => {
                return targetsMoneyPerSecond.get(b.hostname) - targetsMoneyPerSecond.get(a.hostname);
            });
        }
        for (const target of targets) {
            if (
                !ns.getServer(target.hostname).hasAdminRights ||
                ns.getHackingLevel() * config.hackingSkillMultiplierWhenChoosingTarget < target.requiredHackingSkill
            ) {
                target.skip = true;
                target.currentAction = "SKIP" /* SKIP */;
                continue;
            }
            target.skip = false;
            const identifierPrefix = `controller-${target.hostname}`;
            const logFilename = `${LOG_FOLDER}/${identifierPrefix}.txt`;
            if (checkRunningProcessesAndUpdateTargetInfo(ns, logFilename, target)) {
                continue;
            }
            const targetCurrentSecurity = ns.getServerSecurityLevel(target.hostname);
            let targetCurrentMoney = ns.getServerMoneyAvailable(target.hostname);
            if (targetCurrentMoney < 1e4) {
                targetCurrentMoney = 1e4;
            }
            let requiredThreads = 0;
            let action;
            let actionTime;
            let additionalLogInfo = "";
            const securityDiff = targetCurrentSecurity - target.minSecurity;
            if (
                securityDiff > 0.1 &&
                targetCurrentSecurity !== target.maxSecurity &&
                target.previousAction !== "HACK" /* HACK */
            ) {
                action = "WEAKEN" /* WEAKEN */;
                target.hackMoney = 0;
                requiredThreads = Math.ceil(securityDiff / securityReducedPerWeakenThead);
                const weakenTime = ns.getWeakenTime(target.hostname);
                actionTime = weakenTime;
                target.totalWeakenTime += weakenTime;
            } else if (targetCurrentMoney / target.maxMoney <= 0.99) {
                action = "GROW" /* GROW */;
                target.hackMoney = 0;
                requiredThreads = Math.ceil(ns.growthAnalyze(target.hostname, target.maxMoney / targetCurrentMoney));
                const growTime = ns.getGrowTime(target.hostname);
                actionTime = growTime;
                target.totalGrowTime += growTime;
            } else {
                action = "HACK" /* HACK */;
                let hackMoney = target.maxMoney * config.hackMoneyRatio;
                if (target.hostname !== "n00dles") {
                    if (hackMoney > 1e6) {
                        hackMoney -= 1e6;
                    }
                }
                additionalLogInfo = hackMoney.toString();
                target.hackMoney = hackMoney;
                requiredThreads = Math.floor(ns.hackAnalyzeThreads(target.hostname, hackMoney));
                const hackTime = ns.getHackTime(target.hostname);
                actionTime = hackTime;
                target.totalHackTime += hackTime;
                target.totalHackMoney += hackMoney;
            }
            if (requiredThreads <= 0) {
                ns.tprint(
                    `Detect invalid number of required threads. requiredThreads: ${requiredThreads}. Server: ${target.hostname}. Action: ${action} . Current money: ${ns.formatNumber(targetCurrentMoney)}`,
                );
                continue;
            }
            if (requiredThreads > 15e3) {
                ns.tprint(
                    `Detect massive number of required threads. requiredThreads: ${requiredThreads}. Server: ${target.hostname}. Action: ${action} . Current money: ${ns.formatNumber(targetCurrentMoney)}`,
                );
            }
            target.currentAction = action;
            target.previousAction = target.currentAction;
            target.currentThreads = requiredThreads;
            let scriptName;
            switch (action) {
                case "WEAKEN" /* WEAKEN */:
                    scriptName = WEAKEN_SCRIPT_NAME;
                    break;
                case "GROW" /* GROW */:
                    scriptName = GROW_SCRIPT_NAME;
                    break;
                case "HACK" /* HACK */:
                    scriptName = HACK_SCRIPT_NAME;
                    break;
            }
            const runnerProcesses = [];
            while (requiredThreads > 0) {
                target.currentActionCompleteAt = Math.ceil(Date.now() + actionTime);
                const result = nsx.runScriptOnAllAvailableRunners(
                    false,
                    scriptName,
                    {
                        threads: requiredThreads,
                        preventDuplicates: true,
                    },
                    target.hostname,
                    0,
                    // No delay
                    isInfluenceStock(config, action),
                    // Influence stock with grow action
                    `${identifierPrefix}|${action}|${requiredThreads}|${target.currentActionCompleteAt}|${additionalLogInfo}`,
                    // For logging
                );
                runnerProcesses.push(...result.runnerProcesses);
                ns.write(logFilename, JSON.stringify(runnerProcesses), "w");
                if (result.success) {
                    break;
                } else {
                    requiredThreads = result.remainingThreads;
                }
                checkRunningProcessesAndUpdateTargetInfo(ns, logFilename, target);
                ns.clearLog();
                printLog(ns, targets);
                await ns.sleep(1e3);
            }
        }
        ns.clearLog();
        printLog(ns, targets);
        await ns.sleep(1e3);
    }
}
export { autocomplete, main };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2hhY2tDb250cm9sbGVyMi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtBdXRvY29tcGxldGVEYXRhLCBOU30gZnJvbSBcIkBuc1wiO1xuaW1wb3J0IHthc3NlcnRJc1N0cmluZ30gZnJvbSBcIi9saWJzL3V0aWxzXCI7XG5pbXBvcnQge0dST1dfU0NSSVBUX05BTUUsIEhBQ0tfU0NSSVBUX05BTUUsIExPR19GT0xERVIsIFdFQUtFTl9TQ1JJUFRfTkFNRX0gZnJvbSBcIi9saWJzL2NvbnN0YW50c1wiO1xuaW1wb3J0IHtDb21wbGV0ZWRQcm9ncmFtTmFtZX0gZnJvbSBcIi9saWJzL0VudW1zXCI7XG5pbXBvcnQge3BhcnNlTnVtYmVyfSBmcm9tIFwiL2xpYnMvdXRpbHNcIjtcbmltcG9ydCB7TmV0c2NyaXB0RXh0ZW5zaW9uLCBSdW5uZXJQcm9jZXNzfSBmcm9tIFwiL2xpYnMvTmV0c2NyaXB0RXh0ZW5zaW9uXCI7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbmV4cG9ydCBmdW5jdGlvbiBhdXRvY29tcGxldGUoZGF0YTogQXV0b2NvbXBsZXRlRGF0YSwgZmxhZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBbLi4uZGF0YS5zZXJ2ZXJzXTtcbn1cblxuZW51bSBBY3Rpb24ge1xuICAgIFVOS05PV04gPSBcIlVOS05PV05cIixcbiAgICBTS0lQID0gXCJTS0lQXCIsXG4gICAgV0VBS0VOID0gXCJXRUFLRU5cIixcbiAgICBHUk9XID0gXCJHUk9XXCIsXG4gICAgSEFDSyA9IFwiSEFDS1wiXG59XG5cbmludGVyZmFjZSBUYXJnZXQge1xuICAgIHJlYWRvbmx5IGhvc3RuYW1lOiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgcmVxdWlyZWRIYWNraW5nU2tpbGw6IG51bWJlcjtcbiAgICByZWFkb25seSBtYXhNb25leTogbnVtYmVyO1xuICAgIHJlYWRvbmx5IG1heFNlY3VyaXR5OiBudW1iZXI7XG4gICAgcmVhZG9ubHkgbWluU2VjdXJpdHk6IG51bWJlcjtcbiAgICBza2lwOiBib29sZWFuO1xuICAgIGN1cnJlbnRBY3Rpb246IEFjdGlvbjtcbiAgICBjdXJyZW50QWN0aW9uQ29tcGxldGVBdDogbnVtYmVyO1xuICAgIGN1cnJlbnRUaHJlYWRzOiBudW1iZXI7XG4gICAgY3VycmVudEFjdGlvbkxhdGVzdFBpZDogbnVtYmVyO1xuICAgIHByZXZpb3VzQWN0aW9uOiBBY3Rpb247XG4gICAgaGFja01vbmV5OiBudW1iZXI7XG4gICAgdG90YWxXZWFrZW5UaW1lOiBudW1iZXI7XG4gICAgdG90YWxHcm93VGltZTogbnVtYmVyO1xuICAgIHRvdGFsSGFja1RpbWU6IG51bWJlcjtcbiAgICB0b3RhbEhhY2tNb25leTogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgQ29uZmlnIHtcbiAgICBoYWNraW5nU2tpbGxNdWx0aXBsaWVyV2hlbkNob29zaW5nVGFyZ2V0OiBudW1iZXI7XG4gICAgaGFja01vbmV5UmF0aW86IG51bWJlcjtcbiAgICBibGFja2xpc3RTZXJ2ZXJzOiBTZXQ8c3RyaW5nPjtcbiAgICBmb3JjZUtpbGxBbGxTY3JpcHRzOiBib29sZWFuO1xuICAgIGluZmx1ZW5jZVN0b2NrOiBib29sZWFuO1xufVxuXG5jb25zdCBkZWZhdWx0Q29uZmlnOiBDb25maWcgPSB7XG4gICAgaGFja2luZ1NraWxsTXVsdGlwbGllcldoZW5DaG9vc2luZ1RhcmdldDogMC4zLFxuICAgIGhhY2tNb25leVJhdGlvOiAwLjUsXG4gICAgYmxhY2tsaXN0U2VydmVyczogbmV3IFNldChbXG4gICAgICAgIFwibjAwZGxlc1wiLFxuICAgICAgICBcImZvb2Ruc3R1ZmZcIixcbiAgICAgICAgXCJmdWxjcnVtYXNzZXRzXCJcbiAgICBdKSxcbiAgICBmb3JjZUtpbGxBbGxTY3JpcHRzOiB0cnVlLFxuICAgIGluZmx1ZW5jZVN0b2NrOiBmYWxzZVxufTtcblxubGV0IGN1c3RvbUNvbmZpZzogQ29uZmlnIHwgbnVsbCA9IG51bGw7XG5jdXN0b21Db25maWcgPSA8Q29uZmlnPntcbiAgICAvLyBoYWNraW5nU2tpbGxNdWx0aXBsaWVyV2hlbkNob29zaW5nVGFyZ2V0OiAwLjUsXG4gICAgaGFja2luZ1NraWxsTXVsdGlwbGllcldoZW5DaG9vc2luZ1RhcmdldDogMSxcbiAgICAvLyBoYWNrTW9uZXlSYXRpbzogLjYsXG4gICAgaGFja01vbmV5UmF0aW86IC45OSxcbiAgICBibGFja2xpc3RTZXJ2ZXJzOiBuZXcgU2V0KFtcbiAgICAgICAgXCJuMDBkbGVzXCIsXG4gICAgICAgIFwiZm9vZG5zdHVmZlwiLFxuICAgICAgICBcImpvZXNndW5zXCIsIC8vIFVzZSB0aGlzIGZvciBzaW1wbGUgZXhwLWZhcm1pbmcgc2NyaXB0XG4gICAgICAgIFwiZnVsY3J1bWFzc2V0c1wiXG4gICAgXSksXG4gICAgZm9yY2VLaWxsQWxsU2NyaXB0czogZGVmYXVsdENvbmZpZy5mb3JjZUtpbGxBbGxTY3JpcHRzLFxuICAgIGluZmx1ZW5jZVN0b2NrOiBmYWxzZSxcbiAgICAvLyBpbmZsdWVuY2VTdG9jazogdHJ1ZSxcbn07XG5cbmZ1bmN0aW9uIGlzSW5mbHVlbmNlU3RvY2soY29uZmlnOiBDb25maWcsIGFjdGlvbjogQWN0aW9uKSB7XG4gICAgaWYgKCFjb25maWcuaW5mbHVlbmNlU3RvY2spIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gYWN0aW9uID09PSBBY3Rpb24uR1JPVztcbn1cblxuZnVuY3Rpb24gcHJpbnRMb2cobnM6IE5TLCB0YXJnZXRzOiBUYXJnZXRbXSkge1xuICAgIC8vIExvZ2dpbmdcbiAgICBjb25zdCBob3N0bmFtZU1heExlbmd0aCA9IDE4O1xuICAgIGNvbnN0IGFjdGlvbk1heExlbmd0aCA9IDEwO1xuICAgIGNvbnN0IHRocmVhZE1heExlbmd0aCA9IDc7XG4gICAgY29uc3QgdGltZU1heExlbmd0aCA9IDI1O1xuICAgIGNvbnN0IGhhY2tNb25leU1heExlbmd0aCA9IDEwO1xuICAgIGNvbnN0IGxhdGVzdFBpZE1heExlbmd0aCA9IDEwO1xuICAgIG5zLnByaW50KFxuICAgICAgICBgJHtcIkhvc3RuYW1lXCIucGFkRW5kKGhvc3RuYW1lTWF4TGVuZ3RoKX0ke1wiQWN0aW9uXCIucGFkU3RhcnQoYWN0aW9uTWF4TGVuZ3RoKX0ke1wiVGhyZWFkXCIucGFkU3RhcnQodGhyZWFkTWF4TGVuZ3RoKX1gICtcbiAgICAgICAgYCR7XCJIYWNrTW9uZXlcIi5wYWRTdGFydChoYWNrTW9uZXlNYXhMZW5ndGgpfSR7XCJUaW1lXCIucGFkU3RhcnQodGltZU1heExlbmd0aCl9JHtcIkxhdGVzdFBpZFwiLnBhZFN0YXJ0KGxhdGVzdFBpZE1heExlbmd0aCl9YFxuICAgICk7XG4gICAgdGFyZ2V0c1xuICAgICAgICAuZmlsdGVyKHRhcmdldCA9PiB7XG4gICAgICAgICAgICByZXR1cm4gIXRhcmdldC5za2lwO1xuICAgICAgICB9KVxuICAgICAgICAuZm9yRWFjaCh0YXJnZXQgPT4ge1xuICAgICAgICAgICAgbGV0IHJlbWFpbmluZ1RpbWUgPSB0YXJnZXQuY3VycmVudEFjdGlvbkNvbXBsZXRlQXQgLSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgaWYgKHJlbWFpbmluZ1RpbWUgPCAwKSB7XG4gICAgICAgICAgICAgICAgcmVtYWluaW5nVGltZSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBucy5wcmludChcbiAgICAgICAgICAgICAgICBgJHt0YXJnZXQuaG9zdG5hbWUucGFkRW5kKGhvc3RuYW1lTWF4TGVuZ3RoKX1gICtcbiAgICAgICAgICAgICAgICBgJHt0YXJnZXQuY3VycmVudEFjdGlvbi5wYWRTdGFydChhY3Rpb25NYXhMZW5ndGgpfWAgK1xuICAgICAgICAgICAgICAgIGAke3RhcmdldC5jdXJyZW50VGhyZWFkcy50b1N0cmluZygpLnBhZFN0YXJ0KHRocmVhZE1heExlbmd0aCl9YCArXG4gICAgICAgICAgICAgICAgYCR7KCh0YXJnZXQuaGFja01vbmV5ID4gMCkgPyBucy5mb3JtYXROdW1iZXIodGFyZ2V0LmhhY2tNb25leSkgOiBcIlwiKS5wYWRTdGFydChoYWNrTW9uZXlNYXhMZW5ndGgpfWAgK1xuICAgICAgICAgICAgICAgIGAke25zLnRGb3JtYXQocmVtYWluaW5nVGltZSkucGFkU3RhcnQodGltZU1heExlbmd0aCl9YCArXG4gICAgICAgICAgICAgICAgYCR7KHRhcmdldC5jdXJyZW50QWN0aW9uTGF0ZXN0UGlkICE9PSAwKSA/IHRhcmdldC5jdXJyZW50QWN0aW9uTGF0ZXN0UGlkLnRvU3RyaW5nKCkucGFkU3RhcnQobGF0ZXN0UGlkTWF4TGVuZ3RoKSA6IFwiXCJ9YFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSk7XG59XG5cbmZ1bmN0aW9uIGNoZWNrUnVubmluZ1Byb2Nlc3Nlc0FuZFVwZGF0ZVRhcmdldEluZm8obnM6IE5TLCBsb2dGaWxlbmFtZTogc3RyaW5nLCB0YXJnZXQ6IFRhcmdldCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHJlc3VsdE9mQ2hlY2tSdW5uaW5nUHJvY2Vzc2VzID0gbnN4LmNoZWNrUnVubmluZ1Byb2Nlc3Nlcyhsb2dGaWxlbmFtZSk7XG4gICAgaWYgKHJlc3VsdE9mQ2hlY2tSdW5uaW5nUHJvY2Vzc2VzLnN0aWxsSGF2ZVJ1bm5pbmdQcm9jZXNzKSB7XG4gICAgICAgIC8vIFVzZSBpbmZvIGZyb20gbGF0ZXN0IHBpZCB0aHJlYWQncyBhcmd1bWVudHNcbiAgICAgICAgY29uc3QgbGF0ZXN0UHJvY2VzcyA9IHJlc3VsdE9mQ2hlY2tSdW5uaW5nUHJvY2Vzc2VzXG4gICAgICAgICAgICAucnVubmluZ1Byb2Nlc3Nlc1tyZXN1bHRPZkNoZWNrUnVubmluZ1Byb2Nlc3Nlcy5ydW5uaW5nUHJvY2Vzc2VzLmxlbmd0aCAtIDFdO1xuICAgICAgICBjb25zdCBsb2dnaW5nUGFyYW1zID0gbGF0ZXN0UHJvY2Vzc1xuICAgICAgICAgICAgLnNjcmlwdEFyZ3NbM11cbiAgICAgICAgICAgIC50b1N0cmluZygpXG4gICAgICAgICAgICAuc3BsaXQoXCJ8XCIpO1xuICAgICAgICB0YXJnZXQuY3VycmVudEFjdGlvbiA9IGxvZ2dpbmdQYXJhbXNbMV0gYXMgQWN0aW9uO1xuICAgICAgICB0YXJnZXQuY3VycmVudFRocmVhZHMgPSBwYXJzZU51bWJlcihsb2dnaW5nUGFyYW1zWzJdKTtcbiAgICAgICAgdGFyZ2V0LmN1cnJlbnRBY3Rpb25Db21wbGV0ZUF0ID0gcGFyc2VOdW1iZXIobG9nZ2luZ1BhcmFtc1szXSk7XG4gICAgICAgIHRhcmdldC5jdXJyZW50QWN0aW9uTGF0ZXN0UGlkID0gbGF0ZXN0UHJvY2Vzcy5waWQ7XG4gICAgICAgIGlmIChsb2dnaW5nUGFyYW1zWzRdICE9PSBcIlwiKSB7XG4gICAgICAgICAgICB0YXJnZXQuaGFja01vbmV5ID0gcGFyc2VOdW1iZXIobG9nZ2luZ1BhcmFtc1s0XSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0YXJnZXQuY3VycmVudEFjdGlvbkxhdGVzdFBpZCA9IDA7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRPZkNoZWNrUnVubmluZ1Byb2Nlc3Nlcy5zdGlsbEhhdmVSdW5uaW5nUHJvY2Vzcztcbn1cblxubGV0IG5zeDogTmV0c2NyaXB0RXh0ZW5zaW9uO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihuczogTlMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBuc3ggPSBuZXcgTmV0c2NyaXB0RXh0ZW5zaW9uKG5zKTtcbiAgICBuc3gua2lsbFByb2Nlc3Nlc1NwYXduRnJvbVNhbWVTY3JpcHQoKTtcblxuICAgIGNvbnN0IGNvbmZpZyA9IChjdXN0b21Db25maWcgIT09IG51bGwpID8gY3VzdG9tQ29uZmlnIDogZGVmYXVsdENvbmZpZztcblxuICAgIG5zLmRpc2FibGVMb2coXCJBTExcIik7XG4gICAgbnMudGFpbCgpO1xuICAgIG5zLnJlc2l6ZVRhaWwoODAwLCAzMDApO1xuICAgIC8vIG5zLm1vdmVUYWlsKDE3NTAsIDYyNSk7XG5cbiAgICAvLyBBc3N1bWUgMSBjb3JlIGZvciBhbGwgc2VydmVycy4gVGhpcyBzY3JpcHQgZm9jdXNlcyBvbiBzaW1wbGljaXR5LCBzbyB3ZSBpZ25vcmUgdGhlIGhvbWUgc2VydmVyJ3MgbnVtYmVyIG9mIGNvcmVzLlxuICAgIGNvbnN0IHNlY3VyaXR5UmVkdWNlZFBlcldlYWtlblRoZWFkID0gbnMud2Vha2VuQW5hbHl6ZSgxKTtcblxuICAgIGNvbnN0IGFsbEhvc3RzID0gbnN4LnNjYW5CRlMoXCJob21lXCIsIGZ1bmN0aW9uIChob3N0KSB7XG4gICAgICAgIGNvbnN0IGhvc3RuYW1lID0gaG9zdC5ob3N0bmFtZTtcbiAgICAgICAgaWYgKGNvbmZpZy5mb3JjZUtpbGxBbGxTY3JpcHRzKSB7XG4gICAgICAgICAgICBucy5zY3JpcHRLaWxsKFdFQUtFTl9TQ1JJUFRfTkFNRSwgaG9zdG5hbWUpO1xuICAgICAgICAgICAgbnMuc2NyaXB0S2lsbChHUk9XX1NDUklQVF9OQU1FLCBob3N0bmFtZSk7XG4gICAgICAgICAgICBucy5zY3JpcHRLaWxsKEhBQ0tfU0NSSVBUX05BTUUsIGhvc3RuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG9zdG5hbWUgPT09IFwiaG9tZVwiKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbnMuc2NwKFtIQUNLX1NDUklQVF9OQU1FLCBHUk9XX1NDUklQVF9OQU1FLCBXRUFLRU5fU0NSSVBUX05BTUVdLCBob3N0Lmhvc3RuYW1lLCBcImhvbWVcIik7XG4gICAgfSk7XG4gICAgLy8gRmluZCB0YXJnZXRzXG4gICAgbGV0IHRhcmdldHMgPSBhbGxIb3N0c1xuICAgICAgICAuZmlsdGVyKGhvc3QgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5zLmdldFNlcnZlck1heE1vbmV5KGhvc3QuaG9zdG5hbWUpID4gMCAmJiAhY29uZmlnLmJsYWNrbGlzdFNlcnZlcnMuaGFzKGhvc3QuaG9zdG5hbWUpO1xuICAgICAgICB9KVxuICAgICAgICAuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5zLmdldFNlcnZlclJlcXVpcmVkSGFja2luZ0xldmVsKGIuaG9zdG5hbWUpIC0gbnMuZ2V0U2VydmVyUmVxdWlyZWRIYWNraW5nTGV2ZWwoYS5ob3N0bmFtZSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5tYXA8VGFyZ2V0Pihob3N0ID0+IHtcbiAgICAgICAgICAgIHJldHVybiA8VGFyZ2V0PntcbiAgICAgICAgICAgICAgICBob3N0bmFtZTogaG9zdC5ob3N0bmFtZSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZEhhY2tpbmdTa2lsbDogbnMuZ2V0U2VydmVyUmVxdWlyZWRIYWNraW5nTGV2ZWwoaG9zdC5ob3N0bmFtZSksXG4gICAgICAgICAgICAgICAgbWF4TW9uZXk6IG5zLmdldFNlcnZlck1heE1vbmV5KGhvc3QuaG9zdG5hbWUpLFxuICAgICAgICAgICAgICAgIG1heFNlY3VyaXR5OiBucy5nZXRTZXJ2ZXJCYXNlU2VjdXJpdHlMZXZlbChob3N0Lmhvc3RuYW1lKSxcbiAgICAgICAgICAgICAgICBtaW5TZWN1cml0eTogbnMuZ2V0U2VydmVyTWluU2VjdXJpdHlMZXZlbChob3N0Lmhvc3RuYW1lKSxcbiAgICAgICAgICAgICAgICBza2lwOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjdXJyZW50QWN0aW9uOiBBY3Rpb24uVU5LTk9XTixcbiAgICAgICAgICAgICAgICBjdXJyZW50QWN0aW9uQ29tcGxldGVBdDogMCxcbiAgICAgICAgICAgICAgICBjdXJyZW50VGhyZWFkczogMCxcbiAgICAgICAgICAgICAgICBjdXJyZW50QWN0aW9uTGF0ZXN0UGlkOiAwLFxuICAgICAgICAgICAgICAgIHByZXZpb3VzQWN0aW9uOiBBY3Rpb24uVU5LTk9XTixcbiAgICAgICAgICAgICAgICBoYWNrTW9uZXk6IDAsXG4gICAgICAgICAgICAgICAgdG90YWxXZWFrZW5UaW1lOiAwLFxuICAgICAgICAgICAgICAgIHRvdGFsR3Jvd1RpbWU6IDAsXG4gICAgICAgICAgICAgICAgdG90YWxIYWNrVGltZTogMCxcbiAgICAgICAgICAgICAgICB0b3RhbEhhY2tNb25leTogMFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgLy8gRm9yY2UgdXNlIHRhcmdldHMgZnJvbSBhcmd1bWVudHMsIGFzc3VtZSB2YWxpZCBhcmd1bWVudHNcbiAgICBpZiAobnMuYXJncy5sZW5ndGggPiAwKSB7XG4gICAgICAgIG5zLnRwcmludChgRm9yY2UgdXNpbmcgdGFyZ2V0czogJHtucy5hcmdzfWApO1xuICAgICAgICB0YXJnZXRzID0gW107XG4gICAgICAgIG5zLmFyZ3MuZm9yRWFjaChob3N0bmFtZSA9PiB7XG4gICAgICAgICAgICBhc3NlcnRJc1N0cmluZyhob3N0bmFtZSk7XG4gICAgICAgICAgICB0YXJnZXRzLnB1c2goPFRhcmdldD57XG4gICAgICAgICAgICAgICAgaG9zdG5hbWU6IGhvc3RuYW1lLFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkSGFja2luZ1NraWxsOiBucy5nZXRTZXJ2ZXJSZXF1aXJlZEhhY2tpbmdMZXZlbChob3N0bmFtZSksXG4gICAgICAgICAgICAgICAgbWF4TW9uZXk6IG5zLmdldFNlcnZlck1heE1vbmV5KGhvc3RuYW1lKSxcbiAgICAgICAgICAgICAgICBtYXhTZWN1cml0eTogbnMuZ2V0U2VydmVyQmFzZVNlY3VyaXR5TGV2ZWwoaG9zdG5hbWUpLFxuICAgICAgICAgICAgICAgIG1pblNlY3VyaXR5OiBucy5nZXRTZXJ2ZXJNaW5TZWN1cml0eUxldmVsKGhvc3RuYW1lKSxcbiAgICAgICAgICAgICAgICBza2lwOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjdXJyZW50QWN0aW9uOiBBY3Rpb24uVU5LTk9XTixcbiAgICAgICAgICAgICAgICBjdXJyZW50QWN0aW9uQ29tcGxldGVBdDogMCxcbiAgICAgICAgICAgICAgICBjdXJyZW50VGhyZWFkczogMCxcbiAgICAgICAgICAgICAgICBjdXJyZW50QWN0aW9uTGF0ZXN0UGlkOiAwLFxuICAgICAgICAgICAgICAgIHByZXZpb3VzQWN0aW9uOiBBY3Rpb24uVU5LTk9XTixcbiAgICAgICAgICAgICAgICBoYWNrTW9uZXk6IDAsXG4gICAgICAgICAgICAgICAgdG90YWxXZWFrZW5UaW1lOiAwLFxuICAgICAgICAgICAgICAgIHRvdGFsR3Jvd1RpbWU6IDAsXG4gICAgICAgICAgICAgICAgdG90YWxIYWNrVGltZTogMCxcbiAgICAgICAgICAgICAgICB0b3RhbEhhY2tNb25leTogMFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIC8vIFNvcnQgYmFzZWQgb24gbW9uZXkvcyBpZiB3ZSBoYXZlIGFjY2VzcyBvZiBGb3JtdWxhIEFQSVxuICAgICAgICBpZiAobnMuZmlsZUV4aXN0cyhDb21wbGV0ZWRQcm9ncmFtTmFtZS5mb3JtdWxhcywgXCJob21lXCIpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRzTW9uZXlQZXJTZWNvbmQgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgICAgICAgICAgLy8gUHJlY2FsY3VsYXRlIG1vbmV5L3Mgb2YgZWFjaCBzZXJ2ZXJcbiAgICAgICAgICAgIHRhcmdldHMuZm9yRWFjaCh0YXJnZXQgPT4ge1xuICAgICAgICAgICAgICAgIHRhcmdldHNNb25leVBlclNlY29uZC5zZXQodGFyZ2V0Lmhvc3RuYW1lLCBuc3guZ2V0TW9uZXlQZXJTZWNvbmRIR1codGFyZ2V0Lmhvc3RuYW1lKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIFNvcnRcbiAgICAgICAgICAgIHRhcmdldHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRzTW9uZXlQZXJTZWNvbmQuZ2V0KGIuaG9zdG5hbWUpISAtIHRhcmdldHNNb25leVBlclNlY29uZC5nZXQoYS5ob3N0bmFtZSkhO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICAvLyBPbmx5IGF0dGFjayBzZXJ2ZXJzIHdpdGggcm9vdCBhY2Nlc3MgYW5kIGhhcyBcInBvdGVudGlhbFwiIHJlcXVpcmVkIGhhY2tpbmcgc2tpbGxcbiAgICAgICAgICAgIGlmICghbnMuZ2V0U2VydmVyKHRhcmdldC5ob3N0bmFtZSkuaGFzQWRtaW5SaWdodHNcbiAgICAgICAgICAgICAgICB8fCBucy5nZXRIYWNraW5nTGV2ZWwoKSAqIGNvbmZpZy5oYWNraW5nU2tpbGxNdWx0aXBsaWVyV2hlbkNob29zaW5nVGFyZ2V0IDwgdGFyZ2V0LnJlcXVpcmVkSGFja2luZ1NraWxsKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNraXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRhcmdldC5jdXJyZW50QWN0aW9uID0gQWN0aW9uLlNLSVA7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0YXJnZXQuc2tpcCA9IGZhbHNlO1xuICAgICAgICAgICAgLy8gdGFyZ2V0LmN1cnJlbnRBY3Rpb24gPSBBY3Rpb24uVU5LTk9XTjtcbiAgICAgICAgICAgIC8vIFNraXAgaWYgdGhlcmUgaXMgYW4gb25nb2luZyBwcm9jZXNzIG9mIGdyb3dpbmcvd2Vha2VuaW5nL2hhY2tpbmdcbiAgICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXJQcmVmaXggPSBgY29udHJvbGxlci0ke3RhcmdldC5ob3N0bmFtZX1gO1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZW5hbWUgPSBgJHtMT0dfRk9MREVSfS8ke2lkZW50aWZpZXJQcmVmaXh9LnR4dGA7XG4gICAgICAgICAgICBpZiAoY2hlY2tSdW5uaW5nUHJvY2Vzc2VzQW5kVXBkYXRlVGFyZ2V0SW5mbyhucywgbG9nRmlsZW5hbWUsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Q3VycmVudFNlY3VyaXR5ID0gbnMuZ2V0U2VydmVyU2VjdXJpdHlMZXZlbCh0YXJnZXQuaG9zdG5hbWUpO1xuICAgICAgICAgICAgbGV0IHRhcmdldEN1cnJlbnRNb25leSA9IG5zLmdldFNlcnZlck1vbmV5QXZhaWxhYmxlKHRhcmdldC5ob3N0bmFtZSk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Q3VycmVudE1vbmV5IDwgMTAwMDApIHtcbiAgICAgICAgICAgICAgICAvLyBucy50cHJpbnQoYERldGVjdCBvdmVyaGFja2luZy4gU2VydmVyOiAke3RhcmdldC5ob3N0bmFtZX0uIEN1cnJlbnQgbW9uZXk6ICR7bnMuZm9ybWF0TnVtYmVyKHRhcmdldEN1cnJlbnRNb25leSl9YCk7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q3VycmVudE1vbmV5ID0gMTAwMDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcmVxdWlyZWRUaHJlYWRzID0gMDtcbiAgICAgICAgICAgIGxldCBhY3Rpb246IEFjdGlvbjtcbiAgICAgICAgICAgIC8vIFJlcXVpcmVkIHRpbWUgZm9yIGFjdGlvbi4gVGhpcyBpcyBvbmx5IHVzZWQgZm9yIGxvZ2dpbmcuXG4gICAgICAgICAgICBsZXQgYWN0aW9uVGltZTogbnVtYmVyO1xuICAgICAgICAgICAgbGV0IGFkZGl0aW9uYWxMb2dJbmZvOiBzdHJpbmcgPSBcIlwiO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZjpcbiAgICAgICAgICAgIC8vIC0gU2VjdXJpdHkgYXQgbWluXG4gICAgICAgICAgICAvLyAtIEl0J3Mgbm90IHRoZSBmaXJzdCB0aW1lIHdlIGF0dGFjayB0aGlzIHRhcmdldFxuICAgICAgICAgICAgLy8gLSBQcmV2aW91cyBhY3Rpb24gaXMgbm90IEhBQ0sgKFdlIHVzZSBIR1cpXG4gICAgICAgICAgICBjb25zdCBzZWN1cml0eURpZmYgPSB0YXJnZXRDdXJyZW50U2VjdXJpdHkgLSB0YXJnZXQubWluU2VjdXJpdHk7XG4gICAgICAgICAgICBpZiAoc2VjdXJpdHlEaWZmID4gMC4xICYmIHRhcmdldEN1cnJlbnRTZWN1cml0eSAhPT0gdGFyZ2V0Lm1heFNlY3VyaXR5ICYmIHRhcmdldC5wcmV2aW91c0FjdGlvbiAhPT0gQWN0aW9uLkhBQ0spIHtcbiAgICAgICAgICAgICAgICBhY3Rpb24gPSBBY3Rpb24uV0VBS0VOO1xuICAgICAgICAgICAgICAgIHRhcmdldC5oYWNrTW9uZXkgPSAwO1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkVGhyZWFkcyA9IE1hdGguY2VpbChzZWN1cml0eURpZmYgLyBzZWN1cml0eVJlZHVjZWRQZXJXZWFrZW5UaGVhZCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgd2Vha2VuVGltZSA9IG5zLmdldFdlYWtlblRpbWUodGFyZ2V0Lmhvc3RuYW1lKTtcbiAgICAgICAgICAgICAgICBhY3Rpb25UaW1lID0gd2Vha2VuVGltZTtcbiAgICAgICAgICAgICAgICB0YXJnZXQudG90YWxXZWFrZW5UaW1lICs9IHdlYWtlblRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBtb25leSBhdCBtYXhcbiAgICAgICAgICAgIGVsc2UgaWYgKCh0YXJnZXRDdXJyZW50TW9uZXkgLyB0YXJnZXQubWF4TW9uZXkpIDw9IDAuOTkpIHtcbiAgICAgICAgICAgICAgICBhY3Rpb24gPSBBY3Rpb24uR1JPVztcbiAgICAgICAgICAgICAgICB0YXJnZXQuaGFja01vbmV5ID0gMDtcbiAgICAgICAgICAgICAgICByZXF1aXJlZFRocmVhZHMgPSBNYXRoLmNlaWwoXG4gICAgICAgICAgICAgICAgICAgIG5zLmdyb3d0aEFuYWx5emUodGFyZ2V0Lmhvc3RuYW1lLCB0YXJnZXQubWF4TW9uZXkgLyB0YXJnZXRDdXJyZW50TW9uZXkpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBjb25zdCBncm93VGltZSA9IG5zLmdldEdyb3dUaW1lKHRhcmdldC5ob3N0bmFtZSk7XG4gICAgICAgICAgICAgICAgYWN0aW9uVGltZSA9IGdyb3dUaW1lO1xuICAgICAgICAgICAgICAgIHRhcmdldC50b3RhbEdyb3dUaW1lICs9IGdyb3dUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gSGFja1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWN0aW9uID0gQWN0aW9uLkhBQ0s7XG4gICAgICAgICAgICAgICAgbGV0IGhhY2tNb25leSA9IHRhcmdldC5tYXhNb25leSAqIGNvbmZpZy5oYWNrTW9uZXlSYXRpbztcbiAgICAgICAgICAgICAgICAvLyBMZWF2ZSBhdCBsZWFzdCAxbSBtb25leSBpbiBzZXJ2ZXIgZXhjZXB0IFwibjAwZGxlc1wiIHNlcnZlci4gXCJuMDBkbGVzXCIgaGFzIHRvbyBsaXR0bGUgbW9uZXkgYW5kIGl0IGFsc29cbiAgICAgICAgICAgICAgICAvLyBoYXMgZXh0cmVtZWx5IGhpZ2ggc2VydmVyR3Jvd3RoXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldC5ob3N0bmFtZSAhPT0gXCJuMDBkbGVzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhY2tNb25leSA+IDFlNikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFja01vbmV5IC09IDFlNjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhZGRpdGlvbmFsTG9nSW5mbyA9IGhhY2tNb25leS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHRhcmdldC5oYWNrTW9uZXkgPSBoYWNrTW9uZXk7XG4gICAgICAgICAgICAgICAgcmVxdWlyZWRUaHJlYWRzID0gTWF0aC5mbG9vcihucy5oYWNrQW5hbHl6ZVRocmVhZHModGFyZ2V0Lmhvc3RuYW1lLCBoYWNrTW9uZXkpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBoYWNrVGltZSA9IG5zLmdldEhhY2tUaW1lKHRhcmdldC5ob3N0bmFtZSk7XG4gICAgICAgICAgICAgICAgYWN0aW9uVGltZSA9IGhhY2tUaW1lO1xuICAgICAgICAgICAgICAgIHRhcmdldC50b3RhbEhhY2tUaW1lICs9IGhhY2tUaW1lO1xuICAgICAgICAgICAgICAgIHRhcmdldC50b3RhbEhhY2tNb25leSArPSBoYWNrTW9uZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVxdWlyZWRUaHJlYWRzIDw9IDApIHtcbiAgICAgICAgICAgICAgICBucy50cHJpbnQoYERldGVjdCBpbnZhbGlkIG51bWJlciBvZiByZXF1aXJlZCB0aHJlYWRzYFxuICAgICAgICAgICAgICAgICAgICArIGAuIHJlcXVpcmVkVGhyZWFkczogJHtyZXF1aXJlZFRocmVhZHN9YFxuICAgICAgICAgICAgICAgICAgICArIGAuIFNlcnZlcjogJHt0YXJnZXQuaG9zdG5hbWV9YFxuICAgICAgICAgICAgICAgICAgICArIGAuIEFjdGlvbjogJHthY3Rpb259IGBcbiAgICAgICAgICAgICAgICAgICAgKyBgLiBDdXJyZW50IG1vbmV5OiAke25zLmZvcm1hdE51bWJlcih0YXJnZXRDdXJyZW50TW9uZXkpfWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlcXVpcmVkVGhyZWFkcyA+IDE1MDAwKSB7XG4gICAgICAgICAgICAgICAgbnMudHByaW50KGBEZXRlY3QgbWFzc2l2ZSBudW1iZXIgb2YgcmVxdWlyZWQgdGhyZWFkc2BcbiAgICAgICAgICAgICAgICAgICAgKyBgLiByZXF1aXJlZFRocmVhZHM6ICR7cmVxdWlyZWRUaHJlYWRzfWBcbiAgICAgICAgICAgICAgICAgICAgKyBgLiBTZXJ2ZXI6ICR7dGFyZ2V0Lmhvc3RuYW1lfWBcbiAgICAgICAgICAgICAgICAgICAgKyBgLiBBY3Rpb246ICR7YWN0aW9ufSBgXG4gICAgICAgICAgICAgICAgICAgICsgYC4gQ3VycmVudCBtb25leTogJHtucy5mb3JtYXROdW1iZXIodGFyZ2V0Q3VycmVudE1vbmV5KX1gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhcmdldC5jdXJyZW50QWN0aW9uID0gYWN0aW9uO1xuICAgICAgICAgICAgLy8gU2V0IG5ldyBwcmV2aW91c0FjdGlvblxuICAgICAgICAgICAgdGFyZ2V0LnByZXZpb3VzQWN0aW9uID0gdGFyZ2V0LmN1cnJlbnRBY3Rpb247XG4gICAgICAgICAgICB0YXJnZXQuY3VycmVudFRocmVhZHMgPSByZXF1aXJlZFRocmVhZHM7XG5cbiAgICAgICAgICAgIC8vIFBlcmZvcm0gYWN0aW9uIG9uIHJ1bm5lcnNcbiAgICAgICAgICAgIGxldCBzY3JpcHROYW1lO1xuICAgICAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYXNlIEFjdGlvbi5XRUFLRU46XG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBXRUFLRU5fU0NSSVBUX05BTUU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQWN0aW9uLkdST1c6XG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBHUk9XX1NDUklQVF9OQU1FO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFjdGlvbi5IQUNLOlxuICAgICAgICAgICAgICAgICAgICBzY3JpcHROYW1lID0gSEFDS19TQ1JJUFRfTkFNRTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBydW5uZXJQcm9jZXNzZXM6IFJ1bm5lclByb2Nlc3NbXSA9IFtdO1xuICAgICAgICAgICAgd2hpbGUgKHJlcXVpcmVkVGhyZWFkcyA+IDApIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQuY3VycmVudEFjdGlvbkNvbXBsZXRlQXQgPSBNYXRoLmNlaWwoRGF0ZS5ub3coKSArIGFjdGlvblRpbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IG5zeC5ydW5TY3JpcHRPbkFsbEF2YWlsYWJsZVJ1bm5lcnMoXG4gICAgICAgICAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBzY3JpcHROYW1lLFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJlYWRzOiByZXF1aXJlZFRocmVhZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2ZW50RHVwbGljYXRlczogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQuaG9zdG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIDAsIC8vIE5vIGRlbGF5XG4gICAgICAgICAgICAgICAgICAgIGlzSW5mbHVlbmNlU3RvY2soY29uZmlnLCBhY3Rpb24pLCAvLyBJbmZsdWVuY2Ugc3RvY2sgd2l0aCBncm93IGFjdGlvblxuICAgICAgICAgICAgICAgICAgICBgJHtpZGVudGlmaWVyUHJlZml4fXwke2FjdGlvbn18JHtyZXF1aXJlZFRocmVhZHN9fCR7dGFyZ2V0LmN1cnJlbnRBY3Rpb25Db21wbGV0ZUF0fXwke2FkZGl0aW9uYWxMb2dJbmZvfWAgLy8gRm9yIGxvZ2dpbmdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJ1bm5lclByb2Nlc3Nlcy5wdXNoKC4uLnJlc3VsdC5ydW5uZXJQcm9jZXNzZXMpO1xuICAgICAgICAgICAgICAgIG5zLndyaXRlKGxvZ0ZpbGVuYW1lLCBKU09OLnN0cmluZ2lmeShydW5uZXJQcm9jZXNzZXMpLCBcIndcIik7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkVGhyZWFkcyA9IHJlc3VsdC5yZW1haW5pbmdUaHJlYWRzO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNoZWNrUnVubmluZ1Byb2Nlc3Nlc0FuZFVwZGF0ZVRhcmdldEluZm8obnMsIGxvZ0ZpbGVuYW1lLCB0YXJnZXQpO1xuICAgICAgICAgICAgICAgIG5zLmNsZWFyTG9nKCk7XG4gICAgICAgICAgICAgICAgcHJpbnRMb2cobnMsIHRhcmdldHMpO1xuXG4gICAgICAgICAgICAgICAgYXdhaXQgbnMuc2xlZXAoMTAwMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBucy5jbGVhckxvZygpO1xuICAgICAgICBwcmludExvZyhucywgdGFyZ2V0cyk7XG5cbiAgICAgICAgYXdhaXQgbnMuc2xlZXAoMTAwMCk7XG4gICAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBQ0EsU0FBUSxzQkFBcUI7QUFDN0IsU0FBUSxrQkFBa0Isa0JBQWtCLFlBQVksMEJBQXlCO0FBQ2pGLFNBQVEsNEJBQTJCO0FBQ25DLFNBQVEsbUJBQWtCO0FBQzFCLFNBQVEsMEJBQXdDO0FBR3pDLFNBQVMsYUFBYSxNQUF3QixPQUEyQjtBQUM1RSxTQUFPLENBQUMsR0FBRyxLQUFLLE9BQU87QUFDM0I7QUFFQSxJQUFLLFNBQUwsa0JBQUtBLFlBQUw7QUFDSSxFQUFBQSxRQUFBLGFBQVU7QUFDVixFQUFBQSxRQUFBLFVBQU87QUFDUCxFQUFBQSxRQUFBLFlBQVM7QUFDVCxFQUFBQSxRQUFBLFVBQU87QUFDUCxFQUFBQSxRQUFBLFVBQU87QUFMTixTQUFBQTtBQUFBLEdBQUE7QUFtQ0wsTUFBTSxnQkFBd0I7QUFBQSxFQUMxQiwwQ0FBMEM7QUFBQSxFQUMxQyxnQkFBZ0I7QUFBQSxFQUNoQixrQkFBa0Isb0JBQUksSUFBSTtBQUFBLElBQ3RCO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNKLENBQUM7QUFBQSxFQUNELHFCQUFxQjtBQUFBLEVB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
