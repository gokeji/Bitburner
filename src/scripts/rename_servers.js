/** @param {NS} ns **/
export async function main(ns) {
  const purchasedServers = ns.getPurchasedServers()
  // Rename servers from b-0, b-1, to b-00, b-01, etc.
  for (let i = 0; i < purchasedServers.length; i++) {
    const name = purchasedServers[i]
    const newName = `b-${i.toString().padStart(2, '0')}`
    const success = ns.renamePurchasedServer(name, newName)
    if (success) {
      ns.tprint(`Renamed server ${name} to ${newName}`)
    } else {
      ns.tprint(`Failed to rename server ${name} to ${newName}`)
    }
  }
}