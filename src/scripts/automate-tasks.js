import { NS } from "@ns";
import { getSafeBitNodeMultipliers } from "./bitnode-multipliers.js";

const IGNORE_AUGMENTS_IN_GANG = true; // If true, do not work for faction repuatation to get augments that exist in gang, assuming those are easier to get later on.

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
        { type: "augmentation", target: "Synaptic Enhancement Implant" }, // CyberSec 2000

        { type: "augmentation", target: "Hacknet Node NIC Architecture Neural-Upload" }, // Netburners 1.875k
        { type: "augmentation", target: "Hacknet Node Kernel Direct-Neural Interface" }, // Netburners 7.5k
        { type: "augmentation", target: "Hacknet Node Core Direct-Neural Interface" }, // Netburners 12.5k

        { type: "augmentation", target: "Social Negotiation Assistant (S.N.A)" }, // Tian Di Hui 6250
        // { type: "reset" },
        // { type: "augmentation", target: "NeuroFlux Governor" }, // Get closest NFG rep
        { type: "augmentation", target: "Neural-Retention Enhancement" }, // NiteSec 20k
        { type: "augmentation", target: "CRTX42-AA Gene Modification" }, // NiteSec 45k

        // { type: "faction", target: "Illuminati", goal: "120000" },
        // { type: "faction", target: "The Covenant", goal: "120000" },
        { type: "faction", target: "Illuminati", goal: "favor" },
        { type: "faction", target: "The Covenant", goal: "favor" },
        { type: "augmentation", target: "SPTN-97 Gene Modification" }, // The Covenant 1.250m
        { type: "augmentation", target: "QLink" }, // Illuminati 1.875m

        // { type: "train", target: "homicide", goal: 1.0 },
        { type: "train", target: "stats", goal: { strength: 100, defense: 100, dexterity: 100, agility: 100 } },
        // { type: "train", target: "stats", goal: { strength: 10e5, defense: 10e5, dexterity: 10e5, agility: 10e5 } },
        { type: "homicide" },
        // {
        //     type: "graft",
        //     target: "OmniTek InfoLoad",
        // },
        // {
        //     type: "graft",
        //     target: "ADR-V2 Pheromone Gene",
        // },

        // { type: "graft", target: "QLink" },
        // {
        //     type: "graft",
        //     target: "Neuronal Densification",
        // },
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

        { type: "augmentation", target: "Bionic Arms" }, // Tetrads 62500

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
        { type: "stop" },
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
                        `${new Date().toLocaleTimeString()} ${completedDesc}: ${task.type} ${task.target || ""} ${JSON.stringify(task.goal) || ""}`,
                    );
                }
                continue;
            }
            if (canWorkOnTask(ns, task)) {
                const isFirstTime = currentTaskId !== taskId;

                const success = await executeTask(ns, task, isFirstTime);
                if (success) {
                    currentTaskId = taskId;
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
            const playerGang = ns.gang.inGang() ? ns.gang.getGangInformation().faction : null;
            const factionsWithAugmentation = ns.singularity
                .getAugmentationFactions(task.target)
                .filter((faction) => ns.getPlayer().factions.includes(faction) && faction !== playerGang);
            return factionsWithAugmentation.length > 0;
        case "faction":
            return ns.getPlayer().factions.includes(task.target); // Must be in faction
        case "train":
            return ns.getPlayer().money > ns.getPlayer().city === "Sector-12" ? 0 : 200000;
        case "homicide":
            return true; // Can always attempt homicide
        case "reset":
            return true; // Can always attempt reset
        case "stop":
            if (!ns.bladeburner.inBladeburner() || ns.getResetInfo().ownedAugs.has("The Blade's Simulacrum")) {
                // No need to stop if not in bladeburner, or we have The Blade's Simulacrum which allows us to do bladeburner actions while busy
                return false;
            }
            return ns.singularity.getCurrentWork() !== null;
        default:
            return false;
    }
}

