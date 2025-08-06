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
