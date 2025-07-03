import { NS } from "@ns";

const argsSchema = [["faction", false]];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    // Disable default logging for cleaner output
    ns.disableLog("ALL");

    const flags = ns.flags(argsSchema);

    // Get the target server from arguments
    if (ns.args.length === 0) {
        ns.tprint("ERROR: Please provide a server name as an argument");
        ns.tprint("Usage: run find-server.js <server_name>");
        return;
    }

    const serverQuery = ns.args[0];
    const printFactionServerPaths = flags["faction"];

    // Function to find path to target server using BFS
    function findPathToServer(ns, query) {
        const queue = [{ server: "home", path: ["home"] }];
        const visited = new Set(["home"]);

        while (queue.length > 0) {
            const { server, path } = queue.shift();

            // If we found the target server, return the path
            if (server.toLowerCase().includes(query.toLowerCase())) {
                return { server, path };
            }

            // Get all connected servers
            const connectedServers = ns.scan(server);

            for (const connectedServer of connectedServers) {
                if (!visited.has(connectedServer)) {
                    visited.add(connectedServer);
                    queue.push({
                        server: connectedServer,
                        path: [...path, connectedServer],
                    });
                }
            }
        }

        return { server: null, path: [] }; // Server not found
    }

    // If printFactionServerPaths is true, print the commands to get to each of the faction servers
    if (printFactionServerPaths) {
        const factionServers = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z"];
        for (const faction of factionServers) {
            const { server, path } = findPathToServer(ns, faction);
            if (path) {
                let commandToGetToServer = "home; ";
                for (let i = 1; i < path.length; i++) {
                    commandToGetToServer += `connect ${path[i]}; `;
                }
                ns.tprint(
                    `=== ${faction} level: ${ns.getServerRequiredHackingLevel(faction)} === \n${commandToGetToServer}\n `,
                );
            }
        }

        return;
    }

    // Find the path to the target server
    const { server, path } = findPathToServer(ns, serverQuery);

    if (path && server) {
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
        ns.tprint(`Required hacking level: ${ns.getServerRequiredHackingLevel(server)}`);
    } else {
        ns.tprint(`ERROR: Server '${serverQuery}' not found in the network`);
    }
}