/** @param {NS} ns **/
function isTaskComplete(ns, task) {
    switch (task.type) {
        case "graft":
            return ns.getResetInfo().ownedAugs.has(task.target);
        case "augmentation":
            return (
                (ns.getResetInfo().ownedAugs.has(task.target) && task.target !== "NeuroFlux Governor") ||
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
        case "train":
            if (task.target === "homicide") {
                return ns.formulas.work.crimeSuccessChance(ns.getPlayer(), "Homicide") >= task.goal;
            } else if (task.target === "stats") {
                return (
                    ns.getPlayer().skills.strength >= task.goal.strength &&
                    ns.getPlayer().skills.defense >= task.goal.defense &&
                    ns.getPlayer().skills.dexterity >= task.goal.dexterity &&
                    ns.getPlayer().skills.agility >= task.goal.agility
                );
            }
            return false;
        case "homicide":
            return ns.heart.break() <= -54000 || ns.gang.inGang();
        case "reset":
            return false; // Always execute reset when reached
        case "stop":
            return ns.singularity.getCurrentWork() === null;
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

            const playerGang = ns.gang.inGang() ? ns.gang.getGangInformation().faction : null;

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

        case "train":
            if (ns.getPlayer().city !== "Sector-12") {
                ns.singularity.travelToCity("Sector-12");
            }
            if (task.target === "homicide") {
                const stats = findStatsForCrimeSuccessChance(ns, "Homicide", task.goal);
                if (stats) {
                    return trainStats(ns, stats);
                }
                ns.print(`ERROR: ${new Date().toLocaleTimeString()} Failed to find stats for homicide`);
                return false;
            } else if (task.target === "stats") {
                return trainStats(ns, task.goal);
            }
            return false;

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

        case "stop":
            ns.singularity.stopAction();
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

/** @param {NS} ns **/
function startWorkForFactionIfNeeded(ns, faction, workType, goalReputation, currentWork, isFirstTime, purpose) {
    const currentReputation = ns.singularity.getFactionRep(faction);
    if (
        !currentWork ||
        currentWork.type !== "FACTION" ||
        currentWork.factionName !== faction ||
        currentWork.factionWorkType !== workType
    ) {
        const hasNeuroreceptorManagementImplant = ns.getResetInfo().ownedAugs.has("Neuroreceptor Management Implant");
        const success = ns.singularity.workForFaction(faction, workType, !hasNeuroreceptorManagementImplant);
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

function trainStats(ns, stats) {
    const { strength: goalStrength, defense: goalDefense, dexterity: goalDexterity, agility: goalAgility } = stats;
    const { strength, defense, dexterity, agility } = ns.getPlayer().skills;

    const statsToTrain = [];

    if (strength < goalStrength) {
        statsToTrain.push({ stat: "str", level: strength });
    }
    if (defense < goalDefense) {
        statsToTrain.push({ stat: "def", level: defense });
    }
    if (dexterity < goalDexterity) {
        statsToTrain.push({ stat: "dex", level: dexterity });
    }
    if (agility < goalAgility) {
        statsToTrain.push({ stat: "agi", level: agility });
    }

    const lowestLevel = Math.min(...statsToTrain.map((stat) => stat.level));
    const lowestStat = statsToTrain.find((stat) => stat.level === lowestLevel);

    if (lowestStat) {
        ns.singularity.gymWorkout("Powerhouse Gym", lowestStat.stat, false);

        ns.print(
            `${new Date().toLocaleTimeString()} Training: str ${stats.strength} | def ${stats.defense} | dex ${stats.dexterity} | agi ${stats.agility}`,
        );

        return true;
    } else {
        return false;
    }
}

/** @param {NS} ns **/
export function findStatsForCrimeSuccessChance(ns, crimeType, goal, mockPlayer = null) {
    // Optimized for homicide which has hardcoded stats
    // Strength and defense are 4X as valuable as dexterity and agility
    // We want to find the minimum experience required to spread across all stats to reach the goal
    if (crimeType === "Homicide") {
        const originalPlayer = JSON.parse(JSON.stringify(mockPlayer || ns.getPlayer())); // Deep copy the player object to avoid modifying the original
        const player = mockPlayer || ns.getPlayer();
        const bitnodeMults = getSafeBitNodeMultipliers(ns);

        function getSkillMult(stat) {
            let skillMult;
            switch (stat) {
                case "strength":
                    skillMult = player.mults.strength * bitnodeMults.StrengthLevelMultiplier;
                    break;
                case "defense":
                    skillMult = player.mults.defense * bitnodeMults.DefenseLevelMultiplier;
                    break;
                case "dexterity":
                    skillMult = player.mults.dexterity * bitnodeMults.DexterityLevelMultiplier;
                    break;
                case "agility":
                    skillMult = player.mults.agility * bitnodeMults.AgilityLevelMultiplier;
                    break;
            }
            return skillMult;
        }

        while (ns.formulas.work.crimeSuccessChance(player, crimeType) < goal) {
            const { strength, defense, dexterity, agility } = player.skills;

            const strengthExp = ns.formulas.skills.calculateExp(strength, getSkillMult("strength"));
            const defenseExp = ns.formulas.skills.calculateExp(defense, getSkillMult("defense"));
            const dexterityExp = ns.formulas.skills.calculateExp(dexterity, getSkillMult("dexterity"));
            const agilityExp = ns.formulas.skills.calculateExp(agility, getSkillMult("agility"));

            const statsToCompare = [
                { stat: "strength", exp: strengthExp },
                { stat: "defense", exp: defenseExp },
                { stat: "dexterity", exp: dexterityExp * 4 },
                { stat: "agility", exp: agilityExp * 4 },
            ];

            const lowestStat = statsToCompare.sort((a, b) => a.exp - b.exp)[0];
            const lowestStatType = lowestStat.stat;

            player.skills[lowestStatType] += 1;
        }

        const strengthExpRequired =
            ns.formulas.skills.calculateExp(player.skills.strength, getSkillMult("strength")) -
            ns.formulas.skills.calculateExp(originalPlayer.skills.strength, getSkillMult("strength"));
        const defenseExpRequired =
            ns.formulas.skills.calculateExp(player.skills.defense, getSkillMult("defense")) -
            ns.formulas.skills.calculateExp(originalPlayer.skills.defense, getSkillMult("defense"));
        const dexterityExpRequired =
            ns.formulas.skills.calculateExp(player.skills.dexterity, getSkillMult("dexterity")) -
            ns.formulas.skills.calculateExp(originalPlayer.skills.dexterity, getSkillMult("dexterity"));
        const agilityExpRequired =
            ns.formulas.skills.calculateExp(player.skills.agility, getSkillMult("agility")) -
            ns.formulas.skills.calculateExp(originalPlayer.skills.agility, getSkillMult("agility"));
        return {
            strength: player.skills.strength,
            defense: player.skills.defense,
            dexterity: player.skills.dexterity,
            agility: player.skills.agility,
            successChance: ns.formulas.work.crimeSuccessChance(player, crimeType),
            totalExpRequired: strengthExpRequired + defenseExpRequired + dexterityExpRequired + agilityExpRequired,
        };
    }

    for (let i = 1; i < 130; i++) {
        const newPlayer = ns.getPlayer();
        const { strength, defense, dexterity, agility } = newPlayer.skills;
        newPlayer.skills.strength = Math.max(strength, i);
        newPlayer.skills.defense = Math.max(defense, i);
        newPlayer.skills.dexterity = Math.max(dexterity, i);
        newPlayer.skills.agility = Math.max(agility, i);

        const successChance = ns.formulas.work.crimeSuccessChance(newPlayer, crimeType);
        if (successChance >= goal) {
            return {
                strength: newPlayer.skills.strength,
                defense: newPlayer.skills.defense,
                dexterity: newPlayer.skills.dexterity,
                agility: newPlayer.skills.agility,
                successChance,
            };
        }
    }
    return null;
}

// "NeuroFlux Governor", "Augmented Targeting I", "Augmented Targeting II", "Augmented Targeting III", "Synthetic Heart", "Synfibril Muscle", "Combat Rib I", "Combat Rib II", "Combat Rib III", "Nanofiber Weave", "NEMEAN Subdermal Weave", "Wired Reflexes", "Graphene Bone Lacings", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Speech Processor Implant", "TITN-41 Gene-Modification Injection", "Enhanced Social Interaction Implant", "BitWire", "Artificial Bio-neural Network Implant", "Artificial Synaptic Potentiation", "Enhanced Myelin Sheathing", "Synaptic Enhancement Implant", "Neural-Retention Enhancement", "DataJack", "Embedded Netburner Module", "Embedded Netburner Module Core Implant", "Embedded Netburner Module Core V2 Upgrade", "Embedded Netburner Module Core V3 Upgrade", "Embedded Netburner Module Analyze Engine", "Embedded Netburner Module Direct Memory Access Upgrade", "Neuralstimulator", "Neural Accelerator", "Cranial Signal Processors - Gen I", "Cranial Signal Processors - Gen II", "Cranial Signal Processors - Gen III", "Cranial Signal Processors - Gen IV", "Cranial Signal Processors - Gen V", "Neuronal Densification", "Neuroreceptor Management Implant", "Nuoptimal Nootropic Injector Implant", "Speech Enhancement", "FocusWire", "PC Direct-Neural Interface", "PC Direct-Neural Interface Optimization Submodule", "PC Direct-Neural Interface NeuroNet Injector", "PCMatrix", "ADR-V1 Pheromone Gene", "ADR-V2 Pheromone Gene", "The Shadow's Simulacrum", "Hacknet Node CPU Architecture Neural-Upload", "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload", "Hacknet Node Kernel Direct-Neural Interface", "Hacknet Node Core Direct-Neural Interface", "Neurotrainer I", "Neurotrainer II", "Neurotrainer III", "HyperSight Corneal Implant", "LuminCloaking-V1 Skin Implant", "LuminCloaking-V2 Skin Implant", "HemoRecirculator", "SmartSonar Implant", "Power Recirculation Core", "QLink", "The Red Pill", "SPTN-97 Gene Modification", "ECorp HVMind Implant", "CordiARC Fusion Reactor", "SmartJaw", "Neotra", "Xanipher", "nextSENS Gene Modification", "OmniTek InfoLoad", "Photosynthetic Cells", "BitRunners Neurolink", "The Black Hand", "Unstable Circadian Modulator", "CRTX42-AA Gene Modification", "Neuregen Gene Modification", "CashRoot Starter Kit", "NutriGen Implant", "INFRARET Enhancement", "DermaForce Particle Barrier", "Graphene BrachiBlades Upgrade", "Graphene Bionic Arms Upgrade", "BrachiBlades", "Bionic Arms", "Social Negotiation Assistant (S.N.A)", "violet Congruity Implant", "Hydroflame Left Arm", "BigD's Big ... Brain", "Z.O.Ë.", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2", "GOLEM Serum", "Vangelis Virus", "Vangelis Virus 3.0", "I.N.T.E.R.L.I.N.K.E.D", "Blade's Runners", "BLADE-51b Tesla Armor", "BLADE-51b Tesla Armor: Power Cells Upgrade", "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Unibeam Upgrade", "BLADE-51b Tesla Armor: Omnibeam Upgrade", "BLADE-51b Tesla Armor: IPU Upgrade", "The Blade's Simulacrum", "Stanek's Gift - Genesis", "Stanek's Gift - Awakening", "Stanek's Gift - Serenity", "SoA - Might of Ares", "SoA - Wisdom of Athena", "SoA - Trickery of Hermes", "SoA - Beauty of Aphrodite", "SoA - Chaos of Dionysus", "SoA - Flood of Poseidon", "SoA - Hunt of Artemis", "SoA - Knowledge of Apollo", "SoA - phyzical WKS harmonizer"
