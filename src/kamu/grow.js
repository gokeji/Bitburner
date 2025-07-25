import { NS } from "@ns";

let shouldPrint = false;
let serverToPrint = "phantasy";

/** @param {NS} ns **/
export async function main(ns) {
    const { growTime, endTime } = JSON.parse(ns.args[5]);
    // const delay = ns.args[1];
    let delay = endTime - growTime - Date.now();

    const server = ns.args[0];

    if (delay < 0) {
        ns.tprint(`WARN: Batch ${ns.args[4]} Grow was ${-delay}ms too late. (${endTime})`);
        delay = 0;
    }

    const hgwOptions = {
        stock: ns.args[2] ? true : false,
        additionalMsec: delay,
    };
    await ns.grow(server, hgwOptions);

    if (shouldPrint && server === serverToPrint) {
        const timeDifference = Date.now() - endTime;
        const currentTime = new Date().toISOString().substring(11, 23);
        const sign = timeDifference >= 0 ? "+" : "";
        const msg =
            "  " +
            currentTime +
            " | Batch: " +
            ns.args[4] +
            "   |    G    | " +
            // " G  Delay: " +
            // ns.formatNumber(delay) +
            sign +
            timeDifference.toFixed(2) +
            "ms";
        // ns.write("hgw-log.txt", msg, "a");
        ns.tprint(msg);
    }
}
