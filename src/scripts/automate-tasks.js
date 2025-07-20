import { NS } from "@ns";

const IGNORE_AUGMENTS_IN_GANG = false; // If true, do not work for faction repuatation to get augments that exist in gang, assuming those are easier to get later on.

/** @param {NS} ns **/
export async function main(ns) {
    ns.ui.openTail();

    ns.disableLog("sleep");
    ns.disableLog("singularity.commitCrime");

    /**
     * @typedef {
     *     { type: "faction", target: string, goal: string } |
     *     { type: "augmentation", target: string, acceptGraft: boolean } |
     *     { type: "homicide" } |
     *     { type: "graft", target: string } |
     *     { type: "reset" }
     * } Task
     */

    /** @type {Task[]} */
    let taskQueue = [
        { type: "faction", target: "Daedalus", goal: "favor" },
        { type: "augmentation", target: "The Red Pill" }, // Daedalus 2.5m
        { type: "homicide" },
        {
            type: "graft",
            target: "OmniTek InfoLoad",
        },
        // {
        //     type: "graft",
        //     target: "ADR-V2 Pheromone Gene",
        // },

        { type: "augmentation", target: "Synaptic Enhancement Implant" }, // CyberSec 2000

        { type: "augmentation", target: "Social Negotiation Assistant (S.N.A)" }, // Tian Di Hui 6250

        // { type: "faction", target: "Netburners", goal: "7500" },
        // { type: "faction", target: "Netburners", goal: "12500" },
        // { type: "reset" },

        { type: "augmentation", target: "CRTX42-AA Gene Modification" }, // NiteSec 45000

        // { type: "graft", target: "QLink" },
        {
            type: "graft",
            target: "Neuronal Densification",
        },
        // {
        //     type: "graft",
        //     target: "PC Direct-Neural Interface", // 8% hacking skill, 43 min graft
        // },
        // {
        //     type: "graft",
        //     target: "Xanipher",
        //     condition: (ns) => ns.getPlayer().money > 120e9,
        // },
        // {
        //     type: "graft",
        //     target: "BitRunners Neurolink",
        // },
        // {
        //     type: "graft",
        //     target: "SPTN-97 Gene Modification",
        // },

        // { type: "augmentation", target: "Bionic Arms" }, // Tetrads 62500

        // { type: "reset" },
        { type: "augmentation", target: "The Black Hand" }, // The Black Hand 100000
        { type: "augmentation", target: "DataJack" }, // The Black Hand/BitRunners/NiteSec/Chongqing/New Tokyo 112500
        { type: "augmentation", target: "Cranial Signal Processors - Gen IV" }, // The Black Hand/BitRunners 125000

        { type: "augmentation", target: "Neuregen Gene Modification" }, // Chongqing 37500

        { type: "augmentation", target: "Enhanced Myelin Sheathing" }, // BitRunners 100000

        { type: "augmentation", target: "Neuroreceptor Management Implant" }, // Tian Di Hui 75000

        // { type: "faction", target: "NiteSec", goal: "favor" },

        { type: "augmentation", target: "Neural Accelerator" }, // BitRunners 200000

        { type: "augmentation", target: "Cranial Signal Processors - Gen V" }, // BitRunners 250000

        { type: "augmentation", target: "BitRunners Neurolink" }, // BitRunners 875000

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
            if (task.condition && !task.condition(ns)) return false;
            const graftCost = ns.grafting.getAugmentationGraftPrice(task.target);
            const travelCost = ns.getPlayer().city === "New Tokyo" ? 0 : 200000;
            return ns.getPlayer().money > graftCost + travelCost;
        case "augmentation":
            return true;
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
        case "augmentation":
            return (
                ns.getResetInfo().ownedAugs.has(task.target) ||
                ns.singularity
                    .getAugmentationFactions(task.target)
                    .some(
                        (faction) =>
                            ns.singularity.getFactionRep(faction) >= ns.singularity.getAugmentationRepReq(task.target),
                    )
            );
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
                ns.print(`${new Date().toLocaleTimeString()} Grafting ${task.target}`);
                await waitForOngoingGraft(ns);
                return true;
            } else {
                ns.print(`ERROR: ${new Date().toLocaleTimeString()} Failed to graft ${task.target}`);
                return false;
            }

        case "augmentation":
            const factionsWithAugmentation = ns.singularity
                .getAugmentationFactions(task.target)
                .filter((faction) => ns.getPlayer().factions.includes(faction));

            const augmentationRepReq = ns.singularity.getAugmentationRepReq(task.target);

            // Find fastest faction to work for to get it
            let bestFaction;
            let bestFactionWorkType;
            let fastestCyclesToRep = Infinity;

            const playerGang = ns.gang.inGang ? ns.gang.getGangInformation().faction : null;

            for (const faction of factionsWithAugmentation) {
                if (playerGang === faction) {
                    continue;
                }

                let reputationGap = augmentationRepReq - ns.singularity.getFactionRep(faction);

                const { bestWorkType, bestWorkGains } = getBestFactionWorkType(ns, faction);

                const cyclesToRep = Math.ceil(reputationGap / bestWorkGains);
                if (cyclesToRep < fastestCyclesToRep) {
                    fastestCyclesToRep = cyclesToRep;
                    bestFaction = faction;
                    bestFactionWorkType = bestWorkType;
                }
            }

            // If gang faction has it, do nothing
            if (IGNORE_AUGMENTS_IN_GANG && factionsWithAugmentation.includes(playerGang)) {
                return false;
            }

            if (bestFaction) {
                startWorkForFactionIfNeeded(
                    ns,
                    bestFaction,
                    bestFactionWorkType,
                    augmentationRepReq,
                    currentWork,
                    isFirstTime,
                    task.target,
                );
                return true;
            }

            return false;

        case "faction":
            let goalReputation = task.goal;
            if (task.goal === "favor") {
                const currentFavor = ns.singularity.getFactionFavor(task.target);
                goalReputation =
                    ns.formulas.reputation.calculateFavorToRep(150) -
                    ns.formulas.reputation.calculateFavorToRep(currentFavor);
            }

            const { bestWorkType } = getBestFactionWorkType(ns, task.target);

            startWorkForFactionIfNeeded(
                ns,
                task.target,
                bestWorkType,
                goalReputation,
                currentWork,
                isFirstTime,
                task.goal,
            );

            return true;

        case "homicide":
            if (!currentWork || currentWork.type !== "CRIME" || currentWork.crimeType !== "Homicide") {
                const success = ns.singularity.commitCrime("homicide", true);
                if (success && isFirstTime) {
                    ns.print(`${new Date().toLocaleTimeString()} Starting homicide`);
                    if (!ns.scriptRunning("scripts/karma.js", "home")) {
                        ns.run("scripts/karma.js");
                    }
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

/** @param {NS} ns **/
function getBestFactionWorkType(ns, faction) {
    const workTypes = ns.singularity.getFactionWorkTypes(faction);
    let bestWorkType = workTypes[0];
    let bestWorkGains = 0;
    for (const workType of workTypes) {
        const workStats = ns.formulas.work.factionGains(
            ns.getPlayer(),
            workType,
            ns.singularity.getFactionFavor(faction),
        );
        if (workStats.reputation > bestWorkGains) {
            bestWorkType = workType;
            bestWorkGains = workStats.reputation;
        }
    }

    return { bestWorkType, bestWorkGains };
}

function startWorkForFactionIfNeeded(ns, faction, workType, goalReputation, currentWork, isFirstTime, purpose) {
    const currentReputation = ns.singularity.getFactionRep(faction);
    if (
        !currentWork ||
        currentWork.type !== "FACTION" ||
        currentWork.factionName !== faction ||
        currentWork.factionWorkType !== workType
    ) {
        const success = ns.singularity.workForFaction(faction, workType, true);
        if (success && isFirstTime) {
            ns.print(
                `${new Date().toLocaleTimeString()} Starting work for ${faction}, goal: ${ns.formatNumber(currentReputation)}/${ns.formatNumber(goalReputation)} (${purpose})`,
            );
        }
        if (!success) {
            ns.print(`ERROR: ${new Date().toLocaleTimeString()} Failed to work for ${faction}`);
            return false;
        }
    } else if (isFirstTime) {
        ns.print(
            `${new Date().toLocaleTimeString()} Currently working for ${faction}, goal: ${ns.formatNumber(currentReputation)}/${ns.formatNumber(goalReputation)} (${purpose})`,
        );
    }
}

// "NeuroFlux Governor", "Augmented Targeting I", "Augmented Targeting II", "Augmented Targeting III", "Synthetic Heart", "Synfibril Muscle", "Combat Rib I", "Combat Rib II", "Combat Rib III", "Nanofiber Weave", "NEMEAN Subdermal Weave", "Wired Reflexes", "Graphene Bone Lacings", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Speech Processor Implant", "TITN-41 Gene-Modification Injection", "Enhanced Social Interaction Implant", "BitWire", "Artificial Bio-neural Network Implant", "Artificial Synaptic Potentiation", "Enhanced Myelin Sheathing", "Synaptic Enhancement Implant", "Neural-Retention Enhancement", "DataJack", "Embedded Netburner Module", "Embedded Netburner Module Core Implant", "Embedded Netburner Module Core V2 Upgrade", "Embedded Netburner Module Core V3 Upgrade", "Embedded Netburner Module Analyze Engine", "Embedded Netburner Module Direct Memory Access Upgrade", "Neuralstimulator", "Neural Accelerator", "Cranial Signal Processors - Gen I", "Cranial Signal Processors - Gen II", "Cranial Signal Processors - Gen III", "Cranial Signal Processors - Gen IV", "Cranial Signal Processors - Gen V", "Neuronal Densification", "Neuroreceptor Management Implant", "Nuoptimal Nootropic Injector Implant", "Speech Enhancement", "FocusWire", "PC Direct-Neural Interface", "PC Direct-Neural Interface Optimization Submodule", "PC Direct-Neural Interface NeuroNet Injector", "PCMatrix", "ADR-V1 Pheromone Gene", "ADR-V2 Pheromone Gene", "The Shadow's Simulacrum", "Hacknet Node CPU Architecture Neural-Upload", "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload", "Hacknet Node Kernel Direct-Neural Interface", "Hacknet Node Core Direct-Neural Interface", "Neurotrainer I", "Neurotrainer II", "Neurotrainer III", "HyperSight Corneal Implant", "LuminCloaking-V1 Skin Implant", "LuminCloaking-V2 Skin Implant", "HemoRecirculator", "SmartSonar Implant", "Power Recirculation Core", "QLink", "The Red Pill", "SPTN-97 Gene Modification", "ECorp HVMind Implant", "CordiARC Fusion Reactor", "SmartJaw", "Neotra", "Xanipher", "nextSENS Gene Modification", "OmniTek InfoLoad", "Photosynthetic Cells", "BitRunners Neurolink", "The Black Hand", "Unstable Circadian Modulator", "CRTX42-AA Gene Modification", "Neuregen Gene Modification", "CashRoot Starter Kit", "NutriGen Implant", "INFRARET Enhancement", "DermaForce Particle Barrier", "Graphene BrachiBlades Upgrade", "Graphene Bionic Arms Upgrade", "BrachiBlades", "Bionic Arms", "Social Negotiation Assistant (S.N.A)", "violet Congruity Implant", "Hydroflame Left Arm", "BigD's Big ... Brain", "Z.O.Ë.", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2", "GOLEM Serum", "Vangelis Virus", "Vangelis Virus 3.0", "I.N.T.E.R.L.I.N.K.E.D", "Blade's Runners", "BLADE-51b Tesla Armor", "BLADE-51b Tesla Armor: Power Cells Upgrade", "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Unibeam Upgrade", "BLADE-51b Tesla Armor: Omnibeam Upgrade", "BLADE-51b Tesla Armor: IPU Upgrade", "The Blade's Simulacrum", "Stanek's Gift - Genesis", "Stanek's Gift - Awakening", "Stanek's Gift - Serenity", "SoA - Might of Ares", "SoA - Wisdom of Athena", "SoA - Trickery of Hermes", "SoA - Beauty of Aphrodite", "SoA - Chaos of Dionysus", "SoA - Flood of Poseidon", "SoA - Hunt of Artemis", "SoA - Knowledge of Apollo", "SoA - phyzical WKS harmonizer"
