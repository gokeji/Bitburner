import BasePlayer from "./if.player";
/** @param {NS} ns **/
export async function main(ns) {
	let player = new BasePlayer(ns, "player");
	let runtime = ns.args[0];
	let maxPaybackHours = ns.args[1] || 1; // Stop upgrading if payback time > 24 hours
	let prioritizeNetburnersRequirement = ns.args[2]; // If true, prioritize buying 8 nodes

	if (runtime) {
		runtime *= 1000
	} else {
		runtime = 100000000
	}

	const getProd = (level, ram, cores) => (level * 1.5) * Math.pow(1.035, ram - 1) * ((cores + 5) / 6);

	let start_time = new Date().valueOf(); // 16347472346

	let time = new Date().valueOf();
	ns.tprint(`Starting hacknet manager. Max payback time: ${maxPaybackHours} hours. Runtime: ${runtime}ms`)
	while (time < start_time + runtime) {
		time = new Date().valueOf();

		if (!ns.hacknet.numNodes()) {
			while (player.money < ns.hacknet.getPurchaseNodeCost())  {
				await ns.sleep(1000)
			}
			ns.hacknet.purchaseNode()
		}

		let currentNodeStats = [];

		let nodeValue = getProd(10, 1, 1) * player.hnet.multipliers.production;
		let nodeCost = ns.hacknet.getPurchaseNodeCost() * player.hnet.multipliers.purchaseCost;

		// Calculate payback time for new node
		let nodePaybackTime = nodeCost / nodeValue;
		let nodePaybackHours = nodePaybackTime / 3600;

		currentNodeStats.push({
			value: nodeValue,
			cost: nodeCost,
			ratio: nodeValue/nodeCost,
			paybackTime: nodePaybackTime,
			paybackHours: nodePaybackHours,
			type: "node"
		});

		if (prioritizeNetburnersRequirement) {
			// Purchase 8 nodes if we have the money, otherwise wait
			while (ns.hacknet.numNodes() < 8) {
				if (player.money < ns.hacknet.getPurchaseNodeCost()) {
					await ns.sleep(10000)
				} else {
					ns.hacknet.purchaseNode()
				}
			}
		}

		for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
			let {level, ram, cores, production} = ns.hacknet.getNodeStats(idx);

			// Debug everything
			ns.print("--------------------------------")
			ns.print("Node stats:")
			ns.print(`Level: ${level}, Ram: ${ram}, Cores: ${cores}, Production: ${production}`)
			ns.print("--------------------------------")

			ns.print("--------------------------------")

			let levelCost = ns.hacknet.getLevelUpgradeCost(idx, 1) * player.hnet.multipliers.levelCost;
			let ramCost = ns.hacknet.getRamUpgradeCost(idx, 1) * player.hnet.multipliers.ramCost;
			let coreCost = ns.hacknet.getCoreUpgradeCost(idx, 1) * player.hnet.multipliers.coreCost;
			ns.print(`Level Cost: ${levelCost}, Ram Cost: ${ramCost}, Core Cost: ${coreCost}`)
			ns.print(`Player Multipliers:\nlevelCost: ${player.hnet.multipliers.levelCost}\nramCost: ${player.hnet.multipliers.ramCost}\ncoreCost: ${player.hnet.multipliers.coreCost}\npurchaseCost: ${player.hnet.multipliers.purchaseCost}\nproduction: ${player.hnet.multipliers.production}`)


			let levelValue = getProd(level + 1, ram, cores) * player.hnet.multipliers.production - production;
			let ramValue = getProd(level, ram + 1, cores) * player.hnet.multipliers.production - production;
			let coreValue = getProd(level, ram, cores + 1) * player.hnet.multipliers.production - production;
			ns.print(`Level Value: ${levelValue}, Ram Value: ${ramValue}, Core Value: ${coreValue}`)

			// Calculate payback times in seconds
			let levelPaybackTime = levelCost / levelValue;
			let ramPaybackTime = ramCost / ramValue;
			let corePaybackTime = coreCost / coreValue;

			currentNodeStats.push(
				{
					value: levelValue,
					cost:  levelCost,
					ratio: levelValue/levelCost,
					paybackTime: levelPaybackTime,
					paybackHours: levelPaybackTime / 3600, // Convert to hours
					index: idx,
					type: "level"
				},
				{
					value: ramValue,
					cost:  ramCost,
					ratio: ramValue/ramCost,
					paybackTime: ramPaybackTime,
					paybackHours: ramPaybackTime / 3600,
					index: idx,
					type: "ram"

				},
				{
					value: coreValue,
					cost:  coreCost,
					ratio: coreValue/coreCost,
					paybackTime: corePaybackTime,
					paybackHours: corePaybackTime / 3600,
					index: idx,
					type: "core"
				})
				return;
		}

		currentNodeStats.sort((a,b) => a.paybackTime - b.paybackTime)
		let bestUpgrade = currentNodeStats[0];

		// Debug all of the upgrade types before returning
		for (let upgrade of currentNodeStats) {
			ns.print(`Node ${upgrade.index} ${upgrade.type.padEnd(5)}: power: ${ns.formatNumber(upgrade.value, 2).padStart(8)}, cost: ${ns.formatNumber(upgrade.cost, 2).padStart(10)}, ratio: ${upgrade.ratio.toFixed(6).padStart(10)}, payback: ${(upgrade.paybackTime / 3600).toFixed(2).padStart(6)}h`)
		}

		// Log the best upgrade with payback time info
		let nodeInfo = bestUpgrade.type === "node" ? "" : ` on node ${bestUpgrade.index}`;
		let productionInfo = bestUpgrade.type === "node" ?
			`Production: $${ns.formatNumber(bestUpgrade.value, 2)}/sec` :
			`Additional $/sec: ${ns.formatNumber(bestUpgrade.value, 2)}`;

		ns.print(`Best upgrade: ${bestUpgrade.type.toUpperCase()}${nodeInfo}, ` +
			`Cost: $${ns.formatNumber(bestUpgrade.cost, 2)}, ` +
			`${productionInfo}, ` +
			`Payback time: ${ns.tFormat(bestUpgrade.paybackTime * 1000)}`);

		// Check if payback time is too long
		if (bestUpgrade.paybackHours > maxPaybackHours) {
			let upgradeType = bestUpgrade.type === "node" ? "New hacknet node" : `Hacknet ${bestUpgrade.type} upgrade`;

			let printMessage = `${upgradeType} payback time (${bestUpgrade.paybackHours} hours) exceeds maximum (${maxPaybackHours} hours). Stopping upgrades.`

			ns.print(printMessage);
			ns.tprint(printMessage)
			break;
		}

		while (player.money < bestUpgrade.cost) {
			await ns.sleep(10000)
		}
		switch(bestUpgrade.type) {
			case "level":
				ns.hacknet.upgradeLevel(bestUpgrade.index, 1);
				ns.print(`Upgraded level on node ${bestUpgrade.index}`)
				break;
			case "ram":
				ns.hacknet.upgradeRam(bestUpgrade.index, 1);
				ns.print(`Upgraded ram on node ${bestUpgrade.index}`)
				break;
			case "core":
				ns.hacknet.upgradeCore(bestUpgrade.index, 1);
				ns.print(`Upgraded core on node ${bestUpgrade.index}`)
				break;
			case "node":
				ns.hacknet.purchaseNode();
				ns.print(`Purchased node`)
				break;
		}


		await ns.sleep(100)
		ns.print('--------------------------------')
	}

}
