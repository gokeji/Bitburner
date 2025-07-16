import { NS } from "@ns";

/**
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const ignoreScripts = ["kamu/grow.js", "kamu/hack.js", "kamu/weaken.js"];
    const processes = ns.ps();
    for (const process of processes) {
        if (ignoreScripts.includes(process.filename)) continue;
        const ramUsed = ns.getScriptRam(process.filename) * process.threads;
        const pidDisplay = `(PID - ${process.pid})`.padEnd(14);
        const scriptDisplay = process.filename + " " + process.args.join(" ");
        const ramDisplay = `[${ns.formatRam(ramUsed)}]`;
        ns.tprint(`${pidDisplay} ${scriptDisplay.padEnd(40)} ${ramDisplay}`);
    }
}
