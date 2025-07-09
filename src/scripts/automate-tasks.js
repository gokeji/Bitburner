import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.ui.openTail();

    ns.disableLog("sleep");
    ns.disableLog("singularity.commitCrime");

    let taskQueue = [
        // { type: "faction", target: "CyberSec", goal: "2000" },
        {
            type: "graft",
            target: "ADR-V2 Pheromone Gene",
        },
        // { type: "faction", target: "Tian Di Hui", goal: "6250" },

        // { type: "faction", target: "Netburners", goal: "7500" },
        // { type: "faction", target: "Netburners", goal: "12500" },

        { type: "homicide" },
        {
            type: "graft",
            target: "OmniTek InfoLoad",
        },
        // { type: "graft", target: "QLink" },
        { type: "faction", target: "NiteSec", goal: "45000" },
        {
            type: "graft",
            target: "Xanipher",
        },
        // { type: "faction", target: "NiteSec", goal: "favor" },
        // { type: "faction", target: "Daedalus", goal: "favor" },
        // { type: "reset" },

        { type: "faction", target: "BitRunners", goal: "100000" },
        { type: "faction", target: "Daedalus", goal: "favor" },
        { type: "faction", target: "Tian Di Hui", goal: "75000" },
        { type: "faction", target: "BitRunners", goal: "favor" },
        { type: "faction", target: "Chongqing", goal: "37500" },
        { type: "faction", target: "The Black Hand", goal: "favor" },
    ];

    let hasMessaged = false;
    let failedTasks = new Set(); // Track tasks that have failed recently

    ns.print("\n\n\n\n\n\n");

    while (taskQueue.length > 0) {
        let currentWork = ns.singularity.getCurrentWork();
        // ns.print(currentWork);
        await waitForOngoingGraft(ns);
        // let currentWork = ns.singularity.getCurrentWork();

        const task = taskQueue[0];

        switch (task.type) {
            case "graft":
                if (ns.singularity.getOwnedAugmentations(true).includes(task.target)) {
                    ns.print(`${new Date().toLocaleTimeString()} Already have ${task.target}`);
                    taskQueue.shift();
                    break;
                }
                ns.singularity.travelToCity("New Tokyo");
                const success = ns.grafting.graftAugmentation(task.target);
                if (success) {
                    await waitForOngoingGraft(ns);
                    taskQueue.shift();
                } else {
                    ns.print(`${new Date().toLocaleTimeString()} Failed to graft ${task.target}`);
                    taskQueue.shift(); // Remove current task
                    if (taskQueue.length > 0) {
                        taskQueue.splice(1, 0, task); // Insert after the next task (at index 1)
                    } else {
                        taskQueue.push(task); // If no other tasks, put it back at the end
                    }
                    await ns.sleep(5000);
                }
                break;
            case "faction":
                if (!ns.getPlayer().factions.includes(task.target)) {
                    ns.print(`${new Date().toLocaleTimeString()} Player has not joined ${task.target} yet`);
                    // Move this behind the next task (if there is one)
                    taskQueue.shift(); // Remove current task
                    if (taskQueue.length > 0) {
                        taskQueue.splice(1, 0, task); // Insert after the next task (at index 1)
                    } else {
                        taskQueue.push(task); // If no other tasks, put it back at the end
                    }
                    await ns.sleep(5000);
                    break;
                }

                let goalReputation = task.goal;
                if (task.goal === "favor") {
                    const currentFavor = ns.singularity.getFactionFavor(task.target);
                    goalReputation =
                        ns.formulas.reputation.calculateFavorToRep(150) -
                        ns.formulas.reputation.calculateFavorToRep(currentFavor);
                }

                if (ns.singularity.getFactionRep(task.target) < goalReputation) {
                    if (!currentWork || currentWork.type !== "FACTION" || currentWork.factionName !== task.target) {
                        ns.singularity.workForFaction(task.target, "hacking", true);
                        ns.print(
                            `${new Date().toLocaleTimeString()} Starting work for ${task.target}, goal: ${ns.formatNumber(goalReputation)}`,
                        );
                        hasMessaged = false;
                    }
                    if (!hasMessaged) {
                        ns.print(
                            `${new Date().toLocaleTimeString()} Waiting for ${task.target} work, goal: ${ns.formatNumber(goalReputation)}`,
                        );
                        hasMessaged = true;
                    }
                    await ns.sleep(10000);
                } else {
                    // Completed faction goal
                    ns.print(
                        `${new Date().toLocaleTimeString()} Completed faction goal ${ns.formatNumber(goalReputation)} rep for ${task.target}`,
                    );
                    taskQueue.shift();
                }

                break;
            case "homicide":
                if (ns.heart.break() > -54000) {
                    if (!currentWork || currentWork.type !== "CRIME" || currentWork.crimeType !== "Homicide") {
                        ns.singularity.commitCrime("homicide", true);
                        ns.print(`${new Date().toLocaleTimeString()} Starting homicide`);
                        hasMessaged = false;
                    }
                    if (!hasMessaged) {
                        ns.print(`${new Date().toLocaleTimeString()} Waiting for gang unlock`);
                        hasMessaged = true;
                    }
                    await ns.sleep(10000);
                } else {
                    ns.print(`${new Date().toLocaleTimeString()} Gang is unlocked`);
                    taskQueue.shift();
                }
                break;
            case "reset":
                ns.run("scripts/get-augments.js", 1, "--hacking", "--rep", "--hacknet", "--buy", "--force-buy");
                ns.run("scripts/get-augments.js", 1, "--buy", "--force-buy");
                await ns.sleep(10000);
                while (ns.getPlayer().money > ns.singularity.getUpgradeHomeRamCost()) {
                    ns.singularity.upgradeHomeRam();
                }
                ns.singularity.installAugmentations("scripts/after-install.js");
        }
    }
    /** @param {NS} ns **/
    async function waitForOngoingGraft(ns) {
        let currentWork = ns.singularity.getCurrentWork();

        if (currentWork && currentWork.type === "GRAFTING") {
            ns.print("Waiting for graft...");
            await ns.grafting.waitForOngoingGrafting();
            ns.print(`${new Date().toLocaleTimeString()} Graft complete`);
        }
    }
}

