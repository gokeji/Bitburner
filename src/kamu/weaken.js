import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    // const weakenTime = ns.args[4];
    // const startTime = Date.now();
    const delay = ns.args[1];

    const server = ns.args[0];

    const hgwOptions = {
        additionalMsec: delay,
    };
    await ns.weaken(server, hgwOptions);

    // const currentTime = new Date().toISOString().substring(11, 23);
    // const expectedFinishTime = startTime + weakenTime + delay;
    // const timeDifference = Date.now() - expectedFinishTime;
    // const sign = timeDifference >= 0 ? "+" : "";
    // ns.tprint(
    //     currentTime +
    //         " Batch: " +
    //         ns.args[3] +
    //         " W  Delay: " +
    //         ns.formatNumber(delay) +
    //         " Timing: " +
    //         sign +
    //         ns.formatNumber(timeDifference) +
    //         "ms",
    // );
}
