// file: upgrade-servers.js

/** @param {NS} ns **/
export async function main(ns) {
	// Disable default Logging
	ns.disableLog("ALL");

	var notAllServersMaxed = true;
	const ramLimit = ns.getPurchasedServerMaxRam();
	var maxPurchaseableRam = ns.getServerMaxRam("home") / 2;  // we would not buy less than half home RAM
	if (maxPurchaseableRam > ramLimit || ns.getServerMaxRam("home") >= ramLimit) {
		// If home is sufficiently large, don't buy anything cheaper than max RAM since you can easily afford it.
		maxPurchaseableRam = ramLimit;
	}
	ns.print("Initial RAM tier: " + maxPurchaseableRam + " GB");
	while (notAllServersMaxed) {
		var homeMoney = ns.getServerMoneyAvailable("home");
		var ownedServers = ns.getPurchasedServers();
		ownedServers.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
		if (ownedServers.length > 0) {
			// never buy for less than we already have
			maxPurchaseableRam = Math.max(maxPurchaseableRam, ns.getServerMaxRam(ownedServers[0]));
		}

		var ramUpgradeCost = ns.getPurchasedServerCost(maxPurchaseableRam);

		// see if we can afford a higher RAM tier than we already have
		while (maxPurchaseableRam < ramLimit) {
			// check for quadruple RAM for not too big jumps and buffer for another potential double RAM afterwards below
			var nextRamTier = maxPurchaseableRam * 4;
			var nextRamTierCost = ns.getPurchasedServerCost(nextRamTier);
			if (homeMoney > nextRamTierCost) {
				// double RAM
				maxPurchaseableRam *= 2;
			}
			else {	// we found the max affordable ram tier
				break;
			}
		}

		while (ownedServers.length < ns.getPurchasedServerLimit() && homeMoney > ramUpgradeCost) {
			if ((ownedServers.length == 7 || ownedServers.length == 13 || ownedServers.length == 20) && maxPurchaseableRam * 2 <= ramLimit) {
				// switch to a higher RAM tier for the 8th, 14th, and 21st server
				// - make a substantial impact (the increase would be < 10%)
				// - reduce the money lost by deleting servers often
				// - reduce the impact of killing running threads by having the last servers with most of the RAM
				// 		and "baiting" threads to the high RAM servers so that the last small ones have low utilization.
				maxPurchaseableRam *= 2
				ramUpgradeCost = ns.getPurchasedServerCost(maxPurchaseableRam);
			}

			// ns.print("money: " + Math.round(homeMoney / 1000000) + "m cost: " + Math.round(ramUpgradeCost / 1000000) + " m")
			if (homeMoney > ramUpgradeCost) {
				const newServer = ns.purchaseServer("b-" + ownedServers.length, maxPurchaseableRam);
				ownedServers.push(newServer);
				homeMoney = ns.getServerMoneyAvailable("home");
				const printMessage = "Purchased Server " + newServer + " with " + maxPurchaseableRam + " RAM for " + Math.round(ramUpgradeCost / 1000000) + " m";
				ns.print(printMessage);
				ns.toast(printMessage, "success");
			}
		}

		while (ownedServers.length > 0 && homeMoney > ramUpgradeCost) {
			var upgradeServer = ownedServers.pop();
			var upgradeServerRAM = ns.getServerMaxRam(upgradeServer);
			if (upgradeServerRAM >= ramLimit) {
				ns.print("All servers at max RAM");
				ns.tprint("All servers at max RAM");
				ns.toast("All servers at max RAM", "success");
				notAllServersMaxed = false;
				return;
			} else {
				if (maxPurchaseableRam * 2 <= ramLimit && ownedServers.length > 6) {
					if (upgradeServerRAM <= ns.getServerMaxRam(ownedServers[6]) * 2) {
						// switch to double RAM after x servers, so we got the second / third set of servers sizes
						// this looks typically like: servers 0-6: 64 GB; servers 7-13: 32 GB; servers 14-20: 16 GB; servers 21-24: 8 GB
						// - reduce the money lost by deleting servers often
						// - reduce the impact of killing running threads by having the last servers with lower RAM
						// 		and "baiting" threads to the high RAM servers so that the last small ones have low utilization.
						maxPurchaseableRam *= 2;
						ramUpgradeCost = ns.getPurchasedServerCost(maxPurchaseableRam);
						ns.print("Double RAM tier: " + maxPurchaseableRam + " GB");

						if (homeMoney < ramUpgradeCost) {
							// we should switch to a higher RAM tier but cannot afford it. Wait for more money.
							break;
						}
					}
				}

				ns.tprint("Upgrade server " + upgradeServer + " RAM from " + upgradeServerRAM + " to " + maxPurchaseableRam + " for " + Math.round(ramUpgradeCost / 1000000) + " m");
				ns.killall(upgradeServer);
				ns.deleteServer(upgradeServer);
				ns.purchaseServer(upgradeServer, maxPurchaseableRam);
				homeMoney = ns.getServerMoneyAvailable("home");

				const printMessage = "Upgraded Server " + upgradeServer + " RAM from " + upgradeServerRAM + " to " + maxPurchaseableRam + " for " + Math.round(ramUpgradeCost / 1000000) + " m";
				ns.print(printMessage);
				ns.toast(printMessage, "success");
			}
		}
		await ns.sleep(5 * 1000);
	}
}