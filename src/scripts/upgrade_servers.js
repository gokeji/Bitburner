// file: upgrade-servers.js
// import { NS } from "@ns";

// Some bitnodes have exponentially more expensive RAM, so we don't want to always max out everything
const MAX_AUTOUPDATE_RAM = 2 ** 20; // 1PB

// Upgrade RAM to next tier if at least 50% of existing servers are at the current tier
// A more aggressive upgrade factor would be 0.3 then it will try to jump to next level if 30% of existing servers are at the current tier
// Should be between 0 - 1
// 0 = always upgrade to next tier, 1 = never upgrade to next tier
const UPGRADE_THRESHOLD = 0.5;

/**
 *
 * @param {NS} ns
 */
function getRamTierToBuy(ns) {
  const maxAllowedServers = ns.getPurchasedServerLimit();
  const maxAllowedRam = getMaxRamAllowed(ns);

  const purchasedServers = ns.getPurchasedServers();
  const homeServerRam = ns.getServerMaxRam("home");
  const purchasedServersMaxRam = purchasedServers.reduce((max, server) => Math.max(max, ns.getServerMaxRam(server)), 0);

  // Set ram tier to match current max
  let targetRam = Math.min(maxAllowedRam, Math.max(purchasedServersMaxRam, homeServerRam / 2));

  const currentMoney = ns.getServerMoneyAvailable("home");

  // If ram tier exceeds upgrade threshold, double it
  const serversAtCurrentTier = purchasedServers.filter(server => ns.getServerMaxRam(server) == targetRam);
  const currentUpgradeProgress = serversAtCurrentTier.length / maxAllowedServers;
  if (currentUpgradeProgress > UPGRADE_THRESHOLD) {
    targetRam *=2
  }

  // Increase to maximum tier that we can afford
  while (targetRam * 2 <= maxAllowedRam && ns.getPurchasedServerCost(targetRam * 2) <= currentMoney) {
    targetRam *= 2
    ns.print(`Increasing RAM tier to ${targetRam} GB`);
  }

  return targetRam;
}

function getMaxRamAllowed(ns) {
  const maxAllowedRam = ns.getPurchasedServerMaxRam();
  return Math.min(maxAllowedRam, MAX_AUTOUPDATE_RAM);
}

function getNameForNewServer(ns) {
  // b-00, b-01, b-02, etc. Depending on how many servers we have
  const purchasedServers = ns.getPurchasedServers();
  const serverCount = purchasedServers.length;
  const serverName = `b-${serverCount.toString().padStart(2, '0')}`;
  return serverName;
}

/** @param {NS} ns **/
export async function main(ns) {
	// Disable default Logging
	ns.disableLog("ALL");

  const maxAllowedServers = ns.getPurchasedServerLimit();
  const maxAllowedRam = getMaxRamAllowed(ns);

  let ramTierToBuy = 0;
  let ramTierForMessaging = 0;

  while (true) {
    ramTierToBuy = getRamTierToBuy(ns);

    const purchasedServers = ns.getPurchasedServers();

    // If all servers are maxed, break and finish script
    if (purchasedServers.length >= maxAllowedServers && purchasedServers.every(server => ns.getServerMaxRam(server) >= maxAllowedRam)) {
      ns.print("All servers are Maxed");
      ns.toast("All servers are Maxed", "success");
      break;
    }

    // If we cannot afford it, sleep and wait for more money
    if (ns.getPurchasedServerCost(ramTierToBuy) > ns.getServerMoneyAvailable("home")) {
      if (ramTierForMessaging !== ramTierToBuy) {
        ramTierForMessaging = ramTierToBuy;
        ns.print(`Waiting to buy: ${ramTierForMessaging} GB for ${ns.formatNumber(ns.getPurchasedServerCost(ramTierForMessaging), 2)}`);
      }
      await ns.sleep(10000);
      continue;
    }

    // If below max servers, purchase a new server
    if (ns.getPurchasedServers().length < ns.getPurchasedServerLimit()) {

      const serverName = getNameForNewServer(ns);
      ns.purchaseServer(serverName, ramTierToBuy);

      const purchaseMessage = `Purchased server ${serverName} with ${ramTierToBuy} GB RAM for ${ns.formatNumber(ns.getPurchasedServerCost(ramTierToBuy), 2)}`;
      ns.print(purchaseMessage);
      ns.tprint(purchaseMessage);
      ns.toast(purchaseMessage, "success");
    } else {
      // If we are at max servers, find the smallest server and upgrade it to current tier
      const smallestServer = ns.getPurchasedServers().sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b))[0];
      const smallestServerRam = ns.getServerMaxRam(smallestServer);

      ns.killall(smallestServer);
      ns.deleteServer(smallestServer);
      ns.purchaseServer(smallestServer, ramTierToBuy);
      const upgradeMessage = `Upgraded server ${smallestServer} from ${smallestServerRam} GB to ${ramTierToBuy} GB RAM for ${ns.formatNumber(ns.getPurchasedServerCost(ramTierToBuy), 2)}`;
      ns.print(upgradeMessage);
      ns.tprint(upgradeMessage);
      ns.toast(upgradeMessage, "success");
    }

    await ns.sleep(5000);
  }
}