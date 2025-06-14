/** @param {NS} ns **/
export async function main(ns) {
  // Disable default logging for cleaner output
  ns.disableLog("ALL");

  // Get the target server from arguments
  if (ns.args.length === 0) {
    ns.tprint("ERROR: Please provide a server name as an argument");
    ns.tprint("Usage: run find_server.js <server_name>");
    return;
  }

  const targetServer = ns.args[0];
  const fuzzy = true;
  const printFactionServerPaths = ns.args.includes("--faction");

  // Function to find path to target server using BFS
  function findPathToServer(ns, target) {
    const queue = [{ server: "home", path: ["home"] }];
    const visited = new Set(["home"]);

    while (queue.length > 0) {
      const { server, path } = queue.shift();

      // If we found the target server, return the path
      if (server === target || (fuzzy && server.toLowerCase().includes(target.toLowerCase()))) {
        return {server, path};
      }

      // Get all connected servers
      const connectedServers = ns.scan(server);

      for (const connectedServer of connectedServers) {
        if (!visited.has(connectedServer)) {
          visited.add(connectedServer);
          queue.push({
            server: connectedServer,
            path: [...path, connectedServer]
          });
        }
      }
    }

    return null; // Server not found
  }

  // If printFactionServerPaths is true, print the commands to get to each of the faction servers
  if (printFactionServerPaths) {
    const factionServers = ["I.I.I.I", "run4theh111z", "CSEC", "avmnite-02h"];
    for (const faction of factionServers) {
      const {server, path} = findPathToServer(ns, faction);
      if (path) {
        let commandToGetToServer = "home; ";
        for (let i = 1; i < server.length; i++) {
          commandToGetToServer += `connect ${path[i]}; `;
        }
        ns.tprint(`=== Command to get to ${faction} === \n${commandToGetToServer}\n `);
      }
    }

    return;
  }

  // Find the path to the target server
  const {server, path} = findPathToServer(ns, targetServer);

  if (path) {
    ns.tprint(`=== Path to ${server} ===`);
    let commandToGetToServer = "home; ";
    for (let i = 0; i < path.length; i++) {
      if (i > 0) {
        commandToGetToServer += `connect ${path[i]}; `;
      }
      if (i === path.length - 1) {
        ns.tprint(`${i}. ${path[i]} (TARGET)`);
      } else {
        ns.tprint(`${i}. ${path[i]}`);
      }
    }
    ns.tprint(`Total hops: ${path.length - 1}`);
    ns.tprint(`=== Command to get to ${server} === \n${commandToGetToServer}\n `);
  } else {
    ns.tprint(`ERROR: Server '${targetServer}' not found in the network`);
  }
}