// "NeuroFlux Governor", "Augmented Targeting I", "Augmented Targeting II", "Augmented Targeting III", "Synthetic Heart", "Synfibril Muscle", "Combat Rib I", "Combat Rib II", "Combat Rib III", "Nanofiber Weave", "NEMEAN Subdermal Weave", "Wired Reflexes", "Graphene Bone Lacings", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Speech Processor Implant", "TITN-41 Gene-Modification Injection", "Enhanced Social Interaction Implant", "BitWire", "Artificial Bio-neural Network Implant", "Artificial Synaptic Potentiation", "Enhanced Myelin Sheathing", "Synaptic Enhancement Implant", "Neural-Retention Enhancement", "DataJack", "Embedded Netburner Module", "Embedded Netburner Module Core Implant", "Embedded Netburner Module Core V2 Upgrade", "Embedded Netburner Module Core V3 Upgrade", "Embedded Netburner Module Analyze Engine", "Embedded Netburner Module Direct Memory Access Upgrade", "Neuralstimulator", "Neural Accelerator", "Cranial Signal Processors - Gen I", "Cranial Signal Processors - Gen II", "Cranial Signal Processors - Gen III", "Cranial Signal Processors - Gen IV", "Cranial Signal Processors - Gen V", "Neuronal Densification", "Neuroreceptor Management Implant", "Nuoptimal Nootropic Injector Implant", "Speech Enhancement", "FocusWire", "PC Direct-Neural Interface", "PC Direct-Neural Interface Optimization Submodule", "PC Direct-Neural Interface NeuroNet Injector", "PCMatrix", "ADR-V1 Pheromone Gene", "ADR-V2 Pheromone Gene", "The Shadow's Simulacrum", "Hacknet Node CPU Architecture Neural-Upload", "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload", "Hacknet Node Kernel Direct-Neural Interface", "Hacknet Node Core Direct-Neural Interface", "Neurotrainer I", "Neurotrainer II", "Neurotrainer III", "HyperSight Corneal Implant", "LuminCloaking-V1 Skin Implant", "LuminCloaking-V2 Skin Implant", "HemoRecirculator", "SmartSonar Implant", "Power Recirculation Core", "QLink", "The Red Pill", "SPTN-97 Gene Modification", "ECorp HVMind Implant", "CordiARC Fusion Reactor", "SmartJaw", "Neotra", "Xanipher", "nextSENS Gene Modification", "OmniTek InfoLoad", "Photosynthetic Cells", "BitRunners Neurolink", "The Black Hand", "Unstable Circadian Modulator", "CRTX42-AA Gene Modification", "Neuregen Gene Modification", "CashRoot Starter Kit", "NutriGen Implant", "INFRARET Enhancement", "DermaForce Particle Barrier", "Graphene BrachiBlades Upgrade", "Graphene Bionic Arms Upgrade", "BrachiBlades", "Bionic Arms", "Social Negotiation Assistant (S.N.A)", "violet Congruity Implant", "Hydroflame Left Arm", "BigD's Big ... Brain", "Z.O.Ë.", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2", "GOLEM Serum", "Vangelis Virus", "Vangelis Virus 3.0", "I.N.T.E.R.L.I.N.K.E.D", "Blade's Runners", "BLADE-51b Tesla Armor", "BLADE-51b Tesla Armor: Power Cells Upgrade", "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Unibeam Upgrade", "BLADE-51b Tesla Armor: Omnibeam Upgrade", "BLADE-51b Tesla Armor: IPU Upgrade", "The Blade's Simulacrum", "Stanek's Gift - Genesis", "Stanek's Gift - Awakening", "Stanek's Gift - Serenity", "SoA - Might of Ares", "SoA - Wisdom of Athena", "SoA - Trickery of Hermes", "SoA - Beauty of Aphrodite", "SoA - Chaos of Dionysus", "SoA - Flood of Poseidon", "SoA - Hunt of Artemis", "SoA - Knowledge of Apollo", "SoA - phyzical WKS harmonizer"
