async function main(ns) {
  await ns.sleep(ns.args[1] || 1);
  const hostname = ns.args[0];
  if (ns.args.length >= 3) {
    await ns.hack(hostname, { stock: ns.args[2] });
  } else {
    await ns.hack(hostname);
  }
}
export {
  main
};
