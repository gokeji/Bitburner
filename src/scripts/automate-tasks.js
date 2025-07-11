import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.ui.openTail();

    ns.disableLog("sleep");
    ns.disableLog("singularity.commitCrime");

    let taskQueue = [
        { type: "graft", target: "QLink" },
        {
            type: "graft",
            target: "Xanipher",
        },
        {
            type: "graft",
            target: "OmniTek InfoLoad",
        },
        {
            type: "graft",
            target: "ADR-V2 Pheromone Gene",
        },
        { type: "faction", target: "Daedalus", goal: "100000" },
        { type: "faction", target: "Daedalus", goal: "favor" },
        // { type: "faction", target: "CyberSec", goal: "2000" },
        // { type: "faction", target: "Tian Di Hui", goal: "6250" },
        // { type: "faction", target: "Netburners", goal: "7500" },
        { type: "faction", target: "NiteSec", goal: "45000" },
        // { type: "faction", target: "Netburners", goal: "12500" },
        { type: "homicide" },

        { type: "faction", target: "BitRunners", goal: "100000" },
        { type: "faction", target: "Tian Di Hui", goal: "75000" },
        // { type: "faction", target: "NiteSec", goal: "favor" },
        // { type: "reset" },

        { type: "faction", target: "The Black Hand", goal: "100000" },
        { type: "faction", target: "Chongqing", goal: "37500" },
        { type: "faction", target: "BitRunners", goal: "favor" },
    ];

    ns.print("\n\n\n\n\n\n");

    let currentTaskId = null; // Track current task to avoid spam
    let completedTasks = [];

    function getTaskId(task) {
        return `${task.type}-${task.target || ""}-${task.goal || ""}`;
    }

    while (taskQueue.length > completedTasks.length) {
        // Always wait for ongoing graft first
        await waitForOngoingGraft(ns);

        for (let task of taskQueue) {
            const taskId = getTaskId(task);
            if (isTaskComplete(ns, task)) {
                if (!completedTasks.includes(taskId)) {
                    completedTasks.push(taskId);
                    const completedDesc = currentTaskId === taskId ? "Completed" : "Ready";
                    ns.print(
                        `${new Date().toLocaleTimeString()} ${completedDesc}: ${task.type} ${task.target || ""} ${task.goal || ""}`,
                    );
                }
                continue;
            }
            if (canWorkOnTask(ns, task)) {
                const isFirstTime = currentTaskId !== taskId;
                currentTaskId = taskId;

                const success = await executeTask(ns, task, isFirstTime);
                if (success) {
                    break;
                } else {
                    // Should not happen but move on to next task if previous one fails for some reason
                    continue;
                }
            }
        }

        await ns.sleep(10000);
    }

    ns.print(`Completed all queued tasks`);
}

/** @param {NS} ns **/
async function waitForOngoingGraft(ns) {
    let currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "GRAFTING") {
        ns.print(`Waiting for graft: ${currentWork.augmentation}...`);
        await ns.grafting.waitForOngoingGrafting();
        ns.print(`${new Date().toLocaleTimeString()} Graft complete`);
    }
}

/** @param {NS} ns **/
function canWorkOnTask(ns, task) {
    switch (task.type) {
        case "graft":
            const graftCost = ns.grafting.getAugmentationGraftPrice(task.target);
            const travelCost = ns.getPlayer().city === "New Tokyo" ? 0 : 200000;
            return ns.getPlayer().money > graftCost + travelCost;
        case "faction":
            return ns.getPlayer().factions.includes(task.target); // Must be in faction
        case "homicide":
            return true; // Can always attempt homicide
        case "reset":
            return true; // Can always attempt reset
        default:
            return false;
    }
}

/** @param {NS} ns **/
function isTaskComplete(ns, task) {
    switch (task.type) {
        case "graft":
            return ns.singularity.getOwnedAugmentations(false).includes(task.target);
        case "faction":
            if (!ns.getPlayer().factions.includes(task.target)) return false;
            let goalReputation = task.goal;
            if (task.goal === "favor") {
                const currentFavor = ns.singularity.getFactionFavor(task.target);
                goalReputation =
                    ns.formulas.reputation.calculateFavorToRep(150) -
                    ns.formulas.reputation.calculateFavorToRep(currentFavor);
            }
            return ns.singularity.getFactionRep(task.target) >= goalReputation;
        case "homicide":
            return ns.heart.break() <= -54000;
        case "reset":
            return false; // Always execute reset when reached
    }
}

