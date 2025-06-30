import { NS } from "@ns";

const argsSchema = [
    ["kill", false], // Set to true to actually kill the process
    ["tail", false], // Set to true to tail the process
    ["restart", false], // Set to true to restart the process
];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    const shouldKill = ns.args.includes("kill");
    const shouldTail = ns.args.includes("tail");
    const shouldRestart = ns.args.includes("restart");
    const scriptName = ns.args.find((arg) => !["kill", "tail", "restart", "run"].includes(arg));

    let foundPid = 0;
    let actualScriptName = "";
    let foundProcess = null;

    const processes = ns.ps();
    for (const process of processes) {
        if (process.filename.includes(scriptName)) {
            foundPid = process.pid;
            actualScriptName = process.filename;
            foundProcess = process;
            break;
        }
    }

    if (foundPid === 0) {
        ns.tprint(`No process found with name ${scriptName}`);
    } else {
        if (shouldKill) {
            ns.kill(foundPid);
            ns.tprint(`Killed process ${actualScriptName} with PID ${foundPid}`);
        } else if (shouldTail) {
            ns.ui.openTail(foundPid);
        } else if (shouldRestart) {
            ns.kill(foundPid);
            ns.run(actualScriptName, 1, ...foundProcess.args);
            ns.tprint(`Restarted process ${actualScriptName} with PID ${foundPid}`);
        } else {
            ns.tprint(`Found process ${actualScriptName} with PID ${foundPid}`);
        }
    }
}
