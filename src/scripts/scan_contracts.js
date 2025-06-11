/** @param {NS} ns **/
export async function main(ns) {
  // Disable default logging for cleaner output
  ns.disableLog("ALL");

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

  // Start scanning from home
  let servers = new Set(["home"]);
  scanAllServers(ns, "home", servers);

  ns.tprint("=== Scanning for .cct files ===");
  let foundFiles = false;

  // Check each server for .cct files
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