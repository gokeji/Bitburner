import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    const x = ns.args[0];
    const y = ns.args[1];
    await ns.stanek.chargeFragment(x, y);
}
