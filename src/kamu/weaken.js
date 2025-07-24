import { NS } from "@ns";

let shouldPrint = false;
let serverToPrint = "phantasy";

/** @param {NS} ns **/
export async function main(ns) {
    const endTime = ns.args[4].split("=")[1];
    const delay = ns.args[1];

    const server = ns.args[0];

    const hgwOptions = {
        additionalMsec: delay,
    };
    await ns.weaken(server, hgwOptions);

    if (shouldPrint && server === serverToPrint) {
        const currentTime = new Date().toISOString().substring(11, 23);
        const timeDifference = Date.now() - endTime;
        const sign = timeDifference >= 0 ? "+" : "";
        const msg =
            "  " +
            currentTime +
            " | Batch: " +
            ns.args[3] +
            " |       W | " +
            // " W  Delay: " +
            // ns.formatNumber(delay) +
            sign +
            timeDifference.toFixed(2) +
            "ms";
        ns.write("hgw-log.txt", msg, "a");
        ns.tprint(msg);
    }
}
