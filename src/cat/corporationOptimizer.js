import * as comlink from "./libs/comlink";
import { getOptimalBoostMaterialQuantities, getProductMarkup, isProduct, Logger } from "./corporationUtils";
import {
    CityName,
    formatNumber,
    getAdVertCost,
    getAdvertisingFactors,
    getBusinessFactor,
    getDivisionProductionMultiplier,
    getDivisionRawProduction,
    getEmployeeProductionByJobs,
    getMarketFactor,
    getMaxAffordableAdVertLevel,
    getMaxAffordableUpgradeLevel,
    getMaxAffordableWarehouseLevel,
    getResearchAdvertisingMultiplier,
    getResearchRPMultiplier,
    getResearchSalesMultiplier,
    getUpgradeBenefit,
    getUpgradeCost,
    getUpgradeWarehouseCost,
    getWarehouseSize,
    UpgradeName,
} from "./corporationFormulas";
import { CorpMaterialsData } from "./data/CorpMaterialsData";
import { CorpUpgradesData } from "./data/CorpUpgradesData";
import { PriorityQueue } from "./libs/priorityQueue";
import { scaleValueToRange } from "./libs/utils";
var BenchmarkType = /* @__PURE__ */ ((BenchmarkType2) => {
    BenchmarkType2[(BenchmarkType2["STORAGE_FACTORY"] = 0)] = "STORAGE_FACTORY";
    BenchmarkType2[(BenchmarkType2["WILSON_ADVERT"] = 1)] = "WILSON_ADVERT";
    BenchmarkType2[(BenchmarkType2["OFFICE"] = 2)] = "OFFICE";
    return BenchmarkType2;
})(BenchmarkType || {});
const defaultMinForNormalization = 5;
const defaultMaxForNormalization = 200;
const referenceValueModifier = 10;
const precalculatedEmployeeRatioForSupportDivisions = {
    operations: 0.22,
    engineer: 0.632,
    business: 0,
    management: 0.148,
};
const precalculatedEmployeeRatioForProfitSetupOfRound3 = {
    operations: 49 / 138,
    // 0.35507246376811594202898550724638
    engineer: 5 / 138,
    // 0.03623188405797101449275362318841
    business: 51 / 138,
    // 0.36956521739130434782608695652174
    management: 33 / 138,
    // 0.23913043478260869565217391304348
};
const precalculatedEmployeeRatioForProfitSetupOfRound4 = {
    operations: 68 / 369,
    // 0.18428184281842818428184281842818
    engineer: 12 / 369,
    // 0.03252032520325203252032520325203
    business: 244 / 369,
    // 0.66124661246612466124661246612466
    management: 45 / 369,
    // 0.12195121951219512195121951219512
};
const precalculatedEmployeeRatioForProductDivisionRound3 = {
    operations: 0.037,
    engineer: 0.513,
    business: 0.011,
    management: 0.44,
};
const precalculatedEmployeeRatioForProductDivisionRound4 = {
    operations: 0.03,
    engineer: 0.531,
    business: 3e-3,
    management: 0.436,
};
const precalculatedEmployeeRatioForProductDivisionRound5_1 = {
    operations: 0.032,
    engineer: 0.462,
    business: 0.067,
    management: 0.439,
};
const precalculatedEmployeeRatioForProductDivisionRound5_2 = {
    operations: 0.064,
    engineer: 0.317,
    business: 0.298,
    management: 0.321,
};
async function getReferenceData(division, industryData, nonRnDEmployees, item, useCurrentItemData, customData) {
    const operations = Math.floor(nonRnDEmployees * 0.031);
    const engineer = Math.floor(nonRnDEmployees * 0.489);
    const business = Math.floor(nonRnDEmployees * 0.067);
    const management = nonRnDEmployees - (operations + engineer + business);
    return await calculateOfficeBenchmarkData(
        division,
        industryData,
        item,
        useCurrentItemData,
        customData,
        operations,
        engineer,
        business,
        management,
        0,
        getUpgradeBenefit(UpgradeName.ABC_SALES_BOTS, customData.corporationUpgradeLevels[UpgradeName.ABC_SALES_BOTS]),
        getResearchSalesMultiplier(customData.divisionResearches),
        false,
    );
}
function normalizeProfit(profit, referenceValue) {
    return scaleValueToRange(
        profit,
        referenceValue / referenceValueModifier,
        referenceValue * referenceValueModifier,
        defaultMinForNormalization,
        defaultMaxForNormalization,
    );
}
function normalizeProgress(progress) {
    return scaleValueToRange(progress, 0, 100, defaultMinForNormalization, defaultMaxForNormalization);
}
function getComparator(benchmarkType, sortType, customData) {
    switch (benchmarkType) {
        case 0 /* STORAGE_FACTORY */:
            return (a, b) => {
                if (!a || !b) {
                    return 1;
                }
                if (a.production !== b.production) {
                    return a.production - b.production;
                }
                return b.totalCost - a.totalCost;
            };
        case 1 /* WILSON_ADVERT */:
            return (a, b) => {
                if (!a || !b) {
                    return 1;
                }
                if (sortType === "totalCost") {
                    return b.totalCost - a.totalCost;
                }
                if (a.advertisingFactor !== b.advertisingFactor) {
                    return a.advertisingFactor - b.advertisingFactor;
                }
                return b.totalCost - a.totalCost;
            };
        case 2 /* OFFICE */:
            return (a, b) => {
                if (!a || !b) {
                    return 1;
                }
                if (a.totalExperience !== b.totalExperience) {
                    return a.totalExperience - b.totalExperience;
                }
                if (sortType === "rawProduction") {
                    return a.rawProduction - b.rawProduction;
                }
                if (sortType === "progress") {
                    return a.productDevelopmentProgress - b.productDevelopmentProgress;
                }
                if (sortType === "profit") {
                    return a.profit - b.profit;
                }
                if (!customData) {
                    throw new Error(`Invalid custom data`);
                }
                const normalizedProfitOfA = normalizeProfit(a.profit, customData.referenceData.profit);
                const normalizedProgressOfA = normalizeProgress(Math.ceil(100 / a.productDevelopmentProgress));
                const normalizedProfitOfB = normalizeProfit(b.profit, customData.referenceData.profit);
                const normalizedProgressOfB = normalizeProgress(Math.ceil(100 / b.productDevelopmentProgress));
                if (!Number.isFinite(normalizedProfitOfA) || !Number.isFinite(normalizedProfitOfB)) {
                    throw new Error(
                        `Invalid profit: a.profit: ${a.profit.toExponential()}, b.profit: ${b.profit.toExponential()}, referenceData.profit: ${customData.referenceData.profit.toExponential()}`,
                    );
                }
                if (sortType === "profit_progress") {
                    return (
                        customData.balancingModifierForProfitProgress.profit * normalizedProfitOfA -
                        customData.balancingModifierForProfitProgress.progress * normalizedProgressOfA -
                        (customData.balancingModifierForProfitProgress.profit * normalizedProfitOfB -
                            customData.balancingModifierForProfitProgress.progress * normalizedProgressOfB)
                    );
                }
                throw new Error(`Invalid sort type: ${sortType}`);
            };
        default:
            throw new Error(`Invalid benchmark type`);
    }
}
const awarenessMap = /* @__PURE__ */ new Map();
const popularityMap = /* @__PURE__ */ new Map();
const defaultLengthOfBenchmarkDataArray = 10;
const defaultPerformanceModifierForOfficeBenchmark = 40;
const minStepForOfficeBenchmark = 2;
async function calculateOfficeBenchmarkData(
    division,
    industryData,
    item,
    useCurrentItemData,
    customData,
    operations,
    engineer,
    business,
    management,
    rnd,
    salesBotUpgradeBenefit,
    researchSalesMultiplier,
    enableLogging = false,
) {
    const itemIsProduct = isProduct(item);
    const employeesProduction = getEmployeeProductionByJobs(
        {
            avgIntelligence: customData.office.avgIntelligence,
            avgCharisma: customData.office.avgCharisma,
            avgCreativity: customData.office.avgCreativity,
            avgEfficiency: customData.office.avgEfficiency,
            avgMorale: customData.office.avgMorale,
            avgEnergy: customData.office.avgEnergy,
            totalExperience: customData.office.totalExperience,
            employeeJobs: {
                operations,
                engineer,
                business,
                management,
                researchAndDevelopment: rnd,
                intern: 0,
                unassigned: 0,
            },
        },
        customData.corporationUpgradeLevels,
        customData.divisionResearches,
    );
    const rawProduction = getDivisionRawProduction(
        itemIsProduct,
        {
            operationsProduction: employeesProduction.operationsProduction,
            engineerProduction: employeesProduction.engineerProduction,
            managementProduction: employeesProduction.managementProduction,
        },
        division.productionMult,
        customData.corporationUpgradeLevels,
        customData.divisionResearches,
    );
    let productDevelopmentProgress = 0;
    let estimatedRP = 0;
    let productEffectiveRating = 0;
    let productMarkup = 0;
    let demand;
    let competition;
    let itemMultiplier;
    let markupLimit;
    let marketPrice;
    if (itemIsProduct) {
        const totalProductionForProductDev =
            employeesProduction.operationsProduction +
            employeesProduction.engineerProduction +
            employeesProduction.managementProduction;
        const managementFactor = 1 + employeesProduction.managementProduction / (1.2 * totalProductionForProductDev);
        productDevelopmentProgress =
            0.01 *
            (Math.pow(employeesProduction.engineerProduction, 0.34) +
                Math.pow(employeesProduction.operationsProduction, 0.2)) *
            managementFactor;
        if (!useCurrentItemData) {
            const cycles = 100 / productDevelopmentProgress;
            const employeesProductionInSupportCities = getEmployeeProductionByJobs(
                {
                    // Reuse employees' stats of main office. This is fine because we only calculate the estimated value,
                    // not the exact value.
                    avgIntelligence: customData.office.avgIntelligence,
                    avgCharisma: customData.office.avgCharisma,
                    avgCreativity: customData.office.avgCreativity,
                    avgEfficiency: customData.office.avgEfficiency,
                    avgMorale: customData.office.avgMorale,
                    avgEnergy: customData.office.avgEnergy,
                    totalExperience: customData.office.totalExperience,
                    employeeJobs: {
                        operations: 1,
                        engineer: 1,
                        business: 1,
                        management: 1,
                        researchAndDevelopment: operations + engineer + business + management - 4,
                        intern: 0,
                        unassigned: 0,
                    },
                },
                customData.corporationUpgradeLevels,
                customData.divisionResearches,
            );
            const researchPointGainPerCycle =
                5 *
                4 *
                4e-3 *
                Math.pow(employeesProductionInSupportCities.researchAndDevelopmentProduction, 0.5) *
                getUpgradeBenefit(
                    UpgradeName.PROJECT_INSIGHT,
                    customData.corporationUpgradeLevels[UpgradeName.PROJECT_INSIGHT],
                ) *
                getResearchRPMultiplier(customData.divisionResearches);
            estimatedRP = division.researchPoints + researchPointGainPerCycle * cycles;
            const productStats = {
                quality: 0,
                performance: 0,
                durability: 0,
                reliability: 0,
                aesthetics: 0,
                features: 0,
            };
            const totalProduction =
                employeesProduction.engineerProduction +
                employeesProduction.managementProduction +
                employeesProduction.researchAndDevelopmentProduction +
                employeesProduction.operationsProduction +
                employeesProduction.businessProduction;
            const engineerRatio = employeesProduction.engineerProduction / totalProduction;
            const managementRatio = employeesProduction.managementProduction / totalProduction;
            const researchAndDevelopmentRatio = employeesProduction.researchAndDevelopmentProduction / totalProduction;
            const operationsRatio = employeesProduction.operationsProduction / totalProduction;
            const businessRatio = employeesProduction.businessProduction / totalProduction;
            const designInvestmentMultiplier = 1 + Math.pow(item.designInvestment, 0.1) / 100;
            const scienceMultiplier = 1 + Math.pow(estimatedRP, industryData.scienceFactor) / 800;
            const balanceMultiplier =
                1.2 * engineerRatio +
                0.9 * managementRatio +
                1.3 * researchAndDevelopmentRatio +
                1.5 * operationsRatio +
                businessRatio;
            const totalMultiplier = balanceMultiplier * designInvestmentMultiplier * scienceMultiplier;
            productStats.quality =
                totalMultiplier *
                (0.1 * employeesProduction.engineerProduction +
                    0.05 * employeesProduction.managementProduction +
                    0.05 * employeesProduction.researchAndDevelopmentProduction +
                    0.02 * employeesProduction.operationsProduction +
                    0.02 * employeesProduction.businessProduction);
            productStats.performance =
                totalMultiplier *
                (0.15 * employeesProduction.engineerProduction +
                    0.02 * employeesProduction.managementProduction +
                    0.02 * employeesProduction.researchAndDevelopmentProduction +
                    0.02 * employeesProduction.operationsProduction +
                    0.02 * employeesProduction.businessProduction);
            productStats.durability =
                totalMultiplier *
                (0.05 * employeesProduction.engineerProduction +
                    0.02 * employeesProduction.managementProduction +
                    0.08 * employeesProduction.researchAndDevelopmentProduction +
                    0.05 * employeesProduction.operationsProduction +
                    0.05 * employeesProduction.businessProduction);
            productStats.reliability =
                totalMultiplier *
                (0.02 * employeesProduction.engineerProduction +
                    0.08 * employeesProduction.managementProduction +
                    0.02 * employeesProduction.researchAndDevelopmentProduction +
                    0.05 * employeesProduction.operationsProduction +
                    0.08 * employeesProduction.businessProduction);
            productStats.aesthetics =
                totalMultiplier *
                (0.08 * employeesProduction.managementProduction +
                    0.05 * employeesProduction.researchAndDevelopmentProduction +
                    0.02 * employeesProduction.operationsProduction +
                    0.1 * employeesProduction.businessProduction);
            productStats.features =
                totalMultiplier *
                (0.08 * employeesProduction.engineerProduction +
                    0.05 * employeesProduction.managementProduction +
                    0.02 * employeesProduction.researchAndDevelopmentProduction +
                    0.05 * employeesProduction.operationsProduction +
                    0.05 * employeesProduction.businessProduction);
            let productRating = 0;
            const weights = industryData.product.ratingWeights;
            for (const [statName, coefficient] of Object.entries(weights)) {
                productRating += productStats[statName] * coefficient;
            }
            productEffectiveRating = productRating;
            const advertisingInvestmentMultiplier = 1 + Math.pow(item.advertisingInvestment, 0.1) / 100;
            const businessManagementRatio = Math.max(businessRatio + managementRatio, 1 / totalProduction);
            productMarkup =
                100 /
                (advertisingInvestmentMultiplier *
                    Math.pow(productStats.quality + 1e-3, 0.65) *
                    businessManagementRatio);
            demand =
                division.awareness === 0
                    ? 20
                    : Math.min(
                          100,
                          advertisingInvestmentMultiplier * (100 * (division.popularity / division.awareness)),
                      );
            competition = 35;
        } else {
            productEffectiveRating = item.effectiveRating;
            productMarkup = await getProductMarkup(division, industryData, CityName.Sector12, item, void 0);
            if (!item.demand || !item.competition) {
                throw new Error(`You need to unlock "Market Research - Demand" and "Market Data - Competition"`);
            }
            demand = item.demand;
            competition = item.competition;
        }
        itemMultiplier = 0.5 * Math.pow(productEffectiveRating, 0.65);
        markupLimit = Math.max(productEffectiveRating, 1e-3) / productMarkup;
        marketPrice = item.productionCost;
    } else {
        if (!item.demand || !item.competition) {
            throw new Error(`You need to unlock "Market Research - Demand" and "Market Data - Competition"`);
        }
        demand = item.demand;
        competition = item.competition;
        itemMultiplier = item.quality + 1e-3;
        markupLimit = item.quality / CorpMaterialsData[item.name].baseMarkup;
        marketPrice = item.marketPrice;
    }
    const marketFactor = getMarketFactor(demand, competition);
    const businessFactor = getBusinessFactor(employeesProduction.businessProduction);
    const advertisingFactor = getAdvertisingFactors(
        division.awareness,
        division.popularity,
        industryData.advertisingFactor,
    )[0];
    const maxSalesVolume =
        itemMultiplier *
        businessFactor *
        advertisingFactor *
        marketFactor *
        salesBotUpgradeBenefit *
        researchSalesMultiplier;
    let marginErrorRatio = 1;
    if (!itemIsProduct) {
        marginErrorRatio = 0.9;
    }
    if (maxSalesVolume < rawProduction * marginErrorRatio && business > 0) {
        const logger = new Logger(enableLogging);
        logger.warn(
            `WARNING: operations: ${operations}, engineer: ${engineer}, business: ${business}, management: ${management}`,
        );
        logger.warn(`WARNING: rawProduction: ${rawProduction}, maxSalesVolume: ${maxSalesVolume}`);
    }
    const optimalPrice = markupLimit / Math.sqrt(rawProduction / maxSalesVolume) + marketPrice;
    const profit = rawProduction * 10 * optimalPrice;
    return {
        operations,
        engineer,
        business,
        management,
        totalExperience: customData.office.totalExperience,
        rawProduction,
        maxSalesVolume,
        optimalPrice,
        productDevelopmentProgress,
        estimatedRP,
        productRating: productEffectiveRating,
        productMarkup,
        profit,
    };
}
class CorporationOptimizer {
    getScriptUrl() {
        return import.meta.url;
    }
    optimizeStorageAndFactory(
        industryData,
        currentSmartStorageLevel,
        currentWarehouseLevel,
        currentSmartFactoriesLevel,
        divisionResearches,
        maxCost,
        enableLogging = false,
        boostMaterialTotalSizeRatio = 0.8,
    ) {
        if (currentSmartStorageLevel < 0 || currentWarehouseLevel < 0 || currentSmartFactoriesLevel < 0) {
            throw new Error("Invalid parameter");
        }
        const logger = new Logger(enableLogging);
        const maxSmartStorageLevel = getMaxAffordableUpgradeLevel(
            UpgradeName.SMART_STORAGE,
            currentSmartStorageLevel,
            maxCost,
        );
        const maxWarehouseLevel = getMaxAffordableWarehouseLevel(currentWarehouseLevel, maxCost / 6);
        const comparator = getComparator(0 /* STORAGE_FACTORY */);
        const priorityQueue = new PriorityQueue(comparator);
        let minSmartStorageLevel = currentSmartStorageLevel;
        if (maxSmartStorageLevel - minSmartStorageLevel > 1e3) {
            minSmartStorageLevel = maxSmartStorageLevel - 1e3;
        }
        let minWarehouseLevel = currentWarehouseLevel;
        if (maxWarehouseLevel - minWarehouseLevel > 1e3) {
            minWarehouseLevel = maxWarehouseLevel - 1e3;
        }
        logger.log(`minSmartStorageLevel: ${minSmartStorageLevel}`);
        logger.log(`minWarehouseLevel: ${minWarehouseLevel}`);
        logger.log(`maxSmartStorageLevel: ${maxSmartStorageLevel}`);
        logger.log(`maxWarehouseLevel: ${maxWarehouseLevel}`);
        logger.time("StorageAndFactory benchmark");
        for (
            let smartStorageLevel = minSmartStorageLevel;
            smartStorageLevel <= maxSmartStorageLevel;
            smartStorageLevel++
        ) {
            const upgradeSmartStorageCost = getUpgradeCost(
                UpgradeName.SMART_STORAGE,
                currentSmartStorageLevel,
                smartStorageLevel,
            );
            for (let warehouseLevel = minWarehouseLevel; warehouseLevel <= maxWarehouseLevel; warehouseLevel++) {
                const upgradeWarehouseCost = getUpgradeWarehouseCost(currentWarehouseLevel, warehouseLevel) * 6;
                if (upgradeSmartStorageCost + upgradeWarehouseCost > maxCost) {
                    break;
                }
                const warehouseSize = getWarehouseSize(smartStorageLevel, warehouseLevel, divisionResearches);
                const boostMaterials = getOptimalBoostMaterialQuantities(
                    industryData,
                    warehouseSize * boostMaterialTotalSizeRatio,
                );
                const boostMaterialMultiplier = getDivisionProductionMultiplier(industryData, boostMaterials);
                const budgetForSmartFactoriesUpgrade = maxCost - (upgradeSmartStorageCost + upgradeWarehouseCost);
                const maxAffordableSmartFactoriesLevel = getMaxAffordableUpgradeLevel(
                    UpgradeName.SMART_FACTORIES,
                    currentSmartFactoriesLevel,
                    budgetForSmartFactoriesUpgrade,
                );
                const upgradeSmartFactoriesCost = getUpgradeCost(
                    UpgradeName.SMART_FACTORIES,
                    currentSmartFactoriesLevel,
                    maxAffordableSmartFactoriesLevel,
                );
                const totalCost = upgradeSmartStorageCost + upgradeWarehouseCost + upgradeSmartFactoriesCost;
                const smartFactoriesMultiplier =
                    1 + CorpUpgradesData[UpgradeName.SMART_FACTORIES].benefit * maxAffordableSmartFactoriesLevel;
                const production = boostMaterialMultiplier * smartFactoriesMultiplier;
                const dataEntry = {
                    smartStorageLevel,
                    warehouseLevel,
                    smartFactoriesLevel: maxAffordableSmartFactoriesLevel,
                    upgradeSmartStorageCost,
                    upgradeWarehouseCost,
                    warehouseSize,
                    totalCost,
                    production,
                    costPerProduction: totalCost / production,
                    boostMaterials,
                    boostMaterialMultiplier,
                };
                if (priorityQueue.size() < defaultLengthOfBenchmarkDataArray) {
                    priorityQueue.push(dataEntry);
                } else if (comparator(dataEntry, priorityQueue.front()) > 0) {
                    priorityQueue.pop();
                    priorityQueue.push(dataEntry);
                }
            }
        }
        logger.timeEnd("StorageAndFactory benchmark");
        const data = priorityQueue.toArray();
        data.forEach((data2) => {
            logger.log(
                `{storage:${data2.smartStorageLevel}, warehouse:${data2.warehouseLevel}, factory:${data2.smartFactoriesLevel}, totalCost:${formatNumber(data2.totalCost)}, warehouseSize:${formatNumber(data2.warehouseSize)}, production:${formatNumber(data2.production)}, costPerProduction:${formatNumber(data2.costPerProduction)}, boostMaterialMultiplier:${formatNumber(data2.boostMaterialMultiplier)}, boostMaterials:${data2.boostMaterials}}`,
            );
        });
        return data;
    }
    optimizeWilsonAndAdvert(
        industryData,
        currentWilsonLevel,
        currentAdvertLevel,
        currentAwareness,
        currentPopularity,
        divisionResearches,
        maxCost,
        enableLogging = false,
    ) {
        awarenessMap.clear();
        popularityMap.clear();
        if (currentWilsonLevel < 0 || currentAdvertLevel < 0) {
            throw new Error("Invalid parameter");
        }
        const logger = new Logger(enableLogging);
        const maxWilsonLevel = getMaxAffordableUpgradeLevel(UpgradeName.WILSON_ANALYTICS, currentWilsonLevel, maxCost);
        const maxAdvertLevel = getMaxAffordableAdVertLevel(currentAdvertLevel, maxCost);
        logger.log(`maxWilsonLevel: ${maxWilsonLevel}`);
        logger.log(`maxAdvertLevel: ${maxAdvertLevel}`);
        const researchAdvertisingMultiplier = getResearchAdvertisingMultiplier(divisionResearches);
        const comparator = getComparator(1 /* WILSON_ADVERT */);
        const priorityQueue = new PriorityQueue(comparator);
        logger.time("WilsonAndAdvert benchmark");
        for (let wilsonLevel = currentWilsonLevel; wilsonLevel <= maxWilsonLevel; wilsonLevel++) {
            const wilsonCost = getUpgradeCost(UpgradeName.WILSON_ANALYTICS, currentWilsonLevel, wilsonLevel);
            for (let advertLevel = currentAdvertLevel + 1; advertLevel <= maxAdvertLevel; advertLevel++) {
                const advertCost = getAdVertCost(currentAdvertLevel, advertLevel);
                const totalCost = wilsonCost + advertCost;
                if (totalCost > maxCost) {
                    break;
                }
                const previousAwareness = awarenessMap.get(`${wilsonLevel}|${advertLevel - 1}`) ?? currentAwareness;
                const previousPopularity = popularityMap.get(`${wilsonLevel}|${advertLevel - 1}`) ?? currentPopularity;
                const advertisingMultiplier =
                    (1 + CorpUpgradesData[UpgradeName.WILSON_ANALYTICS].benefit * wilsonLevel) *
                    researchAdvertisingMultiplier;
                let awareness = (previousAwareness + 3 * advertisingMultiplier) * (1.005 * advertisingMultiplier);
                let popularity = (previousPopularity + advertisingMultiplier) * ((1 + 2 / 200) * advertisingMultiplier);
                awareness = Math.min(awareness, Number.MAX_VALUE);
                popularity = Math.min(popularity, Number.MAX_VALUE);
                awarenessMap.set(`${wilsonLevel}|${advertLevel}`, awareness);
                popularityMap.set(`${wilsonLevel}|${advertLevel}`, popularity);
                const [advertisingFactor] = getAdvertisingFactors(
                    awareness,
                    popularity,
                    industryData.advertisingFactor,
                );
                const dataEntry = {
                    wilsonLevel,
                    advertLevel,
                    totalCost,
                    popularity,
                    awareness,
                    ratio: popularity / awareness,
                    advertisingFactor,
                    costPerAdvertisingFactor: totalCost / advertisingFactor,
                };
                if (priorityQueue.size() < defaultLengthOfBenchmarkDataArray) {
                    priorityQueue.push(dataEntry);
                } else if (comparator(dataEntry, priorityQueue.front()) > 0) {
                    priorityQueue.pop();
                    priorityQueue.push(dataEntry);
                }
            }
        }
        logger.timeEnd("WilsonAndAdvert benchmark");
        const data = priorityQueue.toArray();
        data.forEach((data2) => {
            logger.log(
                `{wilson:${data2.wilsonLevel}, advert:${data2.advertLevel}, totalCost:${formatNumber(data2.totalCost)}, advertisingFactor:${formatNumber(data2.advertisingFactor)}, popularity:${formatNumber(data2.popularity)}, awareness:${formatNumber(data2.awareness)}, ratio:${formatNumber(data2.ratio)}, costPerAdvertisingFactor:${formatNumber(data2.costPerAdvertisingFactor)}}`,
            );
        });
        return data;
    }
    async optimizeOffice(
        division,
        industryData,
        operationsJob,
        engineerJob,
        managementJob,
        rndEmployee,
        nonRnDEmployees,
        item,
        useCurrentItemData,
        customData,
        sortType,
        comparatorCustomData,
        enableLogging = false,
        employeeJobsRequirement,
    ) {
        const salesBotUpgradeBenefit = getUpgradeBenefit(
            UpgradeName.ABC_SALES_BOTS,
            customData.corporationUpgradeLevels[UpgradeName.ABC_SALES_BOTS],
        );
        const researchSalesMultiplier = getResearchSalesMultiplier(customData.divisionResearches);
        let performanceModifier = defaultPerformanceModifierForOfficeBenchmark;
        if (customData.performanceModifier) {
            performanceModifier = customData.performanceModifier;
        }
        const operationsStep = Math.max(
            Math.floor((operationsJob.max - operationsJob.min) / performanceModifier),
            minStepForOfficeBenchmark,
        );
        const engineerStep = Math.max(
            Math.floor((engineerJob.max - engineerJob.min) / performanceModifier),
            minStepForOfficeBenchmark,
        );
        const managementStep = Math.max(
            Math.floor((managementJob.max - managementJob.min) / performanceModifier),
            minStepForOfficeBenchmark,
        );
        const maxStep = Math.max(operationsStep, engineerStep, managementStep);
        const comparator = getComparator(2 /* OFFICE */, sortType, comparatorCustomData);
        const priorityQueue = new PriorityQueue(comparator);
        for (let operations = operationsJob.min; operations <= operationsJob.max; operations += maxStep) {
            for (let engineer = engineerJob.min; engineer <= engineerJob.max; engineer += maxStep) {
                for (let management = managementJob.min; management <= managementJob.max; management += maxStep) {
                    if (operations + engineer === 0 || operations + engineer + management >= nonRnDEmployees) {
                        continue;
                    }
                    let effectiveEngineer = engineer;
                    let business = nonRnDEmployees - (operations + engineer + management);
                    if (employeeJobsRequirement) {
                        if (employeeJobsRequirement.business !== 0) {
                            throw new Error(
                                `Invalid valid of employeeJobsRequirement.business: ${employeeJobsRequirement.business}`,
                            );
                        }
                        effectiveEngineer += business;
                        business = 0;
                    }
                    const dataEntry = await calculateOfficeBenchmarkData(
                        division,
                        industryData,
                        item,
                        useCurrentItemData,
                        customData,
                        operations,
                        effectiveEngineer,
                        business,
                        management,
                        rndEmployee,
                        salesBotUpgradeBenefit,
                        researchSalesMultiplier,
                        enableLogging,
                    );
                    if (priorityQueue.size() < defaultLengthOfBenchmarkDataArray) {
                        priorityQueue.push(dataEntry);
                    } else if (comparator(dataEntry, priorityQueue.front()) > 0) {
                        priorityQueue.pop();
                        priorityQueue.push(dataEntry);
                    }
                }
            }
        }
        return {
            step: maxStep,
            data: priorityQueue.toArray(),
        };
    }
}
comlink.expose(new CorporationOptimizer());
export {
    BenchmarkType,
    CorporationOptimizer,
    calculateOfficeBenchmarkData,
    defaultPerformanceModifierForOfficeBenchmark,
    getComparator,
    getReferenceData,
    minStepForOfficeBenchmark,
    normalizeProfit,
    normalizeProgress,
    precalculatedEmployeeRatioForProductDivisionRound3,
    precalculatedEmployeeRatioForProductDivisionRound4,
    precalculatedEmployeeRatioForProductDivisionRound5_1,
    precalculatedEmployeeRatioForProductDivisionRound5_2,
    precalculatedEmployeeRatioForProfitSetupOfRound3,
    precalculatedEmployeeRatioForProfitSetupOfRound4,
    precalculatedEmployeeRatioForSupportDivisions,
};
