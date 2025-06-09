/** @param {NS} ns */
export async function main(ns) {
    const allListFile = "all-list.txt";        // The master list of all servers
    const detectedListFile = "detected-list.txt";  // The file to store detailed server info

    // Simple function to get all reachable servers (from mcp.js approach)
    function get_all_servers(ns) {
        const servers = ["home"]
        const result = []
        let i = 0

        while (i < servers.length) {
            const server = servers[i]
            const connections = ns.scan(server)

            for (const connection of connections) {
                if (!servers.includes(connection)) {
                    servers.push(connection)
                    result.push(connection)
                }
            }
            i++
        }
        return result
    }

    // Utility to read file and return an array of lines, properly trimmed of whitespace
    async function readList(fileName) {
        try {
            const fileContent = await ns.read(fileName);
            return fileContent ? fileContent.split("\n").map(line => line.trim()).filter(s => s) : [];
        } catch (err) {
            ns.tprint(`Error reading file ${fileName}: ${err}`);
            return [];
        }
    }

    // Utility to extract the server name from detected-list.txt lines
    function extractServerNameFromDetected(line) {
        const match = line.match(/SW Name:\s*([^,]*)/);
        return match ? match[1].trim() : null;
    }

    // Clear both files to start fresh
    await ns.write(allListFile, "", "w");
    await ns.write(detectedListFile, "", "w");

    ns.tprint("Starting the omniscient scan...");

    // Get all reachable servers
    const allServers = get_all_servers(ns);

    let newServersFound = 0;

    // Write all servers to all-list.txt (one per line)
    for (const server of allServers) {
        if (server === 'home') continue; // Skip home server

        await ns.write(allListFile, server + "\n", "a");
        newServersFound++;
    }

    // Also create detailed info in detected-list.txt
    for (const server of allServers) {
        if (server === 'home') continue;

        try {
            // Get server information
            const reqHack = ns.getServerRequiredHackingLevel(server);
            const openPorts = ns.getServerNumPortsRequired(server);
            const maxMoney = ns.getServerMaxMoney(server);

            // Find what server this one is connected to (for "Adjacent" field)
            let adjacentServer = "unknown";
            const connections = ns.scan(server);
            if (connections.length > 0) {
                // Try to find a meaningful adjacent server (not just "home")
                adjacentServer = connections.find(s => s !== "home") || connections[0];
            }

            const serverInfo = `SW Name: ${server} , Req. Hack: ${reqHack} , Ports: ${openPorts} , Max Money: ${maxMoney} , Adjacent: ${adjacentServer}`;

            // Write to detected list
            await ns.write(detectedListFile, serverInfo + "\n", "a");

            ns.print(`Found server: ${server} (Hack: ${reqHack}, Ports: ${openPorts}, Money: $${maxMoney})`);
            await ns.sleep(1);
        } catch (error) {
            ns.print(`Error scanning server ${server}: ${error}`);
        }
    }

    ns.tprint(`Omniscient scan complete! Found ${newServersFound} servers total.`);
    ns.tprint(`Server list saved to '${allListFile}' and detailed info saved to '${detectedListFile}'.`);
    ns.tprint(`Total reachable servers: ${allServers.length} (including home)`);
}
