/** @param {NS} ns **/
export async function main(ns) {
  const name = ns.args[0]
  const ramSize = ns.args[1]
  const cost = ns.getPurchasedServerCost(ramSize)
  const costDisplay = ns.formatNumber(cost, 3)
  if (ns.getPlayer().money < cost) {
    ns.tprint("Not enough money to buy server. Need $" + costDisplay)
    ns.exit()
  }
  ns.purchaseServer(name, ramSize)
  ns.tprint(`Purchased server ${name} with ${ramSize}GB of RAM for ${costDisplay} money`)
}