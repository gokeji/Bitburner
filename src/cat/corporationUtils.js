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
