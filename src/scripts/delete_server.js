/** @param {NS} ns **/
export async function main(ns) {
  const name = ns.args[0]
  const success = ns.deleteServer(name)
  if (success) {
    ns.tprint(`Deleted server ${name}`)
  } else {
    ns.tprint(`Failed to delete server ${name}`)
  }
}