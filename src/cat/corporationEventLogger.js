import { CityName, formatNumber } from "./corporationFormulas";
import {
    cities,
    dummyDivisionNamePrefix,
    getCorporationUpgradeLevels,
    getDivisionResearches,
} from "./corporationUtils";
import { isTestingToolsAvailable } from "./corporationTestingTools";
import { mean } from "./libs/utils";
class CorporationEventLogger {
    constructor() {
        if (!globalThis.corporationEventCycle) {
            if (isTestingToolsAvailable() && globalThis.Player.corporation) {
                globalThis.corporationEventCycle = globalThis.Player.corporation.cycleCount;
            } else {
                globalThis.corporationEventCycle = 0;
            }
        }
        if (!globalThis.corporationEventData) {
            globalThis.corporationEventData = [];
        }
        if (!globalThis.corporationEventSnapshotData) {
            globalThis.corporationEventSnapshotData = [];
        }
    }
    get cycle() {
        return globalThis.corporationEventCycle;
    }
    set cycle(value) {
        globalThis.corporationEventCycle = value;
    }
    get #events() {
        return globalThis.corporationEventData;
    }
    get #eventsSnapshot() {
        return globalThis.corporationEventSnapshotData;
    }
    set #eventsSnapshot(value) {
        globalThis.corporationEventSnapshotData = value;
    }
    limitNumberOfEvents() {
        if (this.#events.length > 2e3) {
            this.#events.shift();
        }
    }
    createDefaultEvent(ns) {
        const corporation = ns.corporation.getCorporation();
        const corporationEvent = {
            cycle: this.cycle,
            divisions: [],
            funds: corporation.funds,
            revenue: corporation.revenue,
            expenses: corporation.expenses,
            fundingRound: ns.corporation.getInvestmentOffer().round,
            fundingOffer: ns.corporation.getInvestmentOffer().funds,
            upgrades: getCorporationUpgradeLevels(ns),
        };
        const divisions = corporation.divisions;
        for (const divisionName of divisions) {
            if (divisionName.startsWith(dummyDivisionNamePrefix)) {
                continue;
            }
            const division = ns.corporation.getDivision(divisionName);
            const divisionData = {
                name: divisionName,
                awareness: division.awareness,
                popularity: division.popularity,
                advert: division.awareness,
                researchPoints: division.researchPoints,
                researches: getDivisionResearches(ns, divisionName),
                warehouses: [],
                offices: [],
            };
            for (const city of cities) {
                const warehouse = ns.corporation.getWarehouse(divisionName, city);
                const office = ns.corporation.getOffice(divisionName, city);
                divisionData.warehouses.push({
                    city,
                    level: warehouse.level,
                    size: warehouse.size,
                });
                divisionData.offices.push({
                    city,
                    size: office.size,
                    jobs: {
                        Operations: office.employeeJobs.Operations,
                        Engineer: office.employeeJobs.Engineer,
                        Business: office.employeeJobs.Business,
                        Management: office.employeeJobs.Management,
                        "Research & Development": office.employeeJobs["Research & Development"],
                    },
                });
            }
            corporationEvent.divisions.push(divisionData);
        }
        return corporationEvent;
    }
    generateDefaultEvent(ns) {
        this.#events.push(this.createDefaultEvent(ns));
        this.limitNumberOfEvents();
    }
    generateNewProductEvent(ns, divisionName) {
        const products = ns.corporation.getDivision(divisionName).products;
        if (products.length === 0) {
            throw new Error(`Division ${divisionName} does not have any product`);
        }
        let lastProduct;
        if (products.length > 1) {
            lastProduct = ns.corporation.getProduct(divisionName, CityName.Sector12, products[products.length - 2]);
        }
        const newProductEvent = {
            cycle: this.cycle,
            newestProduct: ns.corporation.getProduct(divisionName, CityName.Sector12, products[products.length - 1]),
            lastProduct,
            researchPoints: ns.corporation.getDivision(divisionName).researchPoints,
        };
        this.#events.push(newProductEvent);
        this.limitNumberOfEvents();
    }
    generateSkipDevelopingNewProductEvent(ns) {
        const skipDevelopingNewProductEvent = {
            cycle: this.cycle,
            revenue: ns.corporation.getCorporation().revenue,
            expenses: ns.corporation.getCorporation().expenses,
        };
        this.#events.push(skipDevelopingNewProductEvent);
        this.limitNumberOfEvents();
    }
    generateOfferAcceptanceEvent(ns) {
        const offerAcceptanceEvent = {
            cycle: this.cycle,
            round: ns.corporation.getInvestmentOffer().round,
            offer: ns.corporation.getInvestmentOffer().funds,
        };
        this.#events.push(offerAcceptanceEvent);
        this.limitNumberOfEvents();
    }
    clearEventData() {
        this.#events.length = 0;
    }
    exportEventData() {
        return JSON.stringify(this.#events);
    }
    saveEventSnapshotData() {
        this.#eventsSnapshot = structuredClone(this.#events);
    }
    exportEventSnapshotData() {
        return JSON.stringify(this.#eventsSnapshot);
    }
}
const corporationEventLogger = new CorporationEventLogger();
const profitMilestones = [
    1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22, 1e23, 1e24, 1e25, 1e26, 1e27, 1e28,
    1e29, 1e30, 1e31, 1e32, 1e33, 1e34, 1e35, 1e40, 1e50, 1e60, 1e70, 1e74, 1e75, 1e78, 1e80, 1e88, 1e89, 1e90, 1e91,
    1e92, 1e93, 1e94, 1e95, 1e96, 1e97, 1e98, 1e99, 1e100,
];
function isDefaultCorporationEvent(event) {
    return "divisions" in event;
}
function isNewProductEvent(event) {
    return "newestProduct" in event;
}
function isSkipDevelopingNewProductEvent(event) {
    return "revenue" in event && !("funds" in event);
}
function isOfferAcceptanceEvent(event) {
    return "round" in event;
}
function analyseEventData(eventData) {
    const events = JSON.parse(eventData);
    let currentMilestonesIndex = 0;
    for (const event of events) {
        if (isNewProductEvent(event)) {
            console.log(
                `${event.cycle}: newest product: ${event.newestProduct.name}, RP: ${formatNumber(event.researchPoints)}`,
            );
            continue;
        }
        if (isSkipDevelopingNewProductEvent(event)) {
            console.log(
                `${event.cycle}: skip developing new product, profit: ${formatNumber(event.revenue - event.expenses)}`,
            );
            continue;
        }
        if (isOfferAcceptanceEvent(event)) {
            console.log(`${event.cycle}: round: ${event.round}, offer: ${formatNumber(event.offer)}`);
            continue;
        }
        if (!isDefaultCorporationEvent(event)) {
            console.error("Invalid event:", event);
            continue;
        }
        const profit = event.revenue - event.expenses;
        if (profit >= profitMilestones[currentMilestonesIndex]) {
            console.log(`${event.cycle}: profit: ${formatNumber(profit)}`);
            ++currentMilestonesIndex;
        }
    }
}
function analyseEmployeeRatio(eventData) {
    const events = JSON.parse(eventData);
    const data = /* @__PURE__ */ new Map();
    let divisionIndex = 2;
    const isSupportDivision = divisionIndex === 0 || divisionIndex === 1;
    const isProductDivision = !isSupportDivision;
    for (const event of events) {
        if (isNewProductEvent(event) || isSkipDevelopingNewProductEvent(event) || isOfferAcceptanceEvent(event)) {
            continue;
        }
        if (!isDefaultCorporationEvent(event)) {
            console.error("Invalid event:", event);
            continue;
        }
        const office = event.divisions[divisionIndex].offices[0];
        if (data.has(office.size)) {
            continue;
        }
        const jobs = office.jobs;
        const nonRnDEmployees = jobs.Operations + jobs.Engineer + jobs.Business + jobs.Management;
        const operationsRatio = jobs.Operations / nonRnDEmployees;
        const engineerRatio = jobs.Engineer / nonRnDEmployees;
        const businessRatio = jobs.Business / nonRnDEmployees;
        const managementRatio = jobs.Management / nonRnDEmployees;
        const dataItem = {
            cycle: event.cycle,
            fundingRound: event.fundingRound,
            profit: event.revenue - event.expenses,
            nonRnDEmployees,
            operations: jobs.Operations,
            engineer: jobs.Engineer,
            business: jobs.Business,
            management: jobs.Management,
            operationsRatio,
            engineerRatio,
            businessRatio,
            managementRatio,
        };
        data.set(office.size, dataItem);
        console.log(
            event.cycle,
            event.fundingRound,
            event.revenue.toExponential(),
            office.size,
            nonRnDEmployees,
            jobs.Operations,
            jobs.Engineer,
            jobs.Business,
            jobs.Management,
            operationsRatio.toFixed(3),
            engineerRatio.toFixed(3),
            businessRatio.toFixed(3),
            managementRatio.toFixed(3),
        );
    }
    const filteredData = [...data.values()].filter((value) => {
        if (isSupportDivision) {
            return value.fundingRound >= 4;
        }
        return value.operations > 0;
    });
    if (isSupportDivision) {
        console.log(
            mean(filteredData.map((value) => value.operationsRatio)).toFixed(3),
            mean(filteredData.map((value) => value.engineerRatio)).toFixed(3),
            mean(filteredData.map((value) => value.businessRatio)).toFixed(3),
            mean(filteredData.map((value) => value.managementRatio)).toFixed(3),
        );
    }
    if (isProductDivision) {
        const round3Data = filteredData.filter((value) => value.fundingRound === 3);
        console.log(
            "round 3",
            mean(round3Data.map((value) => value.operationsRatio)).toFixed(3),
            mean(round3Data.map((value) => value.engineerRatio)).toFixed(3),
            mean(round3Data.map((value) => value.businessRatio)).toFixed(3),
            mean(round3Data.map((value) => value.managementRatio)).toFixed(3),
        );
        const round4Data = filteredData.filter((value) => value.fundingRound === 4);
        console.log(
            "round 4",
            mean(round4Data.map((value) => value.operationsRatio)).toFixed(3),
            mean(round4Data.map((value) => value.engineerRatio)).toFixed(3),
            mean(round4Data.map((value) => value.businessRatio)).toFixed(3),
            mean(round4Data.map((value) => value.managementRatio)).toFixed(3),
        );
        const round5Data1 = filteredData.filter((value) => {
            return value.fundingRound === 5 && value.profit < 1e30;
        });
        console.log(
            "round 5-1",
            mean(round5Data1.map((value) => value.operationsRatio)).toFixed(3),
            mean(round5Data1.map((value) => value.engineerRatio)).toFixed(3),
            mean(round5Data1.map((value) => value.businessRatio)).toFixed(3),
            mean(round5Data1.map((value) => value.managementRatio)).toFixed(3),
        );
        const round5Data2 = filteredData.filter((value) => {
            return value.fundingRound === 5 && value.profit >= 1e30;
        });
        console.log(
            "round 5-2",
            mean(round5Data2.map((value) => value.operationsRatio)).toFixed(3),
            mean(round5Data2.map((value) => value.engineerRatio)).toFixed(3),
            mean(round5Data2.map((value) => value.businessRatio)).toFixed(3),
            mean(round5Data2.map((value) => value.managementRatio)).toFixed(3),
        );
    }
}
export { analyseEmployeeRatio, analyseEventData, corporationEventLogger };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2NvcnBvcmF0aW9uRXZlbnRMb2dnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7TlMsIFByb2R1Y3R9IGZyb20gXCJAbnNcIjtcbmltcG9ydCB7Q2l0eU5hbWUsIENvcnBvcmF0aW9uVXBncmFkZUxldmVscywgRGl2aXNpb25SZXNlYXJjaGVzLCBmb3JtYXROdW1iZXIsIE9mZmljZVNldHVwfSBmcm9tIFwiL2NvcnBvcmF0aW9uRm9ybXVsYXNcIjtcbmltcG9ydCB7Y2l0aWVzLCBkdW1teURpdmlzaW9uTmFtZVByZWZpeCwgZ2V0Q29ycG9yYXRpb25VcGdyYWRlTGV2ZWxzLCBnZXREaXZpc2lvblJlc2VhcmNoZXN9IGZyb20gXCIvY29ycG9yYXRpb25VdGlsc1wiO1xuaW1wb3J0IHtpc1Rlc3RpbmdUb29sc0F2YWlsYWJsZX0gZnJvbSBcIi9jb3Jwb3JhdGlvblRlc3RpbmdUb29sc1wiO1xuaW1wb3J0IHttZWFufSBmcm9tIFwiL2xpYnMvdXRpbHNcIjtcblxuZGVjbGFyZSBnbG9iYWwge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby12YXJcbiAgICB2YXIgY29ycG9yYXRpb25FdmVudEN5Y2xlOiBudW1iZXI7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXZhclxuICAgIHZhciBjb3Jwb3JhdGlvbkV2ZW50RGF0YTogQ29ycG9yYXRpb25FdmVudFtdO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby12YXJcbiAgICB2YXIgY29ycG9yYXRpb25FdmVudFNuYXBzaG90RGF0YTogQ29ycG9yYXRpb25FdmVudFtdO1xufVxuXG5pbnRlcmZhY2UgRGl2aXNpb25EYXRhIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgYXdhcmVuZXNzOiBudW1iZXI7XG4gICAgcG9wdWxhcml0eTogbnVtYmVyO1xuICAgIGFkdmVydDogbnVtYmVyO1xuICAgIHJlc2VhcmNoUG9pbnRzOiBudW1iZXI7XG4gICAgcmVzZWFyY2hlczogRGl2aXNpb25SZXNlYXJjaGVzO1xuICAgIHdhcmVob3VzZXM6IHtcbiAgICAgICAgY2l0eTogQ2l0eU5hbWU7XG4gICAgICAgIGxldmVsOiBudW1iZXI7XG4gICAgICAgIHNpemU6IG51bWJlcjtcbiAgICB9W107XG4gICAgb2ZmaWNlczogT2ZmaWNlU2V0dXBbXTtcbn1cblxuaW50ZXJmYWNlIENvcnBvcmF0aW9uRXZlbnQge1xuICAgIGN5Y2xlOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBEZWZhdWx0Q29ycG9yYXRpb25FdmVudCBleHRlbmRzIENvcnBvcmF0aW9uRXZlbnQge1xuICAgIGRpdmlzaW9uczogRGl2aXNpb25EYXRhW107XG4gICAgZnVuZHM6IG51bWJlcjtcbiAgICByZXZlbnVlOiBudW1iZXI7XG4gICAgZXhwZW5zZXM6IG51bWJlcjtcbiAgICBmdW5kaW5nUm91bmQ6IG51bWJlcjtcbiAgICBmdW5kaW5nT2ZmZXI6IG51bWJlcjtcbiAgICB1cGdyYWRlczogQ29ycG9yYXRpb25VcGdyYWRlTGV2ZWxzO1xufVxuXG5pbnRlcmZhY2UgTmV3UHJvZHVjdEV2ZW50IGV4dGVuZHMgQ29ycG9yYXRpb25FdmVudCB7XG4gICAgY3ljbGU6IG51bWJlcjtcbiAgICBuZXdlc3RQcm9kdWN0OiBQcm9kdWN0O1xuICAgIGxhc3RQcm9kdWN0PzogUHJvZHVjdDtcbiAgICByZXNlYXJjaFBvaW50czogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgU2tpcERldmVsb3BpbmdOZXdQcm9kdWN0RXZlbnQgZXh0ZW5kcyBDb3Jwb3JhdGlvbkV2ZW50IHtcbiAgICBjeWNsZTogbnVtYmVyO1xuICAgIHJldmVudWU6IG51bWJlcjtcbiAgICBleHBlbnNlczogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgT2ZmZXJBY2NlcHRhbmNlRXZlbnQgZXh0ZW5kcyBDb3Jwb3JhdGlvbkV2ZW50IHtcbiAgICBjeWNsZTogbnVtYmVyO1xuICAgIHJvdW5kOiBudW1iZXI7XG4gICAgb2ZmZXI6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEVtcGxveWVlUmF0aW9EYXRhIHtcbiAgICBjeWNsZTogbnVtYmVyO1xuICAgIGZ1bmRpbmdSb3VuZDogbnVtYmVyO1xuICAgIHByb2ZpdDogbnVtYmVyO1xuICAgIG5vblJuREVtcGxveWVlczogbnVtYmVyO1xuICAgIG9wZXJhdGlvbnM6IG51bWJlcjtcbiAgICBlbmdpbmVlcjogbnVtYmVyO1xuICAgIGJ1c2luZXNzOiBudW1iZXI7XG4gICAgbWFuYWdlbWVudDogbnVtYmVyO1xuICAgIG9wZXJhdGlvbnNSYXRpbzogbnVtYmVyO1xuICAgIGVuZ2luZWVyUmF0aW86IG51bWJlcjtcbiAgICBidXNpbmVzc1JhdGlvOiBudW1iZXI7XG4gICAgbWFuYWdlbWVudFJhdGlvOiBudW1iZXI7XG59XG5cbmNsYXNzIENvcnBvcmF0aW9uRXZlbnRMb2dnZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBpZiAoIWdsb2JhbFRoaXMuY29ycG9yYXRpb25FdmVudEN5Y2xlKSB7XG4gICAgICAgICAgICBpZiAoaXNUZXN0aW5nVG9vbHNBdmFpbGFibGUoKSAmJiBnbG9iYWxUaGlzLlBsYXllci5jb3Jwb3JhdGlvbikge1xuICAgICAgICAgICAgICAgIGdsb2JhbFRoaXMuY29ycG9yYXRpb25FdmVudEN5Y2xlID0gZ2xvYmFsVGhpcy5QbGF5ZXIuY29ycG9yYXRpb24uY3ljbGVDb3VudDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2xvYmFsVGhpcy5jb3Jwb3JhdGlvbkV2ZW50Q3ljbGUgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghZ2xvYmFsVGhpcy5jb3Jwb3JhdGlvbkV2ZW50RGF0YSkge1xuICAgICAgICAgICAgZ2xvYmFsVGhpcy5jb3Jwb3JhdGlvbkV2ZW50RGF0YSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZ2xvYmFsVGhpcy5jb3Jwb3JhdGlvbkV2ZW50U25hcHNob3REYXRhKSB7XG4gICAgICAgICAgICBnbG9iYWxUaGlzLmNvcnBvcmF0aW9uRXZlbnRTbmFwc2hvdERhdGEgPSBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjeWNsZSgpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gZ2xvYmFsVGhpcy5jb3Jwb3JhdGlvbkV2ZW50Q3ljbGU7XG4gICAgfVxuXG4gICAgc2V0IGN5Y2xlKHZhbHVlOiBudW1iZXIpIHtcbiAgICAgICAgZ2xvYmFsVGhpcy5jb3Jwb3JhdGlvbkV2ZW50Q3ljbGUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgI2V2ZW50cygpIHtcbiAgICAgICAgcmV0dXJuIGdsb2JhbFRoaXMuY29ycG9yYXRpb25FdmVudERhdGE7XG4gICAgfVxuXG4gICAgZ2V0ICNldmVudHNTbmFwc2hvdCgpIHtcbiAgICAgICAgcmV0dXJuIGdsb2JhbFRoaXMuY29ycG9yYXRpb25FdmVudFNuYXBzaG90RGF0YTtcbiAgICB9XG5cbiAgICBzZXQgI2V2ZW50c1NuYXBzaG90KHZhbHVlOiBDb3Jwb3JhdGlvbkV2ZW50W10pIHtcbiAgICAgICAgZ2xvYmFsVGhpcy5jb3Jwb3JhdGlvbkV2ZW50U25hcHNob3REYXRhID0gdmFsdWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBsaW1pdE51bWJlck9mRXZlbnRzKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy4jZXZlbnRzLmxlbmd0aCA+IDIwMDApIHtcbiAgICAgICAgICAgIHRoaXMuI2V2ZW50cy5zaGlmdCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVEZWZhdWx0RXZlbnQobnM6IE5TKTogRGVmYXVsdENvcnBvcmF0aW9uRXZlbnQge1xuICAgICAgICBjb25zdCBjb3Jwb3JhdGlvbiA9IG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCk7XG4gICAgICAgIGNvbnN0IGNvcnBvcmF0aW9uRXZlbnQ6IERlZmF1bHRDb3Jwb3JhdGlvbkV2ZW50ID0ge1xuICAgICAgICAgICAgY3ljbGU6IHRoaXMuY3ljbGUsXG4gICAgICAgICAgICBkaXZpc2lvbnM6IFtdLFxuICAgICAgICAgICAgZnVuZHM6IGNvcnBvcmF0aW9uLmZ1bmRzLFxuICAgICAgICAgICAgcmV2ZW51ZTogY29ycG9yYXRpb24ucmV2ZW51ZSxcbiAgICAgICAgICAgIGV4cGVuc2VzOiBjb3Jwb3JhdGlvbi5leHBlbnNlcyxcbiAgICAgICAgICAgIGZ1bmRpbmdSb3VuZDogbnMuY29ycG9yYXRpb24uZ2V0SW52ZXN0bWVudE9mZmVyKCkucm91bmQsXG4gICAgICAgICAgICBmdW5kaW5nT2ZmZXI6IG5zLmNvcnBvcmF0aW9uLmdldEludmVzdG1lbnRPZmZlcigpLmZ1bmRzLFxuICAgICAgICAgICAgdXBncmFkZXM6IGdldENvcnBvcmF0aW9uVXBncmFkZUxldmVscyhucylcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgZGl2aXNpb25zID0gY29ycG9yYXRpb24uZGl2aXNpb25zO1xuICAgICAgICBmb3IgKGNvbnN0IGRpdmlzaW9uTmFtZSBvZiBkaXZpc2lvbnMpIHtcbiAgICAgICAgICAgIGlmIChkaXZpc2lvbk5hbWUuc3RhcnRzV2l0aChkdW1teURpdmlzaW9uTmFtZVByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGRpdmlzaW9uID0gbnMuY29ycG9yYXRpb24uZ2V0RGl2aXNpb24oZGl2aXNpb25OYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IGRpdmlzaW9uRGF0YTogRGl2aXNpb25EYXRhID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGRpdmlzaW9uTmFtZSxcbiAgICAgICAgICAgICAgICBhd2FyZW5lc3M6IGRpdmlzaW9uLmF3YXJlbmVzcyxcbiAgICAgICAgICAgICAgICBwb3B1bGFyaXR5OiBkaXZpc2lvbi5wb3B1bGFyaXR5LFxuICAgICAgICAgICAgICAgIGFkdmVydDogZGl2aXNpb24uYXdhcmVuZXNzLFxuICAgICAgICAgICAgICAgIHJlc2VhcmNoUG9pbnRzOiBkaXZpc2lvbi5yZXNlYXJjaFBvaW50cyxcbiAgICAgICAgICAgICAgICByZXNlYXJjaGVzOiBnZXREaXZpc2lvblJlc2VhcmNoZXMobnMsIGRpdmlzaW9uTmFtZSksXG4gICAgICAgICAgICAgICAgd2FyZWhvdXNlczogW10sXG4gICAgICAgICAgICAgICAgb2ZmaWNlczogW10sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaXR5IG9mIGNpdGllcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHdhcmVob3VzZSA9IG5zLmNvcnBvcmF0aW9uLmdldFdhcmVob3VzZShkaXZpc2lvbk5hbWUsIGNpdHkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9mZmljZSA9IG5zLmNvcnBvcmF0aW9uLmdldE9mZmljZShkaXZpc2lvbk5hbWUsIGNpdHkpO1xuICAgICAgICAgICAgICAgIGRpdmlzaW9uRGF0YS53YXJlaG91c2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBjaXR5OiBjaXR5LFxuICAgICAgICAgICAgICAgICAgICBsZXZlbDogd2FyZWhvdXNlLmxldmVsLFxuICAgICAgICAgICAgICAgICAgICBzaXplOiB3YXJlaG91c2Uuc2l6ZSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBkaXZpc2lvbkRhdGEub2ZmaWNlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgY2l0eTogY2l0eSxcbiAgICAgICAgICAgICAgICAgICAgc2l6ZTogb2ZmaWNlLnNpemUsXG4gICAgICAgICAgICAgICAgICAgIGpvYnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9wZXJhdGlvbnM6IG9mZmljZS5lbXBsb3llZUpvYnMuT3BlcmF0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgIEVuZ2luZWVyOiBvZmZpY2UuZW1wbG95ZWVKb2JzLkVuZ2luZWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgQnVzaW5lc3M6IG9mZmljZS5lbXBsb3llZUpvYnMuQnVzaW5lc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICBNYW5hZ2VtZW50OiBvZmZpY2UuZW1wbG95ZWVKb2JzLk1hbmFnZW1lbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIlJlc2VhcmNoICYgRGV2ZWxvcG1lbnRcIjogb2ZmaWNlLmVtcGxveWVlSm9ic1tcIlJlc2VhcmNoICYgRGV2ZWxvcG1lbnRcIl0sXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvcnBvcmF0aW9uRXZlbnQuZGl2aXNpb25zLnB1c2goZGl2aXNpb25EYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29ycG9yYXRpb25FdmVudDtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2VuZXJhdGVEZWZhdWx0RXZlbnQobnM6IE5TKTogdm9pZCB7XG4gICAgICAgIHRoaXMuI2V2ZW50cy5wdXNoKHRoaXMuY3JlYXRlRGVmYXVsdEV2ZW50KG5zKSk7XG4gICAgICAgIHRoaXMubGltaXROdW1iZXJPZkV2ZW50cygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZW5lcmF0ZU5ld1Byb2R1Y3RFdmVudChuczogTlMsIGRpdmlzaW9uTmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gbnMuY29ycG9yYXRpb24uZ2V0RGl2aXNpb24oZGl2aXNpb25OYW1lKS5wcm9kdWN0cztcbiAgICAgICAgaWYgKHByb2R1Y3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBEaXZpc2lvbiAke2RpdmlzaW9uTmFtZX0gZG9lcyBub3QgaGF2ZSBhbnkgcHJvZHVjdGApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBsYXN0UHJvZHVjdDtcbiAgICAgICAgaWYgKHByb2R1Y3RzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGxhc3RQcm9kdWN0ID0gbnMuY29ycG9yYXRpb24uZ2V0UHJvZHVjdChkaXZpc2lvbk5hbWUsIENpdHlOYW1lLlNlY3RvcjEyLCBwcm9kdWN0c1twcm9kdWN0cy5sZW5ndGggLSAyXSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbmV3UHJvZHVjdEV2ZW50OiBOZXdQcm9kdWN0RXZlbnQgPSB7XG4gICAgICAgICAgICBjeWNsZTogdGhpcy5jeWNsZSxcbiAgICAgICAgICAgIG5ld2VzdFByb2R1Y3Q6IG5zLmNvcnBvcmF0aW9uLmdldFByb2R1Y3QoZGl2aXNpb25OYW1lLCBDaXR5TmFtZS5TZWN0b3IxMiwgcHJvZHVjdHNbcHJvZHVjdHMubGVuZ3RoIC0gMV0pLFxuICAgICAgICAgICAgbGFzdFByb2R1Y3Q6IGxhc3RQcm9kdWN0LFxuICAgICAgICAgICAgcmVzZWFyY2hQb2ludHM6IG5zLmNvcnBvcmF0aW9uLmdldERpdmlzaW9uKGRpdmlzaW9uTmFtZSkucmVzZWFyY2hQb2ludHNcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy4jZXZlbnRzLnB1c2gobmV3UHJvZHVjdEV2ZW50KTtcbiAgICAgICAgdGhpcy5saW1pdE51bWJlck9mRXZlbnRzKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdlbmVyYXRlU2tpcERldmVsb3BpbmdOZXdQcm9kdWN0RXZlbnQobnM6IE5TKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHNraXBEZXZlbG9waW5nTmV3UHJvZHVjdEV2ZW50OiBTa2lwRGV2ZWxvcGluZ05ld1Byb2R1Y3RFdmVudCA9IHtcbiAgICAgICAgICAgIGN5Y2xlOiB0aGlzLmN5Y2xlLFxuICAgICAgICAgICAgcmV2ZW51ZTogbnMuY29ycG9yYXRpb24uZ2V0Q29ycG9yYXRpb24oKS5yZXZlbnVlLFxuICAgICAgICAgICAgZXhwZW5zZXM6IG5zLmNvcnBvcmF0aW9uLmdldENvcnBvcmF0aW9uKCkuZXhwZW5zZXNcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy4jZXZlbnRzLnB1c2goc2tpcERldmVsb3BpbmdOZXdQcm9kdWN0RXZlbnQpO1xuICAgICAgICB0aGlzLmxpbWl0TnVtYmVyT2ZFdmVudHMoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2VuZXJhdGVPZmZlckFjY2VwdGFuY2VFdmVudChuczogTlMpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgb2ZmZXJBY2NlcHRhbmNlRXZlbnQ6IE9mZmVyQWNjZXB0YW5jZUV2ZW50ID0ge1xuICAgICAgICAgICAgY3ljbGU6IHRoaXMuY3ljbGUsXG4gICAgICAgICAgICByb3VuZDogbnMuY29ycG9yYXRpb24uZ2V0SW52ZXN0bWVudE9mZmVyKCkucm91bmQsXG4gICAgICAgICAgICBvZmZlcjogbnMuY29ycG9yYXRpb24uZ2V0SW52ZXN0bWVudE9mZmVyKCkuZnVuZHNcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy4jZXZlbnRzLnB1c2gob2ZmZXJBY2NlcHRhbmNlRXZlbnQpO1xuICAgICAgICB0aGlzLmxpbWl0TnVtYmVyT2ZFdmVudHMoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgY2xlYXJFdmVudERhdGEoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuI2V2ZW50cy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIHB1YmxpYyBleHBvcnRFdmVudERhdGEoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuI2V2ZW50cyk7XG4gICAgfVxuXG4gICAgcHVibGljIHNhdmVFdmVudFNuYXBzaG90RGF0YSgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy4jZXZlbnRzU25hcHNob3QgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy4jZXZlbnRzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZXhwb3J0RXZlbnRTbmFwc2hvdERhdGEoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuI2V2ZW50c1NuYXBzaG90KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBjb3Jwb3JhdGlvbkV2ZW50TG9nZ2VyID0gbmV3IENvcnBvcmF0aW9uRXZlbnRMb2dnZXIoKTtcblxuY29uc3QgcHJvZml0TWlsZXN0b25lcyA9IFtcbiAgICAxZTEwLFxuICAgIDFlMTEsXG4gICAgMWUxMixcbiAgICAxZTEzLFxuICAgIDFlMTQsXG4gICAgMWUxNSxcbiAgICAxZTE2LFxuICAgIDFlMTcsXG4gICAgMWUxOCxcbiAgICAxZTE5LFxuICAgIDFlMjAsXG4gICAgMWUyMSxcbiAgICAxZTIyLFxuICAgIDFlMjMsXG4gICAgMWUyNCxcbiAgICAxZTI1LFxuICAgIDFlMjYsXG4gICAgMWUyNyxcbiAgICAxZTI4LFxuICAgIDFlMjksXG4gICAgMWUzMCxcbiAgICAxZTMxLFxuICAgIDFlMzIsXG4gICAgMWUzMyxcbiAgICAxZTM0LFxuICAgIDFlMzUsXG4gICAgMWU0MCxcbiAgICAxZTUwLFxuICAgIDFlNjAsXG4gICAgMWU3MCxcbiAgICAxZTc0LFxuICAgIDFlNzUsXG4gICAgMWU3OCxcbiAgICAxZTgwLFxuICAgIDFlODgsXG4gICAgMWU4OSxcbiAgICAxZTkwLFxuICAgIDFlOTEsXG4gICAgMWU5MixcbiAgICAxZTkzLFxuICAgIDFlOTQsXG4gICAgMWU5NSxcbiAgICAxZTk2LFxuICAgIDFlOTcsXG4gICAgMWU5OCxcbiAgICAxZTk5LFxuICAgIDFlMTAwLFxuXTtcblxuZnVuY3Rpb24gaXNEZWZhdWx0Q29ycG9yYXRpb25FdmVudChldmVudDogQ29ycG9yYXRpb25FdmVudCk6IGV2ZW50IGlzIERlZmF1bHRDb3Jwb3JhdGlvbkV2ZW50IHtcbiAgICByZXR1cm4gXCJkaXZpc2lvbnNcIiBpbiBldmVudDtcbn1cblxuZnVuY3Rpb24gaXNOZXdQcm9kdWN0RXZlbnQoZXZlbnQ6IENvcnBvcmF0aW9uRXZlbnQpOiBldmVudCBpcyBOZXdQcm9kdWN0RXZlbnQge1xuICAgIHJldHVybiBcIm5ld2VzdFByb2R1Y3RcIiBpbiBldmVudDtcbn1cblxuZnVuY3Rpb24gaXNTa2lwRGV2ZWxvcGluZ05ld1Byb2R1Y3RFdmVudChldmVudDogQ29ycG9yYXRpb25FdmVudCk6IGV2ZW50IGlzIFNraXBEZXZlbG9waW5nTmV3UHJvZHVjdEV2ZW50IHtcbiAgICByZXR1cm4gKFwicmV2ZW51ZVwiIGluIGV2ZW50KSAmJiAhKFwiZnVuZHNcIiBpbiBldmVudCk7XG59XG5cbmZ1bmN0aW9uIGlzT2ZmZXJBY2NlcHRhbmNlRXZlbnQoZXZlbnQ6IENvcnBvcmF0aW9uRXZlbnQpOiBldmVudCBpcyBPZmZlckFjY2VwdGFuY2VFdmVudCB7XG4gICAgcmV0dXJuIFwicm91bmRcIiBpbiBldmVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5c2VFdmVudERhdGEoZXZlbnREYXRhOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBldmVudHM6IENvcnBvcmF0aW9uRXZlbnRbXSA9IEpTT04ucGFyc2UoZXZlbnREYXRhKTtcbiAgICBsZXQgY3VycmVudE1pbGVzdG9uZXNJbmRleCA9IDA7XG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgICAgaWYgKGlzTmV3UHJvZHVjdEV2ZW50KGV2ZW50KSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYCR7ZXZlbnQuY3ljbGV9OiBuZXdlc3QgcHJvZHVjdDogJHtldmVudC5uZXdlc3RQcm9kdWN0Lm5hbWV9LCBSUDogJHtmb3JtYXROdW1iZXIoZXZlbnQucmVzZWFyY2hQb2ludHMpfWApO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzU2tpcERldmVsb3BpbmdOZXdQcm9kdWN0RXZlbnQoZXZlbnQpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgJHtldmVudC5jeWNsZX06IHNraXAgZGV2ZWxvcGluZyBuZXcgcHJvZHVjdCwgcHJvZml0OiAke2Zvcm1hdE51bWJlcihldmVudC5yZXZlbnVlIC0gZXZlbnQuZXhwZW5zZXMpfWApO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzT2ZmZXJBY2NlcHRhbmNlRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgJHtldmVudC5jeWNsZX06IHJvdW5kOiAke2V2ZW50LnJvdW5kfSwgb2ZmZXI6ICR7Zm9ybWF0TnVtYmVyKGV2ZW50Lm9mZmVyKX1gKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNEZWZhdWx0Q29ycG9yYXRpb25FdmVudChldmVudCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJJbnZhbGlkIGV2ZW50OlwiLCBldmVudCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcm9maXQgPSBldmVudC5yZXZlbnVlIC0gZXZlbnQuZXhwZW5zZXM7XG4gICAgICAgIGlmIChwcm9maXQgPj0gcHJvZml0TWlsZXN0b25lc1tjdXJyZW50TWlsZXN0b25lc0luZGV4XSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYCR7ZXZlbnQuY3ljbGV9OiBwcm9maXQ6ICR7Zm9ybWF0TnVtYmVyKHByb2ZpdCl9YCk7XG4gICAgICAgICAgICArK2N1cnJlbnRNaWxlc3RvbmVzSW5kZXg7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhbmFseXNlRW1wbG95ZWVSYXRpbyhldmVudERhdGE6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGV2ZW50czogQ29ycG9yYXRpb25FdmVudFtdID0gSlNPTi5wYXJzZShldmVudERhdGEpO1xuICAgIGNvbnN0IGRhdGEgPSBuZXcgTWFwPG51bWJlciwgRW1wbG95ZWVSYXRpb0RhdGE+KCk7XG4gICAgLy8gMDogQWdyaWN1bHR1cmVcbiAgICAvLyAxOiBDaGVtaWNhbFxuICAgIC8vIDI6IFRvYmFjY29cbiAgICAvKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcHJlZmVyLWNvbnN0IC0tIFVzZSBsZXQgaW5zdGVhZCBvZiBjb25zdCB0byBhdm9pZCBsaW50aW5nIGVycm9yIHdoZW4gZGl2aXNpb25JbmRleCdzIHR5cGVcbiAgICBpcyBuYXJyb3dlZCBkb3duICovXG4gICAgbGV0IGRpdmlzaW9uSW5kZXggPSAyO1xuICAgIGNvbnN0IGlzU3VwcG9ydERpdmlzaW9uID0gZGl2aXNpb25JbmRleCA9PT0gMCB8fCBkaXZpc2lvbkluZGV4ID09PSAxO1xuICAgIGNvbnN0IGlzUHJvZHVjdERpdmlzaW9uID0gIWlzU3VwcG9ydERpdmlzaW9uO1xuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICAgIGlmIChpc05ld1Byb2R1Y3RFdmVudChldmVudCkgfHwgaXNTa2lwRGV2ZWxvcGluZ05ld1Byb2R1Y3RFdmVudCgoZXZlbnQpKSB8fCBpc09mZmVyQWNjZXB0YW5jZUV2ZW50KGV2ZW50KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc0RlZmF1bHRDb3Jwb3JhdGlvbkV2ZW50KGV2ZW50KSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkludmFsaWQgZXZlbnQ6XCIsIGV2ZW50KTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9mZmljZSA9IGV2ZW50LmRpdmlzaW9uc1tkaXZpc2lvbkluZGV4XS5vZmZpY2VzWzBdO1xuICAgICAgICBpZiAoZGF0YS5oYXMob2ZmaWNlLnNpemUpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBqb2JzID0gb2ZmaWNlLmpvYnM7XG4gICAgICAgIGNvbnN0IG5vblJuREVtcGxveWVlcyA9IGpvYnMuT3BlcmF0aW9ucyArIGpvYnMuRW5naW5lZXIgKyBqb2JzLkJ1c2luZXNzICsgam9icy5NYW5hZ2VtZW50O1xuICAgICAgICBjb25zdCBvcGVyYXRpb25zUmF0aW8gPSBqb2JzLk9wZXJhdGlvbnMgLyBub25SbkRFbXBsb3llZXM7XG4gICAgICAgIGNvbnN0IGVuZ2luZWVyUmF0aW8gPSBqb2JzLkVuZ2luZWVyIC8gbm9uUm5ERW1wbG95ZWVzO1xuICAgICAgICBjb25zdCBidXNpbmVzc1JhdGlvID0gam9icy5CdXNpbmVzcyAvIG5vblJuREVtcGxveWVlcztcbiAgICAgICAgY29uc3QgbWFuYWdlbWVudFJhdGlvID0gam9icy5NYW5hZ2VtZW50IC8gbm9uUm5ERW1wbG95ZWVzO1xuICAgICAgICBjb25zdCBkYXRhSXRlbTogRW1wbG95ZWVSYXRpb0RhdGEgPSB7XG4gICAgICAgICAgICBjeWNsZTogZXZlbnQuY3ljbGUsXG4gICAgICAgICAgICBmdW5kaW5nUm91bmQ6IGV2ZW50LmZ1bmRpbmdSb3VuZCxcbiAgICAgICAgICAgIHByb2ZpdDogZXZlbnQucmV2ZW51ZSAtIGV2ZW50LmV4cGVuc2VzLFxuICAgICAgICAgICAgbm9uUm5ERW1wbG95ZWVzOiBub25SbkRFbXBsb3llZXMsXG4gICAgICAgICAgICBvcGVyYXRpb25zOiBqb2JzLk9wZXJhdGlvbnMsXG4gICAgICAgICAgICBlbmdpbmVlcjogam9icy5FbmdpbmVlcixcbiAgICAgICAgICAgIGJ1c2luZXNzOiBqb2JzLkJ1c2luZXNzLFxuICAgICAgICAgICAgbWFuYWdlbWVudDogam9icy5NYW5hZ2VtZW50LFxuICAgICAgICAgICAgb3BlcmF0aW9uc1JhdGlvOiBvcGVyYXRpb25zUmF0aW8sXG4gICAgICAgICAgICBlbmdpbmVlclJhdGlvOiBlbmdpbmVlclJhdGlvLFxuICAgICAgICAgICAgYnVzaW5lc3NSYXRpbzogYnVzaW5lc3NSYXRpbyxcbiAgICAgICAgICAgIG1hbmFnZW1lbnRSYXRpbzogbWFuYWdlbWVudFJhdGlvLFxuICAgICAgICB9O1xuICAgICAgICBkYXRhLnNldChvZmZpY2Uuc2l6ZSwgZGF0YUl0ZW0pO1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgIGV2ZW50LmN5Y2xlLFxuICAgICAgICAgICAgZXZlbnQuZnVuZGluZ1JvdW5kLFxuICAgICAgICAgICAgZXZlbnQucmV2ZW51ZS50b0V4cG9uZW50aWFsKCksXG4gICAgICAgICAgICBvZmZpY2Uuc2l6ZSxcbiAgICAgICAgICAgIG5vblJuREVtcGxveWVlcyxcbiAgICAgICAgICAgIGpvYnMuT3BlcmF0aW9ucyxcbiAgICAgICAgICAgIGpvYnMuRW5naW5lZXIsXG4gICAgICAgICAgICBqb2JzLkJ1c2luZXNzLFxuICAgICAgICAgICAgam9icy5NYW5hZ2VtZW50LFxuICAgICAgICAgICAgb3BlcmF0aW9uc1JhdGlvLnRvRml4ZWQoMyksXG4gICAgICAgICAgICBlbmdpbmVlclJhdGlvLnRvRml4ZWQoMyksXG4gICAgICAgICAgICBidXNpbmVzc1JhdGlvLnRvRml4ZWQoMyksXG4gICAgICAgICAgICBtYW5hZ2VtZW50UmF0aW8udG9GaXhlZCgzKVxuICAgICAgICApO1xuICAgIH1cbiAgICBjb25zdCBmaWx0ZXJlZERhdGEgPSBbLi4uZGF0YS52YWx1ZXMoKV0uZmlsdGVyKHZhbHVlID0+IHtcbiAgICAgICAgaWYgKGlzU3VwcG9ydERpdmlzaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUuZnVuZGluZ1JvdW5kID49IDQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlLm9wZXJhdGlvbnMgPiAwO1xuICAgIH0pO1xuICAgIGlmIChpc1N1cHBvcnREaXZpc2lvbikge1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgIG1lYW4oZmlsdGVyZWREYXRhLm1hcCh2YWx1ZSA9PiB2YWx1ZS5vcGVyYXRpb25zUmF0aW8pKS50b0ZpeGVkKDMpLFxuICAgICAgICAgICAgbWVhbihmaWx0ZXJlZERhdGEubWFwKHZhbHVlID0+IHZhbHVlLmVuZ2luZWVyUmF0aW8pKS50b0ZpeGVkKDMpLFxuICAgICAgICAgICAgbWVhbihmaWx0ZXJlZERhdGEubWFwKHZhbHVlID0+IHZhbHVlLmJ1c2luZXNzUmF0aW8pKS50b0ZpeGVkKDMpLFxuICAgICAgICAgICAgbWVhbihmaWx0ZXJlZERhdGEubWFwKHZhbHVlID0+IHZhbHVlLm1hbmFnZW1lbnRSYXRpbykpLnRvRml4ZWQoMyksXG4gICAgICAgICk7XG4gICAgfVxuICAgIGlmIChpc1Byb2R1Y3REaXZpc2lvbikge1xuICAgICAgICBjb25zdCByb3VuZDNEYXRhID0gZmlsdGVyZWREYXRhLmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS5mdW5kaW5nUm91bmQgPT09IDMpO1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgIFwicm91bmQgM1wiLFxuICAgICAgICAgICAgbWVhbihyb3VuZDNEYXRhLm1hcCh2YWx1ZSA9PiB2YWx1ZS5vcGVyYXRpb25zUmF0aW8pKS50b0ZpeGVkKDMpLFxuICAgICAgICAgICAgbWVhbihyb3VuZDNEYXRhLm1hcCh2YWx1ZSA9PiB2YWx1ZS5lbmdpbmVlclJhdGlvKSkudG9GaXhlZCgzKSxcbiAgICAgICAgICAgIG1lYW4ocm91bmQzRGF0YS5tYXAodmFsdWUgPT4gdmFsdWUuYnVzaW5lc3NSYXRpbykpLnRvRml4ZWQoMyksXG4gICAgICAgICAgICBtZWFuKHJvdW5kM0RhdGEubWFwKHZhbHVlID0+IHZhbHVlLm1hbmFnZW1lbnRSYXRpbykpLnRvRml4ZWQoMyksXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJvdW5kNERhdGEgPSBmaWx0ZXJlZERhdGEuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmZ1bmRpbmdSb3VuZCA9PT0gNCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgXCJyb3VuZCA0XCIsXG4gICAgICAgICAgICBtZWFuKHJvdW5kNERhdGEubWFwKHZhbHVlID0+IHZhbHVlLm9wZXJhdGlvbnNSYXRpbykpLnRvRml4ZWQoMyksXG4gICAgICAgICAgICBtZWFuKHJvdW5kNERhdGEubWFwKHZhbHVlID0+IHZhbHVlLmVuZ2luZWVyUmF0aW8pKS50b0ZpeGVkKDMpLFxuICAgICAgICAgICAgbWVhbihyb3VuZDREYXRhLm1hcCh2YWx1ZSA9PiB2YWx1ZS5idXNpbmVzc1JhdGlvKSkudG9GaXhlZCgzKSxcbiAgICAgICAgICAgIG1lYW4ocm91bmQ0RGF0YS5tYXAodmFsdWUgPT4gdmFsdWUubWFuYWdlbWVudFJhdGlvKSkudG9GaXhlZCgzKSxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3Qgcm91bmQ1RGF0YTEgPSBmaWx0ZXJlZERhdGEuZmlsdGVyKHZhbHVlID0+IHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZS5mdW5kaW5nUm91bmQgPT09IDUgJiYgdmFsdWUucHJvZml0IDwgMWUzMDtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgXCJyb3VuZCA1LTFcIixcbiAgICAgICAgICAgIG1lYW4ocm91bmQ1RGF0YTEubWFwKHZhbHVlID0+IHZhbHVlLm9wZXJhdGlvbnNSYXRpbykpLnRvRml4ZWQoMyksXG4gICAgICAgICAgICBtZWFuKHJvdW5kNURhdGExLm1hcCh2YWx1ZSA9PiB2YWx1ZS5lbmdpbmVlclJhdGlvKSkudG9GaXhlZCgzKSxcbiAgICAgICAgICAgIG1lYW4ocm91bmQ1RGF0YTEubWFwKHZhbHVlID0+IHZhbHVlLmJ1c2luZXNzUmF0aW8pKS50b0ZpeGVkKDMpLFxuICAgICAgICAgICAgbWVhbihyb3VuZDVEYXRhMS5tYXAodmFsdWUgPT4gdmFsdWUubWFuYWdlbWVudFJhdGlvKSkudG9GaXhlZCgzKSxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3Qgcm91bmQ1RGF0YTIgPSBmaWx0ZXJlZERhdGEuZmlsdGVyKHZhbHVlID0+IHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZS5mdW5kaW5nUm91bmQgPT09IDUgJiYgdmFsdWUucHJvZml0ID49IDFlMzA7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgIFwicm91bmQgNS0yXCIsXG4gICAgICAgICAgICBtZWFuKHJvdW5kNURhdGEyLm1hcCh2YWx1ZSA9PiB2YWx1ZS5vcGVyYXRpb25zUmF0aW8pKS50b0ZpeGVkKDMpLFxuICAgICAgICAgICAgbWVhbihyb3VuZDVEYXRhMi5tYXAodmFsdWUgPT4gdmFsdWUuZW5naW5lZXJSYXRpbykpLnRvRml4ZWQoMyksXG4gICAgICAgICAgICBtZWFuKHJvdW5kNURhdGEyLm1hcCh2YWx1ZSA9PiB2YWx1ZS5idXNpbmVzc1JhdGlvKSkudG9GaXhlZCgzKSxcbiAgICAgICAgICAgIG1lYW4ocm91bmQ1RGF0YTIubWFwKHZhbHVlID0+IHZhbHVlLm1hbmFnZW1lbnRSYXRpbykpLnRvRml4ZWQoMyksXG4gICAgICAgICk7XG4gICAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBQ0EsU0FBUSxVQUF3RCxvQkFBZ0M7QUFDaEcsU0FBUSxRQUFRLHlCQUF5Qiw2QkFBNkIsNkJBQTRCO0FBQ2xHLFNBQVEsK0JBQThCO0FBQ3RDLFNBQVEsWUFBVztBQTBFbkIsTUFBTSx1QkFBdUI7QUFBQSxFQUN6QixjQUFjO0FBQ1YsUUFBSSxDQUFDLFdBQVcsdUJBQXVCO0FBQ25DLFVBQUksd0JBQXdCLEtBQUssV0FBVyxPQUFPLGFBQWE7QUFDNUQsbUJBQVcsd0JBQXdCLFdBQVcsT0FBTyxZQUFZO0FBQUEsTUFDckUsT0FBTztBQUNILG1CQUFXLHdCQUF3QjtBQUFBLE1BQ3ZDO0FBQUEsSUFDSjtBQUNBLFFBQUksQ0FBQyxXQUFXLHNCQUFzQjtBQUNsQyxpQkFBVyx1QkFBdUIsQ0FBQztBQUFBLElBQ3ZDO0FBQ0EsUUFBSSxDQUFDLFdBQVcsOEJBQThCO0FBQzFDLGlCQUFXLCtCQUErQixDQUFDO0FBQUEsSUFDL0M7QUFBQSxFQUNKO0FBQUEsRUFFQSxJQUFJLFFBQWdCO0FBQ2hCLFdBQU8sV0FBVztBQUFBLEVBQ3RCO0FBQUEsRUFFQSxJQUFJLE1BQU0sT0FBZTtBQUNyQixlQUFXLHdCQUF3QjtBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxJQUFJLFVBQVU7QUFDVixXQUFPLFdBQVc7QUFBQSxFQUN0QjtBQUFBLEVBRUEsSUFBSSxrQkFBa0I7QUFDbEIsV0FBTyxXQUFXO0FBQUEsRUFDdEI7QUFBQSxFQUVBLElBQUksZ0JBQWdCLE9BQTJC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