/** @param {NS} ns **/
async function executeTask(ns, task, isFirstTime = false) {
    const currentWork = ns.singularity.getCurrentWork();

    switch (task.type) {
        case "graft":
            if (ns.getPlayer().city !== "New Tokyo") {
                ns.singularity.travelToCity("New Tokyo");
            }
            const success = ns.grafting.graftAugmentation(task.target);
            if (success) {
                await waitForOngoingGraft(ns);
                return true;
            } else {
                ns.print(`ERROR: ${new Date().toLocaleTimeString()} Failed to graft ${task.target}`);
                return false;
            }

        case "faction":
            let goalReputation = task.goal;
            const currentReputation = ns.singularity.getFactionRep(task.target);
            if (task.goal === "favor") {
                const currentFavor = ns.singularity.getFactionFavor(task.target);
                goalReputation =
                    ns.formulas.reputation.calculateFavorToRep(150) -
                    ns.formulas.reputation.calculateFavorToRep(currentFavor);
            }

            if (!currentWork || currentWork.type !== "FACTION" || currentWork.factionName !== task.target) {
                const success = ns.singularity.workForFaction(task.target, "hacking", true);
                if (success && isFirstTime) {
                    ns.print(
                        `${new Date().toLocaleTimeString()} Starting work for ${task.target}, goal: ${ns.formatNumber(currentReputation)}/${ns.formatNumber(goalReputation)}`,
                    );
                }
                if (!success) {
                    ns.print(`ERROR: ${new Date().toLocaleTimeString()} Failed to work for ${task.target}`);
                    return false;
                }
            } else if (isFirstTime) {
                ns.print(
                    `${new Date().toLocaleTimeString()} Currently working for ${task.target}, goal: ${ns.formatNumber(currentReputation)}/${ns.formatNumber(goalReputation)}`,
                );
            }
            return true;

        case "homicide":
            if (!currentWork || currentWork.type !== "CRIME" || currentWork.crimeType !== "Homicide") {
                const success = ns.singularity.commitCrime("homicide", true);
                if (success && isFirstTime) {
                    ns.print(`${new Date().toLocaleTimeString()} Starting homicide`);
                    ns.run("scripts/karma.js");
                }
                if (!success) {
                    ns.print(`ERROR: ${new Date().toLocaleTimeString()} Failed to commit homicide`);
                    return false;
                }
            } else if (isFirstTime) {
                ns.print(`${new Date().toLocaleTimeString()} Currently doing homicide`);
            }
            return true;

        case "reset":
            ns.run("scripts/reset.js");
            return true;
    }
}

// "NeuroFlux Governor", "Augmented Targeting I", "Augmented Targeting II", "Augmented Targeting III", "Synthetic Heart", "Synfibril Muscle", "Combat Rib I", "Combat Rib II", "Combat Rib III", "Nanofiber Weave", "NEMEAN Subdermal Weave", "Wired Reflexes", "Graphene Bone Lacings", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Speech Processor Implant", "TITN-41 Gene-Modification Injection", "Enhanced Social Interaction Implant", "BitWire", "Artificial Bio-neural Network Implant", "Artificial Synaptic Potentiation", "Enhanced Myelin Sheathing", "Synaptic Enhancement Implant", "Neural-Retention Enhancement", "DataJack", "Embedded Netburner Module", "Embedded Netburner Module Core Implant", "Embedded Netburner Module Core V2 Upgrade", "Embedded Netburner Module Core V3 Upgrade", "Embedded Netburner Module Analyze Engine", "Embedded Netburner Module Direct Memory Access Upgrade", "Neuralstimulator", "Neural Accelerator", "Cranial Signal Processors - Gen I", "Cranial Signal Processors - Gen II", "Cranial Signal Processors - Gen III", "Cranial Signal Processors - Gen IV", "Cranial Signal Processors - Gen V", "Neuronal Densification", "Neuroreceptor Management Implant", "Nuoptimal Nootropic Injector Implant", "Speech Enhancement", "FocusWire", "PC Direct-Neural Interface", "PC Direct-Neural Interface Optimization Submodule", "PC Direct-Neural Interface NeuroNet Injector", "PCMatrix", "ADR-V1 Pheromone Gene", "ADR-V2 Pheromone Gene", "The Shadow's Simulacrum", "Hacknet Node CPU Architecture Neural-Upload", "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload", "Hacknet Node Kernel Direct-Neural Interface", "Hacknet Node Core Direct-Neural Interface", "Neurotrainer I", "Neurotrainer II", "Neurotrainer III", "HyperSight Corneal Implant", "LuminCloaking-V1 Skin Implant", "LuminCloaking-V2 Skin Implant", "HemoRecirculator", "SmartSonar Implant", "Power Recirculation Core", "QLink", "The Red Pill", "SPTN-97 Gene Modification", "ECorp HVMind Implant", "CordiARC Fusion Reactor", "SmartJaw", "Neotra", "Xanipher", "nextSENS Gene Modification", "OmniTek InfoLoad", "Photosynthetic Cells", "BitRunners Neurolink", "The Black Hand", "Unstable Circadian Modulator", "CRTX42-AA Gene Modification", "Neuregen Gene Modification", "CashRoot Starter Kit", "NutriGen Implant", "INFRARET Enhancement", "DermaForce Particle Barrier", "Graphene BrachiBlades Upgrade", "Graphene Bionic Arms Upgrade", "BrachiBlades", "Bionic Arms", "Social Negotiation Assistant (S.N.A)", "violet Congruity Implant", "Hydroflame Left Arm", "BigD's Big ... Brain", "Z.O.Ë.", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2", "GOLEM Serum", "Vangelis Virus", "Vangelis Virus 3.0", "I.N.T.E.R.L.I.N.K.E.D", "Blade's Runners", "BLADE-51b Tesla Armor", "BLADE-51b Tesla Armor: Power Cells Upgrade", "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Unibeam Upgrade", "BLADE-51b Tesla Armor: Omnibeam Upgrade", "BLADE-51b Tesla Armor: IPU Upgrade", "The Blade's Simulacrum", "Stanek's Gift - Genesis", "Stanek's Gift - Awakening", "Stanek's Gift - Serenity", "SoA - Might of Ares", "SoA - Wisdom of Athena", "SoA - Trickery of Hermes", "SoA - Beauty of Aphrodite", "SoA - Chaos of Dionysus", "SoA - Flood of Poseidon", "SoA - Hunt of Artemis", "SoA - Knowledge of Apollo", "SoA - phyzical WKS harmonizer"
