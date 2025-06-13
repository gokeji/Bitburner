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
  const fuzzy = ns.args.includes("--fuzzy");

  // Function to find path to target server using BFS
  function findPathToServer(ns, target) {
    const queue = [{ server: "home", path: ["home"] }];
    const visited = new Set(["home"]);

    while (queue.length > 0) {
      const { server, path } = queue.shift();

      // If we found the target server, return the path
      if (server === target || (fuzzy && server.includes(target))) {
        return path;
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

  // Find the path to the target server
  const path = findPathToServer(ns, targetServer);

  if (path) {
    let commandToGetToServer = "";
    ns.tprint(`=== Path to ${targetServer} ===`);
    ns.tprint("Connection chain:");
    for (let i = 0; i < path.length; i++) {
      commandToGetToServer += `connect ${path[i]}; `;
      if (i === path.length - 1) {
        ns.tprint(`${i + 1}. ${path[i]} (TARGET)`);
      } else {
        ns.tprint(`${i + 1}. ${path[i]}`);
      }
    }
    ns.tprint(`\nTotal hops: ${path.length - 1}`);
    ns.tprint(`\nCommand to get to server: ${commandToGetToServer}`);
  } else {
    ns.tprint(`ERROR: Server '${targetServer}' not found in the network`);
  }
}