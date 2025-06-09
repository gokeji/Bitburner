import BasePlayer from "./if.player";
/** @param {NS} ns **/
export async function main(ns) {
	let player = new BasePlayer(ns, "player");
	let runtime = ns.args[0];
	let maxPaybackHours = ns.args[1] || 24; // Stop upgrading if payback time > 24 hours

	if (runtime) {
		runtime *= 1000
	} else {
		runtime = 100000000
	}

	const getProd = (level, ram, cores) => (level * 1.5) * Math.pow(1.035, ram - 1) * ((cores + 5) / 6);

	let start_time = new Date().valueOf(); // 16347472346

	let time = new Date().valueOf();
	ns.tprint(`Starting hacknet manager. Max payback time: ${maxPaybackHours} hours`)
	ns.tprint(time)
	while (time < start_time + runtime) {
		time = new Date().valueOf();

		if (!ns.hacknet.numNodes()) {
			while (player.money < ns.hacknet.getPurchaseNodeCost())  {
				await ns.sleep(1000)
			}
			ns.hacknet.purchaseNode()
		}

		let currentNodeStats = [];

		let nodeValue = getProd(10, 1, 1) * player.hnet.multipliers.production
		let nodeCost = ns.hacknet.getPurchaseNodeCost()

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

		for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
			let {level, ram, cores, production} = ns.hacknet.getNodeStats(idx);

			let levelCost = ns.hacknet.getLevelUpgradeCost(idx, 1);
			let ramCost = ns.hacknet.getRamUpgradeCost(idx, 1);
			let coreCost = ns.hacknet.getCoreUpgradeCost(idx, 1);

			let levelValue = getProd(level + 1, ram, cores) * player.hnet.multipliers.production - production;
			let ramValue = getProd(level, ram + 1, cores) * player.hnet.multipliers.production - production;
			let coreValue = getProd(level, ram, cores + 1) * player.hnet.multipliers.production - production;

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

			}

		currentNodeStats.sort((a,b) => b.ratio - a.ratio)
		let bestUpgrade = currentNodeStats[0];

		// Log the best upgrade with payback time info
		if (bestUpgrade.type !== "node") {
			ns.print(`Best upgrade: ${bestUpgrade.type} on node ${bestUpgrade.index}, ` +
				`Cost: $${ns.formatNumber(bestUpgrade.cost, 2)}, ` +
				`Additional $/sec: ${ns.formatNumber(bestUpgrade.value, 2)}, ` +
				`Payback time: ${ns.tFormat(bestUpgrade.paybackTime * 1000)}`);

			// Check if payback time is too long
			if (bestUpgrade.paybackHours > maxPaybackHours) {
				ns.print(`Payback time (${bestUpgrade.paybackHours.toFixed(1)} hours) exceeds maximum (${maxPaybackHours} hours). Stopping upgrades.`);
				break;
			}
		} else {
			ns.print(`Best upgrade: NEW NODE, ` +
				`Cost: $${ns.formatNumber(bestUpgrade.cost, 2)}, ` +
				`Production: $${ns.formatNumber(bestUpgrade.value, 2)}/sec, ` +
				`Payback time: ${ns.tFormat(bestUpgrade.paybackTime * 1000)}`);

			// Check if payback time is too long for new nodes too
			if (bestUpgrade.paybackHours > maxPaybackHours) {
				ns.print(`New node payback time (${bestUpgrade.paybackHours.toFixed(1)} hours) exceeds maximum (${maxPaybackHours} hours). Stopping upgrades.`);
				break;
			}
		}

		while (player.money < bestUpgrade.cost) {
			await ns.sleep(1000)
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


		await ns.sleep(1000)
	}

}
