import { NetscriptExtension, parseAutoCompleteDataFromDefaultConfig } from "libs/NetscriptExtension";
import {
    buyOptimalAmountOfInputMaterials,
    buyTeaAndThrowPartyForAllDivisions,
    clearPurchaseOrders,
    getProductMarkup,
    loopAllDivisionsAndCities,
    setOptimalSellingPriceForEverything,
    setSmartSupplyData,
    showWarning,
    validateProductMarkupMap,
    waitForNumberOfCycles,
    waitUntilAfterStateHappens,
} from "./corporationUtils";
import { CorpState, UnlockName } from "./corporationFormulas";
import { corporationEventLogger } from "./corporationEventLogger";
function autocomplete(data, flags) {
    return parseAutoCompleteDataFromDefaultConfig(data, defaultConfig);
}
let ns;
let nsx;
let config;
const defaultConfig = [["maintainCorporation", false]];
function init(nsContext) {
    ns = nsContext;
}
async function collectCorporationEventLog() {
    await waitUntilAfterStateHappens(ns, CorpState.START);
    let reachProfitTarget = false;
    while (true) {
        corporationEventLogger.cycle = corporationEventLogger.cycle + 1;
        corporationEventLogger.generateDefaultEvent(ns);
        const corporation = ns.corporation.getCorporation();
        if (!reachProfitTarget && corporation.revenue - corporation.expenses >= 1e90) {
            corporationEventLogger.saveEventSnapshotData();
            reachProfitTarget = true;
        }
        await waitForNumberOfCycles(ns, 1);
    }
}
async function main(nsContext) {
    init(nsContext);
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    config = ns.flags(defaultConfig);
    ns.disableLog("ALL");
    ns.clearLog();
    if (config.maintainCorporation === true && ns.corporation.hasCorporation()) {
        collectCorporationEventLog().then();
        clearPurchaseOrders(ns);
        nsx.addAtExitCallback(() => {
            clearPurchaseOrders(ns);
        });
        let smartSupplyHasBeenEnabledEverywhere = false;
        const warehouseCongestionData = /* @__PURE__ */ new Map();
        while (true) {
            if (ns.corporation.getCorporation().prevState === CorpState.PRODUCTION) {
                loopAllDivisionsAndCities(ns, (divisionName, city) => {
                    const division = ns.corporation.getDivision(divisionName);
                    if (!division.makesProducts) {
                        return;
                    }
                    const industryData = ns.corporation.getIndustryData(division.type);
                    const office = ns.corporation.getOffice(divisionName, city);
                    for (const productName of division.products) {
                        const product = ns.corporation.getProduct(divisionName, city, productName);
                        if (product.developmentProgress < 100) {
                            continue;
                        }
                        getProductMarkup(division, industryData, city, product, office);
                    }
                });
            }
            buyTeaAndThrowPartyForAllDivisions(ns);
            if (!smartSupplyHasBeenEnabledEverywhere) {
                if (ns.corporation.hasUnlock(UnlockName.SMART_SUPPLY)) {
                    loopAllDivisionsAndCities(ns, (divisionName, city) => {
                        ns.corporation.setSmartSupply(divisionName, city, true);
                    });
                    smartSupplyHasBeenEnabledEverywhere = true;
                }
                if (!smartSupplyHasBeenEnabledEverywhere) {
                    setSmartSupplyData(ns);
                    buyOptimalAmountOfInputMaterials(ns, warehouseCongestionData);
                }
            }
            await setOptimalSellingPriceForEverything(ns);
            if (ns.corporation.getCorporation().prevState === CorpState.START) {
                loopAllDivisionsAndCities(ns, (divisionName, city) => {
                    const office = ns.corporation.getOffice(divisionName, city);
                    const unassignedEmployees = office.employeeJobs.Unassigned;
                    if (unassignedEmployees > 0) {
                        showWarning(
                            ns,
                            `WARNING: There are ${unassignedEmployees} unassigned employees in division ${divisionName}`,
                        );
                    }
                });
                validateProductMarkupMap(ns);
            }
            await ns.corporation.nextUpdate();
        }
    }
}
export { autocomplete, main };
