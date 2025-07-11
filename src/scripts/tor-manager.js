/** @param {NS} ns
 * the purpose of tor-manager is to buy the TOR router ASAP
 * so that another script can buy the port breakers. This script
 * dies a natural death once tor is bought. **/
export async function main(ns) {
    const interval = 2000;

    var keepRunning = ns.args.length > 0 && ns.args[0] == "-c";
    if (!keepRunning) ns.print(`tor-manager will run once. Run with argument "-c" to run continuously.`);

    let hasTor = () => ns.scan("home").includes("darkweb");
    if (hasTor()) {
        ns.print("Player already has Tor");
        return;
    }

    do {
        if (hasTor()) {
            ns.print(`Purchased the Tor router for $200,000`);
            ns.tprint(`INFO Purchased the Tor router for $200,000`);
            break;
        }
        if (ns.singularity.purchaseTor()) {
            ns.print(`Purchased the Tor router for $200,000`);
            ns.tprint(`INFO Purchased the Tor router for $200,000`);
            ns.toast(`Purchased the Tor router for $200,000`);
            break;
        }
        if (keepRunning) await ns.sleep(interval);
    } while (keepRunning);
}
