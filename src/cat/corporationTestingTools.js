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
