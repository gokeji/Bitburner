import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    const autoJoinFactions = [
        "Daedalus",
        "Netburners",
        "Slum Snakes",
        "The Black Hand",
        "NiteSec",
        "Tetrads",
        "CyberSec",
        "Tian Di Hui",
        "The Syndicate",
        "BitRunners",
        "New Tokyo",
        "Ishima",
        "Chongqing",
        "Church of the Machine God",
    ];

    // Function to process faction invitations
    async function processFactionInvitations() {
        try {
            // Get current faction invitations
            const invitations = ns.singularity.checkFactionInvitations();

            if (invitations.length === 0) {
                ns.print("No faction invitations available.");
                return;
            }

            ns.print(`Found ${invitations.length} faction invitation(s): ${invitations.join(", ")}`);

            // Process each invitation
            for (const faction of invitations) {
                try {
                    const enemies = ns.singularity.getFactionEnemies(faction);

                    if (enemies.length === 0 || autoJoinFactions.includes(faction)) {
                        // No enemies, safe to join
                        const success = ns.singularity.joinFaction(faction);
                        if (success) {
                            ns.print(`✅ Joined ${faction}!`);
                            ns.tprint(`✅ Joined ${faction}!`);
                            ns.toast(`✅ Joined ${faction}!`, "success");
                        } else {
                            ns.print(`❌ Failed to join ${faction}`);
                            ns.tprint(`❌ Failed to join ${faction}`);
                            ns.toast(`❌ Failed to join ${faction}`, "error");
                        }
                        // if (faction === "Daedalus") {
                        //     const currentWork = ns.singularity.getCurrentWork();
                        //     if (currentWork && currentWork.type === "GRAFTING") {
                        //         await ns.grafting.waitForOngoingGrafting();
                        //     }
                        //     const success = ns.singularity.workForFaction(faction, "hacking");
                        //     if (success) {
                        //         ns.print(`✅ Working for ${faction}!`);
                        //         ns.tprint(`✅ Working for ${faction}!`);
                        //         ns.toast(`✅ Working for ${faction}!`, "success");
                        //     } else {
                        //         ns.print(`❌ Failed to work for ${faction}`);
                        //         ns.tprint(`❌ Failed to work for ${faction}`);
                        //         ns.toast(`❌ Failed to work for ${faction}`, "error");
                        //     }
                        // }
                    } else {
                        // ns.print(`❌ Skipping ${faction}`);
                    }
                } catch (error) {
                    ns.print(`❌ Error processing ${faction}: ${error.message}`);
                }
            }
        } catch (error) {
            ns.print("Error processing faction invitations: " + error.message);
        }
    }

    /** @param {NS} ns */
    async function travelToJoinFactions() {
        const playerFactions = ns.getPlayer().factions;
        const invitations = ns.singularity.checkFactionInvitations();

        if (
            !playerFactions.includes("Church of the Machine God") &&
            !invitations.includes("Church of the Machine God")
        ) {
            ns.singularity.travelToCity("Chongqing");
            await ns.sleep(1000);
            ns.stanek.acceptGift();
        }
        if (ns.getPlayer().money > 30e6) {
            if (!playerFactions.includes("New Tokyo") && !invitations.includes("New Tokyo")) {
                ns.singularity.travelToCity("New Tokyo");
                await ns.sleep(1000);
            }

            if (!playerFactions.includes("Ishima") && !invitations.includes("Ishima")) {
                ns.singularity.travelToCity("Ishima");
                await ns.sleep(1000);
            }

            if (!playerFactions.includes("Chongqing") && !invitations.includes("Chongqing")) {
                ns.singularity.travelToCity("Chongqing");
                await ns.sleep(2000);
            }
        }
        if (
            ns.getPlayer().skills.hacking > 50 &&
            !playerFactions.includes("Tian Di Hui") &&
            !invitations.includes("Tian Di Hui")
        ) {
            ns.singularity.travelToCity("New Tokyo");
            await ns.sleep(1000);
        }
    }

    // Main loop
    ns.print("Starting auto faction joining script...");
    ns.print("Checking for faction invitations every 10 seconds...\n");

    while (true) {
        try {
            await travelToJoinFactions();
            await processFactionInvitations();
            await ns.sleep(5000); // Sleep for 5 seconds
        } catch (error) {
            ns.print("Unexpected error: " + error.message);
            await ns.sleep(5000);
        }
    }
}
