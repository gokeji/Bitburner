import { NS } from "@ns";

import { getRecordEntries, getRecordKeys } from "./libs/Record";
import { parseNumber } from "./libs/utils";
import { Ceres } from "./libs/Ceres";
import {
    CityName,
    CorpState,
    EmployeePosition,
    getAdvertisingFactors,
    getBusinessFactor,
    getDivisionRawProduction,
    getMarketFactor,
    getResearchRPMultiplier,
    getResearchSalesMultiplier,
    getUpgradeBenefit,
    IndustryType,
    MaterialName,
    productMarketPriceMultiplier,
    ResearchName,
    UnlockName,
    UpgradeName,
} from "./corporationFormulas";
import { CorpMaterialsData } from "./data/CorpMaterialsData";
var DivisionName = /* @__PURE__ */ ((DivisionName2) => {
    DivisionName2["AGRICULTURE"] = "Agriculture";
    DivisionName2["CHEMICAL"] = "Chemical";
    DivisionName2["TOBACCO"] = "Tobacco";
    return DivisionName2;
})(DivisionName || {});
const cities = [
    CityName.Sector12,
    CityName.Aevum,
    CityName.Chongqing,
    CityName.NewTokyo,
    CityName.Ishima,
    CityName.Volhaven,
];
const materials = Object.values(MaterialName);
const boostMaterials = [MaterialName.AI_CORES, MaterialName.HARDWARE, MaterialName.REAL_ESTATE, MaterialName.ROBOTS];
const costMultiplierForEmployeeStatsResearch = 5;
const costMultiplierForProductionResearch = 10;
const researchPrioritiesForSupportDivision = [
    { research: ResearchName.HI_TECH_RND_LABORATORY, costMultiplier: 1 },
    { research: ResearchName.OVERCLOCK, costMultiplier: costMultiplierForEmployeeStatsResearch },
    { research: ResearchName.STIMU, costMultiplier: costMultiplierForEmployeeStatsResearch },
    { research: ResearchName.AUTO_DRUG, costMultiplier: 13.5 },
    { research: ResearchName.GO_JUICE, costMultiplier: costMultiplierForEmployeeStatsResearch },
    { research: ResearchName.CPH4_INJECT, costMultiplier: costMultiplierForEmployeeStatsResearch },
    { research: ResearchName.SELF_CORRECTING_ASSEMBLERS, costMultiplier: costMultiplierForProductionResearch },
    { research: ResearchName.DRONES, costMultiplier: 50 },
    { research: ResearchName.DRONES_ASSEMBLY, costMultiplier: costMultiplierForProductionResearch },
    { research: ResearchName.DRONES_TRANSPORT, costMultiplier: costMultiplierForProductionResearch },
];
const researchPrioritiesForProductDivision = [
    ...researchPrioritiesForSupportDivision,
    { research: ResearchName.UPGRADE_FULCRUM, costMultiplier: costMultiplierForProductionResearch },
    // Do not buy these researches
    // {research: ResearchName.UPGRADE_CAPACITY_1, costMultiplier: costMultiplierForProductionResearch},
    // {research: ResearchName.UPGRADE_CAPACITY_2, costMultiplier: costMultiplierForProductionResearch},
];
const exportString = "(IPROD+IINV/10)*(-1)";
const dummyDivisionNamePrefix = "z-";
const sampleProductName = "Sample product";
const smartSupplyData = /* @__PURE__ */ new Map();
const productMarkupData = /* @__PURE__ */ new Map();
const setOfDivisionsWaitingForRP = /* @__PURE__ */ new Set();
class Logger {
    #enableLogging;
    city;
    constructor(enableLogging, city) {
        this.#enableLogging = enableLogging;
        this.city = city;
    }
    log(...args) {
        if (!this.#enableLogging) {
            return;
        }
        if (this.city === void 0 || this.city === CityName.Sector12) {
            console.log(...args);
        }
    }
    warn(...args) {
        if (!this.#enableLogging) {
            return;
        }
        if (this.city === void 0 || this.city === CityName.Sector12) {
            console.warn(...args);
        }
    }
    error(...args) {
        if (!this.#enableLogging) {
            return;
        }
        if (this.city === void 0 || this.city === CityName.Sector12) {
            console.error(...args);
        }
    }
    time(label) {
        if (!this.#enableLogging) {
            return;
        }
        if (this.city === void 0 || this.city === CityName.Sector12) {
            console.time(label);
        }
    }
    timeEnd(label) {
        if (!this.#enableLogging) {
            return;
        }
        if (this.city === void 0 || this.city === CityName.Sector12) {
            console.timeEnd(label);
        }
    }
    timeLog(label) {
        if (!this.#enableLogging) {
            return;
        }
        if (this.city === void 0 || this.city === CityName.Sector12) {
            console.timeLog(label);
        }
    }
}
function showWarning(ns, warningMessage) {
    console.warn(warningMessage);
    ns.print(warningMessage);
    ns.toast(warningMessage, "warning");
}
function loopAllDivisionsAndCities(ns, callback) {
    for (const division of ns.corporation.getCorporation().divisions) {
        if (division.startsWith(dummyDivisionNamePrefix)) {
            continue;
        }
        for (const city of cities) {
            callback(division, city);
        }
    }
}
async function loopAllDivisionsAndCitiesAsyncCallback(ns, callback) {
    for (const division of ns.corporation.getCorporation().divisions) {
        if (division.startsWith(dummyDivisionNamePrefix)) {
            continue;
        }
        for (const city of cities) {
            await callback(division, city);
        }
    }
}
async function waitUntilAfterStateHappens(ns, state) {
    while (true) {
        if (ns.corporation.getCorporation().prevState === state) {
            break;
        }
        await ns.corporation.nextUpdate();
    }
}
async function waitForNextTimeStateHappens(ns, state) {
    while (true) {
        await ns.corporation.nextUpdate();
        if (ns.corporation.getCorporation().prevState === state) {
            break;
        }
    }
}
async function waitForNumberOfCycles(ns, numberOfCycles) {
    const currentState = ns.corporation.getCorporation().prevState;
    let count = 0;
    while (count < numberOfCycles) {
        await waitForNextTimeStateHappens(ns, currentState);
        ++count;
    }
}
function getProfit(ns) {
    const corporation = ns.corporation.getCorporation();
    return corporation.revenue - corporation.expenses;
}
function hasDivision(ns, divisionName) {
    return ns.corporation.getCorporation().divisions.includes(divisionName);
}
function buyUpgrade(ns, upgrade, targetLevel) {
    if (ns.corporation.getUpgradeLevel(upgrade) < targetLevel) {
        ns.print(`Buying ${targetLevel} of ${upgrade}`);
    }
    for (let i = ns.corporation.getUpgradeLevel(upgrade); i < targetLevel; i++) {
        ns.corporation.levelUpgrade(upgrade);
    }
    if (ns.corporation.getUpgradeLevel(upgrade) < targetLevel) {
        ns.print(`ERROR: Cannot buy enough upgrade level`);
    }
}
/**
 *
 * @param {import("@ns").NS} ns
 * @param {string} divisionName
 * @param {number} targetLevel
 */
function buyAdvert(ns, divisionName, targetLevel) {
    for (let i = ns.corporation.getHireAdVertCount(divisionName); i < targetLevel; i++) {
        ns.corporation.hireAdVert(divisionName);
    }
    if (ns.corporation.getHireAdVertCount(divisionName) < targetLevel) {
        ns.print(`ERROR: Cannot buy enough Advert level`);
    }
}
function buyUnlock(ns, unlockName) {
    if (ns.corporation.hasUnlock(unlockName)) {
        return;
    }
    ns.corporation.purchaseUnlock(unlockName);
}
function upgradeWarehouse(ns, divisionName, city, targetLevel) {
    const amount = targetLevel - ns.corporation.getWarehouse(divisionName, city).level;
    if (amount < 1) {
        return;
    }
    ns.corporation.upgradeWarehouse(divisionName, city, amount);
}
/**
 * @param {import("@ns").NS} ns
 * @param {string} divisionName
 */
