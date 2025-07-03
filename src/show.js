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
        ns.tprint(`(PID - ${process.pid}) ${process.filename} ${process.args.join(" ")}`);
    }
}
