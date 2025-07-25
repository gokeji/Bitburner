import { NS } from "@ns";

let shouldPrint = false;
let serverToPrint = "the-hub";

/** @param {NS} ns **/
export async function main(ns) {
    const { weakenTime, endTime } = JSON.parse(ns.args[4]);
    // const delay = ns.args[1];
    let delay = endTime - weakenTime - Date.now();

    const server = ns.args[0];

    if (delay < 0) {
        ns.tprint(`WARN: Batch ${ns.args[3]} Weaken was ${-delay}ms too late. (${endTime})`);
        delay = 0;
    }

    const hgwOptions = {
        additionalMsec: delay,
    };
    await ns.weaken(server, hgwOptions);

    if (shouldPrint && server === serverToPrint) {
        const timeDifference = Date.now() - endTime;
        const currentTime = new Date().toISOString().substring(11, 23);
        const sign = timeDifference >= 0 ? "+" : "";
        const msg =
            "  " +
            currentTime +
            " | Batch: " +
            ns.args[3].padEnd(9, " ") +
            " |       W | " +
            // " W  Delay: " +
            // ns.formatNumber(delay) +
            sign +
            timeDifference.toFixed(2) +
            "ms";
        // ns.write("hgw-log.txt", msg, "a");
        ns.tprint(msg);
    }
}
