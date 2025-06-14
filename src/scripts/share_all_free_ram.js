/** @param {NS} ns **/
// Get all free ram on current server and kick off max threads of share.js
export async function main(ns) {
  const server = ns.args[0];

  if (!server || !ns.serverExists(server)) {
    ns.tprint("Server does not exist");
    return;
  }

  let reserverRam = 0;
  if (server === "home") {
    reserverRam = 100;
  }

  while (true) {
    const maxRam = ns.getServerMaxRam(server);
    const usedRam = ns.getServerUsedRam(server)
    const freeRam = maxRam - usedRam;
    const shareScriptRam = 4;
    const maxThreads = Math.floor((freeRam - reserverRam) / shareScriptRam);

    if (maxThreads <= 0) {
      await ns.sleep(1000);
      continue;
    }

    ns.print(`${server} has ${freeRam} free RAM, kicking off ${maxThreads} threads of share.js`);
    ns.scp("kamu/share.js", server);
    ns.exec("kamu/share.js", server, maxThreads);
    await ns.sleep(10025); // Sleep 25ms extra to make sure share is done running
  }
}