import { CorpResearchesData } from "./data/CorpResearchesData";
import { CorpUpgradesData } from "./data/CorpUpgradesData";
import { Ceres } from "./libs/Ceres";
var CityName = /* @__PURE__ */ ((CityName2) => {
    CityName2["Aevum"] = "Aevum";
    CityName2["Chongqing"] = "Chongqing";
    CityName2["Sector12"] = "Sector-12";
    CityName2["NewTokyo"] = "New Tokyo";
    CityName2["Ishima"] = "Ishima";
    CityName2["Volhaven"] = "Volhaven";
    return CityName2;
})(CityName || {});
var CorpState = /* @__PURE__ */ ((CorpState2) => {
    CorpState2["START"] = "START";
    CorpState2["PURCHASE"] = "PURCHASE";
    CorpState2["PRODUCTION"] = "PRODUCTION";
    CorpState2["EXPORT"] = "EXPORT";
    CorpState2["SALE"] = "SALE";
    return CorpState2;
})(CorpState || {});
var MaterialName = /* @__PURE__ */ ((MaterialName2) => {
    MaterialName2["MINERALS"] = "Minerals";
    MaterialName2["ORE"] = "Ore";
    MaterialName2["WATER"] = "Water";
    MaterialName2["FOOD"] = "Food";
    MaterialName2["PLANTS"] = "Plants";
    MaterialName2["METAL"] = "Metal";
    MaterialName2["HARDWARE"] = "Hardware";
    MaterialName2["CHEMICALS"] = "Chemicals";
    MaterialName2["DRUGS"] = "Drugs";
    MaterialName2["ROBOTS"] = "Robots";
    MaterialName2["AI_CORES"] = "AI Cores";
    MaterialName2["REAL_ESTATE"] = "Real Estate";
    return MaterialName2;
})(MaterialName || {});
var UnlockName = /* @__PURE__ */ ((UnlockName2) => {
    UnlockName2["EXPORT"] = "Export";
    UnlockName2["SMART_SUPPLY"] = "Smart Supply";
    UnlockName2["MARKET_RESEARCH_DEMAND"] = "Market Research - Demand";
    UnlockName2["MARKET_DATA_COMPETITION"] = "Market Data - Competition";
    UnlockName2["VE_CHAIN"] = "VeChain";
    UnlockName2["SHADY_ACCOUNTING"] = "Shady Accounting";
    UnlockName2["GOVERNMENT_PARTNERSHIP"] = "Government Partnership";
    UnlockName2["WAREHOUSE_API"] = "Warehouse API";
    UnlockName2["OFFICE_API"] = "Office API";
    return UnlockName2;
})(UnlockName || {});
var UpgradeName = /* @__PURE__ */ ((UpgradeName2) => {
    UpgradeName2["SMART_FACTORIES"] = "Smart Factories";
    UpgradeName2["SMART_STORAGE"] = "Smart Storage";
    UpgradeName2["DREAM_SENSE"] = "DreamSense";
    UpgradeName2["WILSON_ANALYTICS"] = "Wilson Analytics";
    UpgradeName2["NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS"] = "Nuoptimal Nootropic Injector Implants";
    UpgradeName2["SPEECH_PROCESSOR_IMPLANTS"] = "Speech Processor Implants";
    UpgradeName2["NEURAL_ACCELERATORS"] = "Neural Accelerators";
    UpgradeName2["FOCUS_WIRES"] = "FocusWires";
    UpgradeName2["ABC_SALES_BOTS"] = "ABC SalesBots";
    UpgradeName2["PROJECT_INSIGHT"] = "Project Insight";
    return UpgradeName2;
})(UpgradeName || {});
var EmployeePosition = /* @__PURE__ */ ((EmployeePosition2) => {
    EmployeePosition2["OPERATIONS"] = "Operations";
    EmployeePosition2["ENGINEER"] = "Engineer";
    EmployeePosition2["BUSINESS"] = "Business";
    EmployeePosition2["MANAGEMENT"] = "Management";
    EmployeePosition2["RESEARCH_DEVELOPMENT"] = "Research & Development";
    EmployeePosition2["INTERN"] = "Intern";
    EmployeePosition2["UNASSIGNED"] = "Unassigned";
    return EmployeePosition2;
})(EmployeePosition || {});
var ResearchName = /* @__PURE__ */ ((ResearchName2) => {
    ResearchName2["HI_TECH_RND_LABORATORY"] = "Hi-Tech R&D Laboratory";
    ResearchName2["AUTO_BREW"] = "AutoBrew";
    ResearchName2["AUTO_PARTY"] = "AutoPartyManager";
    ResearchName2["AUTO_DRUG"] = "Automatic Drug Administration";
    ResearchName2["CPH4_INJECT"] = "CPH4 Injections";
    ResearchName2["DRONES"] = "Drones";
    ResearchName2["DRONES_ASSEMBLY"] = "Drones - Assembly";
    ResearchName2["DRONES_TRANSPORT"] = "Drones - Transport";
    ResearchName2["GO_JUICE"] = "Go-Juice";
    ResearchName2["HR_BUDDY_RECRUITMENT"] = "HRBuddy-Recruitment";
    ResearchName2["HR_BUDDY_TRAINING"] = "HRBuddy-Training";
    ResearchName2["MARKET_TA_1"] = "Market-TA.I";
    ResearchName2["MARKET_TA_2"] = "Market-TA.II";
    ResearchName2["OVERCLOCK"] = "Overclock";
    ResearchName2["SELF_CORRECTING_ASSEMBLERS"] = "Self-Correcting Assemblers";
    ResearchName2["STIMU"] = "Sti.mu";
    ResearchName2["UPGRADE_CAPACITY_1"] = "uPgrade: Capacity.I";
    ResearchName2["UPGRADE_CAPACITY_2"] = "uPgrade: Capacity.II";
    ResearchName2["UPGRADE_DASHBOARD"] = "uPgrade: Dashboard";
    ResearchName2["UPGRADE_FULCRUM"] = "uPgrade: Fulcrum";
    return ResearchName2;
})(ResearchName || {});
var IndustryType = /* @__PURE__ */ ((IndustryType2) => {
    IndustryType2["WATER_UTILITIES"] = "Water Utilities";
    IndustryType2["SPRING_WATER"] = "Spring Water";
    IndustryType2["AGRICULTURE"] = "Agriculture";
    IndustryType2["FISHING"] = "Fishing";
    IndustryType2["MINING"] = "Mining";
    IndustryType2["REFINERY"] = "Refinery";
    IndustryType2["RESTAURANT"] = "Restaurant";
    IndustryType2["TOBACCO"] = "Tobacco";
    IndustryType2["CHEMICAL"] = "Chemical";
    IndustryType2["PHARMACEUTICAL"] = "Pharmaceutical";
    IndustryType2["COMPUTER_HARDWARE"] = "Computer Hardware";
    IndustryType2["ROBOTICS"] = "Robotics";
    IndustryType2["SOFTWARE"] = "Software";
    IndustryType2["HEALTHCARE"] = "Healthcare";
    IndustryType2["REAL_ESTATE"] = "Real Estate";
    return IndustryType2;
})(IndustryType || {});
const warehouseUpgradeBasePrice = 1e9;
const officeUpgradeBasePrice = 4e9;
const advertUpgradeBasePrice = 1e9;
const productMarketPriceMultiplier = 5;
const numberSuffixList = ["", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n"];
const numberExpList = numberSuffixList.map((_, i) => parseFloat(`1e${i * 3}`));
const numberFormat = new Intl.NumberFormat("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
});
const basicFormatter = new Intl.NumberFormat("en");
const exponentialFormatter = new Intl.NumberFormat("en", {
    notation: "scientific",
});
function formatNumber(value) {
    const fractionalDigits = 3;
    if (Number.isNaN(value)) {
        return "NaN";
    }
    const nAbs = Math.abs(value);
    if (nAbs === Infinity) {
        return value < 0 ? "-\u221E" : "\u221E";
    }
    if (nAbs < 1e3) {
        return basicFormatter.format(value);
    }
    if (nAbs >= 1e15) {
        return exponentialFormatter.format(value).toLocaleLowerCase();
    }
    let suffixIndex = Math.floor(Math.log10(nAbs) / 3);
    value /= numberExpList[suffixIndex];
    if (
        Math.abs(value).toFixed(fractionalDigits).length === fractionalDigits + 5 &&
        numberSuffixList[suffixIndex + 1]
    ) {
        suffixIndex += 1;
        value = value < 0 ? -1 : 1;
    }
    return numberFormat.format(value) + numberSuffixList[suffixIndex];
}
function getDivisionProductionMultiplier(industryData, boostMaterials) {
    const cityMultiplier =
        Math.pow(2e-3 * boostMaterials[0] + 1, industryData.aiCoreFactor) *
        Math.pow(2e-3 * boostMaterials[1] + 1, industryData.hardwareFactor) *
        Math.pow(2e-3 * boostMaterials[2] + 1, industryData.realEstateFactor) *
        Math.pow(2e-3 * boostMaterials[3] + 1, industryData.robotFactor);
    return Math.max(Math.pow(cityMultiplier, 0.73), 1) * 6;
}
function getGenericUpgradeCost(basePrice, priceMultiplier, fromLevel, toLevel) {
    return (
        basePrice *
        ((Math.pow(priceMultiplier, toLevel) - Math.pow(priceMultiplier, fromLevel)) / (priceMultiplier - 1))
    );
}
function getGenericMaxAffordableUpgradeLevel(basePrice, priceMultiplier, fromLevel, maxCost, roundingWithFloor = true) {
    const maxAffordableUpgradeLevel =
        Math.log((maxCost * (priceMultiplier - 1)) / basePrice + Math.pow(priceMultiplier, fromLevel)) /
        Math.log(priceMultiplier);
    if (roundingWithFloor) {
        return Math.floor(maxAffordableUpgradeLevel);
    }
    return maxAffordableUpgradeLevel;
}
function getUpgradeCost(upgradeName, fromLevel, toLevel) {
    const upgradeData = CorpUpgradesData[upgradeName];
    if (!upgradeData) {
        throw new Error(`Cannot find data of upgrade: ${upgradeName}`);
    }
    return getGenericUpgradeCost(upgradeData.basePrice, upgradeData.priceMult, fromLevel, toLevel);
}
function getMaxAffordableUpgradeLevel(upgradeName, fromLevel, maxCost) {
    const upgradeData = CorpUpgradesData[upgradeName];
    if (!upgradeData) {
        throw new Error(`Cannot find data of upgrade: ${upgradeName}`);
    }
    return getGenericMaxAffordableUpgradeLevel(upgradeData.basePrice, upgradeData.priceMult, fromLevel, maxCost);
}
function getUpgradeBenefit(upgradeName, upgradeLevel) {
    let value = upgradeName === "DreamSense" /* DREAM_SENSE */ ? 0 : 1;
    const benefit = CorpUpgradesData[upgradeName].benefit;
    if (!benefit) {
        throw new Error(`Cannot find data of upgrade: ${upgradeName}`);
    }
    value += benefit * upgradeLevel;
    return value;
}
function getUpgradeWarehouseCost(fromLevel, toLevel) {
    if (fromLevel < 1) {
        throw new Error("Invalid parameter");
    }
    return warehouseUpgradeBasePrice * ((Math.pow(1.07, toLevel + 1) - Math.pow(1.07, fromLevel + 1)) / 0.07);
}
function getMaxAffordableWarehouseLevel(fromLevel, maxCost) {
    if (fromLevel < 1) {
        throw new Error("Invalid parameter");
    }
    return Math.floor(
        Math.log((maxCost * 0.07) / warehouseUpgradeBasePrice + Math.pow(1.07, fromLevel + 1)) / Math.log(1.07) - 1,
    );
}
function getWarehouseSize(smartStorageLevel, warehouseLevel, divisionResearches) {
    return (
        warehouseLevel *
        100 *
        (1 + CorpUpgradesData["Smart Storage" /* SMART_STORAGE */].benefit * smartStorageLevel) *
        getResearchStorageMultiplier(divisionResearches)
    );
}
function getOfficeUpgradeCost(fromSize, toSize) {
    return getGenericUpgradeCost(officeUpgradeBasePrice, 1.09, fromSize / 3, toSize / 3);
}
function getMaxAffordableOfficeSize(fromSize, maxCost) {
    return Math.floor(
        3 * getGenericMaxAffordableUpgradeLevel(officeUpgradeBasePrice, 1.09, fromSize / 3, maxCost, false),
    );
}
function getAdVertCost(fromLevel, toLevel) {
    return getGenericUpgradeCost(advertUpgradeBasePrice, 1.06, fromLevel, toLevel);
}
function getMaxAffordableAdVertLevel(fromLevel, maxCost) {
    return getGenericMaxAffordableUpgradeLevel(advertUpgradeBasePrice, 1.06, fromLevel, maxCost);
}
function getResearchMultiplier(divisionResearches, researchDataKey) {
    let multiplier = 1;
    for (const [researchName, researchData] of Object.entries(CorpResearchesData)) {
        if (!divisionResearches[researchName]) {
            continue;
        }
        const researchDataValue = researchData[researchDataKey];
        if (!Number.isFinite(researchDataValue)) {
            throw new Error(`Invalid researchDataKey: ${researchDataKey}`);
        }
        multiplier *= researchDataValue;
    }
    return multiplier;
}
function getResearchSalesMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "salesMult");
}
function getResearchAdvertisingMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "advertisingMult");
}
function getResearchRPMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "sciResearchMult");
}
function getResearchStorageMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "storageMult");
}
function getResearchEmployeeCreativityMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "employeeCreMult");
}
function getResearchEmployeeCharismaMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "employeeChaMult");
}
function getResearchEmployeeIntelligenceMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "employeeIntMult");
}
function getResearchEmployeeEfficiencyMultiplier(divisionResearches) {
    return getResearchMultiplier(divisionResearches, "productionMult");
}
function getEffectWithFactors(n, expFac, linearFac) {
    if (expFac <= 0 || expFac >= 1) {
        console.warn(`Exponential factor is ${expFac}. This is not an intended value for it`);
    }
    if (linearFac < 1) {
        console.warn(`Linear factor is ${linearFac}. This is not an intended value for it`);
    }
    return Math.pow(n, expFac) + n / linearFac;
}
function getBusinessFactor(businessProduction) {
    return getEffectWithFactors(1 + businessProduction, 0.26, 1e4);
}
function getAdvertisingFactors(awareness, popularity, industryAdvertisingFactor) {
    const awarenessFactor = Math.pow(awareness + 1, industryAdvertisingFactor);
    const popularityFactor = Math.pow(popularity + 1, industryAdvertisingFactor);
    const ratioFactor = awareness === 0 ? 0.01 : Math.max((popularity + 1e-3) / awareness, 0.01);
    const salesFactor = Math.pow(awarenessFactor * popularityFactor * ratioFactor, 0.85);
    return [salesFactor, awarenessFactor, popularityFactor, ratioFactor];
}
function getMarketFactor(demand, competition) {
    return Math.max(0.1, (demand * (100 - competition)) / 100);
}
function getDivisionRawProduction(
    isProduct,
    employeesProduction,
    divisionProductionMultiplier,
    corporationUpgradeLevels,
    divisionResearches,
) {
    const operationEmployeesProduction = employeesProduction.operationsProduction;
    const engineerEmployeesProduction = employeesProduction.engineerProduction;
    const managementEmployeesProduction = employeesProduction.managementProduction;
    const totalEmployeesProduction =
        operationEmployeesProduction + engineerEmployeesProduction + managementEmployeesProduction;
    if (totalEmployeesProduction <= 0) {
        return 0;
    }
    const managementFactor = 1 + managementEmployeesProduction / (1.2 * totalEmployeesProduction);
    const employeesProductionMultiplier =
        (Math.pow(operationEmployeesProduction, 0.4) + Math.pow(engineerEmployeesProduction, 0.3)) * managementFactor;
    const balancingMultiplier = 0.05;
    let officeMultiplier;
    if (isProduct) {
        officeMultiplier = 0.5 * balancingMultiplier * employeesProductionMultiplier;
    } else {
        officeMultiplier = balancingMultiplier * employeesProductionMultiplier;
    }
    const upgradeMultiplier =
        1 +
        corporationUpgradeLevels["Smart Factories" /* SMART_FACTORIES */] *
            CorpUpgradesData["Smart Factories" /* SMART_FACTORIES */].benefit;
    let researchMultiplier = 1;
    researchMultiplier *=
        (divisionResearches["Drones - Assembly" /* DRONES_ASSEMBLY */]
            ? CorpResearchesData["Drones - Assembly" /* DRONES_ASSEMBLY */].productionMult
            : 1) *
        (divisionResearches["Self-Correcting Assemblers" /* SELF_CORRECTING_ASSEMBLERS */]
            ? CorpResearchesData["Self-Correcting Assemblers" /* SELF_CORRECTING_ASSEMBLERS */].productionMult
            : 1);
    if (isProduct) {
        researchMultiplier *= divisionResearches["uPgrade: Fulcrum" /* UPGRADE_FULCRUM */]
            ? CorpResearchesData["uPgrade: Fulcrum" /* UPGRADE_FULCRUM */].productProductionMult
            : 1;
    }
    return officeMultiplier * divisionProductionMultiplier * upgradeMultiplier * researchMultiplier;
}
function getUpgradeAndResearchMultiplierForEmployeeStats(corporationUpgradeLevels, divisionResearches) {
    return {
        upgradeCreativityMultiplier: getUpgradeBenefit(
            "Nuoptimal Nootropic Injector Implants" /* NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS */,
            corporationUpgradeLevels[
                "Nuoptimal Nootropic Injector Implants" /* NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS */
            ],
        ),
        upgradeCharismaMultiplier: getUpgradeBenefit(
            "Speech Processor Implants" /* SPEECH_PROCESSOR_IMPLANTS */,
            corporationUpgradeLevels["Speech Processor Implants" /* SPEECH_PROCESSOR_IMPLANTS */],
        ),
        upgradeIntelligenceMultiplier: getUpgradeBenefit(
            "Neural Accelerators" /* NEURAL_ACCELERATORS */,
            corporationUpgradeLevels["Neural Accelerators" /* NEURAL_ACCELERATORS */],
        ),
        upgradeEfficiencyMultiplier: getUpgradeBenefit(
            "FocusWires" /* FOCUS_WIRES */,
            corporationUpgradeLevels["FocusWires" /* FOCUS_WIRES */],
        ),
        researchCreativityMultiplier: getResearchEmployeeCreativityMultiplier(divisionResearches),
        researchCharismaMultiplier: getResearchEmployeeCharismaMultiplier(divisionResearches),
        researchIntelligenceMultiplier: getResearchEmployeeIntelligenceMultiplier(divisionResearches),
        researchEfficiencyMultiplier: getResearchEmployeeEfficiencyMultiplier(divisionResearches),
    };
}
function getEmployeeProductionByJobs(office, corporationUpgradeLevels, divisionResearches) {
    const upgradeAndResearchMultiplier = getUpgradeAndResearchMultiplierForEmployeeStats(
        corporationUpgradeLevels,
        divisionResearches,
    );
    const effectiveIntelligence =
        office.avgIntelligence *
        upgradeAndResearchMultiplier.upgradeIntelligenceMultiplier *
        upgradeAndResearchMultiplier.researchIntelligenceMultiplier;
    const effectiveCharisma =
        office.avgCharisma *
        upgradeAndResearchMultiplier.upgradeCharismaMultiplier *
        upgradeAndResearchMultiplier.researchCharismaMultiplier;
    const effectiveCreativity =
        office.avgCreativity *
        upgradeAndResearchMultiplier.upgradeCreativityMultiplier *
        upgradeAndResearchMultiplier.researchCreativityMultiplier;
    const effectiveEfficiency =
        office.avgEfficiency *
        upgradeAndResearchMultiplier.upgradeEfficiencyMultiplier *
        upgradeAndResearchMultiplier.researchEfficiencyMultiplier;
    const productionBase = office.avgMorale * office.avgEnergy * 1e-4;
    const totalNumberOfEmployees =
        office.employeeJobs.operations +
        office.employeeJobs.engineer +
        office.employeeJobs.business +
        office.employeeJobs.management +
        office.employeeJobs.researchAndDevelopment +
        office.employeeJobs.intern +
        office.employeeJobs.unassigned;
    const exp = office.totalExperience / totalNumberOfEmployees;
    const operationsProduction =
        office.employeeJobs.operations *
        productionBase *
        (0.6 * effectiveIntelligence + 0.1 * effectiveCharisma + exp + 0.5 * effectiveCreativity + effectiveEfficiency);
    const engineerProduction =
        office.employeeJobs.engineer *
        productionBase *
        (effectiveIntelligence + 0.1 * effectiveCharisma + 1.5 * exp + effectiveEfficiency);
    const businessProduction =
        office.employeeJobs.business * productionBase * (0.4 * effectiveIntelligence + effectiveCharisma + 0.5 * exp);
    const managementProduction =
        office.employeeJobs.management *
        productionBase *
        (2 * effectiveCharisma + exp + 0.2 * effectiveCreativity + 0.7 * effectiveEfficiency);
    const researchAndDevelopmentProduction =
        office.employeeJobs.researchAndDevelopment *
        productionBase *
        (1.5 * effectiveIntelligence + 0.8 * exp + effectiveCreativity + 0.5 * effectiveEfficiency);
    return {
        operationsProduction,
        engineerProduction,
        businessProduction,
        managementProduction,
        researchAndDevelopmentProduction,
    };
}
async function calculateEmployeeStats(office, corporationUpgradeLevels, divisionResearches) {
    let numberOfJobsHavingEmployees = 0;
    for (const [jobName, numberOfEmployees] of Object.entries(office.employeeJobs)) {
        if (jobName === "Intern" || jobName === "Unassigned" || numberOfEmployees === 0) {
            continue;
        }
        ++numberOfJobsHavingEmployees;
    }
    if (numberOfJobsHavingEmployees <= 3) {
        throw new Error("We need at least 4 jobs having 1 employee at the minimum");
    }
    const upgradeAndResearchMultiplier = getUpgradeAndResearchMultiplierForEmployeeStats(
        corporationUpgradeLevels,
        divisionResearches,
    );
    const productionBase = office.avgMorale * office.avgEnergy * 1e-4;
    const exp = office.totalExperience / office.numEmployees;
    const f1 = function ([effectiveCreativity, effectiveCharisma, effectiveIntelligence, effectiveEfficiency]) {
        return (
            office.employeeJobs["Operations" /* OPERATIONS */] *
                productionBase *
                (0.6 * effectiveIntelligence +
                    0.1 * effectiveCharisma +
                    exp +
                    0.5 * effectiveCreativity +
                    effectiveEfficiency) -
            office.employeeProductionByJob["Operations" /* OPERATIONS */]
        );
    };
    const f2 = function ([effectiveCreativity, effectiveCharisma, effectiveIntelligence, effectiveEfficiency]) {
        return (
            office.employeeJobs["Engineer" /* ENGINEER */] *
                productionBase *
                (effectiveIntelligence + 0.1 * effectiveCharisma + 1.5 * exp + effectiveEfficiency) -
            office.employeeProductionByJob["Engineer" /* ENGINEER */]
        );
    };
    const f3 = function ([effectiveCreativity, effectiveCharisma, effectiveIntelligence, effectiveEfficiency]) {
        return (
            office.employeeJobs["Business" /* BUSINESS */] *
                productionBase *
                (0.4 * effectiveIntelligence + effectiveCharisma + 0.5 * exp) -
            office.employeeProductionByJob["Business" /* BUSINESS */]
        );
    };
    const f4 = function ([effectiveCreativity, effectiveCharisma, effectiveIntelligence, effectiveEfficiency]) {
        return (
            office.employeeJobs["Management" /* MANAGEMENT */] *
                productionBase *
                (2 * effectiveCharisma + exp + 0.2 * effectiveCreativity + 0.7 * effectiveEfficiency) -
            office.employeeProductionByJob["Management" /* MANAGEMENT */]
        );
    };
    const f5 = function ([effectiveCreativity, effectiveCharisma, effectiveIntelligence, effectiveEfficiency]) {
        return (
            office.employeeJobs["Research & Development" /* RESEARCH_DEVELOPMENT */] *
                productionBase *
                (1.5 * effectiveIntelligence + 0.8 * exp + effectiveCreativity + 0.5 * effectiveEfficiency) -
            office.employeeProductionByJob["Research & Development" /* RESEARCH_DEVELOPMENT */]
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
        const guess = [75, 75, 75, 75];
        solverResult = solver.solve(guess);
        solver.remove();
    });
    if (!solverResult.success) {
        console.error(solverResult);
        throw new Error(`ERROR: Cannot find hidden stats of employee. Office: ${JSON.stringify(office)}`);
    }
    return {
        avgCreativity:
            solverResult.x[0] /
            (upgradeAndResearchMultiplier.upgradeCreativityMultiplier *
                upgradeAndResearchMultiplier.researchCreativityMultiplier),
        avgCharisma:
            solverResult.x[1] /
            (upgradeAndResearchMultiplier.upgradeCharismaMultiplier *
                upgradeAndResearchMultiplier.researchCharismaMultiplier),
        avgIntelligence:
            solverResult.x[2] /
            (upgradeAndResearchMultiplier.upgradeIntelligenceMultiplier *
                upgradeAndResearchMultiplier.researchIntelligenceMultiplier),
        avgEfficiency:
            solverResult.x[3] /
            (upgradeAndResearchMultiplier.upgradeEfficiencyMultiplier *
                upgradeAndResearchMultiplier.researchEfficiencyMultiplier),
    };
}
export {
    CityName,
    CorpState,
    EmployeePosition,
    IndustryType,
    MaterialName,
    ResearchName,
    UnlockName,
    UpgradeName,
    calculateEmployeeStats,
    formatNumber,
    getAdVertCost,
    getAdvertisingFactors,
    getBusinessFactor,
    getDivisionProductionMultiplier,
    getDivisionRawProduction,
    getEmployeeProductionByJobs,
    getMarketFactor,
    getMaxAffordableAdVertLevel,
    getMaxAffordableOfficeSize,
    getMaxAffordableUpgradeLevel,
    getMaxAffordableWarehouseLevel,
    getOfficeUpgradeCost,
    getResearchAdvertisingMultiplier,
    getResearchEmployeeCharismaMultiplier,
    getResearchEmployeeCreativityMultiplier,
    getResearchEmployeeEfficiencyMultiplier,
    getResearchEmployeeIntelligenceMultiplier,
    getResearchMultiplier,
    getResearchRPMultiplier,
    getResearchSalesMultiplier,
    getResearchStorageMultiplier,
    getUpgradeBenefit,
    getUpgradeCost,
    getUpgradeWarehouseCost,
    getWarehouseSize,
    productMarketPriceMultiplier,
};
