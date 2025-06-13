/** @param {NS} ns **/
export async function main(ns) {
  // Disable default logging for cleaner output
  ns.disableLog("ALL");

  const showPurchased = ns.args.includes("--show-purchased");

  // Function to recursively scan all servers
  function scanAllServers(ns, host, servers) {
      var hosts = ns.scan(host);
      for (let i = 0; i < hosts.length; i++) {
          if (!servers.has(hosts[i])) {
              servers.add(hosts[i]);
              scanAllServers(ns, hosts[i], servers);
          }
      }
  }

  function pad(str, length) {
    return str + " ".repeat(Math.max(length - str.length, 0));
  }

  ns.tprint("=== Scanning all servers ===");

  // Start scanning from home
  let servers = new Set(["home"]);
  scanAllServers(ns, "home", servers);

  for (let server of servers) {
    if (!showPurchased && ns.getServer(server).purchasedByPlayer) {
        continue;
    }
    ns.tprint(`${pad(server, 20)} RAM: ${pad(`${ns.getServer(server).maxRam}GB`, 6)} CPU: ${pad(`${ns.getServer(server).cpuCores} Cores`, 9)}  ROOT: ${pad(ns.hasRootAccess(server), 5)}  PORTS: ${pad(ns.getServerNumPortsRequired(server), 2)}/${pad(ns.getServerNumPortsRequired(server), 2)}`);
  }

  // Check each server for .cct files
  let foundFiles = false;

  for (let server of servers) {
      let cctFiles = ns.ls(server, ".cct");
      if (cctFiles.length > 0) {
          foundFiles = true;
          for (let file of cctFiles) {
              ns.tprint(`${server} -> ${file}`);
          }
      }
  }

  if (!foundFiles) {
      ns.tprint("No .cct files found on any server.");
  }

  ns.tprint("=== Scan complete ===");
}