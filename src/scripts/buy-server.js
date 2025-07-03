/** @param {NS} ns **/
export async function main(ns) {
    // Check if --check flag is passed
    if (ns.args.includes("--check")) {
        ns.tprint("=== Server RAM Costs ===");
        ns.tprint("RAM Size (GB) | Cost");
        ns.tprint("--------------|----------");

        // Get the maximum purchasable server RAM
        const maxRam = ns.getPurchasedServerMaxRam();

        // Iterate through all possible RAM sizes (powers of 2)
        for (let ram = 2; ram <= maxRam; ram *= 2) {
            const cost = ns.getPurchasedServerCost(ram);
            const costDisplay = ns.formatNumber(cost, 3);
            const ramDisplay = ns.formatRam(ram);
            ns.tprint(`${ramDisplay.padEnd(13)} | $${costDisplay}`);
        }

        const playerMoney = ns.getPlayer().money;
        ns.tprint(`\nYour current money: $${ns.formatNumber(playerMoney, 3)}`);
        ns.tprint(`Purchased servers: ${ns.getPurchasedServers().length}/${ns.getPurchasedServerLimit()}`);
        return;
    }

    const name = ns.args[0];
    const ramSize = ns.args[1];

    if (!name || !ramSize) {
        ns.tprint("ERROR: Please provide server name and RAM size as arguments");
        ns.tprint("Usage: run buy-server.js <server_name> <ram_size>");
        ns.tprint("       run buy-server.js --check  (to see all RAM costs)");
        return;
    }

    const cost = ns.getPurchasedServerCost(ramSize);
    const costDisplay = ns.formatNumber(cost, 3);
    if (ns.getPlayer().money < cost) {
        ns.tprint("Not enough money to buy server. Need $" + costDisplay);
        ns.exit();
    }
    ns.purchaseServer(name, ramSize);
    ns.tprint(`Purchased server ${name} with ${ramSize}GB of RAM for ${costDisplay} money`);
}
