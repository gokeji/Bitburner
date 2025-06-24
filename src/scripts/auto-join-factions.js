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
    ];

    // Function to process faction invitations
    function processFactionInvitations() {
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
                    // const enemies = ns.singularity.getFactionEnemies(faction);

                    if (autoJoinFactions.includes(faction)) {
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
                        if (faction === "Daedalus") {
                            const success = ns.singularity.workForFaction(faction, "hacking");
                            if (success) {
                                ns.print(`✅ Working for ${faction}!`);
                                ns.tprint(`✅ Working for ${faction}!`);
                                ns.toast(`✅ Working for ${faction}!`, "success");
                            } else {
                                ns.print(`❌ Failed to work for ${faction}`);
                                ns.tprint(`❌ Failed to work for ${faction}`);
                                ns.toast(`❌ Failed to work for ${faction}`, "error");
                            }
                        }
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

    // Main loop
    ns.print("Starting auto faction joining script...");
    ns.print("Checking for faction invitations every 10 seconds...\n");

    while (true) {
        try {
            processFactionInvitations();
            await ns.sleep(10000); // Sleep for 10 seconds
        } catch (error) {
            ns.print("Unexpected error: " + error.message);
            await ns.sleep(10000);
        }
    }
}