async function buyTeaAndThrowParty(ns, divisionName) {
    const epsilon = 0.5;
    while (true) {
        let finish = true;
        for (const city of cities) {
            const office = ns.corporation.getOffice(divisionName, city);
            if (office.avgEnergy < office.maxEnergy - epsilon) {
                ns.corporation.buyTea(divisionName, city);
                finish = false;
            }
            // ns.print(
            //     `Buying Tea and throwing party ${divisionName} ${city} ${office.avgEnergy} ${office.maxEnergy} ${office.avgMorale} ${office.maxMorale}`,
            // );
            if (office.avgMorale < office.maxMorale - epsilon) {
                ns.corporation.throwParty(divisionName, city, 5e5);
                finish = false;
            }
        }
        if (finish) {
            break;
        }
        await ns.corporation.nextUpdate();
    }
}
function buyTeaAndThrowPartyForAllDivisions(ns) {
    if (ns.corporation.getInvestmentOffer().round >= 3 || ns.corporation.getCorporation().public) {
        loopAllDivisionsAndCities(ns, (divisionName, city) => {
            ns.corporation.buyTea(divisionName, city);
            ns.corporation.throwParty(divisionName, city, 5e5);
        });
        return;
    }
    const epsilon = 0.5;
    loopAllDivisionsAndCities(ns, (divisionName, city) => {
        const office = ns.corporation.getOffice(divisionName, city);
        if (office.avgEnergy < office.maxEnergy - epsilon) {
            ns.corporation.buyTea(divisionName, city);
        }
        if (office.avgMorale < office.maxMorale - epsilon) {
            ns.corporation.throwParty(divisionName, city, 5e5);
        }
    });
}
function generateOfficeSetupsForEarlyRounds(size, increaseBusiness = false) {
    let officeSetup;
    switch (size) {
        case 3:
            officeSetup = [
                { name: EmployeePosition.OPERATIONS, count: 1 },
                { name: EmployeePosition.ENGINEER, count: 1 },
                { name: EmployeePosition.BUSINESS, count: 1 },
                { name: EmployeePosition.MANAGEMENT, count: 0 },
            ];
            break;
        case 4:
            officeSetup = [
                { name: EmployeePosition.OPERATIONS, count: 1 },
                { name: EmployeePosition.ENGINEER, count: 1 },
                { name: EmployeePosition.BUSINESS, count: 1 },
                { name: EmployeePosition.MANAGEMENT, count: 1 },
            ];
            break;
        case 5:
            officeSetup = [
                { name: EmployeePosition.OPERATIONS, count: 2 },
                { name: EmployeePosition.ENGINEER, count: 1 },
                { name: EmployeePosition.BUSINESS, count: 1 },
                { name: EmployeePosition.MANAGEMENT, count: 1 },
            ];
            break;
        case 6:
            if (increaseBusiness) {
                officeSetup = [
                    { name: EmployeePosition.OPERATIONS, count: 2 },
                    { name: EmployeePosition.ENGINEER, count: 1 },
                    { name: EmployeePosition.BUSINESS, count: 2 },
                    { name: EmployeePosition.MANAGEMENT, count: 1 },
                ];
            } else {
                officeSetup = [
                    { name: EmployeePosition.OPERATIONS, count: 2 },
                    { name: EmployeePosition.ENGINEER, count: 1 },
                    { name: EmployeePosition.BUSINESS, count: 1 },
                    { name: EmployeePosition.MANAGEMENT, count: 2 },
                ];
            }
            break;
        case 7:
            if (increaseBusiness) {
                officeSetup = [
                    { name: EmployeePosition.OPERATIONS, count: 2 },
                    { name: EmployeePosition.ENGINEER, count: 1 },
                    { name: EmployeePosition.BUSINESS, count: 2 },
                    { name: EmployeePosition.MANAGEMENT, count: 2 },
                ];
            } else {
                officeSetup = [
                    { name: EmployeePosition.OPERATIONS, count: 3 },
                    { name: EmployeePosition.ENGINEER, count: 1 },
                    { name: EmployeePosition.BUSINESS, count: 1 },
                    { name: EmployeePosition.MANAGEMENT, count: 2 },
                ];
            }
            break;
        case 8:
            if (increaseBusiness) {
                officeSetup = [
                    { name: EmployeePosition.OPERATIONS, count: 3 },
                    { name: EmployeePosition.ENGINEER, count: 1 },
                    { name: EmployeePosition.BUSINESS, count: 2 },
                    { name: EmployeePosition.MANAGEMENT, count: 2 },
                    // { name: EmployeePosition.OPERATIONS, count: 2 },
                    // { name: EmployeePosition.ENGINEER, count: 1 },
                    // { name: EmployeePosition.BUSINESS, count: 3 },
                    // { name: EmployeePosition.MANAGEMENT, count: 2 },
                ];
            } else {
                officeSetup = [
                    { name: EmployeePosition.OPERATIONS, count: 3 },
                    { name: EmployeePosition.ENGINEER, count: 1 },
                    { name: EmployeePosition.BUSINESS, count: 1 },
                    { name: EmployeePosition.MANAGEMENT, count: 3 },
                ];
            }
            break;
        default:
            throw new Error(`Invalid office size: ${size}`);
    }
    return generateOfficeSetups(cities, size, officeSetup);
}
function generateOfficeSetups(cities2, size, jobs) {
    const officeSetupJobs = {
        Operations: 0,
        Engineer: 0,
        Business: 0,
        Management: 0,
        "Research & Development": 0,
        Intern: 0,
    };
    for (const job of jobs) {
        switch (job.name) {
            case EmployeePosition.OPERATIONS:
                officeSetupJobs.Operations = job.count;
                break;
            case EmployeePosition.ENGINEER:
                officeSetupJobs.Engineer = job.count;
                break;
            case EmployeePosition.BUSINESS:
                officeSetupJobs.Business = job.count;
                break;
            case EmployeePosition.MANAGEMENT:
                officeSetupJobs.Management = job.count;
                break;
            case EmployeePosition.RESEARCH_DEVELOPMENT:
                officeSetupJobs["Research & Development"] = job.count;
                break;
            case EmployeePosition.INTERN:
                officeSetupJobs.Intern = job.count;
                break;
            default:
                throw new Error(`Invalid job: ${job.name}`);
        }
    }
    const officeSetups = [];
    for (const city of cities2) {
        officeSetups.push({
            city,
            size,
            jobs: officeSetupJobs,
        });
    }
    return officeSetups;
}
function assignJobs(ns, divisionName, officeSetups) {
    for (const officeSetup of officeSetups) {
        for (const jobName of Object.values(EmployeePosition)) {
            ns.corporation.setAutoJobAssignment(divisionName, officeSetup.city, jobName, 0);
        }
        for (const [jobName, count] of Object.entries(officeSetup.jobs)) {
            if (!ns.corporation.setAutoJobAssignment(divisionName, officeSetup.city, jobName, count)) {
                ns.print(`Cannot assign job properly. City: ${officeSetup.city}, job: ${jobName}, count: ${count}`);
            }
        }
    }
}
function upgradeOffices(ns, divisionName, officeSetups) {
    let totalUpgradeCount = 0;
    let totalEmployeeCount = 0;
    for (const officeSetup of officeSetups) {
        const office = ns.corporation.getOffice(divisionName, officeSetup.city);
        if (officeSetup.size < office.size) {
            ns.print(`Office's new size is smaller than current size. City: ${officeSetup.city}`);
            continue;
        }
        if (officeSetup.size > office.size) {
            ns.corporation.upgradeOfficeSize(divisionName, officeSetup.city, officeSetup.size - office.size);
            totalUpgradeCount += officeSetup.size - office.size;
        }
        while (ns.corporation.hireEmployee(divisionName, officeSetup.city, EmployeePosition.RESEARCH_DEVELOPMENT)) {
            totalEmployeeCount++;
        }
    }
    assignJobs(ns, divisionName, officeSetups);
    if (totalUpgradeCount > 0 || totalEmployeeCount > 0) {
        ns.print(
            `${divisionName}: Upgrade offices completed. Total upgrade count: ${totalUpgradeCount}, total employee count: ${totalEmployeeCount}`,
        );
    }
}
function clearPurchaseOrders(ns, clearInputMaterialOrders = true) {
    loopAllDivisionsAndCities(ns, (divisionName, city) => {
        for (const materialName of boostMaterials) {
            ns.corporation.buyMaterial(divisionName, city, materialName, 0);
            ns.corporation.sellMaterial(divisionName, city, materialName, "0", "MP");
        }
        if (clearInputMaterialOrders) {
            const division = ns.corporation.getDivision(divisionName);
            const industrialData = ns.corporation.getIndustryData(division.type);
            for (const materialName of getRecordKeys(industrialData.requiredMaterials)) {
                ns.corporation.buyMaterial(divisionName, city, materialName, 0);
                ns.corporation.sellMaterial(divisionName, city, materialName, "0", "MP");
            }
        }
    });
}
function generateMaterialsOrders(cities2, materials2) {
    const orders = [];
    for (const city of cities2) {
        orders.push({
            city,
            materials: materials2,
        });
    }
    return orders;
}
async function stockMaterials(ns, divisionName, orders, bulkPurchase = false, discardExceeded = false) {
    let count = 0;
    while (true) {
        if (count === 5) {
            const warningMessage = `It takes too many cycles to stock up on materials. Division: ${divisionName}, orders: ${JSON.stringify(orders)}`;
            showWarning(ns, warningMessage);
            break;
        }
        let finish = true;
        for (const order of orders) {
            for (const material of order.materials) {
                const storedAmount = ns.corporation.getMaterial(divisionName, order.city, material.name).stored;
                if (storedAmount === material.count) {
                    ns.corporation.buyMaterial(divisionName, order.city, material.name, 0);
                    ns.corporation.sellMaterial(divisionName, order.city, material.name, "0", "MP");
                    continue;
                }
                if (storedAmount < material.count) {
                    if (bulkPurchase) {
                        ns.corporation.bulkPurchase(
                            divisionName,
                            order.city,
                            material.name,
                            material.count - storedAmount,
                        );
                    } else {
                        ns.corporation.buyMaterial(
                            divisionName,
                            order.city,
                            material.name,
                            (material.count - storedAmount) / 10,
                        );
                        ns.corporation.sellMaterial(divisionName, order.city, material.name, "0", "MP");
                    }
                    finish = false;
                } else if (discardExceeded) {
                    ns.corporation.buyMaterial(divisionName, order.city, material.name, 0);
                    ns.corporation.sellMaterial(
                        divisionName,
                        order.city,
                        material.name,
                        ((storedAmount - material.count) / 10).toString(),
                        "0",
                    );
                    finish = false;
                }
            }
        }
        if (finish) {
            break;
        }
        await waitForNextTimeStateHappens(ns, CorpState.PURCHASE);
        ++count;
    }
}
function getCorporationUpgradeLevels(ns) {
    const corporationUpgradeLevels = {
        [UpgradeName.SMART_FACTORIES]: 0,
        [UpgradeName.SMART_STORAGE]: 0,
        [UpgradeName.DREAM_SENSE]: 0,
        [UpgradeName.WILSON_ANALYTICS]: 0,
        [UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS]: 0,
        [UpgradeName.SPEECH_PROCESSOR_IMPLANTS]: 0,
        [UpgradeName.NEURAL_ACCELERATORS]: 0,
        [UpgradeName.FOCUS_WIRES]: 0,
        [UpgradeName.ABC_SALES_BOTS]: 0,
        [UpgradeName.PROJECT_INSIGHT]: 0,
    };
    for (const upgradeName of Object.values(UpgradeName)) {
        corporationUpgradeLevels[upgradeName] = ns.corporation.getUpgradeLevel(upgradeName);
    }
    return corporationUpgradeLevels;
}
function getDivisionResearches(ns, divisionName) {
    const divisionResearches = {
        [ResearchName.HI_TECH_RND_LABORATORY]: false,
        [ResearchName.AUTO_BREW]: false,
        [ResearchName.AUTO_PARTY]: false,
        [ResearchName.AUTO_DRUG]: false,
        [ResearchName.CPH4_INJECT]: false,
        [ResearchName.DRONES]: false,
        [ResearchName.DRONES_ASSEMBLY]: false,
        [ResearchName.DRONES_TRANSPORT]: false,
        [ResearchName.GO_JUICE]: false,
        [ResearchName.HR_BUDDY_RECRUITMENT]: false,
        [ResearchName.HR_BUDDY_TRAINING]: false,
        [ResearchName.MARKET_TA_1]: false,
        [ResearchName.MARKET_TA_2]: false,
        [ResearchName.OVERCLOCK]: false,
        [ResearchName.SELF_CORRECTING_ASSEMBLERS]: false,
        [ResearchName.STIMU]: false,
        [ResearchName.UPGRADE_CAPACITY_1]: false,
        [ResearchName.UPGRADE_CAPACITY_2]: false,
        [ResearchName.UPGRADE_DASHBOARD]: false,
        [ResearchName.UPGRADE_FULCRUM]: false,
    };
    for (const researchName of Object.values(ResearchName)) {
        divisionResearches[researchName] = ns.corporation.hasResearched(divisionName, researchName);
    }
    return divisionResearches;
}
/** @param {NS} ns */
async function createDivision(ns, divisionName, officeSize, warehouseLevel) {
    if (!hasDivision(ns, divisionName)) {
        let industryType;
        switch (divisionName) {
            case "Agriculture" /* AGRICULTURE */:
                industryType = IndustryType.AGRICULTURE;
                break;
            case "Chemical" /* CHEMICAL */:
                industryType = IndustryType.CHEMICAL;
                break;
            case "Tobacco" /* TOBACCO */:
                industryType = IndustryType.TOBACCO;
                break;
            default:
                throw new Error(`Invalid division name: ${divisionName}`);
        }
        ns.corporation.expandIndustry(industryType, divisionName);
    }
    const division = ns.corporation.getDivision(divisionName);
    ns.print(`Initializing division: ${divisionName}`);
    for (const city of cities) {
        if (!division.cities.includes(city)) {
            ns.corporation.expandCity(divisionName, city);
            ns.print(`Expand ${divisionName} to ${city}`);
        }
        if (!ns.corporation.hasWarehouse(divisionName, city)) {
            ns.corporation.purchaseWarehouse(divisionName, city);
        }
    }
    upgradeOffices(
        ns,
        divisionName,
        generateOfficeSetups(cities, officeSize, [
            {
                name: EmployeePosition.RESEARCH_DEVELOPMENT,
                count: officeSize,
            },
        ]),
    );
    for (const city of cities) {
        upgradeWarehouse(ns, divisionName, city, warehouseLevel);
        if (ns.corporation.hasUnlock(UnlockName.SMART_SUPPLY)) {
            ns.corporation.setSmartSupply(divisionName, city, true);
        }
    }
    return ns.corporation.getDivision(divisionName);
}
function getOptimalBoostMaterialQuantities(industryData, spaceConstraint, round = true) {
    const { aiCoreFactor, hardwareFactor, realEstateFactor, robotFactor } = industryData;
    const boostMaterialCoefficients = [aiCoreFactor, hardwareFactor, realEstateFactor, robotFactor];
    const boostMaterialSizes = boostMaterials.map((mat) => CorpMaterialsData[mat].size);
    const calculateOptimalQuantities = (matCoefficients, matSizes) => {
        const sumOfCoefficients = matCoefficients.reduce((a, b) => a + b, 0);
        const sumOfSizes = matSizes.reduce((a, b) => a + b, 0);
        const result = [];
        for (let i = 0; i < matSizes.length; ++i) {
            let matCount =
                (spaceConstraint -
                    500 *
                        ((matSizes[i] / matCoefficients[i]) * (sumOfCoefficients - matCoefficients[i]) -
                            (sumOfSizes - matSizes[i]))) /
                (sumOfCoefficients / matCoefficients[i]) /
                matSizes[i];
            if (matCoefficients[i] <= 0 || matCount < 0) {
                return calculateOptimalQuantities(matCoefficients.toSpliced(i, 1), matSizes.toSpliced(i, 1)).toSpliced(
                    i,
                    0,
                    0,
                );
            } else {
                if (round) {
                    matCount = Math.round(matCount);
                }
                result.push(matCount);
            }
        }
        return result;
    };
    return calculateOptimalQuantities(boostMaterialCoefficients, boostMaterialSizes);
}
function getExportRoutes(ns) {
    const exportRoutes = [];
    for (const material of materials) {
        loopAllDivisionsAndCities(ns, (divisionName, sourceCity) => {
            const exports = ns.corporation.getMaterial(divisionName, sourceCity, material).exports;
            if (exports.length === 0) {
                return;
            }
            for (const exportRoute of exports) {
                exportRoutes.push({
                    material,
                    sourceCity,
                    sourceDivision: divisionName,
                    destinationDivision: exportRoute.division,
                    destinationCity: exportRoute.city,
                    destinationAmount: exportRoute.amount,
                });
            }
        });
    }
    return exportRoutes;
}
function buildSmartSupplyKey(divisionName, city) {
    return `${divisionName}|${city}`;
}
function getRawProduction(ns, division, city, isProduct2) {
    const office = ns.corporation.getOffice(division.name, city);
    let rawProduction = getDivisionRawProduction(
        isProduct2,
        {
            operationsProduction: office.employeeProductionByJob.Operations,
            engineerProduction: office.employeeProductionByJob.Engineer,
            managementProduction: office.employeeProductionByJob.Management,
        },
        division.productionMult,
        getCorporationUpgradeLevels(ns),
        getDivisionResearches(ns, division.name),
    );
    rawProduction = rawProduction * 10;
    return rawProduction;
}
function getLimitedRawProduction(ns, division, city, industrialData, warehouse, isProduct2, productSize) {
    let rawProduction = getRawProduction(ns, division, city, isProduct2);
    let requiredStorageSpaceOfEachOutputUnit = 0;
    if (isProduct2) {
        requiredStorageSpaceOfEachOutputUnit += productSize;
    } else {
        for (const outputMaterialName of industrialData.producedMaterials) {
            requiredStorageSpaceOfEachOutputUnit += ns.corporation.getMaterialData(outputMaterialName).size;
        }
    }
    for (const [requiredMaterialName, requiredMaterialCoefficient] of getRecordEntries(
        industrialData.requiredMaterials,
    )) {
        requiredStorageSpaceOfEachOutputUnit -=
            ns.corporation.getMaterialData(requiredMaterialName).size * requiredMaterialCoefficient;
    }
    if (requiredStorageSpaceOfEachOutputUnit > 0) {
        const maxNumberOfOutputUnits = Math.floor(
            (warehouse.size - warehouse.sizeUsed) / requiredStorageSpaceOfEachOutputUnit,
        );
        rawProduction = Math.min(rawProduction, maxNumberOfOutputUnits);
    }
    rawProduction = Math.max(rawProduction, 0);
    return rawProduction;
}
function setSmartSupplyData(ns) {
    if (ns.corporation.getCorporation().prevState !== CorpState.PURCHASE) {
        return;
    }
    loopAllDivisionsAndCities(ns, (divisionName, city) => {
        const division = ns.corporation.getDivision(divisionName);
        const industrialData = ns.corporation.getIndustryData(division.type);
        const warehouse = ns.corporation.getWarehouse(division.name, city);
        let totalRawProduction = 0;
        if (industrialData.makesMaterials) {
            totalRawProduction += getLimitedRawProduction(ns, division, city, industrialData, warehouse, false);
        }
        if (industrialData.makesProducts) {
            for (const productName of division.products) {
                const product = ns.corporation.getProduct(divisionName, city, productName);
                if (product.developmentProgress < 100) {
                    continue;
                }
                totalRawProduction += getLimitedRawProduction(
                    ns,
                    division,
                    city,
                    industrialData,
                    warehouse,
                    true,
                    product.size,
                );
            }
        }
        smartSupplyData.set(buildSmartSupplyKey(divisionName, city), totalRawProduction);
    });
}
function detectWarehouseCongestion(ns, division, industrialData, city, warehouseCongestionData) {
    const requiredMaterials = getRecordEntries(industrialData.requiredMaterials);
    let isWarehouseCongested = false;
    const warehouseCongestionDataKey = `${division.name}|${city}`;
    const items = [];
    if (industrialData.producedMaterials) {
        for (const materialName of industrialData.producedMaterials) {
            items.push(ns.corporation.getMaterial(division.name, city, materialName));
        }
    }
    if (industrialData.makesProducts) {
        for (const productName of division.products) {
            const product = ns.corporation.getProduct(division.name, city, productName);
            if (product.developmentProgress < 100) {
                continue;
            }
            items.push(product);
        }
    }
    for (const item of items) {
        if (item.productionAmount !== 0) {
            warehouseCongestionData.set(warehouseCongestionDataKey, 0);
            continue;
        }
        let numberOfCongestionTimes = warehouseCongestionData.get(warehouseCongestionDataKey) + 1;
        if (Number.isNaN(numberOfCongestionTimes)) {
            numberOfCongestionTimes = 0;
        }
        warehouseCongestionData.set(warehouseCongestionDataKey, numberOfCongestionTimes);
        break;
    }
    if (warehouseCongestionData.get(warehouseCongestionDataKey) > 5) {
        isWarehouseCongested = true;
    }
    if (isWarehouseCongested) {
        showWarning(ns, `Warehouse may be congested. Division: ${division.name}, city: ${city}.`);
        for (const [materialName] of requiredMaterials) {
            ns.corporation.buyMaterial(division.name, city, materialName, 0);
            ns.corporation.sellMaterial(division.name, city, materialName, "MAX", "0");
        }
        warehouseCongestionData.set(warehouseCongestionDataKey, 0);
    } else {
        for (const [materialName] of requiredMaterials) {
            const material = ns.corporation.getMaterial(division.name, city, materialName);
            if (material.desiredSellAmount !== 0) {
                ns.corporation.sellMaterial(division.name, city, materialName, "0", "0");
            }
        }
    }
    return isWarehouseCongested;
}
function buyOptimalAmountOfInputMaterials(ns, warehouseCongestionData) {
    if (ns.corporation.getCorporation().nextState !== "PURCHASE") {
        return;
    }
    loopAllDivisionsAndCities(ns, (divisionName, city) => {
        const division = ns.corporation.getDivision(divisionName);
        const industrialData = ns.corporation.getIndustryData(division.type);
        const office = ns.corporation.getOffice(division.name, city);
        const requiredMaterials = getRecordEntries(industrialData.requiredMaterials);
        let isWarehouseCongested = false;
        if (
            !setOfDivisionsWaitingForRP.has(divisionName) &&
            office.employeeJobs["Research & Development"] !== office.numEmployees
        ) {
            isWarehouseCongested = detectWarehouseCongestion(
                ns,
                division,
                industrialData,
                city,
                warehouseCongestionData,
            );
        }
        if (isWarehouseCongested) {
            return;
        }
        const warehouse = ns.corporation.getWarehouse(division.name, city);
        const inputMaterials = {};
        for (const [materialName, materialCoefficient] of requiredMaterials) {
            inputMaterials[materialName] = {
                requiredQuantity: 0,
                coefficient: materialCoefficient,
            };
        }
        for (const inputMaterialData of Object.values(inputMaterials)) {
            const requiredQuantity =
                (smartSupplyData.get(buildSmartSupplyKey(divisionName, city)) ?? 0) * inputMaterialData.coefficient;
            inputMaterialData.requiredQuantity += requiredQuantity;
        }
        for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
            const materialData = ns.corporation.getMaterialData(materialName);
            const maxAcceptableQuantity = Math.floor((warehouse.size - warehouse.sizeUsed) / materialData.size);
            const limitedRequiredQuantity = Math.min(inputMaterialData.requiredQuantity, maxAcceptableQuantity);
            if (limitedRequiredQuantity > 0) {
                inputMaterialData.requiredQuantity = limitedRequiredQuantity;
            }
        }
        let leastAmountOfOutputUnits = Number.MAX_VALUE;
        for (const { requiredQuantity, coefficient } of Object.values(inputMaterials)) {
            const amountOfOutputUnits = requiredQuantity / coefficient;
            if (amountOfOutputUnits < leastAmountOfOutputUnits) {
                leastAmountOfOutputUnits = amountOfOutputUnits;
            }
        }
        for (const inputMaterialData of Object.values(inputMaterials)) {
            inputMaterialData.requiredQuantity = leastAmountOfOutputUnits * inputMaterialData.coefficient;
        }
        let requiredSpace = 0;
        for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
            requiredSpace += inputMaterialData.requiredQuantity * ns.corporation.getMaterialData(materialName).size;
        }
        const freeSpace = warehouse.size - warehouse.sizeUsed;
        if (requiredSpace > freeSpace) {
            const constrainedStorageSpaceMultiplier = freeSpace / requiredSpace;
            for (const inputMaterialData of Object.values(inputMaterials)) {
                inputMaterialData.requiredQuantity = Math.floor(
                    inputMaterialData.requiredQuantity * constrainedStorageSpaceMultiplier,
                );
            }
        }
        for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
            const material = ns.corporation.getMaterial(divisionName, city, materialName);
            inputMaterialData.requiredQuantity = Math.max(0, inputMaterialData.requiredQuantity - material.stored);
        }
        for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
            ns.corporation.buyMaterial(divisionName, city, materialName, inputMaterialData.requiredQuantity / 10);
        }
    });
}
async function findOptimalAmountOfBoostMaterials(ns, divisionName, industryData, city, useWarehouseSize, ratio) {
    const warehouseSize = ns.corporation.getWarehouse(divisionName, city).size;
    if (useWarehouseSize) {
        return getOptimalBoostMaterialQuantities(industryData, warehouseSize * ratio);
    }
    await waitUntilAfterStateHappens(ns, CorpState.PRODUCTION);
    const availableSpace =
        ns.corporation.getWarehouse(divisionName, city).size - ns.corporation.getWarehouse(divisionName, city).sizeUsed;
    return getOptimalBoostMaterialQuantities(industryData, availableSpace * ratio);
}
async function waitUntilHavingEnoughResearchPoints(ns, conditions) {
    ns.print(`Waiting for research points: ${JSON.stringify(conditions)}`);
    while (true) {
        let finish = true;
        for (const condition of conditions) {
            if (ns.corporation.getDivision(condition.divisionName).researchPoints >= condition.researchPoint) {
                setOfDivisionsWaitingForRP.delete(condition.divisionName);
                continue;
            }
            setOfDivisionsWaitingForRP.add(condition.divisionName);
            finish = false;
        }
        if (finish) {
            break;
        }
        await ns.corporation.nextUpdate();
    }
    ns.print(`Finished waiting for research points. Conditions: ${JSON.stringify(conditions)}`);
}
function getProductIdArray(ns, divisionName) {
    const products = ns.corporation.getDivision(divisionName).products;
    return products
        .map((productName) => {
            const productNameParts = productName.split("-");
            if (productNameParts.length != 3) {
                return NaN;
            }
            return parseNumber(productNameParts[1]);
        })
        .filter((productIndex) => !Number.isNaN(productIndex));
}
function generateNextProductName(ns, divisionName, productDevelopmentBudget) {
    if (!Number.isFinite(productDevelopmentBudget) || productDevelopmentBudget < 1e3) {
        throw new Error(`Invalid budget: ${productDevelopmentBudget}`);
    }
    const productIdArray = getProductIdArray(ns, divisionName);
    if (productIdArray.length === 0) {
        return `${divisionName}-00000-${productDevelopmentBudget.toExponential(5)}`;
    }
    return `${divisionName}-${(Math.max(...productIdArray) + 1).toString().padStart(5, "0")}-${productDevelopmentBudget.toExponential(5)}`;
}
function getMaxNumberOfProducts(ns, divisionName) {
    let maxNumberOfProducts = 3;
    if (ns.corporation.hasResearched(divisionName, ResearchName.UPGRADE_CAPACITY_1)) {
        maxNumberOfProducts = 4;
    }
    if (ns.corporation.hasResearched(divisionName, ResearchName.UPGRADE_CAPACITY_2)) {
        maxNumberOfProducts = 5;
    }
    return maxNumberOfProducts;
}
function developNewProduct(ns, divisionName, mainProductDevelopmentCity, productDevelopmentBudget) {
    const products = ns.corporation.getDivision(divisionName).products;
    let hasDevelopingProduct = false;
    let bestProduct = null;
    let worstProduct = null;
    let maxProductRating = Number.MIN_VALUE;
    let minProductRating = Number.MAX_VALUE;
    for (const productName2 of products) {
        const product = ns.corporation.getProduct(divisionName, mainProductDevelopmentCity, productName2);
        if (product.developmentProgress < 100) {
            hasDevelopingProduct = true;
            break;
        }
        const productRating = product.rating;
        if (productRating < minProductRating) {
            worstProduct = product;
            minProductRating = productRating;
        }
        if (productRating > maxProductRating) {
            bestProduct = product;
            maxProductRating = productRating;
        }
    }
    if (hasDevelopingProduct) {
        return null;
    }
    if (!bestProduct && products.length > 0) {
        throw new Error("Cannot find the best product");
    }
    if (!worstProduct && products.length > 0) {
        throw new Error("Cannot find the worst product to discontinue");
    }
    if (bestProduct) {
        const bestProductBudget = bestProduct.designInvestment + bestProduct.advertisingInvestment;
        if (productDevelopmentBudget < bestProductBudget * 0.5 && products.length >= 3) {
            const warningMessage = `Budget for new product is too low: ${ns.formatNumber(productDevelopmentBudget)}. Current best product's budget: ${ns.formatNumber(bestProductBudget)}`;
            showWarning(ns, warningMessage);
        }
    }
    if (worstProduct && products.length === getMaxNumberOfProducts(ns, divisionName)) {
        ns.corporation.discontinueProduct(divisionName, worstProduct.name);
    }
    const productName = generateNextProductName(ns, divisionName, productDevelopmentBudget);
    ns.corporation.makeProduct(
        divisionName,
        mainProductDevelopmentCity,
        productName,
        productDevelopmentBudget / 2,
        productDevelopmentBudget / 2,
    );
    return productName;
}
function getNewestProductName(ns, divisionName) {
    const products = ns.corporation.getDivision(divisionName).products;
    if (products.length === 0) {
        return null;
    }
    return products[products.length - 1];
}
async function calculateProductMarkup(divisionRP, industryScienceFactor, product, employeeProductionByJob) {
    const designInvestmentMultiplier = 1 + Math.pow(product.designInvestment, 0.1) / 100;
    const researchPointMultiplier = 1 + Math.pow(divisionRP, industryScienceFactor) / 800;
    const k = designInvestmentMultiplier * researchPointMultiplier;
    const balanceMultiplier = function (
        creationJobFactorsEngineer,
        creationJobFactorsManagement,
        creationJobFactorsRnD,
        creationJobFactorsOperations,
        creationJobFactorsBusiness,
    ) {
        const totalCreationJobFactors2 =
            creationJobFactorsEngineer +
            creationJobFactorsManagement +
            creationJobFactorsRnD +
            creationJobFactorsOperations +
            creationJobFactorsBusiness;
        const engineerRatio = creationJobFactorsEngineer / totalCreationJobFactors2;
        const managementRatio2 = creationJobFactorsManagement / totalCreationJobFactors2;
        const researchAndDevelopmentRatio = creationJobFactorsRnD / totalCreationJobFactors2;
        const operationsRatio = creationJobFactorsOperations / totalCreationJobFactors2;
        const businessRatio2 = creationJobFactorsBusiness / totalCreationJobFactors2;
        return (
            1.2 * engineerRatio +
            0.9 * managementRatio2 +
            1.3 * researchAndDevelopmentRatio +
            1.5 * operationsRatio +
            businessRatio2
        );
    };
    const f1 = function ([
        creationJobFactorsEngineer,
        creationJobFactorsManagement,
        creationJobFactorsRnD,
        creationJobFactorsOperations,
        creationJobFactorsBusiness,
    ]) {
        return (
            k *
                balanceMultiplier(
                    creationJobFactorsEngineer,
                    creationJobFactorsManagement,
                    creationJobFactorsRnD,
                    creationJobFactorsOperations,
                    creationJobFactorsBusiness,
                ) *
                (0.1 * creationJobFactorsEngineer +
                    0.05 * creationJobFactorsManagement +
                    0.05 * creationJobFactorsRnD +
                    0.02 * creationJobFactorsOperations +
                    0.02 * creationJobFactorsBusiness) -
            product.stats.quality
        );
    };
    const f2 = function ([
        creationJobFactorsEngineer,
        creationJobFactorsManagement,
        creationJobFactorsRnD,
        creationJobFactorsOperations,
        creationJobFactorsBusiness,
    ]) {
        return (
            k *
                balanceMultiplier(
                    creationJobFactorsEngineer,
                    creationJobFactorsManagement,
                    creationJobFactorsRnD,
                    creationJobFactorsOperations,
                    creationJobFactorsBusiness,
                ) *
                (0.15 * creationJobFactorsEngineer +
                    0.02 * creationJobFactorsManagement +
                    0.02 * creationJobFactorsRnD +
                    0.02 * creationJobFactorsOperations +
                    0.02 * creationJobFactorsBusiness) -
            product.stats.performance
        );
    };
    const f3 = function ([
        creationJobFactorsEngineer,
        creationJobFactorsManagement,
        creationJobFactorsRnD,
        creationJobFactorsOperations,
        creationJobFactorsBusiness,
    ]) {
        return (
            k *
                balanceMultiplier(
                    creationJobFactorsEngineer,
                    creationJobFactorsManagement,
                    creationJobFactorsRnD,
                    creationJobFactorsOperations,
                    creationJobFactorsBusiness,
                ) *
                (0.05 * creationJobFactorsEngineer +
                    0.02 * creationJobFactorsManagement +
                    0.08 * creationJobFactorsRnD +
                    0.05 * creationJobFactorsOperations +
                    0.05 * creationJobFactorsBusiness) -
            product.stats.durability
        );
    };
    const f4 = function ([
        creationJobFactorsEngineer,
        creationJobFactorsManagement,
        creationJobFactorsRnD,
        creationJobFactorsOperations,
        creationJobFactorsBusiness,
    ]) {
        return (
            k *
                balanceMultiplier(
                    creationJobFactorsEngineer,
                    creationJobFactorsManagement,
                    creationJobFactorsRnD,
                    creationJobFactorsOperations,
                    creationJobFactorsBusiness,
                ) *
                (0.02 * creationJobFactorsEngineer +
                    0.08 * creationJobFactorsManagement +
                    0.02 * creationJobFactorsRnD +
                    0.05 * creationJobFactorsOperations +
                    0.08 * creationJobFactorsBusiness) -
            product.stats.reliability
        );
    };
    const f5 = function ([
        creationJobFactorsEngineer,
        creationJobFactorsManagement,
        creationJobFactorsRnD,
        creationJobFactorsOperations,
        creationJobFactorsBusiness,
    ]) {
        return (
            k *
                balanceMultiplier(
                    creationJobFactorsEngineer,
                    creationJobFactorsManagement,
                    creationJobFactorsRnD,
                    creationJobFactorsOperations,
                    creationJobFactorsBusiness,
                ) *
                (0.08 * creationJobFactorsManagement +
                    0.05 * creationJobFactorsRnD +
                    0.02 * creationJobFactorsOperations +
                    0.1 * creationJobFactorsBusiness) -
            product.stats.aesthetics
        );
    };
    let solverResult = {
        success: false,
        message: "",
        x: [],
        report: "string",
    };
    const solver = new Ceres();
    await solver.promise.then(function () {
        solver.add_function(f1);
        solver.add_function(f2);
        solver.add_function(f3);
        solver.add_function(f4);
        solver.add_function(f5);
        let guess = [1, 1, 1, 1, 1];
        if (employeeProductionByJob) {
            guess = [
                employeeProductionByJob.engineerProduction,
                employeeProductionByJob.managementProduction,
                employeeProductionByJob.researchAndDevelopmentProduction,
                employeeProductionByJob.operationsProduction,
                employeeProductionByJob.businessProduction,
            ];
        }
        solverResult = solver.solve(guess);
        solver.remove();
    });
    if (!solverResult.success) {
        throw new Error(`ERROR: Cannot find hidden stats of product: ${JSON.stringify(product)}`);
    }
    const totalCreationJobFactors =
        solverResult.x[0] + solverResult.x[1] + solverResult.x[2] + solverResult.x[3] + solverResult.x[4];
    const managementRatio = solverResult.x[1] / totalCreationJobFactors;
    const businessRatio = solverResult.x[4] / totalCreationJobFactors;
    const advertisingInvestmentMultiplier = 1 + Math.pow(product.advertisingInvestment, 0.1) / 100;
    const businessManagementRatio = Math.max(businessRatio + managementRatio, 1 / totalCreationJobFactors);
    return (
        100 / (advertisingInvestmentMultiplier * Math.pow(product.stats.quality + 1e-3, 0.65) * businessManagementRatio)
    );
}
function isProduct(item) {
    return "rating" in item;
}
function validateProductMarkupMap(ns) {
    for (const productKey of productMarkupData.keys()) {
        const productKeyInfo = productKey.split("|");
        const divisionName = productKeyInfo[0];
        const productName = productKeyInfo[2];

        // Check if division exists before trying to access it
        if (!hasDivision(ns, divisionName)) {
            productMarkupData.delete(productKey);
            continue;
        }

        const division = ns.corporation.getDivision(divisionName);
        if (!division.products.includes(productName)) {
            productMarkupData.delete(productKey);
        }
    }
}
async function getProductMarkup(division, industryData, city, item, office) {
    let productMarkup;
    const productMarkupKey = `${division.name}|${city}|${item.name}`;
    productMarkup = productMarkupData.get(productMarkupKey);
    if (!productMarkup) {
        productMarkup = await calculateProductMarkup(
            division.researchPoints,
            industryData.scienceFactor,
            item,
            office
                ? {
                      operationsProduction: office.employeeProductionByJob.Operations,
                      engineerProduction: office.employeeProductionByJob.Engineer,
                      businessProduction: office.employeeProductionByJob.Business,
                      managementProduction: office.employeeProductionByJob.Management,
                      researchAndDevelopmentProduction: office.employeeProductionByJob["Research & Development"],
                  }
                : void 0,
        );
        productMarkupData.set(productMarkupKey, productMarkup);
    }
    return productMarkup;
}
async function getOptimalSellingPrice(ns, division, industryData, city, item) {
    const itemIsProduct = isProduct(item);
    if (itemIsProduct && item.developmentProgress < 100) {
        throw new Error(`Product is not finished. Product: ${JSON.stringify(item)}`);
    }
    if (!ns.corporation.hasUnlock(UnlockName.MARKET_RESEARCH_DEMAND)) {
        throw new Error(`You must unlock "Market Research - Demand"`);
    }
    if (!ns.corporation.hasUnlock(UnlockName.MARKET_DATA_COMPETITION)) {
        throw new Error(`You must unlock "Market Data - Competition"`);
    }
    if (ns.corporation.getCorporation().nextState !== "SALE") {
        return "0";
    }
    const expectedSalesVolume = item.stored / 10;
    if (expectedSalesVolume < 1e-5) {
        return "0";
    }
    const office = ns.corporation.getOffice(division.name, city);
    let productMarkup;
    let markupLimit;
    let itemMultiplier;
    let marketPrice;
    if (itemIsProduct) {
        productMarkup = await getProductMarkup(division, industryData, city, item, office);
        markupLimit = Math.max(item.effectiveRating, 1e-3) / productMarkup;
        itemMultiplier = 0.5 * Math.pow(item.effectiveRating, 0.65);
        marketPrice = item.productionCost;
    } else {
        markupLimit = item.quality / ns.corporation.getMaterialData(item.name).baseMarkup;
        itemMultiplier = item.quality + 1e-3;
        marketPrice = item.marketPrice;
    }
    const businessFactor = getBusinessFactor(office.employeeProductionByJob[EmployeePosition.BUSINESS]);
    const advertisingFactor = getAdvertisingFactors(
        division.awareness,
        division.popularity,
        industryData.advertisingFactor,
    )[0];
    const marketFactor = getMarketFactor(item.demand, item.competition);
    const salesMultipliers =
        itemMultiplier *
        businessFactor *
        advertisingFactor *
        marketFactor *
        getUpgradeBenefit(UpgradeName.ABC_SALES_BOTS, ns.corporation.getUpgradeLevel(UpgradeName.ABC_SALES_BOTS)) *
        getResearchSalesMultiplier(getDivisionResearches(ns, division.name));
    const optimalPrice = markupLimit / Math.sqrt(expectedSalesVolume / salesMultipliers) + marketPrice;
    return optimalPrice.toString();
}
async function setOptimalSellingPriceForEverything(ns) {
    if (ns.corporation.getCorporation().nextState !== "SALE") {
        return;
    }
    if (
        !ns.corporation.hasUnlock(UnlockName.MARKET_RESEARCH_DEMAND) ||
        !ns.corporation.hasUnlock(UnlockName.MARKET_DATA_COMPETITION)
    ) {
        return;
    }
    await loopAllDivisionsAndCitiesAsyncCallback(ns, async (divisionName, city) => {
        const division = ns.corporation.getDivision(divisionName);
        const industryData = ns.corporation.getIndustryData(division.type);
        const products = division.products;
        const hasMarketTA2 = ns.corporation.hasResearched(divisionName, ResearchName.MARKET_TA_2);
        if (industryData.makesProducts) {
            for (const productName of products) {
                const product = ns.corporation.getProduct(divisionName, city, productName);
                if (product.developmentProgress < 100) {
                    continue;
                }
                if (hasMarketTA2) {
                    ns.corporation.setProductMarketTA2(divisionName, productName, true);
                    continue;
                }
                const optimalPrice = await getOptimalSellingPrice(ns, division, industryData, city, product);
                if (parseNumber(optimalPrice) > 0) {
                    ns.corporation.sellProduct(divisionName, city, productName, "MAX", optimalPrice, false);
                }
            }
        }
        if (industryData.makesMaterials) {
            for (const materialName of industryData.producedMaterials) {
                const material = ns.corporation.getMaterial(divisionName, city, materialName);
                if (hasMarketTA2) {
                    ns.corporation.setMaterialMarketTA2(divisionName, city, materialName, true);
                    continue;
                }
                const optimalPrice = await getOptimalSellingPrice(ns, division, industryData, city, material);
                if (parseNumber(optimalPrice) > 0) {
                    ns.corporation.sellMaterial(divisionName, city, materialName, "MAX", optimalPrice);
                }
            }
        }
    });
}
function getResearchPointGainRate(ns, divisionName) {
    let totalGainRate = 0;
    for (const city of cities) {
        const office = ns.corporation.getOffice(divisionName, city);
        totalGainRate +=
            4 *
            4e-3 *
            Math.pow(office.employeeProductionByJob[EmployeePosition.RESEARCH_DEVELOPMENT], 0.5) *
            getUpgradeBenefit(
                UpgradeName.PROJECT_INSIGHT,
                ns.corporation.getUpgradeLevel(UpgradeName.PROJECT_INSIGHT),
            ) *
            getResearchRPMultiplier(getDivisionResearches(ns, divisionName));
    }
    return totalGainRate;
}
async function buyBoostMaterials(ns, division) {
    const funds = ns.corporation.getCorporation().funds;
    if (funds < 1e10) {
        throw new Error(`Funds is too small to buy boost materials. Funds: ${ns.formatNumber(funds)}.`);
    }
    const industryData = ns.corporation.getIndustryData(division.type);
    let reservedSpaceRatio = 0.2;
    const ratio = 0.1;
    if (industryData.makesProducts) {
        reservedSpaceRatio = 0.1;
    }
    let totalBoostMaterialsCount = 0;
    let count = 0;
    while (true) {
        await waitForNextTimeStateHappens(ns, CorpState.EXPORT);
        if (count === 20) {
            const warningMessage = `It takes too many cycles to buy boost materials. Division: ${division.name}.`;
            showWarning(ns, warningMessage);
            break;
        }
        let finish = true;
        const orders = [];
        for (const city of cities) {
            const warehouse = ns.corporation.getWarehouse(division.name, city);
            const availableSpace = warehouse.size - warehouse.sizeUsed;
            if (availableSpace < warehouse.size * reservedSpaceRatio) {
                continue;
            }
            let effectiveRatio = ratio;
            if (
                (availableSpace / warehouse.size < 0.5 && division.type === IndustryType.AGRICULTURE) ||
                (availableSpace / warehouse.size < 0.75 &&
                    (division.type === IndustryType.CHEMICAL || division.type === IndustryType.TOBACCO))
            ) {
                effectiveRatio = 0.2;
            }
            const boostMaterialQuantities = getOptimalBoostMaterialQuantities(
                industryData,
                availableSpace * effectiveRatio,
            );
            orders.push({
                city,
                materials: [
                    {
                        name: MaterialName.AI_CORES,
                        count:
                            ns.corporation.getMaterial(division.name, city, MaterialName.AI_CORES).stored +
                            boostMaterialQuantities[0],
                    },
                    {
                        name: MaterialName.HARDWARE,
                        count:
                            ns.corporation.getMaterial(division.name, city, MaterialName.HARDWARE).stored +
                            boostMaterialQuantities[1],
                    },
                    {
                        name: MaterialName.REAL_ESTATE,
                        count:
                            ns.corporation.getMaterial(division.name, city, MaterialName.REAL_ESTATE).stored +
                            boostMaterialQuantities[2],
                    },
                    {
                        name: MaterialName.ROBOTS,
                        count:
                            ns.corporation.getMaterial(division.name, city, MaterialName.ROBOTS).stored +
                            boostMaterialQuantities[3],
                    },
                ],
            });
            totalBoostMaterialsCount += boostMaterialQuantities.reduce((a, b) => a + b, 0);
            finish = false;
        }
        if (finish) {
            break;
        }
        await stockMaterials(ns, division.name, orders, true);
        ++count;
    }
    return totalBoostMaterialsCount;
}
function getProductMarketPrice(ns, division, industryData, city) {
    let productMarketPrice = 0;
    for (const [materialName, materialCoefficient] of getRecordEntries(industryData.requiredMaterials)) {
        const materialMarketPrice = ns.corporation.getMaterial(division.name, city, materialName).marketPrice;
        productMarketPrice += materialMarketPrice * materialCoefficient;
    }
    return productMarketPrice * productMarketPriceMultiplier;
}
function createDummyDivisions(ns, numberOfDivisions) {
    const divisions = ns.corporation.getCorporation().divisions;
    for (let i = 0; i < numberOfDivisions; i++) {
        const dummyDivisionName = dummyDivisionNamePrefix + i.toString().padStart(2, "0");
        if (divisions.includes(dummyDivisionName)) {
            continue;
        }
        ns.corporation.expandIndustry(IndustryType.RESTAURANT, dummyDivisionName);
        const division = ns.corporation.getDivision(dummyDivisionName);
        for (const city of cities) {
            if (!division.cities.includes(city)) {
                ns.corporation.expandCity(dummyDivisionName, city);
            }
            if (!ns.corporation.hasWarehouse(dummyDivisionName, city)) {
                ns.corporation.purchaseWarehouse(dummyDivisionName, city);
            }
        }
    }
}
async function waitForOffer(ns, numberOfInitCycles, maxAdditionalCycles, expectedOffer) {
    await waitForNumberOfCycles(ns, numberOfInitCycles);
    let offer = ns.corporation.getInvestmentOffer().funds;
    for (let i = 0; i < maxAdditionalCycles; i++) {
        await waitForNumberOfCycles(ns, 1);
        console.log(`Offer: ${ns.formatNumber(ns.corporation.getInvestmentOffer().funds)}`);
        if (ns.corporation.getInvestmentOffer().funds < offer * 1.001) {
            break;
        }
        offer = ns.corporation.getInvestmentOffer().funds;
    }
    if (ns.corporation.getInvestmentOffer().funds < expectedOffer) {
        ns.alert(
            `Offer is lower than expected value. Offer: ${ns.formatNumber(ns.corporation.getInvestmentOffer().funds)}. Expected value: ${ns.formatNumber(expectedOffer)}.`,
        );
    }
}
export {
    DivisionName,
    Logger,
    assignJobs,
    boostMaterials,
    buyAdvert,
    buyBoostMaterials,
    buyOptimalAmountOfInputMaterials,
    buyTeaAndThrowParty,
    buyTeaAndThrowPartyForAllDivisions,
    buyUnlock,
    buyUpgrade,
    calculateProductMarkup,
    cities,
    clearPurchaseOrders,
    createDivision,
    createDummyDivisions,
    developNewProduct,
    dummyDivisionNamePrefix,
    exportString,
    findOptimalAmountOfBoostMaterials,
    generateMaterialsOrders,
    generateNextProductName,
    generateOfficeSetups,
    generateOfficeSetupsForEarlyRounds,
    getCorporationUpgradeLevels,
    getDivisionResearches,
    getExportRoutes,
    getLimitedRawProduction,
    getNewestProductName,
    getOptimalBoostMaterialQuantities,
    getOptimalSellingPrice,
    getProductIdArray,
    getProductMarketPrice,
    getProductMarkup,
    getProfit,
    getRawProduction,
    getResearchPointGainRate,
    hasDivision,
    isProduct,
    loopAllDivisionsAndCities,
    loopAllDivisionsAndCitiesAsyncCallback,
    materials,
    researchPrioritiesForProductDivision,
    researchPrioritiesForSupportDivision,
    sampleProductName,
    setOptimalSellingPriceForEverything,
    setSmartSupplyData,
    showWarning,
    stockMaterials,
    upgradeOffices,
    upgradeWarehouse,
    validateProductMarkupMap,
    waitForNextTimeStateHappens,
    waitForNumberOfCycles,
    waitForOffer,
    waitUntilAfterStateHappens,
    waitUntilHavingEnoughResearchPoints,
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2NvcnBvcmF0aW9uVXRpbHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gICAgQ29ycEluZHVzdHJ5RGF0YSxcbiAgICBDb3JwTWF0ZXJpYWxOYW1lLFxuICAgIERpdmlzaW9uLFxuICAgIE1hdGVyaWFsLFxuICAgIE5TLFxuICAgIE9mZmljZSxcbiAgICBQcm9kdWN0LFxuICAgIFdhcmVob3VzZVxufSBmcm9tIFwiQG5zXCI7XG5pbXBvcnQgeyBnZXRSZWNvcmRFbnRyaWVzLCBnZXRSZWNvcmRLZXlzLCBQYXJ0aWFsUmVjb3JkIH0gZnJvbSBcIi9saWJzL1JlY29yZFwiO1xuaW1wb3J0IHsgcGFyc2VOdW1iZXIgfSBmcm9tIFwiL2xpYnMvdXRpbHNcIjtcbmltcG9ydCB7IENlcmVzIH0gZnJvbSBcIi9saWJzL0NlcmVzXCI7XG5pbXBvcnQge1xuICAgIENlcmVzU29sdmVyUmVzdWx0LFxuICAgIENpdHlOYW1lLFxuICAgIENvcnBvcmF0aW9uVXBncmFkZUxldmVscyxcbiAgICBDb3JwU3RhdGUsXG4gICAgRGl2aXNpb25SZXNlYXJjaGVzLFxuICAgIEVtcGxveWVlUG9zaXRpb24sXG4gICAgRXhwb3J0Um91dGUsXG4gICAgZ2V0QWR2ZXJ0aXNpbmdGYWN0b3JzLFxuICAgIGdldEJ1c2luZXNzRmFjdG9yLFxuICAgIGdldERpdmlzaW9uUmF3UHJvZHVjdGlvbixcbiAgICBnZXRNYXJrZXRGYWN0b3IsXG4gICAgZ2V0UmVzZWFyY2hSUE11bHRpcGxpZXIsXG4gICAgZ2V0UmVzZWFyY2hTYWxlc011bHRpcGxpZXIsXG4gICAgZ2V0VXBncmFkZUJlbmVmaXQsXG4gICAgSW5kdXN0cnlUeXBlLFxuICAgIE1hdGVyaWFsTmFtZSxcbiAgICBNYXRlcmlhbE9yZGVyLFxuICAgIE9mZmljZVNldHVwLFxuICAgIE9mZmljZVNldHVwSm9icyxcbiAgICBwcm9kdWN0TWFya2V0UHJpY2VNdWx0aXBsaWVyLFxuICAgIFJlc2VhcmNoTmFtZSxcbiAgICBSZXNlYXJjaFByaW9yaXR5LFxuICAgIFVubG9ja05hbWUsXG4gICAgVXBncmFkZU5hbWVcbn0gZnJvbSBcIi9jb3Jwb3JhdGlvbkZvcm11bGFzXCI7XG5pbXBvcnQgeyBDb3JwTWF0ZXJpYWxzRGF0YSB9IGZyb20gXCIvZGF0YS9Db3JwTWF0ZXJpYWxzRGF0YVwiO1xuXG5leHBvcnQgZW51bSBEaXZpc2lvbk5hbWUge1xuICAgIEFHUklDVUxUVVJFID0gXCJBZ3JpY3VsdHVyZVwiLFxuICAgIENIRU1JQ0FMID0gXCJDaGVtaWNhbFwiLFxuICAgIFRPQkFDQ08gPSBcIlRvYmFjY29cIixcbn1cblxuZXhwb3J0IGNvbnN0IGNpdGllczogQ2l0eU5hbWVbXSA9IFtcbiAgICBDaXR5TmFtZS5TZWN0b3IxMixcbiAgICBDaXR5TmFtZS5BZXZ1bSxcbiAgICBDaXR5TmFtZS5DaG9uZ3FpbmcsXG4gICAgQ2l0eU5hbWUuTmV3VG9reW8sXG4gICAgQ2l0eU5hbWUuSXNoaW1hLFxuICAgIENpdHlOYW1lLlZvbGhhdmVuXG5dO1xuXG5leHBvcnQgY29uc3QgbWF0ZXJpYWxzID0gT2JqZWN0LnZhbHVlcyhNYXRlcmlhbE5hbWUpO1xuXG5leHBvcnQgY29uc3QgYm9vc3RNYXRlcmlhbHMgPSBbXG4gICAgTWF0ZXJpYWxOYW1lLkFJX0NPUkVTLFxuICAgIE1hdGVyaWFsTmFtZS5IQVJEV0FSRSxcbiAgICBNYXRlcmlhbE5hbWUuUkVBTF9FU1RBVEUsXG4gICAgTWF0ZXJpYWxOYW1lLlJPQk9UUyxcbl07XG5cbmNvbnN0IGNvc3RNdWx0aXBsaWVyRm9yRW1wbG95ZWVTdGF0c1Jlc2VhcmNoID0gNTtcbmNvbnN0IGNvc3RNdWx0aXBsaWVyRm9yUHJvZHVjdGlvblJlc2VhcmNoID0gMTA7XG5cbmV4cG9ydCBjb25zdCByZXNlYXJjaFByaW9yaXRpZXNGb3JTdXBwb3J0RGl2aXNpb246IFJlc2VhcmNoUHJpb3JpdHlbXSA9IFtcbiAgICB7IHJlc2VhcmNoOiBSZXNlYXJjaE5hbWUuSElfVEVDSF9STkRfTEFCT1JBVE9SWSwgY29zdE11bHRpcGxpZXI6IDEgfSxcbiAgICB7IHJlc2VhcmNoOiBSZXNlYXJjaE5hbWUuT1ZFUkNMT0NLLCBjb3N0TXVsdGlwbGllcjogY29zdE11bHRpcGxpZXJGb3JFbXBsb3llZVN0YXRzUmVzZWFyY2ggfSxcbiAgICB7IHJlc2VhcmNoOiBSZXNlYXJjaE5hbWUuU1RJTVUsIGNvc3RNdWx0aXBsaWVyOiBjb3N0TXVsdGlwbGllckZvckVtcGxveWVlU3RhdHNSZXNlYXJjaCB9LFxuICAgIHsgcmVzZWFyY2g6IFJlc2VhcmNoTmFtZS5BVVRPX0RSVUcsIGNvc3RNdWx0aXBsaWVyOiAxMy41IH0sXG4gICAgeyByZXNlYXJjaDogUmVzZWFyY2hOYW1lLkdPX0pVSUNFLCBjb3N0TXVsdGlwbGllcjogY29zdE11bHRpcGxpZXJGb3JFbXBsb3llZVN0YXRzUmVzZWFyY2ggfSxcbiAgICB7IHJlc2VhcmNoOiBSZXNlYXJjaE5hbWUuQ1BINF9JTkpFQ1QsIGNvc3RNdWx0aXBsaWVyOiBjb3N0TXVsdGlwbGllckZvckVtcGxveWVlU3RhdHNSZXNlYXJjaCB9LFxuXG4gICAgeyByZXNlYXJjaDogUmVzZWFyY2hOYW1lLlNFTEZfQ09SUkVDVElOR19BU1NFTUJMRVJTLCBjb3N0TXVsdGlwbGllcjogY29zdE11bHRpcGxpZXJGb3JQcm9kdWN0aW9uUmVzZWFyY2ggfSxcbiAgICB7IHJlc2VhcmNoOiBSZXNlYXJjaE5hbWUuRFJPTkVTLCBjb3N0TXVsdGlwbGllcjogNTAgfSxcbiAgICB7IHJlc2VhcmNoOiBSZXNlYXJjaE5hbWUuRFJPTkVTX0FTU0VNQkxZLCBjb3N0TXVsdGlwbGllcjogY29zdE11bHRpcGxpZXJGb3JQcm9kdWN0aW9uUmVzZWFyY2ggfSxcbiAgICB7IHJlc2VhcmNoOiBSZXNlYXJjaE5hbWUuRFJPTkVTX1RSQU5TUE9SVCwgY29zdE11bHRpcGxpZXI6IGNvc3RNdWx0aXBsaWVyRm9yUHJvZHVjdGlvblJlc2VhcmNoIH0sXG5dO1xuXG5leHBvcnQgY29uc3QgcmVzZWFyY2hQcmlvcml0aWVzRm9yUHJvZHVjdERpdmlzaW9uOiBSZXNlYXJjaFByaW9yaXR5W10gPSBbXG4gICAgLi4ucmVzZWFyY2hQcmlvcml0aWVzRm9yU3VwcG9ydERpdmlzaW9uLFxuICAgIHsgcmVzZWFyY2g6IFJlc2VhcmNoTmFtZS5VUEdSQURFX0ZVTENSVU0sIGNvc3RNdWx0aXBsaWVyOiBjb3N0TXVsdGlwbGllckZvclByb2R1Y3Rpb25SZXNlYXJjaCB9LFxuICAgIC8vIERvIG5vdCBidXkgdGhlc2UgcmVzZWFyY2hlc1xuICAgIC8vIHtyZXNlYXJjaDogUmVzZWFyY2hOYW1lLlVQR1JBREVfQ0FQQUNJVFlfMSwgY29zdE11bHRpcGxpZXI6IGNvc3RNdWx0aXBsaWVyRm9yUHJvZHVjdGlvblJlc2VhcmNofSxcbiAgICAvLyB7cmVzZWFyY2g6IFJlc2VhcmNoTmFtZS5VUEdSQURFX0NBUEFDSVRZXzIsIGNvc3RNdWx0aXBsaWVyOiBjb3N0TXVsdGlwbGllckZvclByb2R1Y3Rpb25SZXNlYXJjaH0sXG5dO1xuXG5leHBvcnQgY29uc3QgZXhwb3J0U3RyaW5nID0gXCIoSVBST0QrSUlOVi8xMCkqKC0xKVwiO1xuXG5leHBvcnQgY29uc3QgZHVtbXlEaXZpc2lvbk5hbWVQcmVmaXggPSBcInotXCI7XG5cbmV4cG9ydCBjb25zdCBzYW1wbGVQcm9kdWN0TmFtZSA9IFwiU2FtcGxlIHByb2R1Y3RcIjtcblxuLy8gS2V5OiBkaXZpc2lvbk5hbWV8Y2l0eVxuY29uc3Qgc21hcnRTdXBwbHlEYXRhOiBNYXA8c3RyaW5nLCBudW1iZXI+ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuLy8gS2V5OiBkaXZpc2lvbk5hbWV8Y2l0eXxwcm9kdWN0TmFtZVxuY29uc3QgcHJvZHVjdE1hcmt1cERhdGE6IE1hcDxzdHJpbmcsIG51bWJlcj4gPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG5jb25zdCBzZXRPZkRpdmlzaW9uc1dhaXRpbmdGb3JSUDogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuZXhwb3J0IGNsYXNzIExvZ2dlciB7XG4gICAgcmVhZG9ubHkgI2VuYWJsZUxvZ2dpbmc6IGJvb2xlYW47XG4gICAgY2l0eT86IENpdHlOYW1lO1xuXG4gICAgY29uc3RydWN0b3IoZW5hYmxlTG9nZ2luZzogYm9vbGVhbiwgY2l0eT86IENpdHlOYW1lKSB7XG4gICAgICAgIHRoaXMuI2VuYWJsZUxvZ2dpbmcgPSBlbmFibGVMb2dnaW5nO1xuICAgICAgICB0aGlzLmNpdHkgPSBjaXR5O1xuICAgIH1cblxuICAgIHB1YmxpYyBsb2coLi4uYXJnczogdW5rbm93bltdKSB7XG4gICAgICAgIGlmICghdGhpcy4jZW5hYmxlTG9nZ2luZykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNpdHkgPT09IHVuZGVmaW5lZCB8fCB0aGlzLmNpdHkgPT09IENpdHlOYW1lLlNlY3RvcjEyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyB3YXJuKC4uLmFyZ3M6IHVua25vd25bXSkge1xuICAgICAgICBpZiAoIXRoaXMuI2VuYWJsZUxvZ2dpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5jaXR5ID09PSB1bmRlZmluZWQgfHwgdGhpcy5jaXR5ID09PSBDaXR5TmFtZS5TZWN0b3IxMikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGVycm9yKC4uLmFyZ3M6IHVua25vd25bXSkge1xuICAgICAgICBpZiAoIXRoaXMuI2VuYWJsZUxvZ2dpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5jaXR5ID09PSB1bmRlZmluZWQgfHwgdGhpcy5jaXR5ID09PSBDaXR5TmFtZS5TZWN0b3IxMikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvciguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyB0aW1lKGxhYmVsOiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKCF0aGlzLiNlbmFibGVMb2dnaW5nKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuY2l0eSA9PT0gdW5kZWZpbmVkIHx8IHRoaXMuY2l0eSA9PT0gQ2l0eU5hbWUuU2VjdG9yMTIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUudGltZShsYWJlbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgdGltZUVuZChsYWJlbDogc3RyaW5nKSB7XG4gICAgICAgIGlmICghdGhpcy4jZW5hYmxlTG9nZ2luZykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNpdHkgPT09IHVuZGVmaW5lZCB8fCB0aGlzLmNpdHkgPT09IENpdHlOYW1lLlNlY3RvcjEyKSB7XG4gICAgICAgICAgICBjb25zb2xlLnRpbWVFbmQobGFiZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHRpbWVMb2cobGFiZWw6IHN0cmluZykge1xuICAgICAgICBpZiAoIXRoaXMuI2VuYWJsZUxvZ2dpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5jaXR5ID09PSB1bmRlZmluZWQgfHwgdGhpcy5jaXR5ID09PSBDaXR5TmFtZS5TZWN0b3IxMikge1xuICAgICAgICAgICAgY29uc29sZS50aW1lTG9nKGxhYmVsKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dXYXJuaW5nKG5zOiBOUywgd2FybmluZ01lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnNvbGUud2Fybih3YXJuaW5nTWVzc2FnZSk7XG4gICAgbnMucHJpbnQod2FybmluZ01lc3NhZ2UpO1xuICAgIG5zLnRvYXN0KHdhcm5pbmdNZXNzYWdlLCBcIndhcm5pbmdcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29wQWxsRGl2aXNpb25zQW5kQ2l0aWVzKG5zOiBOUywgY2FsbGJhY2s6IChkaXZpc2lvbk5hbWU6IHN0cmluZywgY2l0eTogQ2l0eU5hbWUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGRpdmlzaW9uIG9mIG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkuZGl2aXNpb25zKSB7XG4gICAgICAgIGlmIChkaXZpc2lvbi5zdGFydHNXaXRoKGR1bW15RGl2aXNpb25OYW1lUHJlZml4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBjaXR5IG9mIGNpdGllcykge1xuICAgICAgICAgICAgY2FsbGJhY2soZGl2aXNpb24sIGNpdHkpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9vcEFsbERpdmlzaW9uc0FuZENpdGllc0FzeW5jQ2FsbGJhY2soXG4gICAgbnM6IE5TLFxuICAgIGNhbGxiYWNrOiAoZGl2aXNpb25OYW1lOiBzdHJpbmcsIGNpdHk6IENpdHlOYW1lKSA9PiBQcm9taXNlPHZvaWQ+XG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBmb3IgKGNvbnN0IGRpdmlzaW9uIG9mIG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkuZGl2aXNpb25zKSB7XG4gICAgICAgIGlmIChkaXZpc2lvbi5zdGFydHNXaXRoKGR1bW15RGl2aXNpb25OYW1lUHJlZml4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBjaXR5IG9mIGNpdGllcykge1xuICAgICAgICAgICAgYXdhaXQgY2FsbGJhY2soZGl2aXNpb24sIGNpdHkpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdFVudGlsQWZ0ZXJTdGF0ZUhhcHBlbnMobnM6IE5TLCBzdGF0ZTogQ29ycFN0YXRlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgaWYgKG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkucHJldlN0YXRlID09PSBzdGF0ZSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgbnMuY29ycG9yYXRpb24ubmV4dFVwZGF0ZSgpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JOZXh0VGltZVN0YXRlSGFwcGVucyhuczogTlMsIHN0YXRlOiBDb3JwU3RhdGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBhd2FpdCBucy5jb3Jwb3JhdGlvbi5uZXh0VXBkYXRlKCk7XG4gICAgICAgIGlmIChucy5jb3Jwb3JhdGlvbi5nZXRDb3Jwb3JhdGlvbigpLnByZXZTdGF0ZSA9PT0gc3RhdGUpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdEZvck51bWJlck9mQ3ljbGVzKG5zOiBOUywgbnVtYmVyT2ZDeWNsZXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGN1cnJlbnRTdGF0ZSA9IG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkucHJldlN0YXRlO1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgd2hpbGUgKGNvdW50IDwgbnVtYmVyT2ZDeWNsZXMpIHtcbiAgICAgICAgYXdhaXQgd2FpdEZvck5leHRUaW1lU3RhdGVIYXBwZW5zKG5zLCBjdXJyZW50U3RhdGUgYXMgQ29ycFN0YXRlKTtcbiAgICAgICAgKytjb3VudDtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcm9maXQobnM6IE5TKSB7XG4gICAgY29uc3QgY29ycG9yYXRpb24gPSBucy5jb3Jwb3JhdGlvbi5nZXRDb3Jwb3JhdGlvbigpO1xuICAgIHJldHVybiBjb3Jwb3JhdGlvbi5yZXZlbnVlIC0gY29ycG9yYXRpb24uZXhwZW5zZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNEaXZpc2lvbihuczogTlMsIGRpdmlzaW9uTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkuZGl2aXNpb25zLmluY2x1ZGVzKGRpdmlzaW9uTmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidXlVcGdyYWRlKG5zOiBOUywgdXBncmFkZTogVXBncmFkZU5hbWUsIHRhcmdldExldmVsOiBudW1iZXIpOiB2b2lkIHtcbiAgICBmb3IgKGxldCBpID0gbnMuY29ycG9yYXRpb24uZ2V0VXBncmFkZUxldmVsKHVwZ3JhZGUpOyBpIDwgdGFyZ2V0TGV2ZWw7IGkrKykge1xuICAgICAgICBucy5jb3Jwb3JhdGlvbi5sZXZlbFVwZ3JhZGUodXBncmFkZSk7XG4gICAgfVxuICAgIGlmIChucy5jb3Jwb3JhdGlvbi5nZXRVcGdyYWRlTGV2ZWwodXBncmFkZSkgPCB0YXJnZXRMZXZlbCkge1xuICAgICAgICBucy5wcmludChgRVJST1I6IENhbm5vdCBidXkgZW5vdWdoIHVwZ3JhZGUgbGV2ZWxgKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidXlBZHZlcnQobnM6IE5TLCBkaXZpc2lvbk5hbWU6IHN0cmluZywgdGFyZ2V0TGV2ZWw6IG51bWJlcik6IHZvaWQge1xuICAgIGZvciAobGV0IGkgPSBucy5jb3Jwb3JhdGlvbi5nZXRIaXJlQWRWZXJ0Q291bnQoZGl2aXNpb25OYW1lKTsgaSA8IHRhcmdldExldmVsOyBpKyspIHtcbiAgICAgICAgbnMuY29ycG9yYXRpb24uaGlyZUFkVmVydChkaXZpc2lvbk5hbWUpO1xuICAgIH1cbiAgICBpZiAobnMuY29ycG9yYXRpb24uZ2V0SGlyZUFkVmVydENvdW50KGRpdmlzaW9uTmFtZSkgPCB0YXJnZXRMZXZlbCkge1xuICAgICAgICBucy5wcmludChgRVJST1I6IENhbm5vdCBidXkgZW5vdWdoIEFkdmVydCBsZXZlbGApO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1eVVubG9jayhuczogTlMsIHVubG9ja05hbWU6IFVubG9ja05hbWUpOiB2b2lkIHtcbiAgICBpZiAobnMuY29ycG9yYXRpb24uaGFzVW5sb2NrKHVubG9ja05hbWUpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbnMuY29ycG9yYXRpb24ucHVyY2hhc2VVbmxvY2sodW5sb2NrTmFtZSk7XG59XG5cbi8qKlxuICogV2FyZWhvdXNlIHN0YXJ0cyBhdCBsZXZlbCAxXG4gKlxuICogQHBhcmFtIG5zXG4gKiBAcGFyYW0gZGl2aXNpb25OYW1lXG4gKiBAcGFyYW0gY2l0eVxuICogQHBhcmFtIHRhcmdldExldmVsXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cGdyYWRlV2FyZWhvdXNlKG5zOiBOUywgZGl2aXNpb25OYW1lOiBzdHJpbmcsIGNpdHk6IENpdHlOYW1lLCB0YXJnZXRMZXZlbDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgYW1vdW50ID0gdGFyZ2V0TGV2ZWwgLSBucy5jb3Jwb3JhdGlvbi5nZXRXYXJlaG91c2UoZGl2aXNpb25OYW1lLCBjaXR5KS5sZXZlbDtcbiAgICBpZiAoYW1vdW50IDwgMSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIG5zLmNvcnBvcmF0aW9uLnVwZ3JhZGVXYXJlaG91c2UoZGl2aXNpb25OYW1lLCBjaXR5LCBhbW91bnQpO1xufVxuXG4vKipcbiAqIEJ1eWluZyB0ZWEvdGhyb3dpbmcgcGFydHkgZm9yIGVhY2ggb2ZmaWNlXG4gKlxuICogQHBhcmFtIG5zXG4gKiBAcGFyYW0gZGl2aXNpb25OYW1lXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidXlUZWFBbmRUaHJvd1BhcnR5KG5zOiBOUywgZGl2aXNpb25OYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBlcHNpbG9uID0gMC41O1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGxldCBmaW5pc2ggPSB0cnVlO1xuICAgICAgICBmb3IgKGNvbnN0IGNpdHkgb2YgY2l0aWVzKSB7XG4gICAgICAgICAgICBjb25zdCBvZmZpY2UgPSBucy5jb3Jwb3JhdGlvbi5nZXRPZmZpY2UoZGl2aXNpb25OYW1lLCBjaXR5KTtcbiAgICAgICAgICAgIGlmIChvZmZpY2UuYXZnRW5lcmd5IDwgb2ZmaWNlLm1heEVuZXJneSAtIGVwc2lsb24pIHtcbiAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5idXlUZWEoZGl2aXNpb25OYW1lLCBjaXR5KTtcbiAgICAgICAgICAgICAgICBmaW5pc2ggPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvZmZpY2UuYXZnTW9yYWxlIDwgb2ZmaWNlLm1heE1vcmFsZSAtIGVwc2lsb24pIHtcbiAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi50aHJvd1BhcnR5KGRpdmlzaW9uTmFtZSwgY2l0eSwgNTAwMDAwKTtcbiAgICAgICAgICAgICAgICBmaW5pc2ggPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmluaXNoKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBucy5jb3Jwb3JhdGlvbi5uZXh0VXBkYXRlKCk7XG4gICAgfVxufVxuXG4vKipcbiAqIEJ1eWluZyB0ZWEvdGhyb3dpbmcgcGFydHkgb25jZSBmb3IgZWFjaCBvZmZpY2UgaW4gYWxsIGRpdmlzaW9uc1xuICovXG5leHBvcnQgZnVuY3Rpb24gYnV5VGVhQW5kVGhyb3dQYXJ0eUZvckFsbERpdmlzaW9ucyhuczogTlMpOiB2b2lkIHtcbiAgICAvLyBJZiB3ZSBhcmUgaW4gcm91bmQgMyssIHdlIGJ1eSB0ZWEgYW5kIHRocm93IHBhcnR5IGV2ZXJ5IGN5Y2xlIHRvIG1haW50YWluIG1heCBlbmVyZ3kvbW9yYWxlXG4gICAgaWYgKG5zLmNvcnBvcmF0aW9uLmdldEludmVzdG1lbnRPZmZlcigpLnJvdW5kID49IDMgfHwgbnMuY29ycG9yYXRpb24uZ2V0Q29ycG9yYXRpb24oKS5wdWJsaWMpIHtcbiAgICAgICAgbG9vcEFsbERpdmlzaW9uc0FuZENpdGllcyhucywgKGRpdmlzaW9uTmFtZTogc3RyaW5nLCBjaXR5OiBDaXR5TmFtZSkgPT4ge1xuICAgICAgICAgICAgbnMuY29ycG9yYXRpb24uYnV5VGVhKGRpdmlzaW9uTmFtZSwgY2l0eSk7XG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi50aHJvd1BhcnR5KGRpdmlzaW9uTmFtZSwgY2l0eSwgNTAwMDAwKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgZXBzaWxvbiA9IDAuNTtcbiAgICBsb29wQWxsRGl2aXNpb25zQW5kQ2l0aWVzKG5zLCAoZGl2aXNpb25OYW1lOiBzdHJpbmcsIGNpdHk6IENpdHlOYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IG9mZmljZSA9IG5zLmNvcnBvcmF0aW9uLmdldE9mZmljZShkaXZpc2lvbk5hbWUsIGNpdHkpO1xuICAgICAgICBpZiAob2ZmaWNlLmF2Z0VuZXJneSA8IG9mZmljZS5tYXhFbmVyZ3kgLSBlcHNpbG9uKSB7XG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5idXlUZWEoZGl2aXNpb25OYW1lLCBjaXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob2ZmaWNlLmF2Z01vcmFsZSA8IG9mZmljZS5tYXhNb3JhbGUgLSBlcHNpbG9uKSB7XG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi50aHJvd1BhcnR5KGRpdmlzaW9uTmFtZSwgY2l0eSwgNTAwMDAwKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVPZmZpY2VTZXR1cHNGb3JFYXJseVJvdW5kcyhzaXplOiBudW1iZXIsIGluY3JlYXNlQnVzaW5lc3MgPSBmYWxzZSk6IE9mZmljZVNldHVwW10ge1xuICAgIGxldCBvZmZpY2VTZXR1cDtcbiAgICBzd2l0Y2ggKHNpemUpIHtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgb2ZmaWNlU2V0dXAgPSBbXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlMsIGNvdW50OiAxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkVOR0lORUVSLCBjb3VudDogMSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5CVVNJTkVTUywgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVCwgY291bnQ6IDAgfSxcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgICAgb2ZmaWNlU2V0dXAgPSBbXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlMsIGNvdW50OiAxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkVOR0lORUVSLCBjb3VudDogMSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5CVVNJTkVTUywgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVCwgY291bnQ6IDEgfSxcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgICAgb2ZmaWNlU2V0dXAgPSBbXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlMsIGNvdW50OiAyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkVOR0lORUVSLCBjb3VudDogMSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5CVVNJTkVTUywgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVCwgY291bnQ6IDEgfSxcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA2OlxuICAgICAgICAgICAgaWYgKGluY3JlYXNlQnVzaW5lc3MpIHtcbiAgICAgICAgICAgICAgICBvZmZpY2VTZXR1cCA9IFtcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlMsIGNvdW50OiAyIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5FTkdJTkVFUiwgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkJVU0lORVNTLCBjb3VudDogMiB9LFxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVCwgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9mZmljZVNldHVwID0gW1xuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uT1BFUkFUSU9OUywgY291bnQ6IDIgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkVOR0lORUVSLCBjb3VudDogMSB9LFxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uQlVTSU5FU1MsIGNvdW50OiAxIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5NQU5BR0VNRU5ULCBjb3VudDogMiB9LFxuICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgICAgaWYgKGluY3JlYXNlQnVzaW5lc3MpIHtcbiAgICAgICAgICAgICAgICBvZmZpY2VTZXR1cCA9IFtcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlMsIGNvdW50OiAyIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5FTkdJTkVFUiwgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkJVU0lORVNTLCBjb3VudDogMiB9LFxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVCwgY291bnQ6IDIgfSxcbiAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9mZmljZVNldHVwID0gW1xuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uT1BFUkFUSU9OUywgY291bnQ6IDMgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkVOR0lORUVSLCBjb3VudDogMSB9LFxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uQlVTSU5FU1MsIGNvdW50OiAxIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5NQU5BR0VNRU5ULCBjb3VudDogMiB9LFxuICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgICAgaWYgKGluY3JlYXNlQnVzaW5lc3MpIHtcbiAgICAgICAgICAgICAgICBvZmZpY2VTZXR1cCA9IFtcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlMsIGNvdW50OiAzIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5FTkdJTkVFUiwgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkJVU0lORVNTLCBjb3VudDogMiB9LFxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVCwgY291bnQ6IDIgfSxcbiAgICAgICAgICAgICAgICAgICAgLy8geyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlMsIGNvdW50OiAyIH0sXG4gICAgICAgICAgICAgICAgICAgIC8vIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5FTkdJTkVFUiwgY291bnQ6IDEgfSxcbiAgICAgICAgICAgICAgICAgICAgLy8geyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkJVU0lORVNTLCBjb3VudDogMyB9LFxuICAgICAgICAgICAgICAgICAgICAvLyB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVCwgY291bnQ6IDIgfSxcbiAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9mZmljZVNldHVwID0gW1xuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uT1BFUkFUSU9OUywgY291bnQ6IDMgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBFbXBsb3llZVBvc2l0aW9uLkVOR0lORUVSLCBjb3VudDogMSB9LFxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IEVtcGxveWVlUG9zaXRpb24uQlVTSU5FU1MsIGNvdW50OiAxIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogRW1wbG95ZWVQb3NpdGlvbi5NQU5BR0VNRU5ULCBjb3VudDogMyB9LFxuICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBvZmZpY2Ugc2l6ZTogJHtzaXplfWApO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVPZmZpY2VTZXR1cHMoXG4gICAgICAgIGNpdGllcyxcbiAgICAgICAgc2l6ZSxcbiAgICAgICAgb2ZmaWNlU2V0dXBcbiAgICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVPZmZpY2VTZXR1cHMoY2l0aWVzOiBDaXR5TmFtZVtdLCBzaXplOiBudW1iZXIsIGpvYnM6IHtcbiAgICBuYW1lOiBFbXBsb3llZVBvc2l0aW9uO1xuICAgIGNvdW50OiBudW1iZXI7XG59W10pOiBPZmZpY2VTZXR1cFtdIHtcbiAgICBjb25zdCBvZmZpY2VTZXR1cEpvYnM6IE9mZmljZVNldHVwSm9icyA9IHtcbiAgICAgICAgT3BlcmF0aW9uczogMCxcbiAgICAgICAgRW5naW5lZXI6IDAsXG4gICAgICAgIEJ1c2luZXNzOiAwLFxuICAgICAgICBNYW5hZ2VtZW50OiAwLFxuICAgICAgICBcIlJlc2VhcmNoICYgRGV2ZWxvcG1lbnRcIjogMCxcbiAgICAgICAgSW50ZXJuOiAwLFxuICAgIH07XG4gICAgZm9yIChjb25zdCBqb2Igb2Ygam9icykge1xuICAgICAgICBzd2l0Y2ggKGpvYi5uYW1lKSB7XG4gICAgICAgICAgICBjYXNlIEVtcGxveWVlUG9zaXRpb24uT1BFUkFUSU9OUzpcbiAgICAgICAgICAgICAgICBvZmZpY2VTZXR1cEpvYnMuT3BlcmF0aW9ucyA9IGpvYi5jb3VudDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgRW1wbG95ZWVQb3NpdGlvbi5FTkdJTkVFUjpcbiAgICAgICAgICAgICAgICBvZmZpY2VTZXR1cEpvYnMuRW5naW5lZXIgPSBqb2IuY291bnQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEVtcGxveWVlUG9zaXRpb24uQlVTSU5FU1M6XG4gICAgICAgICAgICAgICAgb2ZmaWNlU2V0dXBKb2JzLkJ1c2luZXNzID0gam9iLmNvdW50O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBFbXBsb3llZVBvc2l0aW9uLk1BTkFHRU1FTlQ6XG4gICAgICAgICAgICAgICAgb2ZmaWNlU2V0dXBKb2JzLk1hbmFnZW1lbnQgPSBqb2IuY291bnQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEVtcGxveWVlUG9zaXRpb24uUkVTRUFSQ0hfREVWRUxPUE1FTlQ6XG4gICAgICAgICAgICAgICAgb2ZmaWNlU2V0dXBKb2JzW1wiUmVzZWFyY2ggJiBEZXZlbG9wbWVudFwiXSA9IGpvYi5jb3VudDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgRW1wbG95ZWVQb3NpdGlvbi5JTlRFUk46XG4gICAgICAgICAgICAgICAgb2ZmaWNlU2V0dXBKb2JzLkludGVybiA9IGpvYi5jb3VudDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGpvYjogJHtqb2IubmFtZX1gKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBvZmZpY2VTZXR1cHM6IE9mZmljZVNldHVwW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNpdHkgb2YgY2l0aWVzKSB7XG4gICAgICAgIG9mZmljZVNldHVwcy5wdXNoKHtcbiAgICAgICAgICAgIGNpdHk6IGNpdHksXG4gICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgam9iczogb2ZmaWNlU2V0dXBKb2JzXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gb2ZmaWNlU2V0dXBzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzaWduSm9icyhuczogTlMsIGRpdmlzaW9uTmFtZTogc3RyaW5nLCBvZmZpY2VTZXR1cHM6IE9mZmljZVNldHVwW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG9mZmljZVNldHVwIG9mIG9mZmljZVNldHVwcykge1xuICAgICAgICAvLyBSZXNldCBhbGwgam9ic1xuICAgICAgICBmb3IgKGNvbnN0IGpvYk5hbWUgb2YgT2JqZWN0LnZhbHVlcyhFbXBsb3llZVBvc2l0aW9uKSkge1xuICAgICAgICAgICAgbnMuY29ycG9yYXRpb24uc2V0QXV0b0pvYkFzc2lnbm1lbnQoZGl2aXNpb25OYW1lLCBvZmZpY2VTZXR1cC5jaXR5LCBqb2JOYW1lLCAwKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBBc3NpZ24gam9ic1xuICAgICAgICBmb3IgKGNvbnN0IFtqb2JOYW1lLCBjb3VudF0gb2YgT2JqZWN0LmVudHJpZXMob2ZmaWNlU2V0dXAuam9icykpIHtcbiAgICAgICAgICAgIGlmICghbnMuY29ycG9yYXRpb24uc2V0QXV0b0pvYkFzc2lnbm1lbnQoZGl2aXNpb25OYW1lLCBvZmZpY2VTZXR1cC5jaXR5LCBqb2JOYW1lLCBjb3VudCkpIHtcbiAgICAgICAgICAgICAgICBucy5wcmludChgQ2Fubm90IGFzc2lnbiBqb2IgcHJvcGVybHkuIENpdHk6ICR7b2ZmaWNlU2V0dXAuY2l0eX0sIGpvYjogJHtqb2JOYW1lfSwgY291bnQ6ICR7Y291bnR9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGdyYWRlT2ZmaWNlcyhuczogTlMsIGRpdmlzaW9uTmFtZTogc3RyaW5nLCBvZmZpY2VTZXR1cHM6IE9mZmljZVNldHVwW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG9mZmljZVNldHVwIG9mIG9mZmljZVNldHVwcykge1xuICAgICAgICBjb25zdCBvZmZpY2UgPSBucy5jb3Jwb3JhdGlvbi5nZXRPZmZpY2UoZGl2aXNpb25OYW1lLCBvZmZpY2VTZXR1cC5jaXR5KTtcbiAgICAgICAgaWYgKG9mZmljZVNldHVwLnNpemUgPCBvZmZpY2Uuc2l6ZSkge1xuICAgICAgICAgICAgbnMucHJpbnQoYE9mZmljZSdzIG5ldyBzaXplIGlzIHNtYWxsZXIgdGhhbiBjdXJyZW50IHNpemUuIENpdHk6ICR7b2ZmaWNlU2V0dXAuY2l0eX1gKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvZmZpY2VTZXR1cC5zaXplID4gb2ZmaWNlLnNpemUpIHtcbiAgICAgICAgICAgIC8vIFVwZ3JhZGUgb2ZmaWNlXG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi51cGdyYWRlT2ZmaWNlU2l6ZShkaXZpc2lvbk5hbWUsIG9mZmljZVNldHVwLmNpdHksIG9mZmljZVNldHVwLnNpemUgLSBvZmZpY2Uuc2l6ZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSGlyZSBlbXBsb3llZXNcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWVtcHR5XG4gICAgICAgIHdoaWxlIChucy5jb3Jwb3JhdGlvbi5oaXJlRW1wbG95ZWUoZGl2aXNpb25OYW1lLCBvZmZpY2VTZXR1cC5jaXR5LCBFbXBsb3llZVBvc2l0aW9uLlJFU0VBUkNIX0RFVkVMT1BNRU5UKSkge1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vIEFzc2lnbiBqb2JzXG4gICAgYXNzaWduSm9icyhucywgZGl2aXNpb25OYW1lLCBvZmZpY2VTZXR1cHMpO1xuICAgIG5zLnByaW50KGBVcGdyYWRlIG9mZmljZXMgY29tcGxldGVkYCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGVhclB1cmNoYXNlT3JkZXJzKG5zOiBOUywgY2xlYXJJbnB1dE1hdGVyaWFsT3JkZXJzOiBib29sZWFuID0gdHJ1ZSk6IHZvaWQge1xuICAgIGxvb3BBbGxEaXZpc2lvbnNBbmRDaXRpZXMobnMsIChkaXZpc2lvbk5hbWUsIGNpdHkpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBtYXRlcmlhbE5hbWUgb2YgYm9vc3RNYXRlcmlhbHMpIHtcbiAgICAgICAgICAgIG5zLmNvcnBvcmF0aW9uLmJ1eU1hdGVyaWFsKGRpdmlzaW9uTmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lLCAwKTtcbiAgICAgICAgICAgIG5zLmNvcnBvcmF0aW9uLnNlbGxNYXRlcmlhbChkaXZpc2lvbk5hbWUsIGNpdHksIG1hdGVyaWFsTmFtZSwgXCIwXCIsIFwiTVBcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNsZWFySW5wdXRNYXRlcmlhbE9yZGVycykge1xuICAgICAgICAgICAgY29uc3QgZGl2aXNpb24gPSBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpO1xuICAgICAgICAgICAgY29uc3QgaW5kdXN0cmlhbERhdGEgPSBucy5jb3Jwb3JhdGlvbi5nZXRJbmR1c3RyeURhdGEoZGl2aXNpb24udHlwZSk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG1hdGVyaWFsTmFtZSBvZiBnZXRSZWNvcmRLZXlzKGluZHVzdHJpYWxEYXRhLnJlcXVpcmVkTWF0ZXJpYWxzKSkge1xuICAgICAgICAgICAgICAgIG5zLmNvcnBvcmF0aW9uLmJ1eU1hdGVyaWFsKGRpdmlzaW9uTmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lLCAwKTtcbiAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZWxsTWF0ZXJpYWwoZGl2aXNpb25OYW1lLCBjaXR5LCBtYXRlcmlhbE5hbWUsIFwiMFwiLCBcIk1QXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZU1hdGVyaWFsc09yZGVycyhcbiAgICBjaXRpZXM6IENpdHlOYW1lW10sXG4gICAgbWF0ZXJpYWxzOiB7XG4gICAgICAgIG5hbWU6IE1hdGVyaWFsTmFtZTtcbiAgICAgICAgY291bnQ6IG51bWJlcjtcbiAgICB9W11cbik6IE1hdGVyaWFsT3JkZXJbXSB7XG4gICAgY29uc3Qgb3JkZXJzOiBNYXRlcmlhbE9yZGVyW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNpdHkgb2YgY2l0aWVzKSB7XG4gICAgICAgIG9yZGVycy5wdXNoKHtcbiAgICAgICAgICAgIGNpdHk6IGNpdHksXG4gICAgICAgICAgICBtYXRlcmlhbHM6IG1hdGVyaWFsc1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG9yZGVycztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0b2NrTWF0ZXJpYWxzKFxuICAgIG5zOiBOUyxcbiAgICBkaXZpc2lvbk5hbWU6IHN0cmluZyxcbiAgICBvcmRlcnM6IE1hdGVyaWFsT3JkZXJbXSxcbiAgICBidWxrUHVyY2hhc2UgPSBmYWxzZSxcbiAgICBkaXNjYXJkRXhjZWVkZWQgPSBmYWxzZVxuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBpZiAoY291bnQgPT09IDUpIHtcbiAgICAgICAgICAgIGNvbnN0IHdhcm5pbmdNZXNzYWdlID0gYEl0IHRha2VzIHRvbyBtYW55IGN5Y2xlcyB0byBzdG9jayB1cCBvbiBtYXRlcmlhbHMuIERpdmlzaW9uOiAke2RpdmlzaW9uTmFtZX0sIGBcbiAgICAgICAgICAgICAgICArIGBvcmRlcnM6ICR7SlNPTi5zdHJpbmdpZnkob3JkZXJzKX1gO1xuICAgICAgICAgICAgc2hvd1dhcm5pbmcobnMsIHdhcm5pbmdNZXNzYWdlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGxldCBmaW5pc2ggPSB0cnVlO1xuICAgICAgICBmb3IgKGNvbnN0IG9yZGVyIG9mIG9yZGVycykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBtYXRlcmlhbCBvZiBvcmRlci5tYXRlcmlhbHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZWRBbW91bnQgPSBucy5jb3Jwb3JhdGlvbi5nZXRNYXRlcmlhbChkaXZpc2lvbk5hbWUsIG9yZGVyLmNpdHksIG1hdGVyaWFsLm5hbWUpLnN0b3JlZDtcbiAgICAgICAgICAgICAgICBpZiAoc3RvcmVkQW1vdW50ID09PSBtYXRlcmlhbC5jb3VudCkge1xuICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5idXlNYXRlcmlhbChkaXZpc2lvbk5hbWUsIG9yZGVyLmNpdHksIG1hdGVyaWFsLm5hbWUsIDApO1xuICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZWxsTWF0ZXJpYWwoZGl2aXNpb25OYW1lLCBvcmRlci5jaXR5LCBtYXRlcmlhbC5uYW1lLCBcIjBcIiwgXCJNUFwiKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEJ1eVxuICAgICAgICAgICAgICAgIGlmIChzdG9yZWRBbW91bnQgPCBtYXRlcmlhbC5jb3VudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVsa1B1cmNoYXNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5idWxrUHVyY2hhc2UoZGl2aXNpb25OYW1lLCBvcmRlci5jaXR5LCBtYXRlcmlhbC5uYW1lLCBtYXRlcmlhbC5jb3VudCAtIHN0b3JlZEFtb3VudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5idXlNYXRlcmlhbChkaXZpc2lvbk5hbWUsIG9yZGVyLmNpdHksIG1hdGVyaWFsLm5hbWUsIChtYXRlcmlhbC5jb3VudCAtIHN0b3JlZEFtb3VudCkgLyAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZWxsTWF0ZXJpYWwoZGl2aXNpb25OYW1lLCBvcmRlci5jaXR5LCBtYXRlcmlhbC5uYW1lLCBcIjBcIiwgXCJNUFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmaW5pc2ggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gRGlzY2FyZFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRpc2NhcmRFeGNlZWRlZCkge1xuICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5idXlNYXRlcmlhbChkaXZpc2lvbk5hbWUsIG9yZGVyLmNpdHksIG1hdGVyaWFsLm5hbWUsIDApO1xuICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZWxsTWF0ZXJpYWwoZGl2aXNpb25OYW1lLCBvcmRlci5jaXR5LCBtYXRlcmlhbC5uYW1lLCAoKHN0b3JlZEFtb3VudCAtIG1hdGVyaWFsLmNvdW50KSAvIDEwKS50b1N0cmluZygpLCBcIjBcIik7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmluaXNoKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCB3YWl0Rm9yTmV4dFRpbWVTdGF0ZUhhcHBlbnMobnMsIENvcnBTdGF0ZS5QVVJDSEFTRSk7XG4gICAgICAgICsrY291bnQ7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29ycG9yYXRpb25VcGdyYWRlTGV2ZWxzKG5zOiBOUyk6IENvcnBvcmF0aW9uVXBncmFkZUxldmVscyB7XG4gICAgY29uc3QgY29ycG9yYXRpb25VcGdyYWRlTGV2ZWxzOiBDb3Jwb3JhdGlvblVwZ3JhZGVMZXZlbHMgPSB7XG4gICAgICAgIFtVcGdyYWRlTmFtZS5TTUFSVF9GQUNUT1JJRVNdOiAwLFxuICAgICAgICBbVXBncmFkZU5hbWUuU01BUlRfU1RPUkFHRV06IDAsXG4gICAgICAgIFtVcGdyYWRlTmFtZS5EUkVBTV9TRU5TRV06IDAsXG4gICAgICAgIFtVcGdyYWRlTmFtZS5XSUxTT05fQU5BTFlUSUNTXTogMCxcbiAgICAgICAgW1VwZ3JhZGVOYW1lLk5VT1BUSU1BTF9OT09UUk9QSUNfSU5KRUNUT1JfSU1QTEFOVFNdOiAwLFxuICAgICAgICBbVXBncmFkZU5hbWUuU1BFRUNIX1BST0NFU1NPUl9JTVBMQU5UU106IDAsXG4gICAgICAgIFtVcGdyYWRlTmFtZS5ORVVSQUxfQUNDRUxFUkFUT1JTXTogMCxcbiAgICAgICAgW1VwZ3JhZGVOYW1lLkZPQ1VTX1dJUkVTXTogMCxcbiAgICAgICAgW1VwZ3JhZGVOYW1lLkFCQ19TQUxFU19CT1RTXTogMCxcbiAgICAgICAgW1VwZ3JhZGVOYW1lLlBST0pFQ1RfSU5TSUdIVF06IDBcbiAgICB9O1xuICAgIGZvciAoY29uc3QgdXBncmFkZU5hbWUgb2YgT2JqZWN0LnZhbHVlcyhVcGdyYWRlTmFtZSkpIHtcbiAgICAgICAgY29ycG9yYXRpb25VcGdyYWRlTGV2ZWxzW3VwZ3JhZGVOYW1lXSA9IG5zLmNvcnBvcmF0aW9uLmdldFVwZ3JhZGVMZXZlbCh1cGdyYWRlTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBjb3Jwb3JhdGlvblVwZ3JhZGVMZXZlbHM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREaXZpc2lvblJlc2VhcmNoZXMobnM6IE5TLCBkaXZpc2lvbk5hbWU6IHN0cmluZyk6IERpdmlzaW9uUmVzZWFyY2hlcyB7XG4gICAgY29uc3QgZGl2aXNpb25SZXNlYXJjaGVzOiBEaXZpc2lvblJlc2VhcmNoZXMgPSB7XG4gICAgICAgIFtSZXNlYXJjaE5hbWUuSElfVEVDSF9STkRfTEFCT1JBVE9SWV06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLkFVVE9fQlJFV106IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLkFVVE9fUEFSVFldOiBmYWxzZSxcbiAgICAgICAgW1Jlc2VhcmNoTmFtZS5BVVRPX0RSVUddOiBmYWxzZSxcbiAgICAgICAgW1Jlc2VhcmNoTmFtZS5DUEg0X0lOSkVDVF06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLkRST05FU106IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLkRST05FU19BU1NFTUJMWV06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLkRST05FU19UUkFOU1BPUlRdOiBmYWxzZSxcbiAgICAgICAgW1Jlc2VhcmNoTmFtZS5HT19KVUlDRV06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLkhSX0JVRERZX1JFQ1JVSVRNRU5UXTogZmFsc2UsXG4gICAgICAgIFtSZXNlYXJjaE5hbWUuSFJfQlVERFlfVFJBSU5JTkddOiBmYWxzZSxcbiAgICAgICAgW1Jlc2VhcmNoTmFtZS5NQVJLRVRfVEFfMV06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLk1BUktFVF9UQV8yXTogZmFsc2UsXG4gICAgICAgIFtSZXNlYXJjaE5hbWUuT1ZFUkNMT0NLXTogZmFsc2UsXG4gICAgICAgIFtSZXNlYXJjaE5hbWUuU0VMRl9DT1JSRUNUSU5HX0FTU0VNQkxFUlNdOiBmYWxzZSxcbiAgICAgICAgW1Jlc2VhcmNoTmFtZS5TVElNVV06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLlVQR1JBREVfQ0FQQUNJVFlfMV06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLlVQR1JBREVfQ0FQQUNJVFlfMl06IGZhbHNlLFxuICAgICAgICBbUmVzZWFyY2hOYW1lLlVQR1JBREVfREFTSEJPQVJEXTogZmFsc2UsXG4gICAgICAgIFtSZXNlYXJjaE5hbWUuVVBHUkFERV9GVUxDUlVNXTogZmFsc2VcbiAgICB9O1xuICAgIGZvciAoY29uc3QgcmVzZWFyY2hOYW1lIG9mIE9iamVjdC52YWx1ZXMoUmVzZWFyY2hOYW1lKSkge1xuICAgICAgICBkaXZpc2lvblJlc2VhcmNoZXNbcmVzZWFyY2hOYW1lXSA9IG5zLmNvcnBvcmF0aW9uLmhhc1Jlc2VhcmNoZWQoZGl2aXNpb25OYW1lLCByZXNlYXJjaE5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gZGl2aXNpb25SZXNlYXJjaGVzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlRGl2aXNpb24obnM6IE5TLCBkaXZpc2lvbk5hbWU6IHN0cmluZywgb2ZmaWNlU2l6ZTogbnVtYmVyLCB3YXJlaG91c2VMZXZlbDogbnVtYmVyKTogUHJvbWlzZTxEaXZpc2lvbj4ge1xuICAgIC8vIENyZWF0ZSBkaXZpc2lvbiBpZiBub3QgZXhpc3RzXG4gICAgaWYgKCFoYXNEaXZpc2lvbihucywgZGl2aXNpb25OYW1lKSkge1xuICAgICAgICBsZXQgaW5kdXN0cnlUeXBlO1xuICAgICAgICBzd2l0Y2ggKGRpdmlzaW9uTmFtZSkge1xuICAgICAgICAgICAgY2FzZSBEaXZpc2lvbk5hbWUuQUdSSUNVTFRVUkU6XG4gICAgICAgICAgICAgICAgaW5kdXN0cnlUeXBlID0gSW5kdXN0cnlUeXBlLkFHUklDVUxUVVJFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBEaXZpc2lvbk5hbWUuQ0hFTUlDQUw6XG4gICAgICAgICAgICAgICAgaW5kdXN0cnlUeXBlID0gSW5kdXN0cnlUeXBlLkNIRU1JQ0FMO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBEaXZpc2lvbk5hbWUuVE9CQUNDTzpcbiAgICAgICAgICAgICAgICBpbmR1c3RyeVR5cGUgPSBJbmR1c3RyeVR5cGUuVE9CQUNDTztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGRpdmlzaW9uIG5hbWU6ICR7ZGl2aXNpb25OYW1lfWApO1xuICAgICAgICB9XG4gICAgICAgIG5zLmNvcnBvcmF0aW9uLmV4cGFuZEluZHVzdHJ5KGluZHVzdHJ5VHlwZSwgZGl2aXNpb25OYW1lKTtcbiAgICB9XG4gICAgY29uc3QgZGl2aXNpb24gPSBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpO1xuICAgIG5zLnByaW50KGBJbml0aWFsaXppbmcgZGl2aXNpb246ICR7ZGl2aXNpb25OYW1lfWApO1xuXG4gICAgLy8gRXhwYW5kIHRvIGFsbCBjaXRpZXNcbiAgICBmb3IgKGNvbnN0IGNpdHkgb2YgY2l0aWVzKSB7XG4gICAgICAgIGlmICghZGl2aXNpb24uY2l0aWVzLmluY2x1ZGVzKGNpdHkpKSB7XG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5leHBhbmRDaXR5KGRpdmlzaW9uTmFtZSwgY2l0eSk7XG4gICAgICAgICAgICBucy5wcmludChgRXhwYW5kICR7ZGl2aXNpb25OYW1lfSB0byAke2NpdHl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQnV5IHdhcmVob3VzZVxuICAgICAgICBpZiAoIW5zLmNvcnBvcmF0aW9uLmhhc1dhcmVob3VzZShkaXZpc2lvbk5hbWUsIGNpdHkpKSB7XG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5wdXJjaGFzZVdhcmVob3VzZShkaXZpc2lvbk5hbWUsIGNpdHkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vIFNldCB1cCBhbGwgY2l0aWVzXG4gICAgdXBncmFkZU9mZmljZXMoXG4gICAgICAgIG5zLFxuICAgICAgICBkaXZpc2lvbk5hbWUsXG4gICAgICAgIGdlbmVyYXRlT2ZmaWNlU2V0dXBzKFxuICAgICAgICAgICAgY2l0aWVzLFxuICAgICAgICAgICAgb2ZmaWNlU2l6ZSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IEVtcGxveWVlUG9zaXRpb24uUkVTRUFSQ0hfREVWRUxPUE1FTlQsXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiBvZmZpY2VTaXplXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICApXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IGNpdHkgb2YgY2l0aWVzKSB7XG4gICAgICAgIHVwZ3JhZGVXYXJlaG91c2UobnMsIGRpdmlzaW9uTmFtZSwgY2l0eSwgd2FyZWhvdXNlTGV2ZWwpO1xuICAgICAgICAvLyBFbmFibGUgU21hcnQgU3VwcGx5XG4gICAgICAgIGlmIChucy5jb3Jwb3JhdGlvbi5oYXNVbmxvY2soVW5sb2NrTmFtZS5TTUFSVF9TVVBQTFkpKSB7XG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZXRTbWFydFN1cHBseShkaXZpc2lvbk5hbWUsIGNpdHksIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3B0aW1hbEJvb3N0TWF0ZXJpYWxRdWFudGl0aWVzKFxuICAgIGluZHVzdHJ5RGF0YTogQ29ycEluZHVzdHJ5RGF0YSxcbiAgICBzcGFjZUNvbnN0cmFpbnQ6IG51bWJlcixcbiAgICByb3VuZDogYm9vbGVhbiA9IHRydWVcbik6IG51bWJlcltdIHtcbiAgICBjb25zdCB7IGFpQ29yZUZhY3RvciwgaGFyZHdhcmVGYWN0b3IsIHJlYWxFc3RhdGVGYWN0b3IsIHJvYm90RmFjdG9yIH0gPSBpbmR1c3RyeURhdGE7XG4gICAgY29uc3QgYm9vc3RNYXRlcmlhbENvZWZmaWNpZW50cyA9IFthaUNvcmVGYWN0b3IhLCBoYXJkd2FyZUZhY3RvciEsIHJlYWxFc3RhdGVGYWN0b3IhLCByb2JvdEZhY3RvciFdO1xuICAgIGNvbnN0IGJvb3N0TWF0ZXJpYWxTaXplcyA9IGJvb3N0TWF0ZXJpYWxzLm1hcChtYXQgPT4gQ29ycE1hdGVyaWFsc0RhdGFbbWF0XS5zaXplKTtcblxuICAgIGNvbnN0IGNhbGN1bGF0ZU9wdGltYWxRdWFudGl0aWVzID0gKFxuICAgICAgICBtYXRDb2VmZmljaWVudHM6IG51bWJlcltdLFxuICAgICAgICBtYXRTaXplczogbnVtYmVyW11cbiAgICApOiBudW1iZXJbXSA9PiB7XG4gICAgICAgIGNvbnN0IHN1bU9mQ29lZmZpY2llbnRzID0gbWF0Q29lZmZpY2llbnRzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApO1xuICAgICAgICBjb25zdCBzdW1PZlNpemVzID0gbWF0U2l6ZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1hdFNpemVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBsZXQgbWF0Q291bnQgPVxuICAgICAgICAgICAgICAgIChzcGFjZUNvbnN0cmFpbnQgLSA1MDAgKiAoKG1hdFNpemVzW2ldIC8gbWF0Q29lZmZpY2llbnRzW2ldKSAqIChzdW1PZkNvZWZmaWNpZW50cyAtIG1hdENvZWZmaWNpZW50c1tpXSkgLSAoc3VtT2ZTaXplcyAtIG1hdFNpemVzW2ldKSkpXG4gICAgICAgICAgICAgICAgLyAoc3VtT2ZDb2VmZmljaWVudHMgLyBtYXRDb2VmZmljaWVudHNbaV0pXG4gICAgICAgICAgICAgICAgLyBtYXRTaXplc1tpXTtcbiAgICAgICAgICAgIGlmIChtYXRDb2VmZmljaWVudHNbaV0gPD0gMCB8fCBtYXRDb3VudCA8IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsY3VsYXRlT3B0aW1hbFF1YW50aXRpZXMoXG4gICAgICAgICAgICAgICAgICAgIG1hdENvZWZmaWNpZW50cy50b1NwbGljZWQoaSwgMSksXG4gICAgICAgICAgICAgICAgICAgIG1hdFNpemVzLnRvU3BsaWNlZChpLCAxKVxuICAgICAgICAgICAgICAgICkudG9TcGxpY2VkKGksIDAsIDApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAocm91bmQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0Q291bnQgPSBNYXRoLnJvdW5kKG1hdENvdW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobWF0Q291bnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgICByZXR1cm4gY2FsY3VsYXRlT3B0aW1hbFF1YW50aXRpZXMoYm9vc3RNYXRlcmlhbENvZWZmaWNpZW50cywgYm9vc3RNYXRlcmlhbFNpemVzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEV4cG9ydFJvdXRlcyhuczogTlMpOiBFeHBvcnRSb3V0ZVtdIHtcbiAgICBjb25zdCBleHBvcnRSb3V0ZXM6IEV4cG9ydFJvdXRlW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IG1hdGVyaWFsIG9mIG1hdGVyaWFscykge1xuICAgICAgICBsb29wQWxsRGl2aXNpb25zQW5kQ2l0aWVzKG5zLCAoZGl2aXNpb25OYW1lLCBzb3VyY2VDaXR5KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBleHBvcnRzID0gbnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWwoZGl2aXNpb25OYW1lLCBzb3VyY2VDaXR5LCBtYXRlcmlhbCkuZXhwb3J0cztcbiAgICAgICAgICAgIGlmIChleHBvcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgZXhwb3J0Um91dGUgb2YgZXhwb3J0cykge1xuICAgICAgICAgICAgICAgIGV4cG9ydFJvdXRlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWw6IG1hdGVyaWFsLFxuICAgICAgICAgICAgICAgICAgICBzb3VyY2VDaXR5OiBzb3VyY2VDaXR5LFxuICAgICAgICAgICAgICAgICAgICBzb3VyY2VEaXZpc2lvbjogZGl2aXNpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbkRpdmlzaW9uOiBleHBvcnRSb3V0ZS5kaXZpc2lvbixcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25DaXR5OiBleHBvcnRSb3V0ZS5jaXR5LFxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbkFtb3VudDogZXhwb3J0Um91dGUuYW1vdW50LFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGV4cG9ydFJvdXRlcztcbn1cblxuZnVuY3Rpb24gYnVpbGRTbWFydFN1cHBseUtleShkaXZpc2lvbk5hbWU6IHN0cmluZywgY2l0eTogQ2l0eU5hbWUpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHtkaXZpc2lvbk5hbWV9fCR7Y2l0eX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmF3UHJvZHVjdGlvbihcbiAgICBuczogTlMsXG4gICAgZGl2aXNpb246IERpdmlzaW9uLFxuICAgIGNpdHk6IENpdHlOYW1lLFxuICAgIGlzUHJvZHVjdDogYm9vbGVhblxuKTogbnVtYmVyIHtcbiAgICBjb25zdCBvZmZpY2UgPSBucy5jb3Jwb3JhdGlvbi5nZXRPZmZpY2UoZGl2aXNpb24ubmFtZSwgY2l0eSk7XG4gICAgbGV0IHJhd1Byb2R1Y3Rpb24gPSBnZXREaXZpc2lvblJhd1Byb2R1Y3Rpb24oXG4gICAgICAgIGlzUHJvZHVjdCxcbiAgICAgICAge1xuICAgICAgICAgICAgb3BlcmF0aW9uc1Byb2R1Y3Rpb246IG9mZmljZS5lbXBsb3llZVByb2R1Y3Rpb25CeUpvYi5PcGVyYXRpb25zLFxuICAgICAgICAgICAgZW5naW5lZXJQcm9kdWN0aW9uOiBvZmZpY2UuZW1wbG95ZWVQcm9kdWN0aW9uQnlKb2IuRW5naW5lZXIsXG4gICAgICAgICAgICBtYW5hZ2VtZW50UHJvZHVjdGlvbjogb2ZmaWNlLmVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iLk1hbmFnZW1lbnRcbiAgICAgICAgfSxcbiAgICAgICAgZGl2aXNpb24ucHJvZHVjdGlvbk11bHQsXG4gICAgICAgIGdldENvcnBvcmF0aW9uVXBncmFkZUxldmVscyhucyksXG4gICAgICAgIGdldERpdmlzaW9uUmVzZWFyY2hlcyhucywgZGl2aXNpb24ubmFtZSlcbiAgICApO1xuICAgIHJhd1Byb2R1Y3Rpb24gPSByYXdQcm9kdWN0aW9uICogMTA7XG4gICAgcmV0dXJuIHJhd1Byb2R1Y3Rpb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMaW1pdGVkUmF3UHJvZHVjdGlvbihcbiAgICBuczogTlMsXG4gICAgZGl2aXNpb246IERpdmlzaW9uLFxuICAgIGNpdHk6IENpdHlOYW1lLFxuICAgIGluZHVzdHJpYWxEYXRhOiBDb3JwSW5kdXN0cnlEYXRhLFxuICAgIHdhcmVob3VzZTogV2FyZWhvdXNlLFxuICAgIGlzUHJvZHVjdDogYm9vbGVhbixcbiAgICBwcm9kdWN0U2l6ZT86IG51bWJlclxuKTogbnVtYmVyIHtcbiAgICBsZXQgcmF3UHJvZHVjdGlvbiA9IGdldFJhd1Byb2R1Y3Rpb24obnMsIGRpdmlzaW9uLCBjaXR5LCBpc1Byb2R1Y3QpO1xuXG4gICAgLy8gQ2FsY3VsYXRlIHJlcXVpcmVkIHN0b3JhZ2Ugc3BhY2Ugb2YgZWFjaCBvdXRwdXQgdW5pdC4gSXQgaXMgdGhlIG5ldCBjaGFuZ2UgaW4gd2FyZWhvdXNlJ3Mgc3RvcmFnZSBzcGFjZSB3aGVuXG4gICAgLy8gcHJvZHVjaW5nIGFuIG91dHB1dCB1bml0LlxuICAgIGxldCByZXF1aXJlZFN0b3JhZ2VTcGFjZU9mRWFjaE91dHB1dFVuaXQgPSAwO1xuICAgIGlmIChpc1Byb2R1Y3QpIHtcbiAgICAgICAgcmVxdWlyZWRTdG9yYWdlU3BhY2VPZkVhY2hPdXRwdXRVbml0ICs9IHByb2R1Y3RTaXplITtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGNvbnN0IG91dHB1dE1hdGVyaWFsTmFtZSBvZiBpbmR1c3RyaWFsRGF0YS5wcm9kdWNlZE1hdGVyaWFscyEpIHtcbiAgICAgICAgICAgIHJlcXVpcmVkU3RvcmFnZVNwYWNlT2ZFYWNoT3V0cHV0VW5pdCArPSBucy5jb3Jwb3JhdGlvbi5nZXRNYXRlcmlhbERhdGEob3V0cHV0TWF0ZXJpYWxOYW1lKS5zaXplO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgW3JlcXVpcmVkTWF0ZXJpYWxOYW1lLCByZXF1aXJlZE1hdGVyaWFsQ29lZmZpY2llbnRdIG9mIGdldFJlY29yZEVudHJpZXMoaW5kdXN0cmlhbERhdGEucmVxdWlyZWRNYXRlcmlhbHMpKSB7XG4gICAgICAgIHJlcXVpcmVkU3RvcmFnZVNwYWNlT2ZFYWNoT3V0cHV0VW5pdCAtPSBucy5jb3Jwb3JhdGlvbi5nZXRNYXRlcmlhbERhdGEocmVxdWlyZWRNYXRlcmlhbE5hbWUpLnNpemUgKiByZXF1aXJlZE1hdGVyaWFsQ29lZmZpY2llbnQ7XG4gICAgfVxuICAgIC8vIExpbWl0IHRoZSByYXcgcHJvZHVjdGlvbiBpZiBuZWVkZWRcbiAgICBpZiAocmVxdWlyZWRTdG9yYWdlU3BhY2VPZkVhY2hPdXRwdXRVbml0ID4gMCkge1xuICAgICAgICBjb25zdCBtYXhOdW1iZXJPZk91dHB1dFVuaXRzID0gTWF0aC5mbG9vcihcbiAgICAgICAgICAgICh3YXJlaG91c2Uuc2l6ZSAtIHdhcmVob3VzZS5zaXplVXNlZCkgLyByZXF1aXJlZFN0b3JhZ2VTcGFjZU9mRWFjaE91dHB1dFVuaXRcbiAgICAgICAgKTtcbiAgICAgICAgcmF3UHJvZHVjdGlvbiA9IE1hdGgubWluKHJhd1Byb2R1Y3Rpb24sIG1heE51bWJlck9mT3V0cHV0VW5pdHMpO1xuICAgIH1cblxuICAgIHJhd1Byb2R1Y3Rpb24gPSBNYXRoLm1heChyYXdQcm9kdWN0aW9uLCAwKTtcbiAgICByZXR1cm4gcmF3UHJvZHVjdGlvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFNtYXJ0U3VwcGx5RGF0YShuczogTlMpOiB2b2lkIHtcbiAgICAvLyBPbmx5IHNldCBzbWFydCBzdXBwbHkgZGF0YSBhZnRlciBcIlBVUkNIQVNFXCIgc3RhdGVcbiAgICBpZiAobnMuY29ycG9yYXRpb24uZ2V0Q29ycG9yYXRpb24oKS5wcmV2U3RhdGUgIT09IENvcnBTdGF0ZS5QVVJDSEFTRSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGxvb3BBbGxEaXZpc2lvbnNBbmRDaXRpZXMobnMsIChkaXZpc2lvbk5hbWUsIGNpdHkpID0+IHtcbiAgICAgICAgY29uc3QgZGl2aXNpb24gPSBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpO1xuICAgICAgICBjb25zdCBpbmR1c3RyaWFsRGF0YSA9IG5zLmNvcnBvcmF0aW9uLmdldEluZHVzdHJ5RGF0YShkaXZpc2lvbi50eXBlKTtcbiAgICAgICAgY29uc3Qgd2FyZWhvdXNlID0gbnMuY29ycG9yYXRpb24uZ2V0V2FyZWhvdXNlKGRpdmlzaW9uLm5hbWUsIGNpdHkpO1xuICAgICAgICBsZXQgdG90YWxSYXdQcm9kdWN0aW9uID0gMDtcblxuICAgICAgICBpZiAoaW5kdXN0cmlhbERhdGEubWFrZXNNYXRlcmlhbHMpIHtcbiAgICAgICAgICAgIHRvdGFsUmF3UHJvZHVjdGlvbiArPSBnZXRMaW1pdGVkUmF3UHJvZHVjdGlvbihcbiAgICAgICAgICAgICAgICBucyxcbiAgICAgICAgICAgICAgICBkaXZpc2lvbixcbiAgICAgICAgICAgICAgICBjaXR5LFxuICAgICAgICAgICAgICAgIGluZHVzdHJpYWxEYXRhLFxuICAgICAgICAgICAgICAgIHdhcmVob3VzZSxcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmR1c3RyaWFsRGF0YS5tYWtlc1Byb2R1Y3RzKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb2R1Y3ROYW1lIG9mIGRpdmlzaW9uLnByb2R1Y3RzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvZHVjdCA9IG5zLmNvcnBvcmF0aW9uLmdldFByb2R1Y3QoZGl2aXNpb25OYW1lLCBjaXR5LCBwcm9kdWN0TmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKHByb2R1Y3QuZGV2ZWxvcG1lbnRQcm9ncmVzcyA8IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdG90YWxSYXdQcm9kdWN0aW9uICs9IGdldExpbWl0ZWRSYXdQcm9kdWN0aW9uKFxuICAgICAgICAgICAgICAgICAgICBucyxcbiAgICAgICAgICAgICAgICAgICAgZGl2aXNpb24sXG4gICAgICAgICAgICAgICAgICAgIGNpdHksXG4gICAgICAgICAgICAgICAgICAgIGluZHVzdHJpYWxEYXRhLFxuICAgICAgICAgICAgICAgICAgICB3YXJlaG91c2UsXG4gICAgICAgICAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHByb2R1Y3Quc2l6ZVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzbWFydFN1cHBseURhdGEuc2V0KGJ1aWxkU21hcnRTdXBwbHlLZXkoZGl2aXNpb25OYW1lLCBjaXR5KSwgdG90YWxSYXdQcm9kdWN0aW9uKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZGV0ZWN0V2FyZWhvdXNlQ29uZ2VzdGlvbihcbiAgICBuczogTlMsXG4gICAgZGl2aXNpb246IERpdmlzaW9uLFxuICAgIGluZHVzdHJpYWxEYXRhOiBDb3JwSW5kdXN0cnlEYXRhLFxuICAgIGNpdHk6IENpdHlOYW1lLFxuICAgIHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhOiBNYXA8c3RyaW5nLCBudW1iZXI+XG4pOiBib29sZWFuIHtcbiAgICBjb25zdCByZXF1aXJlZE1hdGVyaWFscyA9IGdldFJlY29yZEVudHJpZXMoaW5kdXN0cmlhbERhdGEucmVxdWlyZWRNYXRlcmlhbHMpO1xuICAgIGxldCBpc1dhcmVob3VzZUNvbmdlc3RlZCA9IGZhbHNlO1xuICAgIGNvbnN0IHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhS2V5ID0gYCR7ZGl2aXNpb24ubmFtZX18JHtjaXR5fWA7XG4gICAgY29uc3QgaXRlbXM6IChNYXRlcmlhbCB8IFByb2R1Y3QpW10gPSBbXTtcbiAgICBpZiAoaW5kdXN0cmlhbERhdGEucHJvZHVjZWRNYXRlcmlhbHMpIHtcbiAgICAgICAgZm9yIChjb25zdCBtYXRlcmlhbE5hbWUgb2YgaW5kdXN0cmlhbERhdGEucHJvZHVjZWRNYXRlcmlhbHMpIHtcbiAgICAgICAgICAgIGl0ZW1zLnB1c2gobnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWwoZGl2aXNpb24ubmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lKSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluZHVzdHJpYWxEYXRhLm1ha2VzUHJvZHVjdHMpIHtcbiAgICAgICAgZm9yIChjb25zdCBwcm9kdWN0TmFtZSBvZiBkaXZpc2lvbi5wcm9kdWN0cykge1xuICAgICAgICAgICAgY29uc3QgcHJvZHVjdCA9IG5zLmNvcnBvcmF0aW9uLmdldFByb2R1Y3QoZGl2aXNpb24ubmFtZSwgY2l0eSwgcHJvZHVjdE5hbWUpO1xuICAgICAgICAgICAgaWYgKHByb2R1Y3QuZGV2ZWxvcG1lbnRQcm9ncmVzcyA8IDEwMCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaXRlbXMucHVzaChwcm9kdWN0KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgaWYgKGl0ZW0ucHJvZHVjdGlvbkFtb3VudCAhPT0gMCkge1xuICAgICAgICAgICAgd2FyZWhvdXNlQ29uZ2VzdGlvbkRhdGEuc2V0KHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhS2V5LCAwKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGl0ZW0ucHJvZHVjdGlvbkFtb3VudCA9PT0gMCBtZWFucyB0aGF0IGRpdmlzaW9uIGRvZXMgbm90IHByb2R1Y2UgbWF0ZXJpYWwvcHJvZHVjdCBsYXN0IGN5Y2xlLlxuICAgICAgICBsZXQgbnVtYmVyT2ZDb25nZXN0aW9uVGltZXMgPSB3YXJlaG91c2VDb25nZXN0aW9uRGF0YS5nZXQod2FyZWhvdXNlQ29uZ2VzdGlvbkRhdGFLZXkpISArIDE7XG4gICAgICAgIGlmIChOdW1iZXIuaXNOYU4obnVtYmVyT2ZDb25nZXN0aW9uVGltZXMpKSB7XG4gICAgICAgICAgICBudW1iZXJPZkNvbmdlc3Rpb25UaW1lcyA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgd2FyZWhvdXNlQ29uZ2VzdGlvbkRhdGEuc2V0KHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhS2V5LCBudW1iZXJPZkNvbmdlc3Rpb25UaW1lcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBJZiB0aGF0IGhhcHBlbnMgbW9yZSB0aGFuIDUgdGltZXMsIHRoZSB3YXJlaG91c2UgaXMgdmVyeSBsaWtlbHkgY29uZ2VzdGVkLlxuICAgIGlmICh3YXJlaG91c2VDb25nZXN0aW9uRGF0YS5nZXQod2FyZWhvdXNlQ29uZ2VzdGlvbkRhdGFLZXkpISA+IDUpIHtcbiAgICAgICAgaXNXYXJlaG91c2VDb25nZXN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBXZSBuZWVkIHRvIG1pdGlnYXRlIHRoaXMgc2l0dWF0aW9uLiBEaXNjYXJkaW5nIHN0b3JlZCBpbnB1dCBtYXRlcmlhbCBpcyB0aGUgc2ltcGxlc3Qgc29sdXRpb24uXG4gICAgaWYgKGlzV2FyZWhvdXNlQ29uZ2VzdGVkKSB7XG4gICAgICAgIHNob3dXYXJuaW5nKG5zLCBgV2FyZWhvdXNlIG1heSBiZSBjb25nZXN0ZWQuIERpdmlzaW9uOiAke2RpdmlzaW9uLm5hbWV9LCBjaXR5OiAke2NpdHl9LmApO1xuICAgICAgICBmb3IgKGNvbnN0IFttYXRlcmlhbE5hbWVdIG9mIHJlcXVpcmVkTWF0ZXJpYWxzKSB7XG4gICAgICAgICAgICAvLyBDbGVhciBwdXJjaGFzZVxuICAgICAgICAgICAgbnMuY29ycG9yYXRpb24uYnV5TWF0ZXJpYWwoZGl2aXNpb24ubmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lLCAwKTtcbiAgICAgICAgICAgIC8vIERpc2NhcmQgc3RvcmVkIGlucHV0IG1hdGVyaWFsXG4gICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZWxsTWF0ZXJpYWwoZGl2aXNpb24ubmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lLCBcIk1BWFwiLCBcIjBcIik7XG4gICAgICAgIH1cbiAgICAgICAgd2FyZWhvdXNlQ29uZ2VzdGlvbkRhdGEuc2V0KHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhS2V5LCAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGNvbnN0IFttYXRlcmlhbE5hbWVdIG9mIHJlcXVpcmVkTWF0ZXJpYWxzKSB7XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5zLmNvcnBvcmF0aW9uLmdldE1hdGVyaWFsKGRpdmlzaW9uLm5hbWUsIGNpdHksIG1hdGVyaWFsTmFtZSk7XG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGVzaXJlZFNlbGxBbW91bnQgIT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBTdG9wIGRpc2NhcmRpbmcgaW5wdXQgbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZWxsTWF0ZXJpYWwoZGl2aXNpb24ubmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lLCBcIjBcIiwgXCIwXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpc1dhcmVob3VzZUNvbmdlc3RlZDtcbn1cblxuLyoqXG4gKiBDdXN0b20gU21hcnQgU3VwcGx5IHNjcmlwdFxuICpcbiAqIEBwYXJhbSBuc1xuICogQHBhcmFtIHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidXlPcHRpbWFsQW1vdW50T2ZJbnB1dE1hdGVyaWFscyhuczogTlMsIHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhOiBNYXA8c3RyaW5nLCBudW1iZXI+KTogdm9pZCB7XG4gICAgaWYgKG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkubmV4dFN0YXRlICE9PSBcIlBVUkNIQVNFXCIpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBMb29wIGFuZCBzZXQgYnV5IGFtb3VudFxuICAgIGxvb3BBbGxEaXZpc2lvbnNBbmRDaXRpZXMobnMsIChkaXZpc2lvbk5hbWUsIGNpdHkpID0+IHtcbiAgICAgICAgY29uc3QgZGl2aXNpb24gPSBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpO1xuICAgICAgICBjb25zdCBpbmR1c3RyaWFsRGF0YSA9IG5zLmNvcnBvcmF0aW9uLmdldEluZHVzdHJ5RGF0YShkaXZpc2lvbi50eXBlKTtcbiAgICAgICAgY29uc3Qgb2ZmaWNlID0gbnMuY29ycG9yYXRpb24uZ2V0T2ZmaWNlKGRpdmlzaW9uLm5hbWUsIGNpdHkpO1xuICAgICAgICBjb25zdCByZXF1aXJlZE1hdGVyaWFscyA9IGdldFJlY29yZEVudHJpZXMoaW5kdXN0cmlhbERhdGEucmVxdWlyZWRNYXRlcmlhbHMpO1xuXG4gICAgICAgIC8vIERldGVjdCB3YXJlaG91c2UgY29uZ2VzdGlvblxuICAgICAgICBsZXQgaXNXYXJlaG91c2VDb25nZXN0ZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKCFzZXRPZkRpdmlzaW9uc1dhaXRpbmdGb3JSUC5oYXMoZGl2aXNpb25OYW1lKVxuICAgICAgICAgICAgJiYgb2ZmaWNlLmVtcGxveWVlSm9ic1tcIlJlc2VhcmNoICYgRGV2ZWxvcG1lbnRcIl0gIT09IG9mZmljZS5udW1FbXBsb3llZXMpIHtcbiAgICAgICAgICAgIGlzV2FyZWhvdXNlQ29uZ2VzdGVkID0gZGV0ZWN0V2FyZWhvdXNlQ29uZ2VzdGlvbihcbiAgICAgICAgICAgICAgICBucyxcbiAgICAgICAgICAgICAgICBkaXZpc2lvbixcbiAgICAgICAgICAgICAgICBpbmR1c3RyaWFsRGF0YSxcbiAgICAgICAgICAgICAgICBjaXR5LFxuICAgICAgICAgICAgICAgIHdhcmVob3VzZUNvbmdlc3Rpb25EYXRhXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc1dhcmVob3VzZUNvbmdlc3RlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2FyZWhvdXNlID0gbnMuY29ycG9yYXRpb24uZ2V0V2FyZWhvdXNlKGRpdmlzaW9uLm5hbWUsIGNpdHkpO1xuICAgICAgICBjb25zdCBpbnB1dE1hdGVyaWFsczogUGFydGlhbFJlY29yZDxDb3JwTWF0ZXJpYWxOYW1lLCB7XG4gICAgICAgICAgICByZXF1aXJlZFF1YW50aXR5OiBudW1iZXIsXG4gICAgICAgICAgICBjb2VmZmljaWVudDogbnVtYmVyO1xuICAgICAgICB9PiA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFttYXRlcmlhbE5hbWUsIG1hdGVyaWFsQ29lZmZpY2llbnRdIG9mIHJlcXVpcmVkTWF0ZXJpYWxzKSB7XG4gICAgICAgICAgICBpbnB1dE1hdGVyaWFsc1ttYXRlcmlhbE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkUXVhbnRpdHk6IDAsXG4gICAgICAgICAgICAgICAgY29lZmZpY2llbnQ6IG1hdGVyaWFsQ29lZmZpY2llbnRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaW5kIHJlcXVpcmVkIHF1YW50aXR5IG9mIGlucHV0IG1hdGVyaWFscyB0byBwcm9kdWNlIG1hdGVyaWFsL3Byb2R1Y3RcbiAgICAgICAgZm9yIChjb25zdCBpbnB1dE1hdGVyaWFsRGF0YSBvZiBPYmplY3QudmFsdWVzKGlucHV0TWF0ZXJpYWxzKSkge1xuICAgICAgICAgICAgY29uc3QgcmVxdWlyZWRRdWFudGl0eSA9IChzbWFydFN1cHBseURhdGEuZ2V0KGJ1aWxkU21hcnRTdXBwbHlLZXkoZGl2aXNpb25OYW1lLCBjaXR5KSkgPz8gMClcbiAgICAgICAgICAgICAgICAqIGlucHV0TWF0ZXJpYWxEYXRhLmNvZWZmaWNpZW50O1xuICAgICAgICAgICAgaW5wdXRNYXRlcmlhbERhdGEucmVxdWlyZWRRdWFudGl0eSArPSByZXF1aXJlZFF1YW50aXR5O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTGltaXQgdGhlIGlucHV0IG1hdGVyaWFsIHVuaXRzIHRvIG1heCBudW1iZXIgb2YgdW5pdHMgdGhhdCB3ZSBjYW4gc3RvcmUgaW4gd2FyZWhvdXNlJ3MgZnJlZSBzcGFjZVxuICAgICAgICBmb3IgKGNvbnN0IFttYXRlcmlhbE5hbWUsIGlucHV0TWF0ZXJpYWxEYXRhXSBvZiBnZXRSZWNvcmRFbnRyaWVzKGlucHV0TWF0ZXJpYWxzKSkge1xuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxEYXRhID0gbnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWxEYXRhKG1hdGVyaWFsTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBtYXhBY2NlcHRhYmxlUXVhbnRpdHkgPSBNYXRoLmZsb29yKCh3YXJlaG91c2Uuc2l6ZSAtIHdhcmVob3VzZS5zaXplVXNlZCkgLyBtYXRlcmlhbERhdGEuc2l6ZSk7XG4gICAgICAgICAgICBjb25zdCBsaW1pdGVkUmVxdWlyZWRRdWFudGl0eSA9IE1hdGgubWluKGlucHV0TWF0ZXJpYWxEYXRhLnJlcXVpcmVkUXVhbnRpdHksIG1heEFjY2VwdGFibGVRdWFudGl0eSk7XG4gICAgICAgICAgICBpZiAobGltaXRlZFJlcXVpcmVkUXVhbnRpdHkgPiAwKSB7XG4gICAgICAgICAgICAgICAgaW5wdXRNYXRlcmlhbERhdGEucmVxdWlyZWRRdWFudGl0eSA9IGxpbWl0ZWRSZXF1aXJlZFF1YW50aXR5O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmluZCB3aGljaCBpbnB1dCBtYXRlcmlhbCBjcmVhdGVzIHRoZSBsZWFzdCBudW1iZXIgb2Ygb3V0cHV0IHVuaXRzXG4gICAgICAgIGxldCBsZWFzdEFtb3VudE9mT3V0cHV0VW5pdHMgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBmb3IgKGNvbnN0IHsgcmVxdWlyZWRRdWFudGl0eSwgY29lZmZpY2llbnQgfSBvZiBPYmplY3QudmFsdWVzKGlucHV0TWF0ZXJpYWxzKSkge1xuICAgICAgICAgICAgY29uc3QgYW1vdW50T2ZPdXRwdXRVbml0cyA9IHJlcXVpcmVkUXVhbnRpdHkgLyBjb2VmZmljaWVudDtcbiAgICAgICAgICAgIGlmIChhbW91bnRPZk91dHB1dFVuaXRzIDwgbGVhc3RBbW91bnRPZk91dHB1dFVuaXRzKSB7XG4gICAgICAgICAgICAgICAgbGVhc3RBbW91bnRPZk91dHB1dFVuaXRzID0gYW1vdW50T2ZPdXRwdXRVbml0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFsaWduIGFsbCB0aGUgaW5wdXQgbWF0ZXJpYWxzIHRvIHRoZSBzbWFsbGVzdCBhbW91bnRcbiAgICAgICAgZm9yIChjb25zdCBpbnB1dE1hdGVyaWFsRGF0YSBvZiBPYmplY3QudmFsdWVzKGlucHV0TWF0ZXJpYWxzKSkge1xuICAgICAgICAgICAgaW5wdXRNYXRlcmlhbERhdGEucmVxdWlyZWRRdWFudGl0eSA9IGxlYXN0QW1vdW50T2ZPdXRwdXRVbml0cyAqIGlucHV0TWF0ZXJpYWxEYXRhLmNvZWZmaWNpZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIG9mIGFsbCBpbnB1dCBtYXRlcmlhbHMgd2UgYXJlIHRyeWluZyB0byBidXlcbiAgICAgICAgbGV0IHJlcXVpcmVkU3BhY2UgPSAwO1xuICAgICAgICBmb3IgKGNvbnN0IFttYXRlcmlhbE5hbWUsIGlucHV0TWF0ZXJpYWxEYXRhXSBvZiBnZXRSZWNvcmRFbnRyaWVzKGlucHV0TWF0ZXJpYWxzKSkge1xuICAgICAgICAgICAgcmVxdWlyZWRTcGFjZSArPSBpbnB1dE1hdGVyaWFsRGF0YS5yZXF1aXJlZFF1YW50aXR5ICogbnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWxEYXRhKG1hdGVyaWFsTmFtZSkuc2l6ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRoZXJlIGlzIG5vdCBlbm91Z2ggZnJlZSBzcGFjZSwgd2UgYXBwbHkgYSBtdWx0aXBsaWVyIHRvIHJlcXVpcmVkIHF1YW50aXR5IHRvIG5vdCBvdmVyZmlsbCB3YXJlaG91c2VcbiAgICAgICAgY29uc3QgZnJlZVNwYWNlID0gd2FyZWhvdXNlLnNpemUgLSB3YXJlaG91c2Uuc2l6ZVVzZWQ7XG4gICAgICAgIGlmIChyZXF1aXJlZFNwYWNlID4gZnJlZVNwYWNlKSB7XG4gICAgICAgICAgICBjb25zdCBjb25zdHJhaW5lZFN0b3JhZ2VTcGFjZU11bHRpcGxpZXIgPSBmcmVlU3BhY2UgLyByZXF1aXJlZFNwYWNlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBpbnB1dE1hdGVyaWFsRGF0YSBvZiBPYmplY3QudmFsdWVzKGlucHV0TWF0ZXJpYWxzKSkge1xuICAgICAgICAgICAgICAgIGlucHV0TWF0ZXJpYWxEYXRhLnJlcXVpcmVkUXVhbnRpdHkgPSBNYXRoLmZsb29yKGlucHV0TWF0ZXJpYWxEYXRhLnJlcXVpcmVkUXVhbnRpdHkgKiBjb25zdHJhaW5lZFN0b3JhZ2VTcGFjZU11bHRpcGxpZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGVkdWN0IHRoZSBudW1iZXIgb2Ygc3RvcmVkIGlucHV0IG1hdGVyaWFsIHVuaXRzIGZyb20gdGhlIHJlcXVpcmVkIHF1YW50aXR5XG4gICAgICAgIGZvciAoY29uc3QgW21hdGVyaWFsTmFtZSwgaW5wdXRNYXRlcmlhbERhdGFdIG9mIGdldFJlY29yZEVudHJpZXMoaW5wdXRNYXRlcmlhbHMpKSB7XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5zLmNvcnBvcmF0aW9uLmdldE1hdGVyaWFsKGRpdmlzaW9uTmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lKTtcbiAgICAgICAgICAgIGlucHV0TWF0ZXJpYWxEYXRhLnJlcXVpcmVkUXVhbnRpdHkgPSBNYXRoLm1heCgwLCBpbnB1dE1hdGVyaWFsRGF0YS5yZXF1aXJlZFF1YW50aXR5IC0gbWF0ZXJpYWwuc3RvcmVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJ1eSBpbnB1dCBtYXRlcmlhbHNcbiAgICAgICAgZm9yIChjb25zdCBbbWF0ZXJpYWxOYW1lLCBpbnB1dE1hdGVyaWFsRGF0YV0gb2YgZ2V0UmVjb3JkRW50cmllcyhpbnB1dE1hdGVyaWFscykpIHtcbiAgICAgICAgICAgIG5zLmNvcnBvcmF0aW9uLmJ1eU1hdGVyaWFsKGRpdmlzaW9uTmFtZSwgY2l0eSwgbWF0ZXJpYWxOYW1lLCBpbnB1dE1hdGVyaWFsRGF0YS5yZXF1aXJlZFF1YW50aXR5IC8gMTApO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbi8qKlxuICogQHBhcmFtIG5zXG4gKiBAcGFyYW0gZGl2aXNpb25OYW1lXG4gKiBAcGFyYW0gaW5kdXN0cnlEYXRhXG4gKiBAcGFyYW0gY2l0eVxuICogQHBhcmFtIHVzZVdhcmVob3VzZVNpemUgSWYgZmFsc2UsIGZ1bmN0aW9uIHVzZXMgdW51c2VkIHN0b3JhZ2Ugc2l6ZSBhZnRlciBQUk9EVUNUSU9OIHN0YXRlXG4gKiBAcGFyYW0gcmF0aW9cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRPcHRpbWFsQW1vdW50T2ZCb29zdE1hdGVyaWFscyhcbiAgICBuczogTlMsXG4gICAgZGl2aXNpb25OYW1lOiBzdHJpbmcsXG4gICAgaW5kdXN0cnlEYXRhOiBDb3JwSW5kdXN0cnlEYXRhLFxuICAgIGNpdHk6IENpdHlOYW1lLFxuICAgIHVzZVdhcmVob3VzZVNpemU6IGJvb2xlYW4sXG4gICAgcmF0aW86IG51bWJlclxuKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICAgIGNvbnN0IHdhcmVob3VzZVNpemUgPSBucy5jb3Jwb3JhdGlvbi5nZXRXYXJlaG91c2UoZGl2aXNpb25OYW1lLCBjaXR5KS5zaXplO1xuICAgIGlmICh1c2VXYXJlaG91c2VTaXplKSB7XG4gICAgICAgIHJldHVybiBnZXRPcHRpbWFsQm9vc3RNYXRlcmlhbFF1YW50aXRpZXMoaW5kdXN0cnlEYXRhLCB3YXJlaG91c2VTaXplICogcmF0aW8pO1xuICAgIH1cbiAgICBhd2FpdCB3YWl0VW50aWxBZnRlclN0YXRlSGFwcGVucyhucywgQ29ycFN0YXRlLlBST0RVQ1RJT04pO1xuICAgIGNvbnN0IGF2YWlsYWJsZVNwYWNlID0gbnMuY29ycG9yYXRpb24uZ2V0V2FyZWhvdXNlKGRpdmlzaW9uTmFtZSwgY2l0eSkuc2l6ZVxuICAgICAgICAtIG5zLmNvcnBvcmF0aW9uLmdldFdhcmVob3VzZShkaXZpc2lvbk5hbWUsIGNpdHkpLnNpemVVc2VkO1xuICAgIHJldHVybiBnZXRPcHRpbWFsQm9vc3RNYXRlcmlhbFF1YW50aXRpZXMoaW5kdXN0cnlEYXRhLCBhdmFpbGFibGVTcGFjZSAqIHJhdGlvKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRVbnRpbEhhdmluZ0Vub3VnaFJlc2VhcmNoUG9pbnRzKG5zOiBOUywgY29uZGl0aW9uczoge1xuICAgIGRpdmlzaW9uTmFtZTogc3RyaW5nO1xuICAgIHJlc2VhcmNoUG9pbnQ6IG51bWJlcjtcbn1bXSk6IFByb21pc2U8dm9pZD4ge1xuICAgIG5zLnByaW50KGBXYWl0aW5nIGZvciByZXNlYXJjaCBwb2ludHM6ICR7SlNPTi5zdHJpbmdpZnkoY29uZGl0aW9ucyl9YCk7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgbGV0IGZpbmlzaCA9IHRydWU7XG4gICAgICAgIGZvciAoY29uc3QgY29uZGl0aW9uIG9mIGNvbmRpdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihjb25kaXRpb24uZGl2aXNpb25OYW1lKS5yZXNlYXJjaFBvaW50cyA+PSBjb25kaXRpb24ucmVzZWFyY2hQb2ludCkge1xuICAgICAgICAgICAgICAgIHNldE9mRGl2aXNpb25zV2FpdGluZ0ZvclJQLmRlbGV0ZShjb25kaXRpb24uZGl2aXNpb25OYW1lKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldE9mRGl2aXNpb25zV2FpdGluZ0ZvclJQLmFkZChjb25kaXRpb24uZGl2aXNpb25OYW1lKTtcbiAgICAgICAgICAgIGZpbmlzaCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmaW5pc2gpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IG5zLmNvcnBvcmF0aW9uLm5leHRVcGRhdGUoKTtcbiAgICB9XG4gICAgbnMucHJpbnQoYEZpbmlzaGVkIHdhaXRpbmcgZm9yIHJlc2VhcmNoIHBvaW50cy4gQ29uZGl0aW9uczogJHtKU09OLnN0cmluZ2lmeShjb25kaXRpb25zKX1gKTtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGFzc3VtZXMgdGhhdCBhbGwgcHJvZHVjdCdzIG5hbWVzIHdlcmUgZ2VuZXJhdGVkIGJ5IHtAbGluayBnZW5lcmF0ZU5leHRQcm9kdWN0TmFtZX1cbiAqXG4gKiBAcGFyYW0gbnNcbiAqIEBwYXJhbSBkaXZpc2lvbk5hbWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByb2R1Y3RJZEFycmF5KG5zOiBOUywgZGl2aXNpb25OYW1lOiBzdHJpbmcpOiBudW1iZXJbXSB7XG4gICAgY29uc3QgcHJvZHVjdHMgPSBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpLnByb2R1Y3RzO1xuICAgIHJldHVybiBwcm9kdWN0c1xuICAgICAgICAubWFwKHByb2R1Y3ROYW1lID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByb2R1Y3ROYW1lUGFydHMgPSBwcm9kdWN0TmFtZS5zcGxpdChcIi1cIik7XG4gICAgICAgICAgICBpZiAocHJvZHVjdE5hbWVQYXJ0cy5sZW5ndGggIT0gMykge1xuICAgICAgICAgICAgICAgIHJldHVybiBOYU47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VOdW1iZXIocHJvZHVjdE5hbWVQYXJ0c1sxXSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5maWx0ZXIocHJvZHVjdEluZGV4ID0+ICFOdW1iZXIuaXNOYU4ocHJvZHVjdEluZGV4KSk7XG59XG5cbi8qKlxuICogW1wiVG9iYWNjby0wMDAwMHwxZTEyXCIsIFwiVG9iYWNjby0wMDAwMXwxZTEyXCIsIFwiVG9iYWNjby0wMDAwMnwxZTEyXCJdID0+IFwiVG9iYWNjby0wMDAwM3wxZTEyXCJcbiAqIDFlMTIgaXMgZGVzaWduSW52ZXN0ICsgbWFya2V0aW5nSW52ZXN0XG4gKlxuICogQHBhcmFtIG5zXG4gKiBAcGFyYW0gZGl2aXNpb25OYW1lXG4gKiBAcGFyYW0gcHJvZHVjdERldmVsb3BtZW50QnVkZ2V0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZU5leHRQcm9kdWN0TmFtZShuczogTlMsIGRpdmlzaW9uTmFtZTogc3RyaW5nLCBwcm9kdWN0RGV2ZWxvcG1lbnRCdWRnZXQ6IG51bWJlcik6IHN0cmluZyB7XG4gICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUocHJvZHVjdERldmVsb3BtZW50QnVkZ2V0KSB8fCBwcm9kdWN0RGV2ZWxvcG1lbnRCdWRnZXQgPCAxZTMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGJ1ZGdldDogJHtwcm9kdWN0RGV2ZWxvcG1lbnRCdWRnZXR9YCk7XG4gICAgfVxuICAgIGNvbnN0IHByb2R1Y3RJZEFycmF5ID0gZ2V0UHJvZHVjdElkQXJyYXkobnMsIGRpdmlzaW9uTmFtZSk7XG4gICAgaWYgKHByb2R1Y3RJZEFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gYCR7ZGl2aXNpb25OYW1lfS0wMDAwMC0ke3Byb2R1Y3REZXZlbG9wbWVudEJ1ZGdldC50b0V4cG9uZW50aWFsKDUpfWA7XG4gICAgfVxuICAgIHJldHVybiBgJHtkaXZpc2lvbk5hbWV9LSR7KE1hdGgubWF4KC4uLnByb2R1Y3RJZEFycmF5KSArIDEpLnRvU3RyaW5nKCkucGFkU3RhcnQoNSwgXCIwXCIpfS0ke3Byb2R1Y3REZXZlbG9wbWVudEJ1ZGdldC50b0V4cG9uZW50aWFsKDUpfWA7XG59XG5cbmZ1bmN0aW9uIGdldE1heE51bWJlck9mUHJvZHVjdHMobnM6IE5TLCBkaXZpc2lvbk5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgbGV0IG1heE51bWJlck9mUHJvZHVjdHMgPSAzO1xuICAgIGlmIChucy5jb3Jwb3JhdGlvbi5oYXNSZXNlYXJjaGVkKGRpdmlzaW9uTmFtZSwgUmVzZWFyY2hOYW1lLlVQR1JBREVfQ0FQQUNJVFlfMSkpIHtcbiAgICAgICAgbWF4TnVtYmVyT2ZQcm9kdWN0cyA9IDQ7XG4gICAgfVxuICAgIGlmIChucy5jb3Jwb3JhdGlvbi5oYXNSZXNlYXJjaGVkKGRpdmlzaW9uTmFtZSwgUmVzZWFyY2hOYW1lLlVQR1JBREVfQ0FQQUNJVFlfMikpIHtcbiAgICAgICAgbWF4TnVtYmVyT2ZQcm9kdWN0cyA9IDU7XG4gICAgfVxuICAgIHJldHVybiBtYXhOdW1iZXJPZlByb2R1Y3RzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV2ZWxvcE5ld1Byb2R1Y3QoXG4gICAgbnM6IE5TLFxuICAgIGRpdmlzaW9uTmFtZTogc3RyaW5nLFxuICAgIG1haW5Qcm9kdWN0RGV2ZWxvcG1lbnRDaXR5OiBDaXR5TmFtZSxcbiAgICBwcm9kdWN0RGV2ZWxvcG1lbnRCdWRnZXQ6IG51bWJlclxuKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgcHJvZHVjdHMgPSBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpLnByb2R1Y3RzO1xuXG4gICAgbGV0IGhhc0RldmVsb3BpbmdQcm9kdWN0ID0gZmFsc2U7XG4gICAgbGV0IGJlc3RQcm9kdWN0ID0gbnVsbDtcbiAgICBsZXQgd29yc3RQcm9kdWN0ID0gbnVsbDtcbiAgICBsZXQgbWF4UHJvZHVjdFJhdGluZyA9IE51bWJlci5NSU5fVkFMVUU7XG4gICAgbGV0IG1pblByb2R1Y3RSYXRpbmcgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgIGZvciAoY29uc3QgcHJvZHVjdE5hbWUgb2YgcHJvZHVjdHMpIHtcbiAgICAgICAgY29uc3QgcHJvZHVjdCA9IG5zLmNvcnBvcmF0aW9uLmdldFByb2R1Y3QoZGl2aXNpb25OYW1lLCBtYWluUHJvZHVjdERldmVsb3BtZW50Q2l0eSwgcHJvZHVjdE5hbWUpO1xuICAgICAgICAvL0NoZWNrIGlmIHRoZXJlIGlzIGFueSBkZXZlbG9waW5nIHByb2R1Y3RcbiAgICAgICAgaWYgKHByb2R1Y3QuZGV2ZWxvcG1lbnRQcm9ncmVzcyA8IDEwMCkge1xuICAgICAgICAgICAgaGFzRGV2ZWxvcGluZ1Byb2R1Y3QgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBiZXN0IGFuZCB3b3JzdCBwcm9kdWN0XG4gICAgICAgIGNvbnN0IHByb2R1Y3RSYXRpbmcgPSBwcm9kdWN0LnJhdGluZztcbiAgICAgICAgaWYgKHByb2R1Y3RSYXRpbmcgPCBtaW5Qcm9kdWN0UmF0aW5nKSB7XG4gICAgICAgICAgICB3b3JzdFByb2R1Y3QgPSBwcm9kdWN0O1xuICAgICAgICAgICAgbWluUHJvZHVjdFJhdGluZyA9IHByb2R1Y3RSYXRpbmc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb2R1Y3RSYXRpbmcgPiBtYXhQcm9kdWN0UmF0aW5nKSB7XG4gICAgICAgICAgICBiZXN0UHJvZHVjdCA9IHByb2R1Y3Q7XG4gICAgICAgICAgICBtYXhQcm9kdWN0UmF0aW5nID0gcHJvZHVjdFJhdGluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIERvIG5vdGhpbmcgaWYgdGhlcmUgaXMgYW55IGRldmVsb3BpbmcgcHJvZHVjdFxuICAgIGlmIChoYXNEZXZlbG9waW5nUHJvZHVjdCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKCFiZXN0UHJvZHVjdCAmJiBwcm9kdWN0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIHRoZSBiZXN0IHByb2R1Y3RcIik7XG4gICAgfVxuICAgIGlmICghd29yc3RQcm9kdWN0ICYmIHByb2R1Y3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgdGhlIHdvcnN0IHByb2R1Y3QgdG8gZGlzY29udGludWVcIik7XG4gICAgfVxuICAgIC8vIE5ldyBwcm9kdWN0J3MgYnVkZ2V0IHNob3VsZCBiZSBncmVhdGVyIHRoYW4gWCUgb2YgY3VycmVudCBiZXN0IHByb2R1Y3QncyBidWRnZXQuXG4gICAgaWYgKGJlc3RQcm9kdWN0KSB7XG4gICAgICAgIGNvbnN0IGJlc3RQcm9kdWN0QnVkZ2V0ID0gYmVzdFByb2R1Y3QuZGVzaWduSW52ZXN0bWVudCArIGJlc3RQcm9kdWN0LmFkdmVydGlzaW5nSW52ZXN0bWVudDtcbiAgICAgICAgaWYgKHByb2R1Y3REZXZlbG9wbWVudEJ1ZGdldCA8IGJlc3RQcm9kdWN0QnVkZ2V0ICogMC41ICYmIHByb2R1Y3RzLmxlbmd0aCA+PSAzKSB7XG4gICAgICAgICAgICBjb25zdCB3YXJuaW5nTWVzc2FnZSA9IGBCdWRnZXQgZm9yIG5ldyBwcm9kdWN0IGlzIHRvbyBsb3c6ICR7bnMuZm9ybWF0TnVtYmVyKHByb2R1Y3REZXZlbG9wbWVudEJ1ZGdldCl9LiBgXG4gICAgICAgICAgICAgICAgKyBgQ3VycmVudCBiZXN0IHByb2R1Y3QncyBidWRnZXQ6ICR7bnMuZm9ybWF0TnVtYmVyKGJlc3RQcm9kdWN0QnVkZ2V0KX1gO1xuICAgICAgICAgICAgc2hvd1dhcm5pbmcoXG4gICAgICAgICAgICAgICAgbnMsXG4gICAgICAgICAgICAgICAgd2FybmluZ01lc3NhZ2VcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAod29yc3RQcm9kdWN0ICYmIHByb2R1Y3RzLmxlbmd0aCA9PT0gZ2V0TWF4TnVtYmVyT2ZQcm9kdWN0cyhucywgZGl2aXNpb25OYW1lKSkge1xuICAgICAgICBucy5jb3Jwb3JhdGlvbi5kaXNjb250aW51ZVByb2R1Y3QoZGl2aXNpb25OYW1lLCB3b3JzdFByb2R1Y3QubmFtZSk7XG4gICAgfVxuICAgIGNvbnN0IHByb2R1Y3ROYW1lID0gZ2VuZXJhdGVOZXh0UHJvZHVjdE5hbWUobnMsIGRpdmlzaW9uTmFtZSwgcHJvZHVjdERldmVsb3BtZW50QnVkZ2V0KTtcbiAgICBucy5jb3Jwb3JhdGlvbi5tYWtlUHJvZHVjdChcbiAgICAgICAgZGl2aXNpb25OYW1lLFxuICAgICAgICBtYWluUHJvZHVjdERldmVsb3BtZW50Q2l0eSxcbiAgICAgICAgcHJvZHVjdE5hbWUsXG4gICAgICAgIHByb2R1Y3REZXZlbG9wbWVudEJ1ZGdldCAvIDIsXG4gICAgICAgIHByb2R1Y3REZXZlbG9wbWVudEJ1ZGdldCAvIDIsXG4gICAgKTtcbiAgICByZXR1cm4gcHJvZHVjdE5hbWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROZXdlc3RQcm9kdWN0TmFtZShuczogTlMsIGRpdmlzaW9uTmFtZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgcHJvZHVjdHMgPSBucy5jb3Jwb3JhdGlvbi5nZXREaXZpc2lvbihkaXZpc2lvbk5hbWUpLnByb2R1Y3RzO1xuICAgIGlmIChwcm9kdWN0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBwcm9kdWN0c1twcm9kdWN0cy5sZW5ndGggLSAxXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGN1bGF0ZVByb2R1Y3RNYXJrdXAoXG4gICAgZGl2aXNpb25SUDogbnVtYmVyLFxuICAgIGluZHVzdHJ5U2NpZW5jZUZhY3RvcjogbnVtYmVyLFxuICAgIHByb2R1Y3Q6IFByb2R1Y3QsXG4gICAgZW1wbG95ZWVQcm9kdWN0aW9uQnlKb2I/OiB7XG4gICAgICAgIG9wZXJhdGlvbnNQcm9kdWN0aW9uOiBudW1iZXI7XG4gICAgICAgIGVuZ2luZWVyUHJvZHVjdGlvbjogbnVtYmVyO1xuICAgICAgICBidXNpbmVzc1Byb2R1Y3Rpb246IG51bWJlcjtcbiAgICAgICAgbWFuYWdlbWVudFByb2R1Y3Rpb246IG51bWJlcjtcbiAgICAgICAgcmVzZWFyY2hBbmREZXZlbG9wbWVudFByb2R1Y3Rpb246IG51bWJlcjtcbiAgICB9XG4pOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGNvbnN0IGRlc2lnbkludmVzdG1lbnRNdWx0aXBsaWVyID0gMSArIE1hdGgucG93KHByb2R1Y3QuZGVzaWduSW52ZXN0bWVudCwgMC4xKSAvIDEwMDtcbiAgICBjb25zdCByZXNlYXJjaFBvaW50TXVsdGlwbGllciA9IDEgKyBNYXRoLnBvdyhkaXZpc2lvblJQLCBpbmR1c3RyeVNjaWVuY2VGYWN0b3IpIC8gODAwO1xuICAgIGNvbnN0IGsgPSBkZXNpZ25JbnZlc3RtZW50TXVsdGlwbGllciAqIHJlc2VhcmNoUG9pbnRNdWx0aXBsaWVyO1xuICAgIGNvbnN0IGJhbGFuY2VNdWx0aXBsaWVyID0gZnVuY3Rpb24gKFxuICAgICAgICBjcmVhdGlvbkpvYkZhY3RvcnNFbmdpbmVlcjogbnVtYmVyLFxuICAgICAgICBjcmVhdGlvbkpvYkZhY3RvcnNNYW5hZ2VtZW50OiBudW1iZXIsXG4gICAgICAgIGNyZWF0aW9uSm9iRmFjdG9yc1JuRDogbnVtYmVyLFxuICAgICAgICBjcmVhdGlvbkpvYkZhY3RvcnNPcGVyYXRpb25zOiBudW1iZXIsXG4gICAgICAgIGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzOiBudW1iZXIpOiBudW1iZXIge1xuICAgICAgICBjb25zdCB0b3RhbENyZWF0aW9uSm9iRmFjdG9ycyA9IGNyZWF0aW9uSm9iRmFjdG9yc0VuZ2luZWVyICsgY3JlYXRpb25Kb2JGYWN0b3JzTWFuYWdlbWVudCArIGNyZWF0aW9uSm9iRmFjdG9yc1JuRCArIGNyZWF0aW9uSm9iRmFjdG9yc09wZXJhdGlvbnMgKyBjcmVhdGlvbkpvYkZhY3RvcnNCdXNpbmVzcztcbiAgICAgICAgY29uc3QgZW5naW5lZXJSYXRpbyA9IGNyZWF0aW9uSm9iRmFjdG9yc0VuZ2luZWVyIC8gdG90YWxDcmVhdGlvbkpvYkZhY3RvcnM7XG4gICAgICAgIGNvbnN0IG1hbmFnZW1lbnRSYXRpbyA9IGNyZWF0aW9uSm9iRmFjdG9yc01hbmFnZW1lbnQgLyB0b3RhbENyZWF0aW9uSm9iRmFjdG9ycztcbiAgICAgICAgY29uc3QgcmVzZWFyY2hBbmREZXZlbG9wbWVudFJhdGlvID0gY3JlYXRpb25Kb2JGYWN0b3JzUm5EIC8gdG90YWxDcmVhdGlvbkpvYkZhY3RvcnM7XG4gICAgICAgIGNvbnN0IG9wZXJhdGlvbnNSYXRpbyA9IGNyZWF0aW9uSm9iRmFjdG9yc09wZXJhdGlvbnMgLyB0b3RhbENyZWF0aW9uSm9iRmFjdG9ycztcbiAgICAgICAgY29uc3QgYnVzaW5lc3NSYXRpbyA9IGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzIC8gdG90YWxDcmVhdGlvbkpvYkZhY3RvcnM7XG4gICAgICAgIHJldHVybiAxLjIgKiBlbmdpbmVlclJhdGlvICsgMC45ICogbWFuYWdlbWVudFJhdGlvICsgMS4zICogcmVzZWFyY2hBbmREZXZlbG9wbWVudFJhdGlvICsgMS41ICogb3BlcmF0aW9uc1JhdGlvICsgYnVzaW5lc3NSYXRpbztcblxuICAgIH07XG4gICAgY29uc3QgZjEgPSBmdW5jdGlvbiAoW2NyZWF0aW9uSm9iRmFjdG9yc0VuZ2luZWVyLCBjcmVhdGlvbkpvYkZhY3RvcnNNYW5hZ2VtZW50LCBjcmVhdGlvbkpvYkZhY3RvcnNSbkQsIGNyZWF0aW9uSm9iRmFjdG9yc09wZXJhdGlvbnMsIGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzXTogbnVtYmVyW10pIHtcbiAgICAgICAgcmV0dXJuIGtcbiAgICAgICAgICAgICogYmFsYW5jZU11bHRpcGxpZXIoY3JlYXRpb25Kb2JGYWN0b3JzRW5naW5lZXIsIGNyZWF0aW9uSm9iRmFjdG9yc01hbmFnZW1lbnQsIGNyZWF0aW9uSm9iRmFjdG9yc1JuRCwgY3JlYXRpb25Kb2JGYWN0b3JzT3BlcmF0aW9ucywgY3JlYXRpb25Kb2JGYWN0b3JzQnVzaW5lc3MpXG4gICAgICAgICAgICAqICgwLjEgKiBjcmVhdGlvbkpvYkZhY3RvcnNFbmdpbmVlciArIDAuMDUgKiBjcmVhdGlvbkpvYkZhY3RvcnNNYW5hZ2VtZW50ICsgMC4wNSAqIGNyZWF0aW9uSm9iRmFjdG9yc1JuRCArIDAuMDIgKiBjcmVhdGlvbkpvYkZhY3RvcnNPcGVyYXRpb25zICsgMC4wMiAqIGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzKVxuICAgICAgICAgICAgLSBwcm9kdWN0LnN0YXRzLnF1YWxpdHk7XG4gICAgfTtcbiAgICBjb25zdCBmMiA9IGZ1bmN0aW9uIChbY3JlYXRpb25Kb2JGYWN0b3JzRW5naW5lZXIsIGNyZWF0aW9uSm9iRmFjdG9yc01hbmFnZW1lbnQsIGNyZWF0aW9uSm9iRmFjdG9yc1JuRCwgY3JlYXRpb25Kb2JGYWN0b3JzT3BlcmF0aW9ucywgY3JlYXRpb25Kb2JGYWN0b3JzQnVzaW5lc3NdOiBudW1iZXJbXSkge1xuICAgICAgICByZXR1cm4ga1xuICAgICAgICAgICAgKiBiYWxhbmNlTXVsdGlwbGllcihjcmVhdGlvbkpvYkZhY3RvcnNFbmdpbmVlciwgY3JlYXRpb25Kb2JGYWN0b3JzTWFuYWdlbWVudCwgY3JlYXRpb25Kb2JGYWN0b3JzUm5ELCBjcmVhdGlvbkpvYkZhY3RvcnNPcGVyYXRpb25zLCBjcmVhdGlvbkpvYkZhY3RvcnNCdXNpbmVzcylcbiAgICAgICAgICAgICogKDAuMTUgKiBjcmVhdGlvbkpvYkZhY3RvcnNFbmdpbmVlciArIDAuMDIgKiBjcmVhdGlvbkpvYkZhY3RvcnNNYW5hZ2VtZW50ICsgMC4wMiAqIGNyZWF0aW9uSm9iRmFjdG9yc1JuRCArIDAuMDIgKiBjcmVhdGlvbkpvYkZhY3RvcnNPcGVyYXRpb25zICsgMC4wMiAqIGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzKVxuICAgICAgICAgICAgLSBwcm9kdWN0LnN0YXRzLnBlcmZvcm1hbmNlO1xuICAgIH07XG4gICAgY29uc3QgZjMgPSBmdW5jdGlvbiAoW2NyZWF0aW9uSm9iRmFjdG9yc0VuZ2luZWVyLCBjcmVhdGlvbkpvYkZhY3RvcnNNYW5hZ2VtZW50LCBjcmVhdGlvbkpvYkZhY3RvcnNSbkQsIGNyZWF0aW9uSm9iRmFjdG9yc09wZXJhdGlvbnMsIGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzXTogbnVtYmVyW10pIHtcbiAgICAgICAgcmV0dXJuIGtcbiAgICAgICAgICAgICogYmFsYW5jZU11bHRpcGxpZXIoY3JlYXRpb25Kb2JGYWN0b3JzRW5naW5lZXIsIGNyZWF0aW9uSm9iRmFjdG9yc01hbmFnZW1lbnQsIGNyZWF0aW9uSm9iRmFjdG9yc1JuRCwgY3JlYXRpb25Kb2JGYWN0b3JzT3BlcmF0aW9ucywgY3JlYXRpb25Kb2JGYWN0b3JzQnVzaW5lc3MpXG4gICAgICAgICAgICAqICgwLjA1ICogY3JlYXRpb25Kb2JGYWN0b3JzRW5naW5lZXIgKyAwLjAyICogY3JlYXRpb25Kb2JGYWN0b3JzTWFuYWdlbWVudCArIDAuMDggKiBjcmVhdGlvbkpvYkZhY3RvcnNSbkQgKyAwLjA1ICogY3JlYXRpb25Kb2JGYWN0b3JzT3BlcmF0aW9ucyArIDAuMDUgKiBjcmVhdGlvbkpvYkZhY3RvcnNCdXNpbmVzcylcbiAgICAgICAgICAgIC0gcHJvZHVjdC5zdGF0cy5kdXJhYmlsaXR5O1xuICAgIH07XG4gICAgY29uc3QgZjQgPSBmdW5jdGlvbiAoW2NyZWF0aW9uSm9iRmFjdG9yc0VuZ2luZWVyLCBjcmVhdGlvbkpvYkZhY3RvcnNNYW5hZ2VtZW50LCBjcmVhdGlvbkpvYkZhY3RvcnNSbkQsIGNyZWF0aW9uSm9iRmFjdG9yc09wZXJhdGlvbnMsIGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzXTogbnVtYmVyW10pIHtcbiAgICAgICAgcmV0dXJuIGtcbiAgICAgICAgICAgICogYmFsYW5jZU11bHRpcGxpZXIoY3JlYXRpb25Kb2JGYWN0b3JzRW5naW5lZXIsIGNyZWF0aW9uSm9iRmFjdG9yc01hbmFnZW1lbnQsIGNyZWF0aW9uSm9iRmFjdG9yc1JuRCwgY3JlYXRpb25Kb2JGYWN0b3JzT3BlcmF0aW9ucywgY3JlYXRpb25Kb2JGYWN0b3JzQnVzaW5lc3MpXG4gICAgICAgICAgICAqICgwLjAyICogY3JlYXRpb25Kb2JGYWN0b3JzRW5naW5lZXIgKyAwLjA4ICogY3JlYXRpb25Kb2JGYWN0b3JzTWFuYWdlbWVudCArIDAuMDIgKiBjcmVhdGlvbkpvYkZhY3RvcnNSbkQgKyAwLjA1ICogY3JlYXRpb25Kb2JGYWN0b3JzT3BlcmF0aW9ucyArIDAuMDggKiBjcmVhdGlvbkpvYkZhY3RvcnNCdXNpbmVzcylcbiAgICAgICAgICAgIC0gcHJvZHVjdC5zdGF0cy5yZWxpYWJpbGl0eTtcbiAgICB9O1xuICAgIGNvbnN0IGY1ID0gZnVuY3Rpb24gKFtjcmVhdGlvbkpvYkZhY3RvcnNFbmdpbmVlciwgY3JlYXRpb25Kb2JGYWN0b3JzTWFuYWdlbWVudCwgY3JlYXRpb25Kb2JGYWN0b3JzUm5ELCBjcmVhdGlvbkpvYkZhY3RvcnNPcGVyYXRpb25zLCBjcmVhdGlvbkpvYkZhY3RvcnNCdXNpbmVzc106IG51bWJlcltdKSB7XG4gICAgICAgIHJldHVybiBrXG4gICAgICAgICAgICAqIGJhbGFuY2VNdWx0aXBsaWVyKGNyZWF0aW9uSm9iRmFjdG9yc0VuZ2luZWVyLCBjcmVhdGlvbkpvYkZhY3RvcnNNYW5hZ2VtZW50LCBjcmVhdGlvbkpvYkZhY3RvcnNSbkQsIGNyZWF0aW9uSm9iRmFjdG9yc09wZXJhdGlvbnMsIGNyZWF0aW9uSm9iRmFjdG9yc0J1c2luZXNzKVxuICAgICAgICAgICAgKiAoMC4wOCAqIGNyZWF0aW9uSm9iRmFjdG9yc01hbmFnZW1lbnQgKyAwLjA1ICogY3JlYXRpb25Kb2JGYWN0b3JzUm5EICsgMC4wMiAqIGNyZWF0aW9uSm9iRmFjdG9yc09wZXJhdGlvbnMgKyAwLjEgKiBjcmVhdGlvbkpvYkZhY3RvcnNCdXNpbmVzcylcbiAgICAgICAgICAgIC0gcHJvZHVjdC5zdGF0cy5hZXN0aGV0aWNzO1xuICAgIH07XG4gICAgbGV0IHNvbHZlclJlc3VsdDogQ2VyZXNTb2x2ZXJSZXN1bHQgPSB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBcIlwiLFxuICAgICAgICB4OiBbXSxcbiAgICAgICAgcmVwb3J0OiBcInN0cmluZ1wiLFxuICAgIH07XG4gICAgY29uc3Qgc29sdmVyID0gbmV3IENlcmVzKCk7XG4gICAgYXdhaXQgc29sdmVyLnByb21pc2UudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNvbHZlci5hZGRfZnVuY3Rpb24oZjEpO1xuICAgICAgICBzb2x2ZXIuYWRkX2Z1bmN0aW9uKGYyKTtcbiAgICAgICAgc29sdmVyLmFkZF9mdW5jdGlvbihmMyk7XG4gICAgICAgIHNvbHZlci5hZGRfZnVuY3Rpb24oZjQpO1xuICAgICAgICBzb2x2ZXIuYWRkX2Z1bmN0aW9uKGY1KTtcbiAgICAgICAgLy8gR3Vlc3MgdGhlIGluaXRpYWwgdmFsdWVzIG9mIHRoZSBzb2x1dGlvblxuICAgICAgICBsZXQgZ3Vlc3MgPSBbMSwgMSwgMSwgMSwgMV07XG4gICAgICAgIGlmIChlbXBsb3llZVByb2R1Y3Rpb25CeUpvYikge1xuICAgICAgICAgICAgZ3Vlc3MgPSBbXG4gICAgICAgICAgICAgICAgZW1wbG95ZWVQcm9kdWN0aW9uQnlKb2IuZW5naW5lZXJQcm9kdWN0aW9uLFxuICAgICAgICAgICAgICAgIGVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iLm1hbmFnZW1lbnRQcm9kdWN0aW9uLFxuICAgICAgICAgICAgICAgIGVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iLnJlc2VhcmNoQW5kRGV2ZWxvcG1lbnRQcm9kdWN0aW9uLFxuICAgICAgICAgICAgICAgIGVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iLm9wZXJhdGlvbnNQcm9kdWN0aW9uLFxuICAgICAgICAgICAgICAgIGVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iLmJ1c2luZXNzUHJvZHVjdGlvblxuICAgICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgICBzb2x2ZXJSZXN1bHQgPSBzb2x2ZXIuc29sdmUoZ3Vlc3MpITtcbiAgICAgICAgc29sdmVyLnJlbW92ZSgpO1xuICAgIH0pO1xuICAgIGlmICghc29sdmVyUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFUlJPUjogQ2Fubm90IGZpbmQgaGlkZGVuIHN0YXRzIG9mIHByb2R1Y3Q6ICR7SlNPTi5zdHJpbmdpZnkocHJvZHVjdCl9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRvdGFsQ3JlYXRpb25Kb2JGYWN0b3JzID0gc29sdmVyUmVzdWx0LnhbMF0gKyBzb2x2ZXJSZXN1bHQueFsxXSArIHNvbHZlclJlc3VsdC54WzJdICsgc29sdmVyUmVzdWx0LnhbM10gKyBzb2x2ZXJSZXN1bHQueFs0XTtcbiAgICBjb25zdCBtYW5hZ2VtZW50UmF0aW8gPSBzb2x2ZXJSZXN1bHQueFsxXSAvIHRvdGFsQ3JlYXRpb25Kb2JGYWN0b3JzO1xuICAgIGNvbnN0IGJ1c2luZXNzUmF0aW8gPSBzb2x2ZXJSZXN1bHQueFs0XSAvIHRvdGFsQ3JlYXRpb25Kb2JGYWN0b3JzO1xuXG4gICAgY29uc3QgYWR2ZXJ0aXNpbmdJbnZlc3RtZW50TXVsdGlwbGllciA9IDEgKyBNYXRoLnBvdyhwcm9kdWN0LmFkdmVydGlzaW5nSW52ZXN0bWVudCwgMC4xKSAvIDEwMDtcbiAgICBjb25zdCBidXNpbmVzc01hbmFnZW1lbnRSYXRpbyA9IE1hdGgubWF4KGJ1c2luZXNzUmF0aW8gKyBtYW5hZ2VtZW50UmF0aW8sIDEgLyB0b3RhbENyZWF0aW9uSm9iRmFjdG9ycyk7XG4gICAgcmV0dXJuIDEwMCAvIChhZHZlcnRpc2luZ0ludmVzdG1lbnRNdWx0aXBsaWVyICogTWF0aC5wb3cocHJvZHVjdC5zdGF0cy5xdWFsaXR5ICsgMC4wMDEsIDAuNjUpICogYnVzaW5lc3NNYW5hZ2VtZW50UmF0aW8pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQcm9kdWN0KGl0ZW06IE1hdGVyaWFsIHwgUHJvZHVjdCk6IGl0ZW0gaXMgUHJvZHVjdCB7XG4gICAgcmV0dXJuIFwicmF0aW5nXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlUHJvZHVjdE1hcmt1cE1hcChuczogTlMpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IHByb2R1Y3RLZXkgb2YgcHJvZHVjdE1hcmt1cERhdGEua2V5cygpKSB7XG4gICAgICAgIGNvbnN0IHByb2R1Y3RLZXlJbmZvID0gcHJvZHVjdEtleS5zcGxpdChcInxcIik7XG4gICAgICAgIGNvbnN0IGRpdmlzaW9uTmFtZSA9IHByb2R1Y3RLZXlJbmZvWzBdO1xuICAgICAgICBjb25zdCBwcm9kdWN0TmFtZSA9IHByb2R1Y3RLZXlJbmZvWzJdO1xuICAgICAgICBpZiAoIW5zLmNvcnBvcmF0aW9uLmdldERpdmlzaW9uKGRpdmlzaW9uTmFtZSkucHJvZHVjdHMuaW5jbHVkZXMocHJvZHVjdE5hbWUpKSB7XG4gICAgICAgICAgICBwcm9kdWN0TWFya3VwRGF0YS5kZWxldGUocHJvZHVjdEtleSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRQcm9kdWN0TWFya3VwKFxuICAgIGRpdmlzaW9uOiBEaXZpc2lvbixcbiAgICBpbmR1c3RyeURhdGE6IENvcnBJbmR1c3RyeURhdGEsXG4gICAgY2l0eTogQ2l0eU5hbWUsXG4gICAgaXRlbTogUHJvZHVjdCxcbiAgICBvZmZpY2U/OiBPZmZpY2Vcbik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgbGV0IHByb2R1Y3RNYXJrdXA7XG4gICAgY29uc3QgcHJvZHVjdE1hcmt1cEtleSA9IGAke2RpdmlzaW9uLm5hbWV9fCR7Y2l0eX18JHtpdGVtLm5hbWV9YDtcbiAgICBwcm9kdWN0TWFya3VwID0gcHJvZHVjdE1hcmt1cERhdGEuZ2V0KHByb2R1Y3RNYXJrdXBLZXkpO1xuICAgIGlmICghcHJvZHVjdE1hcmt1cCkge1xuICAgICAgICBwcm9kdWN0TWFya3VwID0gYXdhaXQgY2FsY3VsYXRlUHJvZHVjdE1hcmt1cChcbiAgICAgICAgICAgIGRpdmlzaW9uLnJlc2VhcmNoUG9pbnRzLFxuICAgICAgICAgICAgaW5kdXN0cnlEYXRhLnNjaWVuY2VGYWN0b3IhLFxuICAgICAgICAgICAgaXRlbSxcbiAgICAgICAgICAgIChvZmZpY2UpID8ge1xuICAgICAgICAgICAgICAgIG9wZXJhdGlvbnNQcm9kdWN0aW9uOiBvZmZpY2UuZW1wbG95ZWVQcm9kdWN0aW9uQnlKb2IuT3BlcmF0aW9ucyxcbiAgICAgICAgICAgICAgICBlbmdpbmVlclByb2R1Y3Rpb246IG9mZmljZS5lbXBsb3llZVByb2R1Y3Rpb25CeUpvYi5FbmdpbmVlcixcbiAgICAgICAgICAgICAgICBidXNpbmVzc1Byb2R1Y3Rpb246IG9mZmljZS5lbXBsb3llZVByb2R1Y3Rpb25CeUpvYi5CdXNpbmVzcyxcbiAgICAgICAgICAgICAgICBtYW5hZ2VtZW50UHJvZHVjdGlvbjogb2ZmaWNlLmVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iLk1hbmFnZW1lbnQsXG4gICAgICAgICAgICAgICAgcmVzZWFyY2hBbmREZXZlbG9wbWVudFByb2R1Y3Rpb246IG9mZmljZS5lbXBsb3llZVByb2R1Y3Rpb25CeUpvYltcIlJlc2VhcmNoICYgRGV2ZWxvcG1lbnRcIl0sXG4gICAgICAgICAgICB9IDogdW5kZWZpbmVkXG4gICAgICAgICk7XG4gICAgICAgIHByb2R1Y3RNYXJrdXBEYXRhLnNldChwcm9kdWN0TWFya3VwS2V5LCBwcm9kdWN0TWFya3VwKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb2R1Y3RNYXJrdXA7XG59XG5cbi8qKlxuICogQ3VzdG9tIE1hcmtldC1UQS5JSSBzY3JpcHRcbiAqXG4gKiBAcGFyYW0gbnNcbiAqIEBwYXJhbSBkaXZpc2lvblxuICogQHBhcmFtIGluZHVzdHJ5RGF0YVxuICogQHBhcmFtIGNpdHlcbiAqIEBwYXJhbSBpdGVtXG4gKiBAcmV0dXJuc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3B0aW1hbFNlbGxpbmdQcmljZShcbiAgICBuczogTlMsXG4gICAgZGl2aXNpb246IERpdmlzaW9uLFxuICAgIGluZHVzdHJ5RGF0YTogQ29ycEluZHVzdHJ5RGF0YSxcbiAgICBjaXR5OiBDaXR5TmFtZSxcbiAgICBpdGVtOiBNYXRlcmlhbCB8IFByb2R1Y3Rcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgaXRlbUlzUHJvZHVjdCA9IGlzUHJvZHVjdChpdGVtKTtcbiAgICBpZiAoaXRlbUlzUHJvZHVjdCAmJiBpdGVtLmRldmVsb3BtZW50UHJvZ3Jlc3MgPCAxMDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9kdWN0IGlzIG5vdCBmaW5pc2hlZC4gUHJvZHVjdDogJHtKU09OLnN0cmluZ2lmeShpdGVtKX1gKTtcbiAgICB9XG4gICAgaWYgKCFucy5jb3Jwb3JhdGlvbi5oYXNVbmxvY2soVW5sb2NrTmFtZS5NQVJLRVRfUkVTRUFSQ0hfREVNQU5EKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBtdXN0IHVubG9jayBcIk1hcmtldCBSZXNlYXJjaCAtIERlbWFuZFwiYCk7XG4gICAgfVxuICAgIGlmICghbnMuY29ycG9yYXRpb24uaGFzVW5sb2NrKFVubG9ja05hbWUuTUFSS0VUX0RBVEFfQ09NUEVUSVRJT04pKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWW91IG11c3QgdW5sb2NrIFwiTWFya2V0IERhdGEgLSBDb21wZXRpdGlvblwiYCk7XG4gICAgfVxuXG4gICAgaWYgKG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkubmV4dFN0YXRlICE9PSBcIlNBTEVcIikge1xuICAgICAgICByZXR1cm4gXCIwXCI7XG4gICAgfVxuICAgIGNvbnN0IGV4cGVjdGVkU2FsZXNWb2x1bWUgPSBpdGVtLnN0b3JlZCAvIDEwO1xuICAgIC8vIERvIG5vdCBjb21wYXJlIHdpdGggMCwgdGhlcmUgaXMgY2FzZSB3aGVuIGl0ZW0uc3RvcmVkIGlzIGEgdGlueSBudW1iZXIuXG4gICAgaWYgKGV4cGVjdGVkU2FsZXNWb2x1bWUgPCAxZS01KSB7XG4gICAgICAgIHJldHVybiBcIjBcIjtcbiAgICB9XG5cbiAgICBjb25zdCBvZmZpY2UgPSBucy5jb3Jwb3JhdGlvbi5nZXRPZmZpY2UoZGl2aXNpb24ubmFtZSwgY2l0eSk7XG4gICAgbGV0IHByb2R1Y3RNYXJrdXA6IG51bWJlcjtcbiAgICBsZXQgbWFya3VwTGltaXQ6IG51bWJlcjtcbiAgICBsZXQgaXRlbU11bHRpcGxpZXI6IG51bWJlcjtcbiAgICBsZXQgbWFya2V0UHJpY2U6IG51bWJlcjtcbiAgICBpZiAoaXRlbUlzUHJvZHVjdCkge1xuICAgICAgICBwcm9kdWN0TWFya3VwID0gYXdhaXQgZ2V0UHJvZHVjdE1hcmt1cChcbiAgICAgICAgICAgIGRpdmlzaW9uLFxuICAgICAgICAgICAgaW5kdXN0cnlEYXRhLFxuICAgICAgICAgICAgY2l0eSxcbiAgICAgICAgICAgIGl0ZW0sXG4gICAgICAgICAgICBvZmZpY2VcbiAgICAgICAgKTtcbiAgICAgICAgbWFya3VwTGltaXQgPSBNYXRoLm1heChpdGVtLmVmZmVjdGl2ZVJhdGluZywgMC4wMDEpIC8gcHJvZHVjdE1hcmt1cDtcbiAgICAgICAgaXRlbU11bHRpcGxpZXIgPSAwLjUgKiBNYXRoLnBvdyhpdGVtLmVmZmVjdGl2ZVJhdGluZywgMC42NSk7XG4gICAgICAgIG1hcmtldFByaWNlID0gaXRlbS5wcm9kdWN0aW9uQ29zdDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXJrdXBMaW1pdCA9IGl0ZW0ucXVhbGl0eSAvIG5zLmNvcnBvcmF0aW9uLmdldE1hdGVyaWFsRGF0YShpdGVtLm5hbWUpLmJhc2VNYXJrdXA7XG4gICAgICAgIGl0ZW1NdWx0aXBsaWVyID0gaXRlbS5xdWFsaXR5ICsgMC4wMDE7XG4gICAgICAgIG1hcmtldFByaWNlID0gaXRlbS5tYXJrZXRQcmljZTtcbiAgICB9XG5cbiAgICBjb25zdCBidXNpbmVzc0ZhY3RvciA9IGdldEJ1c2luZXNzRmFjdG9yKG9mZmljZS5lbXBsb3llZVByb2R1Y3Rpb25CeUpvYltFbXBsb3llZVBvc2l0aW9uLkJVU0lORVNTXSk7XG4gICAgY29uc3QgYWR2ZXJ0aXNpbmdGYWN0b3IgPSBnZXRBZHZlcnRpc2luZ0ZhY3RvcnMoZGl2aXNpb24uYXdhcmVuZXNzLCBkaXZpc2lvbi5wb3B1bGFyaXR5LCBpbmR1c3RyeURhdGEuYWR2ZXJ0aXNpbmdGYWN0b3IhKVswXTtcbiAgICBjb25zdCBtYXJrZXRGYWN0b3IgPSBnZXRNYXJrZXRGYWN0b3IoaXRlbS5kZW1hbmQhLCBpdGVtLmNvbXBldGl0aW9uISk7XG4gICAgY29uc3Qgc2FsZXNNdWx0aXBsaWVycyA9XG4gICAgICAgIGl0ZW1NdWx0aXBsaWVyICpcbiAgICAgICAgYnVzaW5lc3NGYWN0b3IgKlxuICAgICAgICBhZHZlcnRpc2luZ0ZhY3RvciAqXG4gICAgICAgIG1hcmtldEZhY3RvciAqXG4gICAgICAgIGdldFVwZ3JhZGVCZW5lZml0KFVwZ3JhZGVOYW1lLkFCQ19TQUxFU19CT1RTLCBucy5jb3Jwb3JhdGlvbi5nZXRVcGdyYWRlTGV2ZWwoVXBncmFkZU5hbWUuQUJDX1NBTEVTX0JPVFMpKSAqXG4gICAgICAgIGdldFJlc2VhcmNoU2FsZXNNdWx0aXBsaWVyKGdldERpdmlzaW9uUmVzZWFyY2hlcyhucywgZGl2aXNpb24ubmFtZSkpO1xuICAgIGNvbnN0IG9wdGltYWxQcmljZSA9IG1hcmt1cExpbWl0IC8gTWF0aC5zcXJ0KGV4cGVjdGVkU2FsZXNWb2x1bWUgLyBzYWxlc011bHRpcGxpZXJzKSArIG1hcmtldFByaWNlO1xuICAgIC8vIG5zLnByaW50KGBpdGVtOiAke2l0ZW0ubmFtZX0sIG9wdGltYWxQcmljZTogJHtucy5mb3JtYXROdW1iZXIob3B0aW1hbFByaWNlKX1gKTtcblxuICAgIHJldHVybiBvcHRpbWFsUHJpY2UudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldE9wdGltYWxTZWxsaW5nUHJpY2VGb3JFdmVyeXRoaW5nKG5zOiBOUyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmIChucy5jb3Jwb3JhdGlvbi5nZXRDb3Jwb3JhdGlvbigpLm5leHRTdGF0ZSAhPT0gXCJTQUxFXCIpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIW5zLmNvcnBvcmF0aW9uLmhhc1VubG9jayhVbmxvY2tOYW1lLk1BUktFVF9SRVNFQVJDSF9ERU1BTkQpXG4gICAgICAgIHx8ICFucy5jb3Jwb3JhdGlvbi5oYXNVbmxvY2soVW5sb2NrTmFtZS5NQVJLRVRfREFUQV9DT01QRVRJVElPTikpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhd2FpdCBsb29wQWxsRGl2aXNpb25zQW5kQ2l0aWVzQXN5bmNDYWxsYmFjayhucywgYXN5bmMgKGRpdmlzaW9uTmFtZSwgY2l0eSkgPT4ge1xuICAgICAgICBjb25zdCBkaXZpc2lvbiA9IG5zLmNvcnBvcmF0aW9uLmdldERpdmlzaW9uKGRpdmlzaW9uTmFtZSk7XG4gICAgICAgIGNvbnN0IGluZHVzdHJ5RGF0YSA9IG5zLmNvcnBvcmF0aW9uLmdldEluZHVzdHJ5RGF0YShkaXZpc2lvbi50eXBlKTtcbiAgICAgICAgY29uc3QgcHJvZHVjdHMgPSBkaXZpc2lvbi5wcm9kdWN0cztcbiAgICAgICAgY29uc3QgaGFzTWFya2V0VEEyID0gbnMuY29ycG9yYXRpb24uaGFzUmVzZWFyY2hlZChkaXZpc2lvbk5hbWUsIFJlc2VhcmNoTmFtZS5NQVJLRVRfVEFfMik7XG4gICAgICAgIGlmIChpbmR1c3RyeURhdGEubWFrZXNQcm9kdWN0cykge1xuICAgICAgICAgICAgLy8gU2V0IHNlbGwgcHJpY2UgZm9yIHByb2R1Y3RzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb2R1Y3ROYW1lIG9mIHByb2R1Y3RzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvZHVjdCA9IG5zLmNvcnBvcmF0aW9uLmdldFByb2R1Y3QoZGl2aXNpb25OYW1lLCBjaXR5LCBwcm9kdWN0TmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKHByb2R1Y3QuZGV2ZWxvcG1lbnRQcm9ncmVzcyA8IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGhhc01hcmtldFRBMikge1xuICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZXRQcm9kdWN0TWFya2V0VEEyKGRpdmlzaW9uTmFtZSwgcHJvZHVjdE5hbWUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW1hbFByaWNlID0gYXdhaXQgZ2V0T3B0aW1hbFNlbGxpbmdQcmljZShucywgZGl2aXNpb24sIGluZHVzdHJ5RGF0YSwgY2l0eSwgcHJvZHVjdCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhcnNlTnVtYmVyKG9wdGltYWxQcmljZSkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIG5zLmNvcnBvcmF0aW9uLnNlbGxQcm9kdWN0KGRpdmlzaW9uTmFtZSwgY2l0eSwgcHJvZHVjdE5hbWUsIFwiTUFYXCIsIG9wdGltYWxQcmljZSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kdXN0cnlEYXRhLm1ha2VzTWF0ZXJpYWxzKSB7XG4gICAgICAgICAgICAvLyBTZXQgc2VsbCBwcmljZSBmb3Igb3V0cHV0IG1hdGVyaWFsc1xuICAgICAgICAgICAgZm9yIChjb25zdCBtYXRlcmlhbE5hbWUgb2YgaW5kdXN0cnlEYXRhLnByb2R1Y2VkTWF0ZXJpYWxzISkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWwoZGl2aXNpb25OYW1lLCBjaXR5LCBtYXRlcmlhbE5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChoYXNNYXJrZXRUQTIpIHtcbiAgICAgICAgICAgICAgICAgICAgbnMuY29ycG9yYXRpb24uc2V0TWF0ZXJpYWxNYXJrZXRUQTIoZGl2aXNpb25OYW1lLCBjaXR5LCBtYXRlcmlhbE5hbWUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW1hbFByaWNlID0gYXdhaXQgZ2V0T3B0aW1hbFNlbGxpbmdQcmljZShucywgZGl2aXNpb24sIGluZHVzdHJ5RGF0YSwgY2l0eSwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgIGlmIChwYXJzZU51bWJlcihvcHRpbWFsUHJpY2UpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5zZWxsTWF0ZXJpYWwoZGl2aXNpb25OYW1lLCBjaXR5LCBtYXRlcmlhbE5hbWUsIFwiTUFYXCIsIG9wdGltYWxQcmljZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXNlYXJjaFBvaW50R2FpblJhdGUobnM6IE5TLCBkaXZpc2lvbk5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgbGV0IHRvdGFsR2FpblJhdGUgPSAwO1xuICAgIGZvciAoY29uc3QgY2l0eSBvZiBjaXRpZXMpIHtcbiAgICAgICAgY29uc3Qgb2ZmaWNlID0gbnMuY29ycG9yYXRpb24uZ2V0T2ZmaWNlKGRpdmlzaW9uTmFtZSwgY2l0eSk7XG4gICAgICAgIC8vIDQgc3RhdGVzOiBQVVJDSEFTRSwgUFJPRFVDVElPTiwgRVhQT1JUIGFuZCBTQUxFXG4gICAgICAgIHRvdGFsR2FpblJhdGUgKz0gNCAqIDAuMDA0ICogTWF0aC5wb3cob2ZmaWNlLmVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iW0VtcGxveWVlUG9zaXRpb24uUkVTRUFSQ0hfREVWRUxPUE1FTlRdLCAwLjUpXG4gICAgICAgICAgICAqIGdldFVwZ3JhZGVCZW5lZml0KFVwZ3JhZGVOYW1lLlBST0pFQ1RfSU5TSUdIVCwgbnMuY29ycG9yYXRpb24uZ2V0VXBncmFkZUxldmVsKFVwZ3JhZGVOYW1lLlBST0pFQ1RfSU5TSUdIVCkpXG4gICAgICAgICAgICAqIGdldFJlc2VhcmNoUlBNdWx0aXBsaWVyKGdldERpdmlzaW9uUmVzZWFyY2hlcyhucywgZGl2aXNpb25OYW1lKSk7XG4gICAgfVxuICAgIHJldHVybiB0b3RhbEdhaW5SYXRlO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnV5Qm9vc3RNYXRlcmlhbHMobnM6IE5TLCBkaXZpc2lvbjogRGl2aXNpb24pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBUaGlzIG1ldGhvZCBpcyBvbmx5IGNhbGxlZCBpbiByb3VuZCAzKy4gSWYgd2UgZG9uJ3QgaGF2ZSBtb3JlIHRoYW4gMTBlOSBpbiBmdW5kcywgdGhlcmUgbXVzdCBiZSBzb21ldGhpbmcgd3JvbmdcbiAgICAvLyBpbiB0aGUgc2NyaXB0LlxuICAgIGNvbnN0IGZ1bmRzID0gbnMuY29ycG9yYXRpb24uZ2V0Q29ycG9yYXRpb24oKS5mdW5kcztcbiAgICBpZiAoZnVuZHMgPCAxMGU5KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRnVuZHMgaXMgdG9vIHNtYWxsIHRvIGJ1eSBib29zdCBtYXRlcmlhbHMuIEZ1bmRzOiAke25zLmZvcm1hdE51bWJlcihmdW5kcyl9LmApO1xuICAgIH1cbiAgICBjb25zdCBpbmR1c3RyeURhdGEgPSBucy5jb3Jwb3JhdGlvbi5nZXRJbmR1c3RyeURhdGEoZGl2aXNpb24udHlwZSk7XG4gICAgbGV0IHJlc2VydmVkU3BhY2VSYXRpbyA9IDAuMjtcbiAgICBjb25zdCByYXRpbyA9IDAuMTtcbiAgICBpZiAoaW5kdXN0cnlEYXRhLm1ha2VzUHJvZHVjdHMpIHtcbiAgICAgICAgcmVzZXJ2ZWRTcGFjZVJhdGlvID0gMC4xO1xuICAgIH1cbiAgICBsZXQgY291bnQgPSAwO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGF3YWl0IHdhaXRGb3JOZXh0VGltZVN0YXRlSGFwcGVucyhucywgQ29ycFN0YXRlLkVYUE9SVCk7XG4gICAgICAgIGlmIChjb3VudCA9PT0gMjApIHtcbiAgICAgICAgICAgIGNvbnN0IHdhcm5pbmdNZXNzYWdlID0gYEl0IHRha2VzIHRvbyBtYW55IGN5Y2xlcyB0byBidXkgYm9vc3QgbWF0ZXJpYWxzLiBEaXZpc2lvbjogJHtkaXZpc2lvbi5uYW1lfS5gO1xuICAgICAgICAgICAgc2hvd1dhcm5pbmcobnMsIHdhcm5pbmdNZXNzYWdlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGxldCBmaW5pc2ggPSB0cnVlO1xuICAgICAgICBjb25zdCBvcmRlcnMgPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBjaXR5IG9mIGNpdGllcykge1xuICAgICAgICAgICAgY29uc3Qgd2FyZWhvdXNlID0gbnMuY29ycG9yYXRpb24uZ2V0V2FyZWhvdXNlKGRpdmlzaW9uLm5hbWUsIGNpdHkpO1xuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlU3BhY2UgPSB3YXJlaG91c2Uuc2l6ZSAtIHdhcmVob3VzZS5zaXplVXNlZDtcbiAgICAgICAgICAgIGlmIChhdmFpbGFibGVTcGFjZSA8IHdhcmVob3VzZS5zaXplICogcmVzZXJ2ZWRTcGFjZVJhdGlvKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgZWZmZWN0aXZlUmF0aW8gPSByYXRpbztcbiAgICAgICAgICAgIGlmICgoYXZhaWxhYmxlU3BhY2UgLyB3YXJlaG91c2Uuc2l6ZSA8IDAuNSAmJiBkaXZpc2lvbi50eXBlID09PSBJbmR1c3RyeVR5cGUuQUdSSUNVTFRVUkUpXG4gICAgICAgICAgICAgICAgfHwgKGF2YWlsYWJsZVNwYWNlIC8gd2FyZWhvdXNlLnNpemUgPCAwLjc1XG4gICAgICAgICAgICAgICAgICAgICYmIChkaXZpc2lvbi50eXBlID09PSBJbmR1c3RyeVR5cGUuQ0hFTUlDQUwgfHwgZGl2aXNpb24udHlwZSA9PT0gSW5kdXN0cnlUeXBlLlRPQkFDQ08pKSkge1xuICAgICAgICAgICAgICAgIGVmZmVjdGl2ZVJhdGlvID0gMC4yO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYm9vc3RNYXRlcmlhbFF1YW50aXRpZXMgPSBnZXRPcHRpbWFsQm9vc3RNYXRlcmlhbFF1YW50aXRpZXMoaW5kdXN0cnlEYXRhLCBhdmFpbGFibGVTcGFjZSAqIGVmZmVjdGl2ZVJhdGlvKTtcbiAgICAgICAgICAgIG9yZGVycy5wdXNoKHtcbiAgICAgICAgICAgICAgICBjaXR5OiBjaXR5LFxuICAgICAgICAgICAgICAgIG1hdGVyaWFsczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBNYXRlcmlhbE5hbWUuQUlfQ09SRVMsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogbnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWwoZGl2aXNpb24ubmFtZSwgY2l0eSwgTWF0ZXJpYWxOYW1lLkFJX0NPUkVTKS5zdG9yZWQgKyBib29zdE1hdGVyaWFsUXVhbnRpdGllc1swXVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBNYXRlcmlhbE5hbWUuSEFSRFdBUkUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogbnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWwoZGl2aXNpb24ubmFtZSwgY2l0eSwgTWF0ZXJpYWxOYW1lLkhBUkRXQVJFKS5zdG9yZWQgKyBib29zdE1hdGVyaWFsUXVhbnRpdGllc1sxXVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBNYXRlcmlhbE5hbWUuUkVBTF9FU1RBVEUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogbnMuY29ycG9yYXRpb24uZ2V0TWF0ZXJpYWwoZGl2aXNpb24ubmFtZSwgY2l0eSwgTWF0ZXJpYWxOYW1lLlJFQUxfRVNUQVRFKS5zdG9yZWQgKyBib29zdE1hdGVyaWFsUXVhbnRpdGllc1syXVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBNYXRlcmlhbE5hbWUuUk9CT1RTLFxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IG5zLmNvcnBvcmF0aW9uLmdldE1hdGVyaWFsKGRpdmlzaW9uLm5hbWUsIGNpdHksIE1hdGVyaWFsTmFtZS5ST0JPVFMpLnN0b3JlZCArIGJvb3N0TWF0ZXJpYWxRdWFudGl0aWVzWzNdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmaW5pc2ggPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmluaXNoKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBzdG9ja01hdGVyaWFscyhcbiAgICAgICAgICAgIG5zLFxuICAgICAgICAgICAgZGl2aXNpb24ubmFtZSxcbiAgICAgICAgICAgIG9yZGVycyxcbiAgICAgICAgICAgIHRydWVcbiAgICAgICAgKTtcbiAgICAgICAgKytjb3VudDtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcm9kdWN0TWFya2V0UHJpY2UoXG4gICAgbnM6IE5TLFxuICAgIGRpdmlzaW9uOiBEaXZpc2lvbixcbiAgICBpbmR1c3RyeURhdGE6IENvcnBJbmR1c3RyeURhdGEsXG4gICAgY2l0eTogQ2l0eU5hbWVcbik6IG51bWJlciB7XG4gICAgbGV0IHByb2R1Y3RNYXJrZXRQcmljZSA9IDA7XG4gICAgZm9yIChjb25zdCBbbWF0ZXJpYWxOYW1lLCBtYXRlcmlhbENvZWZmaWNpZW50XSBvZiBnZXRSZWNvcmRFbnRyaWVzKGluZHVzdHJ5RGF0YS5yZXF1aXJlZE1hdGVyaWFscykpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWxNYXJrZXRQcmljZSA9IG5zLmNvcnBvcmF0aW9uLmdldE1hdGVyaWFsKGRpdmlzaW9uLm5hbWUsIGNpdHksIG1hdGVyaWFsTmFtZSkubWFya2V0UHJpY2U7XG4gICAgICAgIHByb2R1Y3RNYXJrZXRQcmljZSArPSBtYXRlcmlhbE1hcmtldFByaWNlICogbWF0ZXJpYWxDb2VmZmljaWVudDtcbiAgICB9XG4gICAgcmV0dXJuIHByb2R1Y3RNYXJrZXRQcmljZSAqIHByb2R1Y3RNYXJrZXRQcmljZU11bHRpcGxpZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEdW1teURpdmlzaW9ucyhuczogTlMsIG51bWJlck9mRGl2aXNpb25zOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBkaXZpc2lvbnMgPSBucy5jb3Jwb3JhdGlvbi5nZXRDb3Jwb3JhdGlvbigpLmRpdmlzaW9ucztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bWJlck9mRGl2aXNpb25zOyBpKyspIHtcbiAgICAgICAgY29uc3QgZHVtbXlEaXZpc2lvbk5hbWUgPSBkdW1teURpdmlzaW9uTmFtZVByZWZpeCArIGkudG9TdHJpbmcoKS5wYWRTdGFydCgyLCBcIjBcIik7XG4gICAgICAgIGlmIChkaXZpc2lvbnMuaW5jbHVkZXMoZHVtbXlEaXZpc2lvbk5hbWUpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBucy5jb3Jwb3JhdGlvbi5leHBhbmRJbmR1c3RyeShJbmR1c3RyeVR5cGUuUkVTVEFVUkFOVCwgZHVtbXlEaXZpc2lvbk5hbWUpO1xuICAgICAgICBjb25zdCBkaXZpc2lvbiA9IG5zLmNvcnBvcmF0aW9uLmdldERpdmlzaW9uKGR1bW15RGl2aXNpb25OYW1lKTtcbiAgICAgICAgZm9yIChjb25zdCBjaXR5IG9mIGNpdGllcykge1xuICAgICAgICAgICAgaWYgKCFkaXZpc2lvbi5jaXRpZXMuaW5jbHVkZXMoY2l0eSkpIHtcbiAgICAgICAgICAgICAgICBucy5jb3Jwb3JhdGlvbi5leHBhbmRDaXR5KGR1bW15RGl2aXNpb25OYW1lLCBjaXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbnMuY29ycG9yYXRpb24uaGFzV2FyZWhvdXNlKGR1bW15RGl2aXNpb25OYW1lLCBjaXR5KSkge1xuICAgICAgICAgICAgICAgIG5zLmNvcnBvcmF0aW9uLnB1cmNoYXNlV2FyZWhvdXNlKGR1bW15RGl2aXNpb25OYW1lLCBjaXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JPZmZlcihuczogTlMsIG51bWJlck9mSW5pdEN5Y2xlczogbnVtYmVyLCBtYXhBZGRpdGlvbmFsQ3ljbGVzOiBudW1iZXIsIGV4cGVjdGVkT2ZmZXI6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHdhaXRGb3JOdW1iZXJPZkN5Y2xlcyhucywgbnVtYmVyT2ZJbml0Q3ljbGVzKTtcbiAgICBsZXQgb2ZmZXIgPSBucy5jb3Jwb3JhdGlvbi5nZXRJbnZlc3RtZW50T2ZmZXIoKS5mdW5kcztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1heEFkZGl0aW9uYWxDeWNsZXM7IGkrKykge1xuICAgICAgICBhd2FpdCB3YWl0Rm9yTnVtYmVyT2ZDeWNsZXMobnMsIDEpO1xuICAgICAgICBjb25zb2xlLmxvZyhgT2ZmZXI6ICR7bnMuZm9ybWF0TnVtYmVyKG5zLmNvcnBvcmF0aW9uLmdldEludmVzdG1lbnRPZmZlcigpLmZ1bmRzKX1gKTtcbiAgICAgICAgaWYgKG5zLmNvcnBvcmF0aW9uLmdldEludmVzdG1lbnRPZmZlcigpLmZ1bmRzIDwgb2ZmZXIgKiAxLjAwMSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgb2ZmZXIgPSBucy5jb3Jwb3JhdGlvbi5nZXRJbnZlc3RtZW50T2ZmZXIoKS5mdW5kcztcbiAgICB9XG4gICAgaWYgKG5zLmNvcnBvcmF0aW9uLmdldEludmVzdG1lbnRPZmZlcigpLmZ1bmRzIDwgZXhwZWN0ZWRPZmZlcikge1xuICAgICAgICBucy5hbGVydChcbiAgICAgICAgICAgIGBPZmZlciBpcyBsb3dlciB0aGFuIGV4cGVjdGVkIHZhbHVlLiBPZmZlcjogJHtucy5mb3JtYXROdW1iZXIobnMuY29ycG9yYXRpb24uZ2V0SW52ZXN0bWVudE9mZmVyKCkuZnVuZHMpfWBcbiAgICAgICAgICAgICsgYC4gRXhwZWN0ZWQgdmFsdWU6ICR7bnMuZm9ybWF0TnVtYmVyKGV4cGVjdGVkT2ZmZXIpfS5gXG4gICAgICAgICk7XG4gICAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBVUEsU0FBUyxrQkFBa0IscUJBQW9DO0FBQy9ELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsYUFBYTtBQUN0QjtBQUFBLEVBRUk7QUFBQSxFQUVBO0FBQUEsRUFFQTtBQUFBLEVBRUE7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBSUE7QUFBQSxFQUNBO0FBQUEsRUFFQTtBQUFBLEVBQ0E7QUFBQSxPQUNHO0FBQ1AsU0FBUyx5QkFBeUI7QUFFM0IsSUFBSyxlQUFMLGtCQUFLQSxrQkFBTDtBQUNILEVBQUFBLGNBQUEsaUJBQWM7QUFDZCxFQUFBQSxjQUFBLGNBQVc7QUFDWCxFQUFBQSxjQUFBLGFBQVU7QUFIRixTQUFBQTtBQUFBLEdBQUE7QUFNTCxNQUFNLFNBQXFCO0FBQUEsRUFDOUIsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUNiO0FBRU8sTUFBTSxZQUFZLE9BQU8sT0FBTyxZQUFZO0FBRTVDLE1BQU0saUJBQWlCO0FBQUEsRUFDMUIsYUFBYTtBQUFBLEVBQ2IsYUFBYTtBQUFBLEVBQ2IsYUFBYTtBQUFBLEVBQ2IsYUFBYTtBQUNqQjtBQUVBLE1BQU0seUNB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TyxTQUFTLElBQUksR0FBRztBQUNqQyxXQUFHLFlBQVksV0FBVyxtQkFBbUIsSUFBSTtBQUFBLE1BQ3JEO0FBQ0EsVUFBSSxDQUFDLEdBQUcsWUFBWSxhQUFhLG1CQUFtQixJQUFJLEdBQUc7QUFDdkQsV0FBRyxZQUFZLGtCQUFrQixtQkFBbUIsSUFBSTtBQUFBLE1BQzVEO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSjtBQUVBLGVBQXNCLGFBQWEsSUFBUSxvQkFBNEIscUJBQTZCLGVBQXNDO0FBQ3RJLFFBQU0sc0JBQXNCLElBQUksa0JBQWtCO0FBQ2xELE1BQUksUUFBUSxHQUFHLFlBQVksbUJBQW1CLEVBQUU7QUFDaEQsV0FBUyxJQUFJLEdBQUcsSUFBSSxxQkFBcUIsS0FBSztBQUMxQyxVQUFNLHNCQUFzQixJQUFJLENBQUM7QUFDakMsWUFBUSxJQUFJLFVBQVUsR0FBRyxhQUFhLEdBQUcsWUFBWSxtQkFBbUIsRUFBRSxLQUFLLENBQUMsRUFBRTtBQUNsRixRQUFJLEdBQUcsWUFBWSxtQkFBbUIsRUFBRSxRQUFRLFFBQVEsT0FBTztBQUMzRDtBQUFBLElBQ0o7QUFDQSxZQUFRLEdBQUcsWUFBWSxtQkFBbUIsRUFBRTtBQUFBLEVBQ2hEO0FBQ0EsTUFBSSxHQUFHLFlBQVksbUJBQW1CLEVBQUUsUUFBUSxlQUFlO0FBQzNELE9BQUc7QUFBQSxNQUNDLDhDQUE4QyxHQUFHLGFBQWEsR0FBRyxZQUFZLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxxQkFDakYsR0FBRyxhQUFhLGFBQWEsQ0FBQztBQUFBLElBQ3pEO0FBQUEsRUFDSjtBQUNKOyIsCiAgIm5hbWVzIjogWyJEaXZpc2lvbk5hbWUiLCAiY2l0aWVzIiwgIm1hdGVyaWFscyIsICJpc1Byb2R1Y3QiLCAicHJvZHVjdE5hbWUiLCAidG90YWxDcmVhdGlvbkpvYkZhY3RvcnMiLCAibWFuYWdlbWVudFJhdGlvIiwgImJ1c2luZXNzUmF0aW8iXQp9Cg==
