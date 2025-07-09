import { NS } from "@ns";

const argsSchema = [
    ["server", "home"],
    ["threads", 1],
];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    const flags = ns.flags(argsSchema);
    const targetServer = flags["server"];
    const threads = flags["threads"];

    // Validate server exists
    if (!ns.serverExists(targetServer)) {
        ns.tprint(`Server ${targetServer} does not exist`);
        return;
    }

    let reservedRam = 0;
    if (targetServer === "home") {
        reservedRam = 100;
    }

    while (true) {
        const fragments = ns.stanek.activeFragments();

        const maxRam = ns.getServerMaxRam(targetServer);
        const usedRam = ns.getServerUsedRam(targetServer);
        const freeRam = maxRam - usedRam;
        const chargeScriptRam = ns.getScriptRam("./charge.js");
        const maxThreads = Math.floor((freeRam - reservedRam) / chargeScriptRam);

        if (maxThreads <= 0) {
            await ns.sleep(100);
            continue;
        }

        const threadsToUse = targetServer === "home" ? threads : maxThreads;

        if (targetServer !== "home") {
            ns.scp("./charge.js", targetServer);
        }

        // Filter out adjacent fragments and find the one with lowest charge
        const chargeableFragments = fragments.filter((fragment) => !fragment.effect.includes("adjacent"));

        if (chargeableFragments.length === 0) {
            await ns.sleep(100);
            continue;
        }

        // Find fragment with lowest charge
        const lowestChargeFragment = chargeableFragments.reduce((lowest, current) =>
            current.numCharge < lowest.numCharge ? current : lowest,
        );

        let success = false;
        while (!success) {
            success = ns.exec(
                `./charge.js`,
                targetServer,
                threadsToUse,
                lowestChargeFragment.x,
                lowestChargeFragment.y,
            );
            await ns.sleep(50);

            if (success) {
                ns.print(
                    `Charged fragment [${lowestChargeFragment.x}, ${lowestChargeFragment.y}] - ${lowestChargeFragment.numCharge} charges`,
                );
                break; // Exit the while loop after successful charge
            }
        }
    }
}
