import { NS } from "@ns";

/**
 * @param {NS} ns
 **/
/*
Lists the RAM and cores for all servers you own (home + purchased servers).
RAM: 1.75GB
Supports chart mode with --chart or -c flag for dynamic updating display.
 */

const calculateServerCost = (ns, ram) => {
    // const cost_per_ram = 55000;
    // return cost_per_ram * ram;
    return ns.getPurchasedServerCost(ram); // Need to use this function to get the correct cost for different bitnodes
};

function get_all_servers(ns) {
    /*
	Scans and iterates through all servers.
	*/
    var servers = ["home"];
    var result = [];

    var i = 0;
    while (i < servers.length) {
        var server = servers[i];
        var s = ns.scan(server);
        for (var j in s) {
            var con = s[j];
            if (servers.indexOf(con) < 0) {
                servers.push(con);
                result.push(con);
            }
        }
        i += 1;
    }
    return result;
}

// Get purchased servers (servers owned by the player)
function get_purchased_servers(ns) {
    const allServers = get_all_servers(ns);
    return allServers.filter((server) => ns.getServer(server).purchasedByPlayer);
}

// Get all owned servers (home + purchased servers)
function get_owned_servers(ns) {
    const purchasedServers = get_purchased_servers(ns);
    return ["home", ...purchasedServers];
}

function pad_str(string, len) {
    /*
	Prepends the requested padding to the string.
	*/
    var pad = "                    ";
    return String(pad + string).slice(-len);
}

function get_server_ram_info(ns, server) {
    /*
	Creates the info text for each server's RAM, cores, and cost.
	*/
    var maxRam = ns.getServerMaxRam(server);
    var cores = ns.getServer(server).cpuCores;

    // Format RAM values
    var maxRamFormatted = ns.formatRam(maxRam);

    // Calculate and format cost
    var cost = server === "home" ? 0 : calculateServerCost(ns, maxRam);
    var costFormatted = server === "home" ? "FREE" : "$" + ns.formatNumber(cost, 2);

    // Determine server type
    var serverType = server === "home" ? "HOME" : "PURCHASED";

    // Build row with separators
    // Column layout: Server (20) | Type (10) | Max RAM (8) | Cores (6) | Cost (12)
    var result =
        `${pad_str(server, 20)}|` +
        `${pad_str(serverType, 10)}|` +
        `${pad_str(maxRamFormatted, 10)}|` +
        `${pad_str(cores.toString(), 6)}|` +
        `${pad_str(costFormatted, 12)}`;

    return result;
}

function get_table_header() {
    // Column layout with separators:
    // Server: 20 chars
    // Type: 10 chars
    // Max RAM: 10 chars
    // Cores: 6 chars
    // Cost: 12 chars
    return `${pad_str("Server", 20)}|${pad_str("Type", 10)}|${pad_str("Max RAM", 10)}|${pad_str("Cores", 6)}|${pad_str("Cost", 12)}`;
}

function displayData(ns, displayFn) {
    const ownedServers = get_owned_servers(ns).sort((a, b) => {
        if (a === "home") return -1;
        if (b === "home") return 1;
        return a.localeCompare(b);
    });

    const charsWidth = 64;
    let totalMaxRam = 0,
        totalCores = 0,
        totalCost = 0;

    displayFn(`Server RAM & Cores List - ${new Date().toLocaleTimeString()}`);
    displayFn("=".repeat(charsWidth));
    displayFn(get_table_header());
    displayFn("-".repeat(charsWidth));

    for (const server of ownedServers) {
        displayFn(get_server_ram_info(ns, server));
        totalMaxRam += ns.getServerMaxRam(server);
        totalCores += ns.getServer(server).cpuCores;
        if (server !== "home") totalCost += calculateServerCost(ns, ns.getServerMaxRam(server));
    }

    displayFn("-".repeat(charsWidth));
    displayFn(
        `${pad_str("TOTALS", 20)}|${pad_str("", 10)}|${pad_str(ns.formatRam(totalMaxRam), 10)}|${pad_str(totalCores.toString(), 6)}|${pad_str("$" + ns.formatNumber(totalCost, 2), 12)}`,
    );
    displayFn("=".repeat(charsWidth));
    displayFn(`Total owned servers: ${ownedServers.length}`);
    displayFn(`Home servers: 1, Purchased servers: ${ownedServers.length - 1}`);
    displayFn(`Total investment in servers: $${ns.formatNumber(totalCost, 2)}`);
}

export async function main(ns) {
    ns.disableLog("ALL");

    // Kill other instances
    ns.ps(ns.getHostname())
        .filter((p) => p.filename === "scripts/ram-list.js" && p.pid !== ns.pid)
        .forEach((p) => {
            ns.ui.closeTail(p.pid);
            ns.kill(p.pid);
        });

    const isChartMode = ns.args.includes("--chart") || ns.args.includes("-c");

    if (isChartMode) {
        ns.ui.openTail();
        ns.ui.resizeTail(640, 400);
        ns.ui.moveTail(320, 0);

        while (true) {
            ns.clearLog();
            displayData(ns, ns.print);
            await ns.sleep(1000);
        }
    } else {
        displayData(ns, ns.tprint);
    }
}
