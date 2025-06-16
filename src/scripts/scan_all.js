// import { NS } from "@ns";

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
    const s = String(str);
    return s + " ".repeat(Math.max(length - s.length, 0));
  }

  ns.tprint("=== Scanning all servers ===");

  // Start scanning from home
  let servers = new Set(["home"]);
  scanAllServers(ns, "home", servers);

  // Convert to array and filter out purchased servers if needed
  let serverArray = Array.from(servers).filter(server => {
    return showPurchased || !ns.getServer(server).purchasedByPlayer;
  });

  // Sort by hacking level ascending
  serverArray.sort((a, b) => {
    return ns.getServerRequiredHackingLevel(a) - ns.getServerRequiredHackingLevel(b);
  });

  let count = 0;

  for (let server of serverArray) {
    count++;
    const hackLevel = ns.getServerRequiredHackingLevel(server);
    const maxRam = ns.getServer(server).maxRam;
    const cpuCores = ns.getServer(server).cpuCores;
    const hasRoot = ns.hasRootAccess(server);
    const openPorts = ns.getServer(server).openPortCount;
    const reqPorts = ns.getServerNumPortsRequired(server);
    const maxMoney = ns.getServerMaxMoney(server);

    ns.tprint(`${pad(count, 3)}: ${pad(server, 20)} HACK: ${pad(hackLevel, 5)} RAM: ${pad(`${maxRam}GB`, 8)} CPU: ${pad(`${cpuCores} Cores`, 8)} ROOT: ${pad(hasRoot, 5)} PORTS: ${pad(`${openPorts}/${reqPorts}`, 5)} ${pad(maxMoney.toLocaleString(), 12)}`);
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