import { NetscriptExtension } from "./libs/NetscriptExtension";
function autocomplete(data, flags) {
    return [...data.servers];
}
let nsx;
function main(ns) {
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    const target = ns.args[0];
    const scriptName = "simpleHack.js";
    nsx.scanBFS("home", function (host) {
        if (host.hostname === "home") {
            return;
        }
        if (!ns.hasRootAccess(host.hostname)) {
            ns.tprint(`Skip ${host.hostname}. No root access.`);
            return;
        }
        const numberOfThread = Math.floor(
            (ns.getServerMaxRam(host.hostname) - ns.getServerUsedRam(host.hostname)) / ns.getScriptRam(scriptName),
        );
        if (numberOfThread === 0) {
            ns.tprint(`Skip ${host.hostname}. Not enough RAM.`);
            return;
        }
        ns.scriptKill(scriptName, host.hostname);
        ns.scp(scriptName, host.hostname);
        ns.exec(scriptName, host.hostname, numberOfThread, target);
        ns.tprint(`Host: ${host.hostname}. Threads: ${numberOfThread}`);
    });
}
export { autocomplete, main };
