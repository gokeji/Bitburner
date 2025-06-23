import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const hackTime = ns.args[5];
    const startTime = Date.now();
    const delay = ns.args[1];
    await ns.sleep(delay);

    const server = ns.args[0];

    if (ns.args.length >= 3) {
        await ns.hack(server, { stock: ns.args[2] });
    } else {
        await ns.hack(server);
    }
    const currentTime = new Date().toISOString().substring(11, 23);
    const expectedFinishTime = startTime + hackTime + delay;
    const timeDifference = Date.now() - expectedFinishTime;
    const sign = timeDifference >= 0 ? "+" : "";
    ns.tprint(
        "  " +
            currentTime +
            " Batch: " +
            ns.args[4] +
            " H  Delay: " +
            ns.formatNumber(delay) +
            " Timing: " +
            sign +
            ns.formatNumber(timeDifference) +
            "ms",
    );
}
