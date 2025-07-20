import { NS } from "@ns";

const argsSchema = [
    ["faction", false],
    ["fuzzy", false],
];

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

    const serverQuery = ns.args.find((arg) => !arg.startsWith("-"));
    const printFactionServerPaths = flags["faction"];
    const fuzzy = flags["fuzzy"];

    // Function to find path to target server using BFS
    function findPathToServer(ns, query) {
        const queue = [{ server: "home", path: ["home"] }];
        const visited = new Set(["home"]);

        while (queue.length > 0) {
            const { server, path } = queue.shift();

            // If we found the target server, return the path
            if (fuzzy ? server.toLowerCase().includes(query.toLowerCase()) : server === query) {
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
        const factionServers = [
            ["CyberSec", "CSEC"],
            ["NiteSec", "avmnite-02h"],
            ["The Black Hand", "I.I.I.I"],
            ["BitRunners", "run4theh111z"],
        ];
        for (const [faction, factionServer] of factionServers) {
            const { server, path } = findPathToServer(ns, factionServer);
            if (path) {
                let commandToGetToServer = "home; ";
                for (let i = 1; i < path.length; i++) {
                    commandToGetToServer += `connect ${path[i]}; `;
                }
                ns.tprint(
                    `=== ${faction} (${factionServer}) level: ${ns.getServerRequiredHackingLevel(factionServer)} === \n${commandToGetToServer}\n `,
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
