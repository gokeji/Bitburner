import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.ui.openTail();

    let factionsToBribe = new Map();

    const ownedAugs = ns.singularity.getOwnedAugmentations(true);
    const bribeAmountPerReputation = ns.corporation.getConstants().bribeAmountPerReputation;

    for (const faction of ns.getPlayer().factions) {
        // Valid factions are the ones that have at least one type of work
        const workTypes = ns.singularity.getFactionWorkTypes(faction);
        if (workTypes.length === 0) {
            continue;
        }

        const factionRep = ns.singularity.getFactionRep(faction);
        const augments = ns.singularity.getAugmentationsFromFaction(faction);
        for (const augment of augments) {
            const repCost = ns.singularity.getAugmentationRepReq(augment);
            if (ownedAugs.includes(augment)) {
                continue;
            }

            if (factionRep < repCost) {
                const repGap = repCost - factionRep;
                if (factionsToBribe.has(faction)) {
                    const highestRepGap = Math.max(factionsToBribe.get(faction).repGap, repGap);
                    factionsToBribe.set(faction, {
                        repGap: highestRepGap,
                        bribeAmount: highestRepGap * bribeAmountPerReputation,
                    });
                } else {
                    factionsToBribe.set(faction, {
                        repGap,
                        bribeAmount: bribeAmountPerReputation * repGap,
                    });
                }
            }
        }
    }

    const sortedFactions = Array.from(factionsToBribe.entries()).sort((a, b) => b[1].bribeAmount - a[1].bribeAmount);

    ns.print(`\n\n\n\n\n\n\n`);
    let totalRepGap = 0;
    let totalBribeAmount = 0;
    for (const [faction, bribeInfo] of sortedFactions) {
        ns.print(`${faction}: need ${ns.formatNumber(bribeInfo.repGap)} rep`);
        totalRepGap += bribeInfo.repGap;
        totalBribeAmount += bribeInfo.bribeAmount;
    }
    ns.print(`\n`);
    ns.print(`Total rep gap: ${ns.formatNumber(totalRepGap)}`);
    ns.print(`Total bribe amount: ${ns.formatNumber(totalBribeAmount)}`);

    if (totalBribeAmount < ns.corporation.getCorporation().funds / 100) {
        ns.print(`Bribing factions...`);
        for (const [faction, bribeInfo] of sortedFactions) {
            ns.print(
                `${faction}: need ${ns.formatNumber(bribeInfo.repGap)} rep, bribing ${ns.formatNumber(bribeInfo.bribeAmount)}`,
            );
            const success = ns.corporation.bribe(faction, bribeInfo.bribeAmount);
            if (!success) {
                ns.print(`Failed to bribe ${faction}`);
            }
        }
        ns.print(`Bribing complete`);
    } else {
        ns.print(`Not enough funds to bribe all factions`);
    }
}
