import { NetscriptExtension, parseAutoCompleteDataFromDefaultConfig } from "libs/NetscriptExtension";
import {
    CityName,
    CorpState,
    EmployeePosition,
    getMaxAffordableAdVertLevel,
    getMaxAffordableOfficeSize,
    getMaxAffordableUpgradeLevel,
    getMaxAffordableWarehouseLevel,
    IndustryType,
    MaterialName,
    ResearchName,
    UnlockName,
    UpgradeName,
} from "./corporationFormulas";
import {
    assignJobs,
    buyAdvert,
    buyBoostMaterials,
    buyTeaAndThrowParty,
    buyUnlock,
    buyUpgrade,
    cities,
    clearPurchaseOrders,
    createDivision,
    createDummyDivisions,
    developNewProduct,
    DivisionName,
    exportString,
    findOptimalAmountOfBoostMaterials,
    generateMaterialsOrders,
    generateOfficeSetups,
    getDivisionResearches,
    getProductIdArray,
    getProductMarketPrice,
    getProfit,
    hasDivision,
    Logger,
    researchPrioritiesForProductDivision,
    researchPrioritiesForSupportDivision,
    sampleProductName,
    stockMaterials,
    upgradeOffices,
    upgradeWarehouse,
    waitForNumberOfCycles,
    waitForOffer,
    waitForNextTimeStateHappens,
    waitUntilHavingEnoughResearchPoints,
    generateOfficeSetupsForEarlyRounds,
} from "./corporationUtils";
import { optimizeOffice } from "./corporationOptimizerTools";
import {
    CorporationOptimizer,
    defaultPerformanceModifierForOfficeBenchmark,
    precalculatedEmployeeRatioForProductDivisionRound3,
    precalculatedEmployeeRatioForProductDivisionRound4,
    precalculatedEmployeeRatioForProductDivisionRound5_1,
    precalculatedEmployeeRatioForProductDivisionRound5_2,
    precalculatedEmployeeRatioForProfitSetupOfRound3,
    precalculatedEmployeeRatioForProfitSetupOfRound4,
    precalculatedEmployeeRatioForSupportDivisions,
} from "./corporationOptimizer";
import * as testingTools from "./corporationTestingTools";
import { corporationEventLogger } from "./corporationEventLogger";
// import { exposeGameInternalObjects } from "exploits";
function autocomplete(data, flags) {
    return parseAutoCompleteDataFromDefaultConfig(data, defaultConfig);
}
const PrecalculatedRound1Option = {
    // 1498 - 61.344e9 - 504.8e9 - 443.456e9 - 4.89m/s - 17.604b/h
    OPTION1: {
        agricultureOfficeSize: 3,
        waitForAgricultureRP: 55,
        boostMaterialsRatio: 0.89,
        // boostMaterialsRatio: 0.88 // Smart Supply - Advert 1
    },
    // 1649 - 51.46e9 - 557.1e9 - 505.64e9 - 5.381e6/s - 19.371/h
    OPTION2: {
        agricultureOfficeSize: 4,
        waitForAgricultureRP: 55,
        boostMaterialsRatio: 0.86,
        // boostMaterialsRatio: 0.84 // Smart Supply
    },
    // 1588 - 42.704e9 - 536.8e9 - 494.096e9 - 5.176m/s - 18.633b/h
    OPTION3: {
        agricultureOfficeSize: 5,
        waitForAgricultureRP: 55,
        boostMaterialsRatio: 0.84,
    },
    // 1441 - 34.13e9 - 487.5e9 - 453.37e9 - 4.694m/s - 16.898b/h
    OPTION4: {
        agricultureOfficeSize: 6,
        waitForAgricultureRP: 55,
        boostMaterialsRatio: 0.815,
    },
    OPTION5: {
        agricultureOfficeSize: 5,
        waitForAgricultureRP: 500,
        boostMaterialsRatio: 0.6,
    },
};
const PrecalculatedRound2Option = {
    // 15.266e12 17282 804.175
    OPTION1: {
        agricultureOfficeSize: 8,
        // 3-1-1-3
        increaseBusiness: false,
        waitForAgricultureRP: 903,
        waitForChemicalRP: 516,
        agricultureBoostMaterialsRatio: 0.75,
    },
    // 14.57e12 16485 815.188
    OPTION2: {
        agricultureOfficeSize: 8,
        increaseBusiness: true,
        waitForAgricultureRP: 703,
        waitForChemicalRP: 393,
        agricultureBoostMaterialsRatio: 0.76,
    },
    // 14.474e12
    OPTION3: {
        agricultureOfficeSize: 8,
        increaseBusiness: true,
        waitForAgricultureRP: 653,
        waitForChemicalRP: 362,
        agricultureBoostMaterialsRatio: 0.755,
    },
    // 13.994e12
    OPTION4: {
        agricultureOfficeSize: 8,
        increaseBusiness: true,
        waitForAgricultureRP: 602,
        waitForChemicalRP: 331,
        agricultureBoostMaterialsRatio: 0.74,
    },
    // 13.742e12
    OPTION5: {
        agricultureOfficeSize: 8,
        // 2-1-3-2
        increaseBusiness: true,
        waitForAgricultureRP: 602,
        waitForChemicalRP: 331,
        agricultureBoostMaterialsRatio: 0.77,
    },
    // 13.425e12
    OPTION6: {
        agricultureOfficeSize: 8,
        increaseBusiness: true,
        waitForAgricultureRP: 551,
        waitForChemicalRP: 300,
        agricultureBoostMaterialsRatio: 0.71,
    },
    // 13.7e12
    OPTION7: {
        agricultureOfficeSize: 8,
        // 2-1-3-2
        increaseBusiness: true,
        waitForAgricultureRP: 551,
        waitForChemicalRP: 300,
        agricultureBoostMaterialsRatio: 0.77,
    },
    // 13.6e12
    OPTION8: {
        agricultureOfficeSize: 8,
        // 2-1-3-2
        increaseBusiness: true,
        waitForAgricultureRP: 500,
        waitForChemicalRP: 269,
        agricultureBoostMaterialsRatio: 0.77,
    },
    // 13e12
    OPTION9: {
        agricultureOfficeSize: 8,
        // 2-1-3-2
        increaseBusiness: true,
        waitForAgricultureRP: 450,
        waitForChemicalRP: 238,
        agricultureBoostMaterialsRatio: 0.73,
    },
    // 10.884e12
    OPTION10: {
        agricultureOfficeSize: 8,
        // 2-1-3-2
        increaseBusiness: true,
        waitForAgricultureRP: 302,
        waitForChemicalRP: 148,
        agricultureBoostMaterialsRatio: 0.61,
    },
    OPTION11: {
        agricultureOfficeSize: 8,
        // 3-1-1-3
        increaseBusiness: true,
        waitForAgricultureRP: 903,
        waitForChemicalRP: 516,
        agricultureBoostMaterialsRatio: 0.4,
    },
};
const PrecalculatedRound3Option = {
    OPTION1: {},
};
const defaultBudgetRatioForSupportDivision = {
    warehouse: 0.1,
    office: 0.9,
};
const defaultBudgetRatioForProductDivision = {
    rawProduction: 1 / 23,
    wilsonAdvert: 4 / 23,
    office: 8 / 23,
    employeeStatUpgrades: 8 / 23,
    salesBot: 1 / 23,
    projectInsight: 1 / 23,
};
const budgetRatioForProductDivisionWithoutAdvert = {
    rawProduction: 1 / 19,
    wilsonAdvert: 0,
    office: 8 / 19,
    employeeStatUpgrades: 8 / 19,
    salesBot: 1 / 19,
    projectInsight: 1 / 19,
};
const maxRerunWhenOptimizingOfficeForProductDivision = 0;
const usePrecalculatedEmployeeRatioForSupportDivisions = true;
const usePrecalculatedEmployeeRatioForProfitSetup = true;
const usePrecalculatedEmployeeRatioForProductDivision = true;
const maxNumberOfProductsInRound3 = 1;
const maxNumberOfProductsInRound4 = 2;
const thresholdOfFocusingOnAdvert = 1e14; // Was 1e18
/** @type {import("@ns").NS} */
let ns;
let nsx;
let config;
let enableTestingTools = false;
let mainProductDevelopmentCity;
let supportProductDevelopmentCities;
let agricultureIndustryData;
let chemicalIndustryData;
let tobaccoIndustryData;
let budgetRatioForProductDivision = defaultBudgetRatioForProductDivision;
const defaultConfig = [
    ["benchmark", false],
    ["auto", false],
    ["selfFund", false],
    ["round1", false],
    ["round1_5", false],
    ["round2", false],
    ["round3", false],
    ["improveAllDivisions", false],
    ["test", false],
    ["help", false],
];
function init(nsContext) {
    ns = nsContext;
    nsx = new NetscriptExtension(ns);
    mainProductDevelopmentCity = ns.enums.CityName.Sector12;
    supportProductDevelopmentCities = Object.values(ns.enums.CityName).filter(
        (cityName) => cityName !== mainProductDevelopmentCity,
    );
}
async function round1(option = PrecalculatedRound1Option.OPTION2) {
    ns.print(`Use: ${JSON.stringify(option)}`);
    await createDivision(ns, DivisionName.AGRICULTURE, option.agricultureOfficeSize, 1);
    ns.print(`Finished creating division`);
    for (const city of cities) {
        ns.corporation.sellMaterial(DivisionName.AGRICULTURE, city, MaterialName.PLANTS, "MAX", "MP");
        ns.corporation.sellMaterial(DivisionName.AGRICULTURE, city, MaterialName.FOOD, "MAX", "MP");
    }
    // if (enableTestingTools && config.auto === false) {
    //     testingTools.setEnergyAndMorale(DivisionName.AGRICULTURE, 100, 100);
    //     testingTools.setResearchPoints(DivisionName.AGRICULTURE, option.waitForAgricultureRP);
    // }
    await buyTeaAndThrowParty(ns, DivisionName.AGRICULTURE);
    buyAdvert(ns, DivisionName.AGRICULTURE, 2);
    const dataArray = new CorporationOptimizer().optimizeStorageAndFactory(
        agricultureIndustryData,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_STORAGE),
        // Assume that all warehouses are at the same level
        ns.corporation.getWarehouse(DivisionName.AGRICULTURE, CityName.Sector12).level,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_FACTORIES),
        getDivisionResearches(ns, DivisionName.AGRICULTURE),
        ns.corporation.getCorporation().funds,
        false,
    );
    // if (dataArray.length === 0) {
    //     throw new Error("Cannot find optimal data");
    // }
    if (dataArray.length > 0) {
        const optimalData = dataArray[dataArray.length - 1];
        buyUpgrade(ns, UpgradeName.SMART_STORAGE, optimalData.smartStorageLevel);
        buyUpgrade(ns, UpgradeName.SMART_FACTORIES, optimalData.smartFactoriesLevel);
        for (const city of cities) {
            upgradeWarehouse(ns, DivisionName.AGRICULTURE, city, optimalData.warehouseLevel);
        }
    }
    await waitUntilHavingEnoughResearchPoints(ns, [
        {
            divisionName: DivisionName.AGRICULTURE,
            researchPoint: option.waitForAgricultureRP,
        },
    ]);
    assignJobs(ns, DivisionName.AGRICULTURE, generateOfficeSetupsForEarlyRounds(option.agricultureOfficeSize, false));
    const optimalAmountOfBoostMaterials = await findOptimalAmountOfBoostMaterials(
        ns,
        DivisionName.AGRICULTURE,
        agricultureIndustryData,
        CityName.Sector12,
        true,
        option.boostMaterialsRatio,
    );
    await stockMaterials(
        ns,
        DivisionName.AGRICULTURE,
        generateMaterialsOrders(cities, [
            { name: MaterialName.AI_CORES, count: optimalAmountOfBoostMaterials[0] },
            { name: MaterialName.HARDWARE, count: optimalAmountOfBoostMaterials[1] },
            { name: MaterialName.REAL_ESTATE, count: optimalAmountOfBoostMaterials[2] },
            { name: MaterialName.ROBOTS, count: optimalAmountOfBoostMaterials[3] },
        ]),
    );
    if (config.auto === true) {
        await waitForOffer(ns, 10, 10, 49e10);
        ns.print(`Round 1: Accept offer: ${ns.formatNumber(ns.corporation.getInvestmentOffer().funds)}`);
        corporationEventLogger.generateOfferAcceptanceEvent(ns);
        ns.corporation.acceptInvestmentOffer();
        await round2();
    }
}
async function round1_5(option = PrecalculatedRound1Option.OPTION5) {
    ns.print(`Use: ${JSON.stringify(option)}`);
    await createDivision(ns, DivisionName.AGRICULTURE, option.agricultureOfficeSize, 1);
    for (const city of cities) {
        ns.corporation.sellMaterial(DivisionName.AGRICULTURE, city, MaterialName.PLANTS, "MAX", "MP");
        ns.corporation.sellMaterial(DivisionName.AGRICULTURE, city, MaterialName.FOOD, "MAX", "MP");
    }
    // if (enableTestingTools && config.auto === false) {
    //     testingTools.setEnergyAndMorale(DivisionName.AGRICULTURE, 100, 100);
    //     testingTools.setResearchPoints(DivisionName.AGRICULTURE, option.waitForAgricultureRP);
    // }
    await buyTeaAndThrowParty(ns, DivisionName.AGRICULTURE);
    buyAdvert(ns, DivisionName.AGRICULTURE, 2);
    const dataArray = new CorporationOptimizer().optimizeStorageAndFactory(
        agricultureIndustryData,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_STORAGE),
        // Assume that all warehouses are at the same level
        ns.corporation.getWarehouse(DivisionName.AGRICULTURE, CityName.Sector12).level,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_FACTORIES),
        getDivisionResearches(ns, DivisionName.AGRICULTURE),
        ns.corporation.getCorporation().funds,
        false,
    );
    // if (dataArray.length === 0) {
    //     throw new Error("Cannot find optimal data");
    // }
    if (dataArray.length > 0) {
        const optimalData = dataArray[dataArray.length - 1];
        buyUpgrade(ns, UpgradeName.SMART_STORAGE, optimalData.smartStorageLevel);
        buyUpgrade(ns, UpgradeName.SMART_FACTORIES, optimalData.smartFactoriesLevel);
        for (const city of cities) {
            upgradeWarehouse(ns, DivisionName.AGRICULTURE, city, optimalData.warehouseLevel);
        }
    }
    await waitUntilHavingEnoughResearchPoints(ns, [
        {
            divisionName: DivisionName.AGRICULTURE,
            researchPoint: option.waitForAgricultureRP,
        },
    ]);
    assignJobs(ns, DivisionName.AGRICULTURE, generateOfficeSetupsForEarlyRounds(option.agricultureOfficeSize, false));
    const optimalAmountOfBoostMaterials = await findOptimalAmountOfBoostMaterials(
        ns,
        DivisionName.AGRICULTURE,
        agricultureIndustryData,
        CityName.Sector12,
        true,
        option.boostMaterialsRatio,
    );
    await stockMaterials(
        ns,
        DivisionName.AGRICULTURE,
        generateMaterialsOrders(cities, [
            { name: MaterialName.AI_CORES, count: optimalAmountOfBoostMaterials[0] },
            { name: MaterialName.HARDWARE, count: optimalAmountOfBoostMaterials[1] },
            { name: MaterialName.REAL_ESTATE, count: optimalAmountOfBoostMaterials[2] },
            { name: MaterialName.ROBOTS, count: optimalAmountOfBoostMaterials[3] },
        ]),
    );
    // if (config.auto === true) {
    //     await waitForOffer(ns, 10, 10, 49e10);
    //     ns.print(`Round 1: Accept offer: ${ns.formatNumber(ns.corporation.getInvestmentOffer().funds)}`);
    //     corporationEventLogger.generateOfferAcceptanceEvent(ns);
    //     ns.corporation.acceptInvestmentOffer();
    //     await round2();
    // }
}
async function round2(option = PrecalculatedRound2Option.OPTION2) {
    ns.print(`Use: ${JSON.stringify(option)}`);
    if (enableTestingTools && config.auto === false) {
        resetStatistics();
        testingTools.setFunds(49e10);
    }
    buyUnlock(ns, UnlockName.EXPORT);
    ns.print("Upgrade Agriculture division");
    upgradeOffices(
        ns,
        DivisionName.AGRICULTURE,
        generateOfficeSetups(cities, option.agricultureOfficeSize, [
            { name: EmployeePosition.RESEARCH_DEVELOPMENT, count: option.agricultureOfficeSize },
        ]),
    );
    await createDivision(ns, DivisionName.CHEMICAL, 3, 2);
    for (const city of cities) {
        ns.corporation.cancelExportMaterial(DivisionName.AGRICULTURE, city, DivisionName.CHEMICAL, city, "Plants");
        ns.corporation.exportMaterial(
            DivisionName.AGRICULTURE,
            city,
            DivisionName.CHEMICAL,
            city,
            "Plants",
            exportString,
        );
        ns.corporation.cancelExportMaterial(DivisionName.CHEMICAL, city, DivisionName.AGRICULTURE, city, "Chemicals");
        ns.corporation.exportMaterial(
            DivisionName.CHEMICAL,
            city,
            DivisionName.AGRICULTURE,
            city,
            "Chemicals",
            exportString,
        );
        ns.corporation.sellMaterial(DivisionName.CHEMICAL, city, MaterialName.CHEMICALS, "MAX", "MP");
    }
    testingTools.setResearchPoints(DivisionName.AGRICULTURE, 55);
    if (enableTestingTools && config.auto === false) {
        testingTools.setEnergyAndMorale(DivisionName.AGRICULTURE, 100, 100);
        testingTools.setEnergyAndMorale(DivisionName.CHEMICAL, 100, 100);
        testingTools.setResearchPoints(DivisionName.AGRICULTURE, option.waitForAgricultureRP);
        testingTools.setResearchPoints(DivisionName.CHEMICAL, option.waitForChemicalRP);
    }
    await buyTeaAndThrowParty(ns, DivisionName.AGRICULTURE);
    await buyTeaAndThrowParty(ns, DivisionName.CHEMICAL);
    buyAdvert(ns, DivisionName.AGRICULTURE, 8);
    const dataArray = new CorporationOptimizer().optimizeStorageAndFactory(
        agricultureIndustryData,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_STORAGE),
        // Assume that all warehouses are at the same level
        ns.corporation.getWarehouse(DivisionName.AGRICULTURE, CityName.Sector12).level,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_FACTORIES),
        getDivisionResearches(ns, DivisionName.AGRICULTURE),
        ns.corporation.getCorporation().funds,
        false,
    );
    // if (dataArray.length === 0) {
    //     throw new Error("Cannot find optimal data");
    // }
    if (dataArray.length > 0) {
        const optimalData = dataArray[dataArray.length - 1];
        buyUpgrade(ns, UpgradeName.SMART_STORAGE, optimalData.smartStorageLevel);
        buyUpgrade(ns, UpgradeName.SMART_FACTORIES, optimalData.smartFactoriesLevel);
        for (const city of cities) {
            upgradeWarehouse(ns, DivisionName.AGRICULTURE, city, optimalData.warehouseLevel);
        }
    }
    await waitUntilHavingEnoughResearchPoints(ns, [
        {
            divisionName: DivisionName.AGRICULTURE,
            researchPoint: option.waitForAgricultureRP,
        },
        {
            divisionName: DivisionName.CHEMICAL,
            researchPoint: option.waitForChemicalRP,
        },
    ]);
    buyAdvert(
        ns,
        DivisionName.AGRICULTURE,
        getMaxAffordableAdVertLevel(
            ns.corporation.getHireAdVertCount(DivisionName.AGRICULTURE),
            ns.corporation.getCorporation().funds,
        ),
    );
    assignJobs(
        ns,
        DivisionName.AGRICULTURE,
        generateOfficeSetupsForEarlyRounds(option.agricultureOfficeSize, option.increaseBusiness),
    );
    assignJobs(ns, DivisionName.CHEMICAL, generateOfficeSetupsForEarlyRounds(3));
    const optimalAmountOfBoostMaterialsForAgriculture = await findOptimalAmountOfBoostMaterials(
        ns,
        DivisionName.AGRICULTURE,
        agricultureIndustryData,
        CityName.Sector12,
        true,
        option.agricultureBoostMaterialsRatio,
    );
    const optimalAmountOfBoostMaterialsForChemical = await findOptimalAmountOfBoostMaterials(
        ns,
        DivisionName.CHEMICAL,
        chemicalIndustryData,
        CityName.Sector12,
        true,
        0.95,
    );
    await Promise.allSettled([
        stockMaterials(
            ns,
            DivisionName.AGRICULTURE,
            generateMaterialsOrders(cities, [
                { name: MaterialName.AI_CORES, count: optimalAmountOfBoostMaterialsForAgriculture[0] },
                { name: MaterialName.HARDWARE, count: optimalAmountOfBoostMaterialsForAgriculture[1] },
                { name: MaterialName.REAL_ESTATE, count: optimalAmountOfBoostMaterialsForAgriculture[2] },
                { name: MaterialName.ROBOTS, count: optimalAmountOfBoostMaterialsForAgriculture[3] },
            ]),
        ),
        stockMaterials(
            ns,
            DivisionName.CHEMICAL,
            generateMaterialsOrders(cities, [
                { name: MaterialName.AI_CORES, count: optimalAmountOfBoostMaterialsForChemical[0] },
                { name: MaterialName.HARDWARE, count: optimalAmountOfBoostMaterialsForChemical[1] },
                { name: MaterialName.REAL_ESTATE, count: optimalAmountOfBoostMaterialsForChemical[2] },
                { name: MaterialName.ROBOTS, count: optimalAmountOfBoostMaterialsForChemical[3] },
            ]),
        ),
    ]);
    if (config.auto === true) {
        await waitForOffer(ns, 15, 50, 11e12);
        ns.print(`Round 2: Accept offer: ${ns.formatNumber(ns.corporation.getInvestmentOffer().funds)}`);
        corporationEventLogger.generateOfferAcceptanceEvent(ns);
        ns.corporation.acceptInvestmentOffer();
        await round3();
    }
}
async function round3(option = PrecalculatedRound3Option.OPTION1) {
    if (hasDivision(ns, DivisionName.TOBACCO)) {
        ns.spawn(ns.getScriptName(), { spawnDelay: 500 }, "--improveAllDivisions");
        return;
    }
    ns.print(`Use: ${JSON.stringify(option)}`);
    if (enableTestingTools && config.auto === false) {
        resetStatistics();
        testingTools.setFunds(11e12);
    }
    buyUnlock(ns, UnlockName.MARKET_RESEARCH_DEMAND);
    buyUnlock(ns, UnlockName.MARKET_DATA_COMPETITION);
    if (ns.corporation.getCorporation().divisions.length === 20) {
        throw new Error("You need to sell 1 division");
    }
    await createDivision(ns, DivisionName.TOBACCO, 3, 1);
    createDummyDivisions(ns, 20 - ns.corporation.getCorporation().divisions.length);
    for (const city of cities) {
        ns.corporation.cancelExportMaterial(DivisionName.AGRICULTURE, city, DivisionName.TOBACCO, city, "Plants");
        ns.corporation.exportMaterial(
            DivisionName.AGRICULTURE,
            city,
            DivisionName.TOBACCO,
            city,
            "Plants",
            exportString,
        );
        ns.corporation.cancelExportMaterial(DivisionName.AGRICULTURE, city, DivisionName.CHEMICAL, city, "Plants");
        ns.corporation.exportMaterial(
            DivisionName.AGRICULTURE,
            city,
            DivisionName.CHEMICAL,
            city,
            "Plants",
            exportString,
        );
    }
    const agricultureDivision = ns.corporation.getDivision(DivisionName.AGRICULTURE);
    const chemicalDivision = ns.corporation.getDivision(DivisionName.CHEMICAL);
    const tobaccoDivision = ns.corporation.getDivision(DivisionName.TOBACCO);
    const agricultureDivisionBudget = 15e10;
    const chemicalDivisionBudget = 3e10;
    while (ns.corporation.getDivision(DivisionName.TOBACCO).productionMult === 0) {
        await ns.corporation.nextUpdate();
    }
    await improveProductDivision(
        DivisionName.TOBACCO,
        ns.corporation.getCorporation().funds * 0.99 - agricultureDivisionBudget - chemicalDivisionBudget - 1e9,
        false,
        false,
        false,
    );
    developNewProduct(ns, DivisionName.TOBACCO, mainProductDevelopmentCity, 1e9);
    corporationEventLogger.generateNewProductEvent(ns, DivisionName.TOBACCO);
    await improveSupportDivision(
        DivisionName.AGRICULTURE,
        agricultureDivisionBudget,
        defaultBudgetRatioForSupportDivision,
        false,
        false,
    );
    await improveSupportDivision(
        DivisionName.CHEMICAL,
        chemicalDivisionBudget,
        defaultBudgetRatioForSupportDivision,
        false,
        false,
    );
    await Promise.allSettled([
        buyBoostMaterials(ns, agricultureDivision),
        buyBoostMaterials(ns, chemicalDivision),
        buyBoostMaterials(ns, tobaccoDivision),
    ]);
    ns.spawn(ns.getScriptName(), { spawnDelay: 500 }, "--improveAllDivisions");
}
async function improveAllDivisions() {
    let cycleCount = corporationEventLogger.cycle;
    const pendingImprovingProductDivisions1 = /* @__PURE__ */ new Map();
    const pendingImprovingProductDivisions2 = /* @__PURE__ */ new Map();
    const pendingImprovingSupportDivisions = /* @__PURE__ */ new Map();
    const pendingBuyingBoostMaterialsDivisions = /* @__PURE__ */ new Set();
    const buyBoostMaterialsIfNeeded = (divisionName) => {
        if (!pendingBuyingBoostMaterialsDivisions.has(divisionName)) {
            pendingBuyingBoostMaterialsDivisions.add(divisionName);
            // ns.print(`Buying boost materials for division: ${divisionName}`);
            buyBoostMaterials(ns, ns.corporation.getDivision(divisionName)).then((totalBoostMaterialsCount) => {
                if (totalBoostMaterialsCount > 0) {
                    ns.print(
                        `${divisionName}: Finish buying boost materials. Total boost materials count: ${totalBoostMaterialsCount}`,
                    );
                }
                pendingBuyingBoostMaterialsDivisions.delete(divisionName);
            });
        }
    };
    await improveProductDivision(
        DivisionName.TOBACCO,
        ns.corporation.getCorporation().funds * 0.99 - 1e9,
        false,
        false,
        false,
    );
    buyBoostMaterialsIfNeeded(DivisionName.TOBACCO);
    let reservedFunds = 0;
    const increaseReservedFunds = (amount) => {
        console.log(`Increase reservedFunds by ${ns.formatNumber(amount)}`);
        reservedFunds += amount;
        console.log(`New reservedFunds: ${ns.formatNumber(reservedFunds)}`);
    };
    const decreaseReservedFunds = (amount) => {
        console.log(`Decrease reservedFunds by ${ns.formatNumber(amount)}`);
        reservedFunds -= amount;
        console.log(`New reservedFunds: ${ns.formatNumber(reservedFunds)}`);
    };
    let preparingToAcceptOffer = false;
    while (true) {
        ++cycleCount;
        const currentRound = ns.corporation.getInvestmentOffer().round;
        const profit = getProfit(ns);
        if (cycleCount % 10 === 0) {
            ns.print(
                `Cycle: ${cycleCount}. Funds: ${ns.formatNumber(ns.corporation.getCorporation().funds)}. Profit: ${ns.formatNumber(profit)}`,
            );
        }
        console.log(
            `cycleCount: ${cycleCount}. Funds: ${ns.formatNumber(ns.corporation.getCorporation().funds)}. Profit: ${ns.formatNumber(profit)}` +
                (currentRound <= 4 ? `. Offer: ${ns.formatNumber(ns.corporation.getInvestmentOffer().funds)}` : ""),
        );
        await buyResearch();
        if (ns.corporation.getDivision(DivisionName.TOBACCO).awareness !== Number.MAX_VALUE) {
            const currentWilsonLevel = ns.corporation.getUpgradeLevel(UpgradeName.WILSON_ANALYTICS);
            const maxWilsonLevel = getMaxAffordableUpgradeLevel(
                UpgradeName.WILSON_ANALYTICS,
                currentWilsonLevel,
                profit,
            );
            if (maxWilsonLevel > currentWilsonLevel) {
                buyUpgrade(ns, UpgradeName.WILSON_ANALYTICS, maxWilsonLevel);
            }
            if (profit >= thresholdOfFocusingOnAdvert) {
                const currentAdvertLevel = ns.corporation.getHireAdVertCount(DivisionName.TOBACCO);
                const maxAdvertLevel = getMaxAffordableAdVertLevel(
                    currentAdvertLevel,
                    (ns.corporation.getCorporation().funds - reservedFunds) * 0.6,
                );
                if (maxAdvertLevel > currentAdvertLevel) {
                    buyAdvert(ns, DivisionName.TOBACCO, maxAdvertLevel);
                }
            }
        }
        const totalFunds = ns.corporation.getCorporation().funds - reservedFunds;
        let availableFunds = totalFunds;
        let maxNumberOfProducts = maxNumberOfProductsInRound3;
        if (currentRound === 4) {
            maxNumberOfProducts = maxNumberOfProductsInRound4;
        }
        if (currentRound === 3 || currentRound === 4) {
            const productIdArray = getProductIdArray(ns, DivisionName.TOBACCO);
            let numberOfDevelopedProducts = 0;
            if (productIdArray.length > 0) {
                numberOfDevelopedProducts = Math.max(...productIdArray) + 1;
            }
            if (numberOfDevelopedProducts >= maxNumberOfProducts) {
                const products = ns.corporation.getDivision(DivisionName.TOBACCO).products;
                const allProductsAreFinished = products.every((productName) => {
                    const product = ns.corporation.getProduct(
                        DivisionName.TOBACCO,
                        mainProductDevelopmentCity,
                        productName,
                    );
                    return product.developmentProgress === 100;
                });
                const getNewestProduct = () => {
                    return ns.corporation.getProduct(
                        DivisionName.TOBACCO,
                        mainProductDevelopmentCity,
                        products[products.length - 1],
                    );
                };
                const newestProduct = getNewestProduct();
                if (
                    !preparingToAcceptOffer &&
                    newestProduct.developmentProgress > 98 &&
                    newestProduct.developmentProgress < 100
                ) {
                    preparingToAcceptOffer = true;
                }
                if (allProductsAreFinished) {
                    const productDevelopmentBudget = totalFunds * 0.01;
                    const newProductName = developNewProduct(
                        ns,
                        DivisionName.TOBACCO,
                        mainProductDevelopmentCity,
                        productDevelopmentBudget,
                    );
                    if (newProductName) {
                        corporationEventLogger.generateNewProductEvent(ns, DivisionName.TOBACCO);
                        availableFunds -= productDevelopmentBudget;
                    }
                    while (getNewestProduct().effectiveRating === 0) {
                        await waitForNumberOfCycles(ns, 1);
                        ++cycleCount;
                    }
                    await switchAllOfficesToProfitSetup(
                        tobaccoIndustryData,
                        // We must use the latest data of product
                        getNewestProduct(),
                    );
                    let expectedOffer = Number.MAX_VALUE;
                    if (currentRound === 3) {
                        expectedOffer = 1e16;
                    } else if (currentRound === 4) {
                        expectedOffer = 1e20;
                    }
                    const currentCycle = corporationEventLogger.cycle;
                    await waitForOffer(ns, 10, 5, expectedOffer);
                    cycleCount += corporationEventLogger.cycle - currentCycle;
                    console.log(
                        `Cycle: ${cycleCount}. Accept offer: ${ns.formatNumber(ns.corporation.getInvestmentOffer().funds)}`,
                    );
                    corporationEventLogger.generateOfferAcceptanceEvent(ns);
                    ns.corporation.acceptInvestmentOffer();
                    preparingToAcceptOffer = false;
                    continue;
                }
            }
        }
        if (profit <= 1e40 || availableFunds >= 1e72) {
            let productDevelopmentBudget = totalFunds * 0.01;
            if (availableFunds >= 1e72) {
                productDevelopmentBudget = Math.max(productDevelopmentBudget, 1e72);
            }
            const newProductName = developNewProduct(
                ns,
                DivisionName.TOBACCO,
                mainProductDevelopmentCity,
                productDevelopmentBudget,
            );
            if (newProductName) {
                console.log(`Develop ${newProductName}`);
                corporationEventLogger.generateNewProductEvent(ns, DivisionName.TOBACCO);
                availableFunds -= productDevelopmentBudget;
            }
        } else {
            const products = ns.corporation.getDivision(DivisionName.TOBACCO).products;
            const allProductsAreFinished = products.every((productName) => {
                const product = ns.corporation.getProduct(
                    DivisionName.TOBACCO,
                    mainProductDevelopmentCity,
                    productName,
                );
                return product.developmentProgress === 100;
            });
            if (allProductsAreFinished) {
                corporationEventLogger.generateSkipDevelopingNewProductEvent(ns);
            }
        }
        const tobaccoHasRevenue = ns.corporation.getDivision(DivisionName.TOBACCO).lastCycleRevenue > 0;
        const budgetForTobaccoDivision = totalFunds * 0.9;
        if (
            tobaccoHasRevenue &&
            (cycleCount % 5 === 0 || needToUpgradeDivision(DivisionName.TOBACCO, budgetForTobaccoDivision))
        ) {
            availableFunds -= budgetForTobaccoDivision;
            if (!pendingImprovingProductDivisions1.has(DivisionName.TOBACCO)) {
                const nonOfficesBudget = budgetForTobaccoDivision * (1 - budgetRatioForProductDivision.office);
                increaseReservedFunds(nonOfficesBudget);
                pendingImprovingProductDivisions1.set(DivisionName.TOBACCO, nonOfficesBudget);
                console.log(`Upgrade ${DivisionName.TOBACCO}-1, budget: ${ns.formatNumber(nonOfficesBudget)}`);
                console.time(DivisionName.TOBACCO + "-1");
                improveProductDivision(DivisionName.TOBACCO, budgetForTobaccoDivision, true, false, false)
                    .catch((reason) => {
                        console.error(`Error occurred when upgrading ${DivisionName.TOBACCO}`, reason);
                    })
                    .finally(() => {
                        console.timeEnd(DivisionName.TOBACCO + "-1");
                        decreaseReservedFunds(pendingImprovingProductDivisions1.get(DivisionName.TOBACCO) ?? 0);
                        pendingImprovingProductDivisions1.delete(DivisionName.TOBACCO);
                        buyBoostMaterialsIfNeeded(DivisionName.TOBACCO);
                    });
            }
            if (!pendingImprovingProductDivisions2.has(DivisionName.TOBACCO) && !preparingToAcceptOffer) {
                const officesBudget = budgetForTobaccoDivision * budgetRatioForProductDivision.office;
                increaseReservedFunds(officesBudget);
                pendingImprovingProductDivisions2.set(DivisionName.TOBACCO, officesBudget);
                console.log(`Upgrade ${DivisionName.TOBACCO}-2, budget: ${ns.formatNumber(officesBudget)}`);
                console.time(DivisionName.TOBACCO + "-2");
                improveProductDivisionOffices(DivisionName.TOBACCO, tobaccoIndustryData, officesBudget, false, false)
                    .catch((reason) => {
                        console.error(`Error occurred when upgrading ${DivisionName.TOBACCO}`, reason);
                    })
                    .finally(() => {
                        console.timeEnd(DivisionName.TOBACCO + "-2");
                        decreaseReservedFunds(pendingImprovingProductDivisions2.get(DivisionName.TOBACCO) ?? 0);
                        pendingImprovingProductDivisions2.delete(DivisionName.TOBACCO);
                    });
            }
        }
        const budgetForAgricultureDivision = Math.max(
            Math.min(profit * (currentRound <= 4 ? 0.9 : 0.99), totalFunds * 0.09, availableFunds),
            0,
        );
        if (
            tobaccoHasRevenue &&
            (cycleCount % 10 === 0 || needToUpgradeDivision(DivisionName.AGRICULTURE, budgetForAgricultureDivision)) &&
            !pendingImprovingSupportDivisions.has(DivisionName.AGRICULTURE)
        ) {
            availableFunds -= budgetForAgricultureDivision;
            increaseReservedFunds(budgetForAgricultureDivision);
            pendingImprovingSupportDivisions.set(DivisionName.AGRICULTURE, budgetForAgricultureDivision);
            console.log(
                `Upgrade ${DivisionName.AGRICULTURE}, budget: ${ns.formatNumber(budgetForAgricultureDivision)}`,
            );
            console.time(DivisionName.AGRICULTURE);
            improveSupportDivision(
                DivisionName.AGRICULTURE,
                budgetForAgricultureDivision,
                defaultBudgetRatioForSupportDivision,
                false,
                false,
            )
                .catch((reason) => {
                    console.error(`Error occurred when upgrading ${DivisionName.AGRICULTURE}`, reason);
                })
                .finally(() => {
                    console.timeEnd(DivisionName.AGRICULTURE);
                    decreaseReservedFunds(pendingImprovingSupportDivisions.get(DivisionName.AGRICULTURE) ?? 0);
                    pendingImprovingSupportDivisions.delete(DivisionName.AGRICULTURE);
                    buyBoostMaterialsIfNeeded(DivisionName.AGRICULTURE);
                });
        }
        const budgetForChemicalDivision = Math.max(
            Math.min(profit * (currentRound <= 4 ? 0.1 : 0.01), totalFunds * 0.01, availableFunds),
            0,
        );
        if (
            tobaccoHasRevenue &&
            (cycleCount % 15 === 0 || needToUpgradeDivision(DivisionName.CHEMICAL, budgetForChemicalDivision)) &&
            !pendingImprovingSupportDivisions.has(DivisionName.CHEMICAL)
        ) {
            availableFunds -= budgetForChemicalDivision;
            increaseReservedFunds(budgetForChemicalDivision);
            pendingImprovingSupportDivisions.set(DivisionName.CHEMICAL, budgetForChemicalDivision);
            console.log(`Upgrade ${DivisionName.CHEMICAL}, budget: ${ns.formatNumber(budgetForChemicalDivision)}`);
            console.time(DivisionName.CHEMICAL);
            improveSupportDivision(
                DivisionName.CHEMICAL,
                budgetForChemicalDivision,
                defaultBudgetRatioForSupportDivision,
                false,
                false,
            )
                .catch((reason) => {
                    console.error(`Error occurred when upgrading ${DivisionName.CHEMICAL}`, reason);
                })
                .finally(() => {
                    console.timeEnd(DivisionName.CHEMICAL);
                    decreaseReservedFunds(pendingImprovingSupportDivisions.get(DivisionName.CHEMICAL) ?? 0);
                    pendingImprovingSupportDivisions.delete(DivisionName.CHEMICAL);
                    buyBoostMaterialsIfNeeded(DivisionName.CHEMICAL);
                });
        }
        const producedPlants = ns.corporation.getMaterial(
            DivisionName.AGRICULTURE,
            mainProductDevelopmentCity,
            MaterialName.PLANTS,
        ).productionAmount;
        const consumedPlants = Math.abs(
            ns.corporation.getMaterial(DivisionName.TOBACCO, mainProductDevelopmentCity, MaterialName.PLANTS)
                .productionAmount,
        );
        if (consumedPlants > 0 && producedPlants / consumedPlants < 1) {
            console.debug(`plants ratio: ${producedPlants / consumedPlants}`);
        }
        await waitForNextTimeStateHappens(ns, CorpState.START);
    }
}
function needToUpgradeDivision(divisionName, budget) {
    const office = ns.corporation.getOffice(divisionName, CityName.Sector12);
    let expectedUpgradeSize = 30;
    if (ns.corporation.getInvestmentOffer().round <= 4) {
        expectedUpgradeSize = Math.min(office.size / 2, 30);
    }
    const maxOfficeSize = getMaxAffordableOfficeSize(office.size, budget / 6);
    const needToUpgrade = maxOfficeSize >= office.size + expectedUpgradeSize;
    if (needToUpgrade) {
        console.debug(
            `needToUpgrade ${divisionName}, budget: ${ns.formatNumber(budget)}, office.size: ${office.size}, maxOfficeSize: ${maxOfficeSize}}`,
        );
    }
    return needToUpgrade;
}
function getBalancingModifierForProfitProgress() {
    if (getProfit(ns) >= 1e35) {
        return {
            profit: 1,
            progress: 2.5,
        };
    }
    return {
        profit: 1,
        progress: 5,
    };
}
async function switchAllOfficesToProfitSetup(industryData, newestProduct) {
    const mainOffice = ns.corporation.getOffice(DivisionName.TOBACCO, mainProductDevelopmentCity);
    const officeSetup = {
        city: mainProductDevelopmentCity,
        size: mainOffice.numEmployees,
        jobs: {
            Operations: 0,
            Engineer: 0,
            Business: 0,
            Management: 0,
            "Research & Development": 0,
        },
    };
    if (usePrecalculatedEmployeeRatioForProfitSetup) {
        const precalculatedEmployeeRatioForProfitSetup =
            ns.corporation.getInvestmentOffer().round === 3
                ? precalculatedEmployeeRatioForProfitSetupOfRound3
                : precalculatedEmployeeRatioForProfitSetupOfRound4;
        officeSetup.jobs.Operations = Math.floor(
            officeSetup.size * precalculatedEmployeeRatioForProfitSetup.operations,
        );
        officeSetup.jobs.Engineer = Math.floor(officeSetup.size * precalculatedEmployeeRatioForProfitSetup.engineer);
        officeSetup.jobs.Business = Math.floor(officeSetup.size * precalculatedEmployeeRatioForProfitSetup.business);
        officeSetup.jobs.Management =
            officeSetup.size - (officeSetup.jobs.Operations + officeSetup.jobs.Engineer + officeSetup.jobs.Business);
    } else {
        const dataArray = await optimizeOffice(
            nsx,
            ns.corporation.getDivision(DivisionName.TOBACCO),
            industryData,
            mainProductDevelopmentCity,
            mainOffice.numEmployees,
            0,
            newestProduct,
            true,
            "profit",
            getBalancingModifierForProfitProgress(),
            0,
            // Do not rerun
            20,
            // Half of defaultPerformanceModifierForOfficeBenchmark
            false,
        );
        const optimalData = dataArray[dataArray.length - 1];
        console.log(`Optimize all offices for "profit"`, optimalData);
        officeSetup.jobs = {
            Operations: optimalData.operations,
            Engineer: optimalData.engineer,
            Business: optimalData.business,
            Management: optimalData.management,
            "Research & Development": 0,
        };
    }
    assignJobs(ns, DivisionName.TOBACCO, [officeSetup]);
    for (const city of supportProductDevelopmentCities) {
        const office = ns.corporation.getOffice(DivisionName.TOBACCO, city);
        const operations = Math.max(
            Math.floor(office.numEmployees * (officeSetup.jobs.Operations / mainOffice.numEmployees)),
            1,
        );
        const engineer = Math.max(
            Math.floor(office.numEmployees * (officeSetup.jobs.Engineer / mainOffice.numEmployees)),
            1,
        );
        const business = Math.max(
            Math.floor(office.numEmployees * (officeSetup.jobs.Business / mainOffice.numEmployees)),
            1,
        );
        const management = office.numEmployees - (operations + engineer + business);
        assignJobs(ns, DivisionName.TOBACCO, [
            {
                city,
                size: office.numEmployees,
                jobs: {
                    Operations: operations,
                    Engineer: engineer,
                    Business: business,
                    Management: management,
                    "Research & Development": 0,
                },
            },
        ]);
    }
}
async function buyResearch() {
    if (ns.corporation.getInvestmentOffer().round <= 3) {
        return;
    }
    const buyResearches = (divisionName) => {
        let researchPriorities;
        if (divisionName === DivisionName.AGRICULTURE || divisionName === DivisionName.CHEMICAL) {
            researchPriorities = researchPrioritiesForSupportDivision;
        } else {
            researchPriorities = researchPrioritiesForProductDivision;
        }
        for (const researchPriority of researchPriorities) {
            if (
                ns.corporation.getInvestmentOffer().round === 4 &&
                researchPriority.research !== ResearchName.HI_TECH_RND_LABORATORY
            ) {
                break;
            }
            if (ns.corporation.hasResearched(divisionName, researchPriority.research)) {
                continue;
            }
            const researchCost = ns.corporation.getResearchCost(divisionName, researchPriority.research);
            if (
                ns.corporation.getDivision(divisionName).researchPoints <
                researchCost * researchPriority.costMultiplier
            ) {
                break;
            }
            ns.corporation.research(divisionName, researchPriority.research);
        }
    };
    buyResearches(DivisionName.AGRICULTURE);
    buyResearches(DivisionName.CHEMICAL);
    buyResearches(DivisionName.TOBACCO);
}
async function improveSupportDivision(divisionName, totalBudget, budgetRatio, dryRun, enableLogging) {
    if (totalBudget < 0) {
        return;
    }
    const logger = new Logger(enableLogging);
    const currentFunds = ns.corporation.getCorporation().funds;
    const warehouseBudget = (totalBudget * budgetRatio.warehouse) / 6;
    const officeBudget = (totalBudget * budgetRatio.office) / 6;
    const officeSetups = [];
    for (const city2 of cities) {
        logger.city = city2;
        const currentWarehouseLevel = ns.corporation.getWarehouse(divisionName, city2).level;
        const newWarehouseLevel = getMaxAffordableWarehouseLevel(currentWarehouseLevel, warehouseBudget);
        if (newWarehouseLevel > currentWarehouseLevel && !dryRun) {
            ns.corporation.upgradeWarehouse(divisionName, city2, newWarehouseLevel - currentWarehouseLevel);
        }
        logger.log(
            `Division ${divisionName}: currentWarehouseLevel: ${currentWarehouseLevel}, newWarehouseLevel: ${ns.corporation.getWarehouse(divisionName, city2).level}`,
        );
    }
    const city = CityName.Sector12;
    logger.city = city;
    const office = ns.corporation.getOffice(divisionName, city);
    const maxOfficeSize = getMaxAffordableOfficeSize(office.size, officeBudget);
    logger.log(`City: ${city}. currentOfficeSize: ${office.size}, maxOfficeSize: ${maxOfficeSize}`);
    if (maxOfficeSize < 6) {
        throw new Error(
            `Budget for office is too low. Division: ${divisionName}. Office's budget: ${ns.formatNumber(officeBudget)}`,
        );
    }
    const rndEmployee = Math.min(Math.floor(maxOfficeSize * 0.2), maxOfficeSize - 3);
    const nonRnDEmployees = maxOfficeSize - rndEmployee;
    const officeSetup = {
        city,
        size: maxOfficeSize,
        jobs: {
            Operations: 0,
            Engineer: 0,
            Business: 0,
            Management: 0,
            "Research & Development": rndEmployee,
        },
    };
    if (usePrecalculatedEmployeeRatioForSupportDivisions) {
        officeSetup.jobs.Operations = Math.floor(
            nonRnDEmployees * precalculatedEmployeeRatioForSupportDivisions.operations,
        );
        officeSetup.jobs.Business = Math.floor(
            nonRnDEmployees * precalculatedEmployeeRatioForSupportDivisions.business,
        );
        officeSetup.jobs.Management = Math.floor(
            nonRnDEmployees * precalculatedEmployeeRatioForSupportDivisions.management,
        );
        officeSetup.jobs.Engineer =
            nonRnDEmployees - (officeSetup.jobs.Operations + officeSetup.jobs.Business + officeSetup.jobs.Management);
    } else {
        let item;
        switch (divisionName) {
            case DivisionName.AGRICULTURE:
                item = ns.corporation.getMaterial(divisionName, city, MaterialName.PLANTS);
                break;
            case DivisionName.CHEMICAL:
                item = ns.corporation.getMaterial(divisionName, city, MaterialName.CHEMICALS);
                break;
            default:
                throw new Error(`Invalid division: ${divisionName}`);
        }
        if (nonRnDEmployees <= 3) {
            throw new Error("Invalid R&D ratio");
        }
        const division = ns.corporation.getDivision(divisionName);
        const industryData = ns.corporation.getIndustryData(division.type);
        const dataArray = await optimizeOffice(
            nsx,
            division,
            industryData,
            city,
            nonRnDEmployees,
            rndEmployee,
            item,
            true,
            "rawProduction",
            getBalancingModifierForProfitProgress(),
            0,
            // Do not rerun
            20,
            // Half of defaultPerformanceModifierForOfficeBenchmark
            enableLogging,
            {
                engineer: Math.floor(nonRnDEmployees * 0.625),
                business: 0,
            },
        );
        if (dataArray.length === 0) {
            throw new Error(
                `Cannot calculate optimal office setup. Division: ${divisionName}, nonRnDEmployees: ${nonRnDEmployees}`,
            );
        } else {
            const optimalData = dataArray[dataArray.length - 1];
            officeSetup.jobs = {
                Operations: optimalData.operations,
                Engineer: optimalData.engineer,
                Business: optimalData.business,
                Management: optimalData.management,
                "Research & Development": rndEmployee,
            };
        }
        logger.log("Optimal officeSetup:", JSON.stringify(officeSetup));
    }
    for (const city2 of cities) {
        officeSetups.push({
            city: city2,
            size: officeSetup.size,
            jobs: officeSetup.jobs,
        });
    }
    logger.city = void 0;
    if (!dryRun) {
        upgradeOffices(ns, divisionName, officeSetups);
    }
    logger.log(`Spent: ${ns.formatNumber(currentFunds - ns.corporation.getCorporation().funds)}`);
}
function improveProductDivisionRawProduction(
    divisionName,
    industryData,
    divisionResearches,
    budget,
    dryRun,
    benchmark,
    enableLogging,
) {
    const logger = new Logger(enableLogging);
    const dataArray = benchmark.optimizeStorageAndFactory(
        industryData,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_STORAGE),
        // Assume that all warehouses are at the same level
        ns.corporation.getWarehouse(divisionName, CityName.Sector12).level,
        ns.corporation.getUpgradeLevel(UpgradeName.SMART_FACTORIES),
        divisionResearches,
        budget,
        enableLogging,
    );
    if (dataArray.length === 0) {
        return;
    }
    const optimalData = dataArray[dataArray.length - 1];
    logger.log(`rawProduction: ${JSON.stringify(optimalData)}`);
    if (!dryRun) {
        buyUpgrade(ns, UpgradeName.SMART_STORAGE, optimalData.smartStorageLevel);
        buyUpgrade(ns, UpgradeName.SMART_FACTORIES, optimalData.smartFactoriesLevel);
        for (const city of cities) {
            const currentWarehouseLevel = ns.corporation.getWarehouse(divisionName, city).level;
            if (optimalData.warehouseLevel > currentWarehouseLevel) {
                ns.corporation.upgradeWarehouse(divisionName, city, optimalData.warehouseLevel - currentWarehouseLevel);
            }
        }
    }
}
function improveProductDivisionWilsonAdvert(
    divisionName,
    industryData,
    divisionResearches,
    budget,
    dryRun,
    benchmark,
    enableLogging,
) {
    const logger = new Logger(enableLogging);
    const division = ns.corporation.getDivision(divisionName);
    const dataArray = benchmark.optimizeWilsonAndAdvert(
        industryData,
        ns.corporation.getUpgradeLevel(UpgradeName.WILSON_ANALYTICS),
        ns.corporation.getHireAdVertCount(divisionName),
        division.awareness,
        division.popularity,
        divisionResearches,
        budget,
        enableLogging,
    );
    if (dataArray.length === 0) {
        return;
    }
    const optimalData = dataArray[dataArray.length - 1];
    logger.log(`wilsonAdvert: ${JSON.stringify(optimalData)}`);
    if (!dryRun) {
        buyUpgrade(ns, UpgradeName.WILSON_ANALYTICS, optimalData.wilsonLevel);
        buyAdvert(ns, divisionName, optimalData.advertLevel);
    }
}
async function improveProductDivisionMainOffice(divisionName, industryData, budget, dryRun, enableLogging) {
    const logger = new Logger(enableLogging);
    const profit = getProfit(ns);
    const division = ns.corporation.getDivision(divisionName);
    const office = ns.corporation.getOffice(divisionName, mainProductDevelopmentCity);
    const maxOfficeSize = getMaxAffordableOfficeSize(office.size, budget);
    if (maxOfficeSize < office.size) {
        return;
    }
    const officeSetup = {
        city: mainProductDevelopmentCity,
        size: maxOfficeSize,
        jobs: {
            Operations: 0,
            Engineer: 0,
            Business: 0,
            Management: 0,
            "Research & Development": 0,
        },
    };
    const products = division.products;
    let item;
    let sortType;
    let useCurrentItemData = true;
    if (usePrecalculatedEmployeeRatioForProductDivision) {
        let precalculatedEmployeeRatioForProductDivision;
        if (ns.corporation.getInvestmentOffer().round === 3) {
            precalculatedEmployeeRatioForProductDivision = precalculatedEmployeeRatioForProductDivisionRound3;
        } else if (ns.corporation.getInvestmentOffer().round === 4) {
            precalculatedEmployeeRatioForProductDivision = precalculatedEmployeeRatioForProductDivisionRound4;
        } else if (ns.corporation.getInvestmentOffer().round === 5 && profit < 1e30) {
            precalculatedEmployeeRatioForProductDivision = precalculatedEmployeeRatioForProductDivisionRound5_1;
        } else if (ns.corporation.getInvestmentOffer().round === 5 && profit >= 1e30) {
            precalculatedEmployeeRatioForProductDivision = precalculatedEmployeeRatioForProductDivisionRound5_2;
        } else {
            throw new Error("Invalid precalculated employee ratio");
        }
        officeSetup.jobs.Operations = Math.floor(
            officeSetup.size * precalculatedEmployeeRatioForProductDivision.operations,
        );
        officeSetup.jobs.Engineer = Math.floor(
            officeSetup.size * precalculatedEmployeeRatioForProductDivision.engineer,
        );
        officeSetup.jobs.Business = Math.floor(
            officeSetup.size * precalculatedEmployeeRatioForProductDivision.business,
        );
        if (officeSetup.jobs.Business === 0) {
            officeSetup.jobs.Business = 1;
        }
        officeSetup.jobs.Management =
            officeSetup.size - (officeSetup.jobs.Operations + officeSetup.jobs.Engineer + officeSetup.jobs.Business);
    } else {
        if (ns.corporation.getInvestmentOffer().round === 3 || ns.corporation.getInvestmentOffer().round === 4) {
            sortType = "progress";
        } else {
            sortType = "profit_progress";
        }
        let bestProduct = null;
        let highestEffectiveRating = Number.MIN_VALUE;
        for (const productName of products) {
            const product = ns.corporation.getProduct(divisionName, mainProductDevelopmentCity, productName);
            if (product.developmentProgress < 100) {
                continue;
            }
            if (product.effectiveRating > highestEffectiveRating) {
                bestProduct = product;
                highestEffectiveRating = product.effectiveRating;
            }
        }
        if (!bestProduct) {
            useCurrentItemData = false;
            item = {
                name: sampleProductName,
                demand: 54,
                competition: 35,
                rating: 36e3,
                effectiveRating: 36e3,
                stats: {
                    quality: 42e3,
                    performance: 46e3,
                    durability: 2e4,
                    reliability: 31e3,
                    aesthetics: 25e3,
                    features: 37e3,
                },
                // Material's market price is different between cities. We use Sector12's price as reference price.
                productionCost: getProductMarketPrice(ns, division, industryData, CityName.Sector12),
                desiredSellPrice: 0,
                desiredSellAmount: 0,
                stored: 0,
                productionAmount: 0,
                actualSellAmount: 0,
                developmentProgress: 100,
                advertisingInvestment: (ns.corporation.getCorporation().funds * 0.01) / 2,
                designInvestment: (ns.corporation.getCorporation().funds * 0.01) / 2,
                size: 0.05,
            };
        } else {
            item = bestProduct;
            logger.log(`Use product: ${JSON.stringify(item)}`);
        }
        const dataArray = await optimizeOffice(
            nsx,
            division,
            industryData,
            mainProductDevelopmentCity,
            maxOfficeSize,
            0,
            item,
            useCurrentItemData,
            sortType,
            getBalancingModifierForProfitProgress(),
            maxRerunWhenOptimizingOfficeForProductDivision,
            defaultPerformanceModifierForOfficeBenchmark,
            enableLogging,
        );
        if (dataArray.length === 0) {
            throw new Error(`Cannot calculate optimal office setup. maxTotalEmployees: ${maxOfficeSize}`);
        }
        const optimalData = dataArray[dataArray.length - 1];
        officeSetup.jobs = {
            Operations: optimalData.operations,
            Engineer: optimalData.engineer,
            Business: optimalData.business,
            Management: optimalData.management,
            "Research & Development": 0,
        };
    }
    logger.log(`mainOffice: ${JSON.stringify(officeSetup)}`);
    if (!dryRun) {
        upgradeOffices(ns, divisionName, [officeSetup]);
    }
}
async function improveProductDivisionSupportOffices(divisionName, budget, dryRun, enableLogging) {
    const logger = new Logger(enableLogging);
    const officeSetups = [];
    if (budget > ns.corporation.getCorporation().funds) {
        console.warn(
            `Budget is higher than current funds. Budget: ${ns.formatNumber(budget)}, funds: ${ns.formatNumber(ns.corporation.getCorporation().funds)}`,
        );
        budget = ns.corporation.getCorporation().funds * 0.9;
    }
    const budgetForEachOffice = budget / 5;
    for (const city of supportProductDevelopmentCities) {
        const office = ns.corporation.getOffice(divisionName, city);
        const maxOfficeSize = getMaxAffordableOfficeSize(office.size, budgetForEachOffice);
        if (maxOfficeSize < 5) {
            throw new Error(
                `Budget for office is too low. Division: ${divisionName}. Office's budget: ${ns.formatNumber(budgetForEachOffice)}`,
            );
        }
        if (maxOfficeSize < office.size) {
            continue;
        }
        const officeSetup = {
            city,
            size: maxOfficeSize,
            jobs: {
                Operations: 0,
                Engineer: 0,
                Business: 0,
                Management: 0,
                "Research & Development": 0,
            },
        };
        if (ns.corporation.getInvestmentOffer().round === 3 && maxNumberOfProductsInRound3 === 1) {
            officeSetup.jobs.Operations = 0;
            officeSetup.jobs.Engineer = 0;
            officeSetup.jobs.Business = 0;
            officeSetup.jobs.Management = 0;
            officeSetup.jobs["Research & Development"] = maxOfficeSize;
        } else if (ns.corporation.getInvestmentOffer().round === 3 || ns.corporation.getInvestmentOffer().round === 4) {
            officeSetup.jobs.Operations = 1;
            officeSetup.jobs.Engineer = 1;
            officeSetup.jobs.Business = 1;
            officeSetup.jobs.Management = 1;
            officeSetup.jobs["Research & Development"] = maxOfficeSize - 4;
        } else {
            const rndEmployee = Math.min(Math.floor(maxOfficeSize * 0.5), maxOfficeSize - 4);
            const nonRnDEmployees = maxOfficeSize - rndEmployee;
            officeSetup.jobs.Operations = Math.floor(
                nonRnDEmployees * precalculatedEmployeeRatioForProfitSetupOfRound4.operations,
            );
            officeSetup.jobs.Engineer = Math.floor(
                nonRnDEmployees * precalculatedEmployeeRatioForProfitSetupOfRound4.engineer,
            );
            officeSetup.jobs.Business = Math.floor(
                nonRnDEmployees * precalculatedEmployeeRatioForProfitSetupOfRound4.business,
            );
            officeSetup.jobs.Management =
                nonRnDEmployees - (officeSetup.jobs.Operations + officeSetup.jobs.Engineer + officeSetup.jobs.Business);
            officeSetup.jobs["Research & Development"] = rndEmployee;
        }
        officeSetups.push(officeSetup);
    }
    logger.log(`supportOffices: ${JSON.stringify(officeSetups)}`);
    if (!dryRun) {
        upgradeOffices(ns, divisionName, officeSetups);
    }
}
async function improveProductDivisionOffices(divisionName, industryData, budget, dryRun, enableLogging) {
    let ratio = {
        mainOffice: 0.5,
        supportOffices: 0.5,
    };
    if (ns.corporation.getInvestmentOffer().round === 3) {
        ratio = {
            mainOffice: 0.75,
            supportOffices: 0.25,
        };
    }
    await improveProductDivisionMainOffice(
        divisionName,
        industryData,
        budget * ratio.mainOffice,
        dryRun,
        enableLogging,
    );
    await improveProductDivisionSupportOffices(divisionName, budget * ratio.supportOffices, dryRun, enableLogging);
}
async function improveProductDivision(divisionName, totalBudget, skipUpgradingOffice, dryRun, enableLogging) {
    if (totalBudget < 0) {
        return;
    }
    const logger = new Logger(enableLogging);
    const division = ns.corporation.getDivision(divisionName);
    const industryData = ns.corporation.getIndustryData(division.type);
    const divisionResearches = getDivisionResearches(ns, divisionName);
    const benchmark = new CorporationOptimizer();
    const currentFunds = ns.corporation.getCorporation().funds;
    if (getProfit(ns) >= thresholdOfFocusingOnAdvert) {
        budgetRatioForProductDivision = budgetRatioForProductDivisionWithoutAdvert;
    }
    const employeeStatUpgradesBudget = totalBudget * budgetRatioForProductDivision.employeeStatUpgrades;
    const currentCreativityUpgradeLevel = ns.corporation.getUpgradeLevel(
        UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS,
    );
    const currentCharismaUpgradeLevel = ns.corporation.getUpgradeLevel(UpgradeName.SPEECH_PROCESSOR_IMPLANTS);
    const currentIntelligenceUpgradeLevel = ns.corporation.getUpgradeLevel(UpgradeName.NEURAL_ACCELERATORS);
    const currentEfficiencyUpgradeLevel = ns.corporation.getUpgradeLevel(UpgradeName.FOCUS_WIRES);
    const newCreativityUpgradeLevel = getMaxAffordableUpgradeLevel(
        UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS,
        currentCreativityUpgradeLevel,
        employeeStatUpgradesBudget / 4,
    );
    const newCharismaUpgradeLevel = getMaxAffordableUpgradeLevel(
        UpgradeName.SPEECH_PROCESSOR_IMPLANTS,
        currentCharismaUpgradeLevel,
        employeeStatUpgradesBudget / 4,
    );
    const newIntelligenceUpgradeLevel = getMaxAffordableUpgradeLevel(
        UpgradeName.NEURAL_ACCELERATORS,
        currentIntelligenceUpgradeLevel,
        employeeStatUpgradesBudget / 4,
    );
    const newEfficiencyUpgradeLevel = getMaxAffordableUpgradeLevel(
        UpgradeName.FOCUS_WIRES,
        currentEfficiencyUpgradeLevel,
        employeeStatUpgradesBudget / 4,
    );
    if (!dryRun) {
        buyUpgrade(ns, UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS, newCreativityUpgradeLevel);
        buyUpgrade(ns, UpgradeName.SPEECH_PROCESSOR_IMPLANTS, newCharismaUpgradeLevel);
        buyUpgrade(ns, UpgradeName.NEURAL_ACCELERATORS, newIntelligenceUpgradeLevel);
        buyUpgrade(ns, UpgradeName.FOCUS_WIRES, newEfficiencyUpgradeLevel);
    }
    const salesBotBudget = totalBudget * budgetRatioForProductDivision.salesBot;
    const currentSalesBotUpgradeLevel = ns.corporation.getUpgradeLevel(UpgradeName.ABC_SALES_BOTS);
    const newSalesBotUpgradeLevel = getMaxAffordableUpgradeLevel(
        UpgradeName.ABC_SALES_BOTS,
        currentSalesBotUpgradeLevel,
        salesBotBudget,
    );
    if (!dryRun) {
        buyUpgrade(ns, UpgradeName.ABC_SALES_BOTS, newSalesBotUpgradeLevel);
    }
    const projectInsightBudget = totalBudget * budgetRatioForProductDivision.projectInsight;
    const currentProjectInsightUpgradeLevel = ns.corporation.getUpgradeLevel(UpgradeName.PROJECT_INSIGHT);
    const newProjectInsightUpgradeLevel = getMaxAffordableUpgradeLevel(
        UpgradeName.PROJECT_INSIGHT,
        currentProjectInsightUpgradeLevel,
        projectInsightBudget,
    );
    if (!dryRun) {
        buyUpgrade(ns, UpgradeName.PROJECT_INSIGHT, newProjectInsightUpgradeLevel);
    }
    const rawProductionBudget = totalBudget * budgetRatioForProductDivision.rawProduction;
    improveProductDivisionRawProduction(
        division.name,
        industryData,
        divisionResearches,
        rawProductionBudget,
        dryRun,
        benchmark,
        enableLogging,
    );
    const wilsonAdvertBudget = totalBudget * budgetRatioForProductDivision.wilsonAdvert;
    improveProductDivisionWilsonAdvert(
        division.name,
        industryData,
        divisionResearches,
        wilsonAdvertBudget,
        dryRun,
        benchmark,
        enableLogging,
    );
    if (!skipUpgradingOffice) {
        const officesBudget = totalBudget * budgetRatioForProductDivision.office;
        await improveProductDivisionOffices(division.name, industryData, officesBudget, dryRun, enableLogging);
    }
    logger.log(`Spent: ${ns.formatNumber(currentFunds - ns.corporation.getCorporation().funds)}`);
}
function resetStatistics() {
    globalThis.Player.corporation.cycleCount = 0;
    globalThis.corporationCycleHistory = [];
    corporationEventLogger.cycle = 0;
    corporationEventLogger.clearEventData();
}
async function test() {}
async function main(nsContext) {
    init(nsContext);
    // if (ns.getResetInfo().currentNode !== 3) {
    //     throw new Error("This script is specialized for BN3");
    // }
    config = ns.flags(defaultConfig);
    if (config.help === true) {
        ns.tprint(`Default config: ${defaultConfig}`);
        return;
    }
    ns.disableLog("ALL");
    ns.clearLog();
    if (!ns.corporation.hasCorporation()) {
        if (!ns.corporation.createCorporation("Corp", config.selfFund)) {
            ns.print(`Cannot create corporation`);
            return;
        }
    }
    nsx.addAtExitCallback(() => {
        clearPurchaseOrders(ns, false);
    });
    agricultureIndustryData = ns.corporation.getIndustryData(IndustryType.AGRICULTURE);
    chemicalIndustryData = ns.corporation.getIndustryData(IndustryType.CHEMICAL);
    tobaccoIndustryData = ns.corporation.getIndustryData(IndustryType.TOBACCO);
    // if (config.benchmark === true) {
    //     exposeGameInternalObjects();
    //     testingTools.resetRNGData();
    //     enableTestingTools = true;
    // }

    if (config.round1 === true) {
        ns.print("Round 1");
        await round1();
        return;
    }
    if (config.round1_5 === true) {
        ns.print("Round 1.5");
        await round1_5();
        return;
    }
    if (config.round2 === true) {
        ns.print("Round 2");
        await round2();
        return;
    }
    if (config.round3 === true) {
        ns.print("Round 3");
        await round3();
        return;
    }
    if (config.improveAllDivisions === true) {
        nsx.killProcessesSpawnFromSameScript();
        ns.ui.openTail();
        await improveAllDivisions();
        return;
    }
    if (config.test) {
        ns.ui.openTail();
        await test();
        return;
    }

    // Auto recognize round
    if (
        !ns.corporation.hasCorporation() ||
        !hasDivision(ns, DivisionName.AGRICULTURE) ||
        !hasDivision(ns, DivisionName.CHEMICAL)
    ) {
        ns.print("Recognize Round 1");
        await round1();
        return;
    } else if (!hasDivision(ns, DivisionName.TOBACCO)) {
        ns.print("Recognize Round 2");
        await round2();
        return;
    } else {
        ns.print("Recognize Round 3");
        await round3();
        return;
    }
}
export { autocomplete, main };
