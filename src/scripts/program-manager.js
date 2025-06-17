/** @param {NS} ns
 * the purpose of the program-manager is to buy all the programs
 * from the darkweb we can afford so we don't have to do it manually
 * or write them ourselves. Like tor-manager, this script dies a natural death
 * once all programs are bought. **/
export async function main(ns) {
    const programNames = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
    const interval = 2000;

    const keepRunning = ns.args.length > 0 && ns.args[0] == "-c";
    if (!keepRunning) ns.print(`program-manager will run once. Run with argument "-c" to run continuously.`);

    // Check if TOR is available first
    let hasTor = () => ns.scan("home").includes("darkweb");
    if (!hasTor()) {
        ns.print("TOR router not available - cannot purchase programs from darkweb");
        return;
    }

    let foundMissingProgram = false;
    do {
        foundMissingProgram = false;
        for (const prog of programNames) {
            if (!ns.fileExists(prog, "home")) {
                if (ns.singularity.purchaseProgram(prog)) {
                    const cost = ns.singularity.getDarkwebProgramCost(prog);
                    ns.print(`INFO Purchased ${prog} for $${cost}`);
                    ns.tprint(`INFO Purchased ${prog} for $${cost}`);
                } else {
                    foundMissingProgram = true;
                }
            }
        }
        if (keepRunning && foundMissingProgram) await ns.sleep(interval);
    } while (keepRunning && foundMissingProgram);
}
