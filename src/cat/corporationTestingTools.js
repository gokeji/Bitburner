import { cities } from "./corporationUtils";
import { EmployeePosition, MaterialName, UpgradeName } from "./corporationFormulas";
import { getRecordEntries } from "./libs/Record";
import { CorpUpgradesData } from "./data/CorpUpgradesData";
import { CorpMaterialsData } from "./data/CorpMaterialsData";
const indexDBObjectStore = "savestring";
async function getObjectStore() {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open("bitburnerSave", 1);
        request.onerror = () => {
            console.error("Error occurred when interacting with IndexDB. Result:", request.result);
            reject("Error occurred when interacting with IndexDB");
        };
        request.onsuccess = function () {
            const db = this.result;
            const objectStore = db.transaction([indexDBObjectStore], "readwrite").objectStore(indexDBObjectStore);
            resolve(objectStore);
        };
    });
}
async function getAllSaveDataKeys() {
    return new Promise((resolve) => {
        getObjectStore().then((objectStore) => {
            const requestGetAllKeys = objectStore.getAllKeys();
            requestGetAllKeys.onsuccess = () => resolve(requestGetAllKeys.result);
        });
    });
}
async function getSaveData(key) {
    return new Promise((resolve) => {
        getObjectStore().then((objectStore) => {
            const requestGet = objectStore.get(key);
            requestGet.onsuccess = () => resolve(requestGet.result);
        });
    });
}
async function insertSaveData(saveData) {
    return new Promise((resolve) => {
        getObjectStore().then((objectStore) => {
            const requestPut = objectStore.put(saveData, /* @__PURE__ */ new Date().toISOString());
            requestPut.onsuccess = () => resolve();
        });
    });
}
async function updateSaveData(key, saveData) {
    return new Promise((resolve) => {
        getObjectStore().then((objectStore) => {
            const requestPut = objectStore.put(saveData, key);
            requestPut.onsuccess = () => resolve();
        });
    });
}
async function deleteSaveData(key) {
    return new Promise((resolve) => {
        getObjectStore().then((objectStore) => {
            const requestDelete = objectStore.delete(key);
            requestDelete.onsuccess = () => resolve();
        });
    });
}
function isTestingToolsAvailable() {
    return globalThis.Player !== void 0;
}
function setUnlimitedBonusTime() {
    if (!isTestingToolsAvailable()) {
        return;
    }
    Player.corporation.storedCycles = 1e9;
    for (const sleeve of Player.sleeves) {
        sleeve.storedCycles = 1e9;
    }
    Player.bladeburner.storedCycles = 1e9;
}
function removeBonusTime() {
    if (!isTestingToolsAvailable()) {
        return;
    }
    Player.corporation.storedCycles = 0;
    for (const sleeve of Player.sleeves) {
        sleeve.storedCycles = 0;
    }
    player.bladeburner.storedCycles = 0;
}
function setFunds(funds) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    Player.corporation.funds = funds;
}
function setUpgradeLevel(upgradeName, level) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    const corpUpgrades = getRecordEntries(Player.corporation.upgrades);
    for (const [corpUpgradeName, corpUpgradeInfo] of corpUpgrades) {
        if (corpUpgradeName === upgradeName) {
            const upgradeData = CorpUpgradesData[corpUpgradeName];
            corpUpgradeInfo.level = level;
            corpUpgradeInfo.value = 1 + upgradeData.benefit * level;
        }
        if (corpUpgradeName === UpgradeName.SMART_STORAGE) {
            for (const division of Player.corporation.divisions.values()) {
                const warehouses = Object.values(division.warehouses);
                for (const warehouse of warehouses) {
                    warehouse.updateSize(Player.corporation, division);
                }
            }
        }
    }
}
function setResearchPoints(divisionName, researchPoints) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    Player.corporation.divisions.get(divisionName).researchPoints = researchPoints;
}
function setOfficeSetup(divisionName, employeeJobs) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    const size = employeeJobs.reduce((accumulator, current) => (accumulator += current), 0);
    const offices = Object.values(Player.corporation.divisions.get(divisionName).offices);
    for (const office of offices) {
        office.size = size;
        office.numEmployees = size;
        office.employeeNextJobs[EmployeePosition.OPERATIONS] = employeeJobs[0];
        office.employeeNextJobs[EmployeePosition.ENGINEER] = employeeJobs[1];
        office.employeeNextJobs[EmployeePosition.BUSINESS] = employeeJobs[2];
        office.employeeNextJobs[EmployeePosition.MANAGEMENT] = employeeJobs[3];
        office.employeeNextJobs[EmployeePosition.RESEARCH_DEVELOPMENT] = employeeJobs[4];
        office.employeeNextJobs[EmployeePosition.INTERN] = 0;
        office.employeeNextJobs[EmployeePosition.UNASSIGNED] = 0;
    }
}
function setWarehouseLevel(divisionName, level) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    const division = Player.corporation.divisions.get(divisionName);
    const warehouses = Object.values(division.warehouses);
    for (const warehouse of warehouses) {
        warehouse.level = level;
        warehouse.updateSize(Player.corporation, division);
    }
}
function setBoostMaterials(divisionName, boostMaterials) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    const warehouses = Object.values(Player.corporation.divisions.get(divisionName).warehouses);
    for (const warehouse of warehouses) {
        const materials = Object.values(warehouse.materials);
        for (const material of materials) {
            switch (material.name) {
                case MaterialName.AI_CORES:
                    material.stored = boostMaterials[0];
                    break;
                case MaterialName.HARDWARE:
                    material.stored = boostMaterials[1];
                    break;
                case MaterialName.REAL_ESTATE:
                    material.stored = boostMaterials[2];
                    break;
                case MaterialName.ROBOTS:
                    material.stored = boostMaterials[3];
                    break;
            }
        }
    }
}
function clearMaterials(divisionName, options) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    const division = Player.corporation.divisions.get(divisionName);
    const requiredMaterials = Object.keys(division.requiredMaterials);
    const producedMaterials = division.producedMaterials;
    const warehouses = Object.values(division.warehouses);
    for (const warehouse of warehouses) {
        const materials = Object.values(warehouse.materials);
        for (const material of materials) {
            if (
                (options.input && requiredMaterials.includes(material.name)) ||
                (options.output && producedMaterials.includes(material.name))
            ) {
                material.stored = 0;
            }
        }
    }
}
function setEnergyAndMorale(divisionName, energy, morale) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    for (const city of cities) {
        Player.corporation.divisions.get(divisionName).offices[city].avgEnergy = energy;
        Player.corporation.divisions.get(divisionName).offices[city].avgMorale = morale;
    }
}
function addResearch(divisionName, researchName) {
    if (!isTestingToolsAvailable()) {
        return;
    }
    Player.corporation.divisions.get(divisionName).researched.add(researchName);
}
function resetRNGData() {
    if (!isTestingToolsAvailable()) {
        return;
    }
    for (const [_, division] of Player.corporation.divisions) {
        for (const [_2, office] of Object.entries(division.offices)) {
            office.avgIntelligence = 75;
            office.avgCharisma = 75;
            office.avgCreativity = 75;
            office.avgEfficiency = 75;
        }
        for (const [_2, warehouse] of Object.entries(division.warehouses)) {
            for (const [_3, material] of Object.entries(warehouse.materials)) {
                material.demand = CorpMaterialsData[material.name].demandBase;
                material.competition = CorpMaterialsData[material.name].competitionBase;
                material.marketPrice = CorpMaterialsData[material.name].baseCost;
                material.averagePrice = CorpMaterialsData[material.name].baseCost;
            }
        }
    }
}
export {
    addResearch,
    clearMaterials,
    deleteSaveData,
    getAllSaveDataKeys,
    getObjectStore,
    getSaveData,
    insertSaveData,
    isTestingToolsAvailable,
    removeBonusTime,
    resetRNGData,
    setBoostMaterials,
    setEnergyAndMorale,
    setFunds,
    setOfficeSetup,
    setResearchPoints,
    setUnlimitedBonusTime,
    setUpgradeLevel,
    setWarehouseLevel,
    updateSaveData,
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2NvcnBvcmF0aW9uVGVzdGluZ1Rvb2xzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgdHlwZSB7IEZhY3Rpb25OYW1lLCBIUCwgTXVsdGlwbGllcnMsIFNraWxscyB9IGZyb20gXCJAbnNcIjtcbmltcG9ydCB7IGNpdGllcyB9IGZyb20gXCIvY29ycG9yYXRpb25VdGlsc1wiO1xuaW1wb3J0IHsgQ2l0eU5hbWUsIEVtcGxveWVlUG9zaXRpb24sIE1hdGVyaWFsTmFtZSwgUmVzZWFyY2hOYW1lLCBVcGdyYWRlTmFtZSB9IGZyb20gXCIvY29ycG9yYXRpb25Gb3JtdWxhc1wiO1xuaW1wb3J0IHsgZ2V0UmVjb3JkRW50cmllcywgUGFydGlhbFJlY29yZCB9IGZyb20gXCIvbGlicy9SZWNvcmRcIjtcbmltcG9ydCB7IENvcnBVcGdyYWRlc0RhdGEgfSBmcm9tIFwiL2RhdGEvQ29ycFVwZ3JhZGVzRGF0YVwiO1xuaW1wb3J0IHsgQ29ycE1hdGVyaWFsc0RhdGEgfSBmcm9tIFwiLi9kYXRhL0NvcnBNYXRlcmlhbHNEYXRhXCI7XG5pbXBvcnQgdHlwZSB7IFNhdmVEYXRhIH0gZnJvbSBcIi9leHBsb2l0c1wiO1xuXG5kZWNsYXJlIGdsb2JhbCB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXZhclxuICAgIHZhciBQbGF5ZXI6IHtcbiAgICAgICAgaHA6IEhQO1xuICAgICAgICBza2lsbHM6IFNraWxscztcbiAgICAgICAgZXhwOiB0eXBlb2YgUGxheWVyLnNraWxscztcbiAgICAgICAgbXVsdHM6IE11bHRpcGxpZXJzO1xuICAgICAgICBjb3Jwb3JhdGlvbjogQ29ycG9yYXRpb24gfCBudWxsO1xuICAgICAgICBmYWN0aW9uczogRmFjdGlvbk5hbWVbXTtcbiAgICAgICAga2FybWE6IG51bWJlcjtcbiAgICAgICAgbW9uZXk6IG51bWJlcjtcbiAgICAgICAgc2xlZXZlczoge1xuICAgICAgICAgICAgbWVtb3J5OiBudW1iZXI7XG4gICAgICAgICAgICBzaG9jazogbnVtYmVyO1xuICAgICAgICAgICAgc3RvcmVkQ3ljbGVzOiBudW1iZXI7XG4gICAgICAgICAgICBzeW5jOiBudW1iZXI7XG4gICAgICAgIH1bXTtcbiAgICAgICAgc291cmNlRmlsZXM6IE1hcDxudW1iZXIsIG51bWJlcj47XG4gICAgICAgIGdhaW5IYWNraW5nRXhwOiAoZXhwOiBudW1iZXIpID0+IHZvaWQ7XG4gICAgfTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdmFyXG4gICAgdmFyIGNvcnBvcmF0aW9uQ3ljbGVIaXN0b3J5OiBDeWNsZURhdGFbXTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdmFyXG4gICAgdmFyIGJhY2t1cENvcnBvcmF0aW9uRGF0YTogQ29ycG9yYXRpb24gfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgQ3ljbGVEYXRhIHtcbiAgICBjeWNsZTogbnVtYmVyO1xuICAgIGRpdmlzaW9uczogQ29ycG9yYXRpb25bXCJkaXZpc2lvbnNcIl07XG4gICAgZnVuZHM6IENvcnBvcmF0aW9uW1wiZnVuZHNcIl07XG4gICAgcmV2ZW51ZTogQ29ycG9yYXRpb25bXCJyZXZlbnVlXCJdO1xuICAgIGV4cGVuc2VzOiBDb3Jwb3JhdGlvbltcImV4cGVuc2VzXCJdO1xuICAgIGZ1bmRpbmdSb3VuZDogQ29ycG9yYXRpb25bXCJmdW5kaW5nUm91bmRcIl07XG4gICAgdXBncmFkZXM6IENvcnBvcmF0aW9uW1widXBncmFkZXNcIl07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2ZmaWNlIHtcbiAgICBzaXplOiBudW1iZXI7XG4gICAgYXZnRW5lcmd5OiBudW1iZXI7XG4gICAgYXZnTW9yYWxlOiBudW1iZXI7XG4gICAgYXZnSW50ZWxsaWdlbmNlOiBudW1iZXI7XG4gICAgYXZnQ2hhcmlzbWE6IG51bWJlcjtcbiAgICBhdmdDcmVhdGl2aXR5OiBudW1iZXI7XG4gICAgYXZnRWZmaWNpZW5jeTogbnVtYmVyO1xuICAgIG51bUVtcGxveWVlczogbnVtYmVyO1xuICAgIGVtcGxveWVlTmV4dEpvYnM6IHtcbiAgICAgICAgT3BlcmF0aW9uczogbnVtYmVyO1xuICAgICAgICBFbmdpbmVlcjogbnVtYmVyO1xuICAgICAgICBCdXNpbmVzczogbnVtYmVyO1xuICAgICAgICBNYW5hZ2VtZW50OiBudW1iZXI7XG4gICAgICAgIFwiUmVzZWFyY2ggJiBEZXZlbG9wbWVudFwiOiBudW1iZXI7XG4gICAgICAgIEludGVybjogbnVtYmVyO1xuICAgICAgICBVbmFzc2lnbmVkOiBudW1iZXI7XG4gICAgICAgIHRvdGFsOiBudW1iZXI7XG4gICAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNYXRlcmlhbCB7XG4gICAgbmFtZTogTWF0ZXJpYWxOYW1lO1xuICAgIHN0b3JlZDogbnVtYmVyO1xuICAgIGRlbWFuZDogbnVtYmVyO1xuICAgIGNvbXBldGl0aW9uOiBudW1iZXI7XG4gICAgbWFya2V0UHJpY2U6IG51bWJlcjtcbiAgICBhdmVyYWdlUHJpY2U6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXYXJlaG91c2Uge1xuICAgIG1hdGVyaWFsczogUmVjb3JkPE1hdGVyaWFsTmFtZSwgTWF0ZXJpYWw+O1xuICAgIGxldmVsOiBudW1iZXI7XG4gICAgdXBkYXRlU2l6ZTogKGNvcnBvcmF0aW9uOiBDb3Jwb3JhdGlvbiwgZGl2aXNpb246IERpdmlzaW9uKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERpdmlzaW9uIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgcmVzZWFyY2hQb2ludHM6IG51bWJlcjtcbiAgICByZXNlYXJjaGVkOiBTZXQ8UmVzZWFyY2hOYW1lPjtcbiAgICByZXF1aXJlZE1hdGVyaWFsczogUGFydGlhbFJlY29yZDxNYXRlcmlhbE5hbWUsIG51bWJlcj47XG4gICAgcHJvZHVjZWRNYXRlcmlhbHM6IE1hdGVyaWFsTmFtZVtdO1xuICAgIG9mZmljZXM6IFBhcnRpYWxSZWNvcmQ8Q2l0eU5hbWUsIE9mZmljZT47XG4gICAgd2FyZWhvdXNlczogUGFydGlhbFJlY29yZDxDaXR5TmFtZSwgV2FyZWhvdXNlPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb3Jwb3JhdGlvbiBleHRlbmRzIFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIGZ1bmRzOiBudW1iZXI7XG4gICAgcmV2ZW51ZTogbnVtYmVyO1xuICAgIGV4cGVuc2VzOiBudW1iZXI7XG4gICAgZnVuZGluZ1JvdW5kOiBudW1iZXI7XG4gICAgc3RvcmVkQ3ljbGVzOiBudW1iZXI7XG4gICAgZGl2aXNpb25zOiBNYXA8c3RyaW5nLCBEaXZpc2lvbj47XG4gICAgdXBncmFkZXM6IFJlY29yZDxVcGdyYWRlTmFtZSwgeyBsZXZlbDogbnVtYmVyOyB2YWx1ZTogbnVtYmVyIH0+O1xuICAgIHZhbHVhdGlvbjogbnVtYmVyO1xuICAgIGN5Y2xlQ291bnQ6IG51bWJlcjtcbn1cblxuY29uc3QgaW5kZXhEQk9iamVjdFN0b3JlID0gXCJzYXZlc3RyaW5nXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRPYmplY3RTdG9yZSgpOiBQcm9taXNlPElEQk9iamVjdFN0b3JlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHdpbmRvdy5pbmRleGVkREIub3BlbihcImJpdGJ1cm5lclNhdmVcIiwgMSk7XG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBvY2N1cnJlZCB3aGVuIGludGVyYWN0aW5nIHdpdGggSW5kZXhEQi4gUmVzdWx0OlwiLCByZXF1ZXN0LnJlc3VsdCk7XG4gICAgICAgICAgICByZWplY3QoXCJFcnJvciBvY2N1cnJlZCB3aGVuIGludGVyYWN0aW5nIHdpdGggSW5kZXhEQlwiKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiAodGhpczogSURCUmVxdWVzdDxJREJEYXRhYmFzZT4pIHtcbiAgICAgICAgICAgIGNvbnN0IGRiID0gdGhpcy5yZXN1bHQ7XG4gICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IGRiLnRyYW5zYWN0aW9uKFtpbmRleERCT2JqZWN0U3RvcmVdLCBcInJlYWR3cml0ZVwiKS5vYmplY3RTdG9yZShpbmRleERCT2JqZWN0U3RvcmUpO1xuICAgICAgICAgICAgcmVzb2x2ZShvYmplY3RTdG9yZSk7XG4gICAgICAgIH07XG4gICAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBbGxTYXZlRGF0YUtleXMoKTogUHJvbWlzZTxJREJWYWxpZEtleVtdPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGdldE9iamVjdFN0b3JlKCkudGhlbigob2JqZWN0U3RvcmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RHZXRBbGxLZXlzID0gb2JqZWN0U3RvcmUuZ2V0QWxsS2V5cygpO1xuICAgICAgICAgICAgcmVxdWVzdEdldEFsbEtleXMub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXF1ZXN0R2V0QWxsS2V5cy5yZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNhdmVEYXRhKGtleTogc3RyaW5nKTogUHJvbWlzZTxTYXZlRGF0YT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBnZXRPYmplY3RTdG9yZSgpLnRoZW4oKG9iamVjdFN0b3JlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXF1ZXN0R2V0ID0gb2JqZWN0U3RvcmUuZ2V0KGtleSk7XG4gICAgICAgICAgICByZXF1ZXN0R2V0Lm9uc3VjY2VzcyA9ICgpID0+IHJlc29sdmUocmVxdWVzdEdldC5yZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGluc2VydFNhdmVEYXRhKHNhdmVEYXRhOiBTYXZlRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBnZXRPYmplY3RTdG9yZSgpLnRoZW4oKG9iamVjdFN0b3JlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXF1ZXN0UHV0ID0gb2JqZWN0U3RvcmUucHV0KHNhdmVEYXRhLCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpO1xuICAgICAgICAgICAgcmVxdWVzdFB1dC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlU2F2ZURhdGEoa2V5OiBzdHJpbmcsIHNhdmVEYXRhOiBTYXZlRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBnZXRPYmplY3RTdG9yZSgpLnRoZW4oKG9iamVjdFN0b3JlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXF1ZXN0UHV0ID0gb2JqZWN0U3RvcmUucHV0KHNhdmVEYXRhLCBrZXkpO1xuICAgICAgICAgICAgcmVxdWVzdFB1dC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlU2F2ZURhdGEoa2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgZ2V0T2JqZWN0U3RvcmUoKS50aGVuKChvYmplY3RTdG9yZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVxdWVzdERlbGV0ZSA9IG9iamVjdFN0b3JlLmRlbGV0ZShrZXkpO1xuICAgICAgICAgICAgcmVxdWVzdERlbGV0ZS5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNUZXN0aW5nVG9vbHNBdmFpbGFibGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGdsb2JhbFRoaXMuUGxheWVyICE9PSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRVbmxpbWl0ZWRCb251c1RpbWUoKTogdm9pZCB7XG4gICAgaWYgKCFpc1Rlc3RpbmdUb29sc0F2YWlsYWJsZSgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgUGxheWVyLmNvcnBvcmF0aW9uIS5zdG9yZWRDeWNsZXMgPSAxZTk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVCb251c1RpbWUoKTogdm9pZCB7XG4gICAgaWYgKCFpc1Rlc3RpbmdUb29sc0F2YWlsYWJsZSgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgUGxheWVyLmNvcnBvcmF0aW9uIS5zdG9yZWRDeWNsZXMgPSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0RnVuZHMoZnVuZHM6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghaXNUZXN0aW5nVG9vbHNBdmFpbGFibGUoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIFBsYXllci5jb3Jwb3JhdGlvbiEuZnVuZHMgPSBmdW5kcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFVwZ3JhZGVMZXZlbCh1cGdyYWRlTmFtZTogVXBncmFkZU5hbWUsIGxldmVsOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAoIWlzVGVzdGluZ1Rvb2xzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBjb3JwVXBncmFkZXMgPSBnZXRSZWNvcmRFbnRyaWVzKFBsYXllci5jb3Jwb3JhdGlvbiEudXBncmFkZXMpO1xuICAgIGZvciAoY29uc3QgW2NvcnBVcGdyYWRlTmFtZSwgY29ycFVwZ3JhZGVJbmZvXSBvZiBjb3JwVXBncmFkZXMpIHtcbiAgICAgICAgaWYgKGNvcnBVcGdyYWRlTmFtZSA9PT0gdXBncmFkZU5hbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHVwZ3JhZGVEYXRhID0gQ29ycFVwZ3JhZGVzRGF0YVtjb3JwVXBncmFkZU5hbWVdO1xuICAgICAgICAgICAgY29ycFVwZ3JhZGVJbmZvLmxldmVsID0gbGV2ZWw7XG4gICAgICAgICAgICBjb3JwVXBncmFkZUluZm8udmFsdWUgPSAxICsgdXBncmFkZURhdGEuYmVuZWZpdCAqIGxldmVsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvcnBVcGdyYWRlTmFtZSA9PT0gVXBncmFkZU5hbWUuU01BUlRfU1RPUkFHRSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBkaXZpc2lvbiBvZiBQbGF5ZXIuY29ycG9yYXRpb24hLmRpdmlzaW9ucy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHdhcmVob3VzZXMgPSBPYmplY3QudmFsdWVzKGRpdmlzaW9uLndhcmVob3VzZXMpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgd2FyZWhvdXNlIG9mIHdhcmVob3VzZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FyZWhvdXNlLnVwZGF0ZVNpemUoUGxheWVyLmNvcnBvcmF0aW9uISwgZGl2aXNpb24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFJlc2VhcmNoUG9pbnRzKGRpdmlzaW9uTmFtZTogc3RyaW5nLCByZXNlYXJjaFBvaW50czogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKCFpc1Rlc3RpbmdUb29sc0F2YWlsYWJsZSgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgUGxheWVyLmNvcnBvcmF0aW9uIS5kaXZpc2lvbnMuZ2V0KGRpdmlzaW9uTmFtZSkhLnJlc2VhcmNoUG9pbnRzID0gcmVzZWFyY2hQb2ludHM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRPZmZpY2VTZXR1cChkaXZpc2lvbk5hbWU6IHN0cmluZywgZW1wbG95ZWVKb2JzOiBudW1iZXJbXSk6IHZvaWQge1xuICAgIGlmICghaXNUZXN0aW5nVG9vbHNBdmFpbGFibGUoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNpemUgPSBlbXBsb3llZUpvYnMucmVkdWNlKChhY2N1bXVsYXRvciwgY3VycmVudCkgPT4gKGFjY3VtdWxhdG9yICs9IGN1cnJlbnQpLCAwKTtcbiAgICBjb25zdCBvZmZpY2VzID0gT2JqZWN0LnZhbHVlcyhQbGF5ZXIuY29ycG9yYXRpb24hLmRpdmlzaW9ucy5nZXQoZGl2aXNpb25OYW1lKSEub2ZmaWNlcyk7XG4gICAgZm9yIChjb25zdCBvZmZpY2Ugb2Ygb2ZmaWNlcykge1xuICAgICAgICBvZmZpY2Uuc2l6ZSA9IHNpemU7XG4gICAgICAgIG9mZmljZS5udW1FbXBsb3llZXMgPSBzaXplO1xuICAgICAgICBvZmZpY2UuZW1wbG95ZWVOZXh0Sm9ic1tFbXBsb3llZVBvc2l0aW9uLk9QRVJBVElPTlNdID0gZW1wbG95ZWVKb2JzWzBdO1xuICAgICAgICBvZmZpY2UuZW1wbG95ZWVOZXh0Sm9ic1tFbXBsb3llZVBvc2l0aW9uLkVOR0lORUVSXSA9IGVtcGxveWVlSm9ic1sxXTtcbiAgICAgICAgb2ZmaWNlLmVtcGxveWVlTmV4dEpvYnNbRW1wbG95ZWVQb3NpdGlvbi5CVVNJTkVTU10gPSBlbXBsb3llZUpvYnNbMl07XG4gICAgICAgIG9mZmljZS5lbXBsb3llZU5leHRKb2JzW0VtcGxveWVlUG9zaXRpb24uTUFOQUdFTUVOVF0gPSBlbXBsb3llZUpvYnNbM107XG4gICAgICAgIG9mZmljZS5lbXBsb3llZU5leHRKb2JzW0VtcGxveWVlUG9zaXRpb24uUkVTRUFSQ0hfREVWRUxPUE1FTlRdID0gZW1wbG95ZWVKb2JzWzRdO1xuICAgICAgICBvZmZpY2UuZW1wbG95ZWVOZXh0Sm9ic1tFbXBsb3llZVBvc2l0aW9uLklOVEVSTl0gPSAwO1xuICAgICAgICBvZmZpY2UuZW1wbG95ZWVOZXh0Sm9ic1tFbXBsb3llZVBvc2l0aW9uLlVOQVNTSUdORURdID0gMDtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRXYXJlaG91c2VMZXZlbChkaXZpc2lvbk5hbWU6IHN0cmluZywgbGV2ZWw6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghaXNUZXN0aW5nVG9vbHNBdmFpbGFibGUoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGRpdmlzaW9uID0gUGxheWVyLmNvcnBvcmF0aW9uIS5kaXZpc2lvbnMuZ2V0KGRpdmlzaW9uTmFtZSkhO1xuICAgIGNvbnN0IHdhcmVob3VzZXMgPSBPYmplY3QudmFsdWVzKGRpdmlzaW9uLndhcmVob3VzZXMpO1xuICAgIGZvciAoY29uc3Qgd2FyZWhvdXNlIG9mIHdhcmVob3VzZXMpIHtcbiAgICAgICAgd2FyZWhvdXNlLmxldmVsID0gbGV2ZWw7XG4gICAgICAgIHdhcmVob3VzZS51cGRhdGVTaXplKFBsYXllci5jb3Jwb3JhdGlvbiEsIGRpdmlzaW9uKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRCb29zdE1hdGVyaWFscyhkaXZpc2lvbk5hbWU6IHN0cmluZywgYm9vc3RNYXRlcmlhbHM6IG51bWJlcltdKTogdm9pZCB7XG4gICAgaWYgKCFpc1Rlc3RpbmdUb29sc0F2YWlsYWJsZSgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgd2FyZWhvdXNlcyA9IE9iamVjdC52YWx1ZXMoUGxheWVyLmNvcnBvcmF0aW9uIS5kaXZpc2lvbnMuZ2V0KGRpdmlzaW9uTmFtZSkhLndhcmVob3VzZXMpO1xuICAgIGZvciAoY29uc3Qgd2FyZWhvdXNlIG9mIHdhcmVob3VzZXMpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWxzID0gT2JqZWN0LnZhbHVlcyh3YXJlaG91c2UubWF0ZXJpYWxzKTtcbiAgICAgICAgZm9yIChjb25zdCBtYXRlcmlhbCBvZiBtYXRlcmlhbHMpIHtcbiAgICAgICAgICAgIHN3aXRjaCAobWF0ZXJpYWwubmFtZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgTWF0ZXJpYWxOYW1lLkFJX0NPUkVTOlxuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5zdG9yZWQgPSBib29zdE1hdGVyaWFsc1swXTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBNYXRlcmlhbE5hbWUuSEFSRFdBUkU6XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnN0b3JlZCA9IGJvb3N0TWF0ZXJpYWxzWzFdO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIE1hdGVyaWFsTmFtZS5SRUFMX0VTVEFURTpcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuc3RvcmVkID0gYm9vc3RNYXRlcmlhbHNbMl07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgTWF0ZXJpYWxOYW1lLlJPQk9UUzpcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuc3RvcmVkID0gYm9vc3RNYXRlcmlhbHNbM107XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJNYXRlcmlhbHMoXG4gICAgZGl2aXNpb25OYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczoge1xuICAgICAgICBpbnB1dDogYm9vbGVhbjtcbiAgICAgICAgb3V0cHV0OiBib29sZWFuO1xuICAgIH1cbik6IHZvaWQge1xuICAgIGlmICghaXNUZXN0aW5nVG9vbHNBdmFpbGFibGUoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGRpdmlzaW9uID0gUGxheWVyLmNvcnBvcmF0aW9uIS5kaXZpc2lvbnMuZ2V0KGRpdmlzaW9uTmFtZSkhO1xuICAgIGNvbnN0IHJlcXVpcmVkTWF0ZXJpYWxzID0gT2JqZWN0LmtleXMoZGl2aXNpb24ucmVxdWlyZWRNYXRlcmlhbHMpO1xuICAgIGNvbnN0IHByb2R1Y2VkTWF0ZXJpYWxzID0gZGl2aXNpb24ucHJvZHVjZWRNYXRlcmlhbHM7XG4gICAgY29uc3Qgd2FyZWhvdXNlcyA9IE9iamVjdC52YWx1ZXMoZGl2aXNpb24ud2FyZWhvdXNlcyk7XG4gICAgZm9yIChjb25zdCB3YXJlaG91c2Ugb2Ygd2FyZWhvdXNlcykge1xuICAgICAgICBjb25zdCBtYXRlcmlhbHMgPSBPYmplY3QudmFsdWVzKHdhcmVob3VzZS5tYXRlcmlhbHMpO1xuICAgICAgICBmb3IgKGNvbnN0IG1hdGVyaWFsIG9mIG1hdGVyaWFscykge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIChvcHRpb25zLmlucHV0ICYmIHJlcXVpcmVkTWF0ZXJpYWxzLmluY2x1ZGVzKG1hdGVyaWFsLm5hbWUpKSB8fFxuICAgICAgICAgICAgICAgIChvcHRpb25zLm91dHB1dCAmJiBwcm9kdWNlZE1hdGVyaWFscy5pbmNsdWRlcyhtYXRlcmlhbC5uYW1lKSlcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnN0b3JlZCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRFbmVyZ3lBbmRNb3JhbGUoZGl2aXNpb25OYW1lOiBzdHJpbmcsIGVuZXJneTogbnVtYmVyLCBtb3JhbGU6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghaXNUZXN0aW5nVG9vbHNBdmFpbGFibGUoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoY29uc3QgY2l0eSBvZiBjaXRpZXMpIHtcbiAgICAgICAgUGxheWVyLmNvcnBvcmF0aW9uIS5kaXZpc2lvbnMuZ2V0KGRpdmlzaW9uTmFtZSkhLm9mZmljZXNbY2l0eV0hLmF2Z0VuZXJneSA9IGVuZXJneTtcbiAgICAgICAgUGxheWVyLmNvcnBvcmF0aW9uIS5kaXZpc2lvbnMuZ2V0KGRpdmlzaW9uTmFtZSkhLm9mZmljZXNbY2l0eV0hLmF2Z01vcmFsZSA9IG1vcmFsZTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRSZXNlYXJjaChkaXZpc2lvbk5hbWU6IHN0cmluZywgcmVzZWFyY2hOYW1lOiBSZXNlYXJjaE5hbWUpOiB2b2lkIHtcbiAgICBpZiAoIWlzVGVzdGluZ1Rvb2xzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBQbGF5ZXIuY29ycG9yYXRpb24hLmRpdmlzaW9ucy5nZXQoZGl2aXNpb25OYW1lKSEucmVzZWFyY2hlZC5hZGQocmVzZWFyY2hOYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0Uk5HRGF0YSgpIHtcbiAgICBpZiAoIWlzVGVzdGluZ1Rvb2xzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFtfLCBkaXZpc2lvbl0gb2YgUGxheWVyLmNvcnBvcmF0aW9uIS5kaXZpc2lvbnMpIHtcbiAgICAgICAgZm9yIChjb25zdCBbXywgb2ZmaWNlXSBvZiBPYmplY3QuZW50cmllcyhkaXZpc2lvbi5vZmZpY2VzKSkge1xuICAgICAgICAgICAgb2ZmaWNlLmF2Z0ludGVsbGlnZW5jZSA9IDc1O1xuICAgICAgICAgICAgb2ZmaWNlLmF2Z0NoYXJpc21hID0gNzU7XG4gICAgICAgICAgICBvZmZpY2UuYXZnQ3JlYXRpdml0eSA9IDc1O1xuICAgICAgICAgICAgb2ZmaWNlLmF2Z0VmZmljaWVuY3kgPSA3NTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IFtfLCB3YXJlaG91c2VdIG9mIE9iamVjdC5lbnRyaWVzKGRpdmlzaW9uLndhcmVob3VzZXMpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtfLCBtYXRlcmlhbF0gb2YgT2JqZWN0LmVudHJpZXMod2FyZWhvdXNlLm1hdGVyaWFscykpIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kZW1hbmQgPSBDb3JwTWF0ZXJpYWxzRGF0YVttYXRlcmlhbC5uYW1lXS5kZW1hbmRCYXNlO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmNvbXBldGl0aW9uID0gQ29ycE1hdGVyaWFsc0RhdGFbbWF0ZXJpYWwubmFtZV0uY29tcGV0aXRpb25CYXNlO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLm1hcmtldFByaWNlID0gQ29ycE1hdGVyaWFsc0RhdGFbbWF0ZXJpYWwubmFtZV0uYmFzZUNvc3Q7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYXZlcmFnZVByaWNlID0gQ29ycE1hdGVyaWFsc0RhdGFbbWF0ZXJpYWwubmFtZV0uYmFzZUNvc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFDQSxTQUFTLGNBQWM7QUFDdkIsU0FBbUIsa0JBQWtCLGNBQTRCLG1CQUFtQjtBQUNwRixTQUFTLHdCQUF1QztBQUNoRCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHlCQUF5QjtBQWlHbEMsTUFBTSxxQkFBcUI7QUFFM0IsZUFBc0IsaUJBQTBDO0FBQzVELFNBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3BDLFVBQU0sVUFBVSxPQUFPLFVBQVUsS0FBSyxpQkFBaUIsQ0FBQztBQUN4RCxZQUFRLFVBQVUsTUFBTTtBQUNwQixjQUFRLE1BQU0seURBQXlELFFBQVEsTUFBTTtBQUNyRixhQUFPLDhDQUE4QztBQUFBLElBQ3pEO0FBQ0EsWUFBUSxZQUFZLFdBQXlDO0FBQ3pELFlBQU0sS0FBSyxLQUFLO0FBQ2hCLFlBQU0sY0FBYyxHQUFHLFlBQVksQ0FBQyxrQkFBa0IsR0FBRyxXQUFXLEVBQUUsWUFBWSxrQkFBa0I7QUFDcEcsY0FBUSxXQUFXO0FBQUEsSUFDdkI7QUFBQSxFQUNKLENBQUM7QUFDTDtBQUVBLGVBQXNCLHFCQUE2QztBQUMvRCxTQUFP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
