import { NetscriptExtension } from "/libs/NetscriptExtension";
import { DAEMON_SCRIPT_NAME } from "/libs/constants";
import { parseNumber } from "/libs/utils";
import { UpgradeName } from "/corporationFormulas";
import { clearPurchaseOrders, DivisionName, hasDivision } from "/corporationUtils";
import * as testingTools from "/corporationTestingTools";
import { exposeGameInternalObjects } from "/exploits";
let ns;
let nsx;
let doc;
const enableTestingTools = true;
let runCorpMaintain = false;
let runDelScripts = false;
let reload = false;
let runCorpRound = false;
let runCorpTest = false;
function rerun(ns2) {
  ns2.spawn(ns2.getScriptName(), { spawnDelay: 100 });
}
function removeTestingTool() {
  const testingToolsDiv = doc.querySelector("#testing-tools");
  if (testingToolsDiv) {
    testingToolsDiv.remove();
  }
}
function createTestingTool() {
  if (enableTestingTools) {
    removeTestingTool();
    const root = doc.querySelector("#root");
    const testingToolsTemplate = doc.createElement("template");
    testingToolsTemplate.innerHTML = `
<div id="testing-tools">
    <div>
        <button id="btn-corp-maintain">CorpMaintain</button>
        <button id="btn-unlimited-bonus-time">UnlimitedBonusTime</button>
        <button id="btn-remove-bonus-time">RemoveBonusTime</button>
        <button id="btn-corp-round">CorpRound</button>
        <button id="btn-corp-test">CorpTest</button>
        <button id="btn-import-save">ImportSave</button>
        <button id="btn-delete-all-scripts">DelScripts</button>
        <button id="btn-reload">Reload</button>
        <button id="btn-exit">Exit</button>
    </div>
    <div>
        <label for="testing-tools-input">Input:</label>
        <input id="testing-tools-input" type="text"/>
        <input id="testing-tools-file-input" type="file"/>
        <button id="btn-funds">Funds</button>
        <button id="btn-smart-factories">SmartFactories</button>
        <button id="btn-smart-storage">SmartStorage</button>
        <select id="select-save-data">
            <option value="current">Current</option>
        </select>
        <button id="btn-import-save-data">Import</button>
        <button id="btn-export-save-data">Export</button>
        <button id="btn-delete-save-data">Delete</button>
    </div>
    <div>
        <label for="testing-tools-divisions">Division:</label>
        <select name="divisions" id="testing-tools-divisions">
            <option value="Agriculture">Agriculture</option>
            <option value="Chemical">Chemical</option>
            <option value="Tobacco">Tobacco</option>
        </select>
        <button id="btn-rp">RP</button>
        <button id="btn-office">Office</button>
        <button id="btn-warehouse">Warehouse</button>
        <button id="btn-boost-materials">BoostMats</button>
        <button id="btn-clear-boost-materials">ClearBoostMats</button>
        <button id="btn-clear-input-materials">ClearInputMats</button>
        <button id="btn-clear-output-materials">ClearOutputMats</button>
        <button id="btn-clear-storage">ClearStorage</button>
    </div>
    <div>
    </div>
    <style>
        #testing-tools {
            transform: translate(850px, 5px);z-index: 9999;display: flex;flex-flow: wrap;position: fixed;min-width: 150px;
            max-width: 840px;min-height: 33px;border: 1px solid rgb(68, 68, 68);color: white;
        }
        #testing-tools > div {
            width: 100%;display: flex;
        }
        #btn-corp-test {
            margin-right: auto;
        }
        #btn-import-save {
            margin-left: auto;
        }
        #btn-funds {
            margin-left: 10px;
        }
        #btn-rp {
            margin-left: 10px;
        }
        #testing-tools-file-input {
            display: none;
        }
        #select-save-data {
            min-width: 195px;
        }
    </style>
</div>
        `.trim();
    root.appendChild(testingToolsTemplate.content.firstChild);
    const testingToolsDiv = doc.querySelector("#testing-tools");
    const savaDataSelectElement = doc.getElementById("select-save-data");
    const reloadSaveDataSelectElement = async () => {
      const keys = await testingTools.getAllSaveDataKeys();
      keys.sort((a, b) => {
        if (a === "save") {
          return 1;
        }
        return b.toString().localeCompare(a.toString());
      });
      savaDataSelectElement.innerHTML = "";
      for (const key of keys) {
        const option = document.createElement("option");
        option.text = key;
        option.value = key;
        savaDataSelectElement.add(option);
      }
    };
    reloadSaveDataSelectElement().then();
    doc.getElementById("btn-corp-maintain").addEventListener("click", function() {
      runCorpMaintain = true;
    });
    doc.getElementById("btn-unlimited-bonus-time").addEventListener("click", function() {
      testingTools.setUnlimitedBonusTime();
    });
    doc.getElementById("btn-remove-bonus-time").addEventListener("click", function() {
      testingTools.removeBonusTime();
    });
    doc.getElementById("btn-corp-round").addEventListener("click", function() {
      runCorpRound = true;
    });
    doc.getElementById("btn-corp-test").addEventListener("click", function() {
      runCorpTest = true;
    });
    doc.getElementById("btn-import-save").addEventListener("click", function() {
      const fileInput = doc.getElementById("testing-tools-file-input");
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(e2) {
          const target = e2.target;
          if (target === null) {
            throw new Error("Error importing file");
          }
          const result = target.result;
          const indexedDbRequest = window.indexedDB.open("bitburnerSave", 1);
          indexedDbRequest.onsuccess = function() {
            const db = this.result;
            if (!db) {
              throw new Error("Cannot access database");
            }
            const objectStore = db.transaction(["savestring"], "readwrite").objectStore("savestring");
            const request = objectStore.put(
              result instanceof ArrayBuffer ? new Uint8Array(result) : result,
              "save"
            );
            request.onsuccess = () => {
              globalThis.setTimeout(() => globalThis.location.reload(), 1e3);
            };
          };
        };
        if (file.name.endsWith(".gz")) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      };
      fileInput.click();
    });
    doc.getElementById("btn-delete-all-scripts").addEventListener("click", function() {
      runDelScripts = true;
    });
    doc.getElementById("btn-reload").addEventListener("click", function() {
      reload = true;
      testingToolsDiv.remove();
    });
    doc.getElementById("btn-exit").addEventListener("click", function() {
      testingToolsDiv.remove();
    });
    const getInputValue = function() {
      return doc.querySelector("#testing-tools-input").value;
    };
    const useInputValueAsNumber = function(callback) {
      const value = parseNumber(getInputValue());
      if (Number.isNaN(value)) {
        alert("Invalid input");
        return;
      }
      callback(value);
    };
    const useInputValueAsString = function(callback) {
      const value = getInputValue();
      if (!value) {
        alert("Invalid input");
        return;
      }
      callback(value);
    };
    const getDivisionName = function() {
      return doc.querySelector("#testing-tools-divisions").value;
    };
    doc.getElementById("btn-funds").addEventListener("click", function() {
      useInputValueAsNumber((inputValue) => {
        testingTools.setFunds(inputValue);
      });
    });
    doc.getElementById("btn-smart-factories").addEventListener("click", function() {
      useInputValueAsNumber((inputValue) => {
        testingTools.setUpgradeLevel(UpgradeName.SMART_FACTORIES, inputValue);
      });
    });
    doc.getElementById("btn-smart-storage").addEventListener("click", function() {
      useInputValueAsNumber((inputValue) => {
        testingTools.setUpgradeLevel(UpgradeName.SMART_STORAGE, inputValue);
      });
    });
    doc.getElementById("btn-import-save-data").addEventListener("click", function() {
      testingTools.getSaveData(savaDataSelectElement.value).then((saveData) => {
        if (!saveData) {
          return;
        }
        testingTools.updateSaveData("save", saveData).then(() => {
          ns.killall("home");
          const currentAllServers = globalThis.AllServers.saveAllServers();
          globalThis.SaveObject.loadGame(saveData);
          setTimeout(() => {
            globalThis.AllServers.loadAllServers(currentAllServers);
            ns.exec("daemon.js", "home", 1, "--maintainCorporation");
          }, 1e3);
        });
      });
    });
    doc.getElementById("btn-export-save-data").addEventListener("click", async function() {
      testingTools.insertSaveData(await globalThis.SaveObject.saveObject.getSaveData(true, true)).then(() => {
        reloadSaveDataSelectElement().then();
      });
    });
    doc.getElementById("btn-delete-save-data").addEventListener("click", function() {
      const key = savaDataSelectElement.value;
      if (!key) {
        return;
      }
      if (key === "save") {
        alert(`You cannot delete the built-in "save"`);
        return;
      }
      testingTools.deleteSaveData(savaDataSelectElement.value).then(() => {
        reloadSaveDataSelectElement().then();
      });
    });
    doc.getElementById("btn-rp").addEventListener("click", function() {
      useInputValueAsNumber((inputValue) => {
        testingTools.setResearchPoints(getDivisionName(), inputValue);
      });
    });
    doc.getElementById("btn-office").addEventListener("click", function() {
      useInputValueAsString((inputValue) => {
        const employeeJobs = inputValue.trim().split(",").map((value) => parseNumber(value)).filter((value) => !Number.isNaN(value));
        if (employeeJobs.length !== 5) {
          alert("Invalid input");
          return;
        }
        testingTools.setOfficeSetup(getDivisionName(), employeeJobs);
      });
    });
    doc.getElementById("btn-warehouse").addEventListener("click", function() {
      useInputValueAsNumber((inputValue) => {
        testingTools.setWarehouseLevel(getDivisionName(), inputValue);
      });
    });
    doc.getElementById("btn-boost-materials").addEventListener("click", function() {
      useInputValueAsString((inputValue) => {
        const boostMaterials = inputValue.trim().split(",").map((value) => parseNumber(value)).filter((value) => !Number.isNaN(value));
        if (boostMaterials.length !== 4) {
          alert("Invalid input");
          return;
        }
        testingTools.setBoostMaterials(getDivisionName(), boostMaterials);
      });
    });
    doc.getElementById("btn-clear-boost-materials").addEventListener("click", function() {
      testingTools.setBoostMaterials(getDivisionName(), [0, 0, 0, 0]);
    });
    doc.getElementById("btn-clear-input-materials").addEventListener("click", function() {
      testingTools.clearMaterials(getDivisionName(), { input: true, output: false });
    });
    doc.getElementById("btn-clear-output-materials").addEventListener("click", function() {
      testingTools.clearMaterials(getDivisionName(), { input: false, output: true });
    });
    doc.getElementById("btn-clear-storage").addEventListener("click", function() {
      clearPurchaseOrders(ns);
      testingTools.setBoostMaterials(getDivisionName(), [0, 0, 0, 0]);
      testingTools.clearMaterials(getDivisionName(), { input: true, output: true });
    });
  }
}
async function main(nsContext) {
  exposeGameInternalObjects();
  ns = nsContext;
  nsx = new NetscriptExtension(ns);
  nsx.killProcessesSpawnFromSameScript();
  ns.disableLog("ALL");
  ns.clearLog();
  doc = eval("document");
  const hook0 = doc.getElementById("overview-extra-hook-0");
  const hook1 = doc.getElementById("overview-extra-hook-1");
  nsx.addAtExitCallback(() => {
    hook0.innerText = "";
    hook1.innerText = "";
    removeTestingTool();
  });
  const headers = [];
  const values = [];
  headers.push("<div>ServerLoad</div>");
  values.push("<div id='hud-server-load'>0%</div>");
  if (ns.stock.hasWSEAccount()) {
    headers.push("<div>StockWorth</div>");
    values.push("<div id='hud-stock-worth'>0</div>");
  }
  if (ns.corporation.hasCorporation()) {
    headers.push("<div>InvestmentOffer</div>");
    values.push("<div id='hud-investment-offer'>0</div>");
    headers.push("<div>CorpMaintain</div>");
    values.push("<div id='hud-corp-maintain'>false</div>");
  }
  hook0.innerHTML = headers.join("");
  hook1.innerHTML = values.join("");
  if (globalThis.Player) {
    createTestingTool();
  }
  while (true) {
    try {
      let totalMaxRAMOfAllRunners = 0;
      let totalUsedRAMOfAllRunners = 0;
      nsx.scanBFS("home").filter((host) => {
        return ns.getServerMaxRam(host.hostname) > 0 && ns.hasRootAccess(host.hostname);
      }).forEach((runner) => {
        totalMaxRAMOfAllRunners += ns.getServerMaxRam(runner.hostname);
        totalUsedRAMOfAllRunners += ns.getServerUsedRam(runner.hostname);
      });
      doc.getElementById("hud-server-load").innerText = `${(totalUsedRAMOfAllRunners / totalMaxRAMOfAllRunners * 100).toFixed(2)}%`;
      if (ns.stock.hasWSEAccount()) {
        const hudStockWorthValue = doc.getElementById("hud-stock-worth");
        if (hudStockWorthValue === null) {
          rerun(ns);
          return;
        }
        const stockStats = nsx.calculateStockStats();
        hudStockWorthValue.innerText = ns.formatNumber(stockStats.currentWorth);
      }
      if (ns.corporation.hasCorporation()) {
        const hudInvestmentOfferValue = doc.getElementById("hud-investment-offer");
        if (hudInvestmentOfferValue === null) {
          rerun(ns);
          return;
        }
        hudInvestmentOfferValue.innerText = ns.formatNumber(ns.corporation.getInvestmentOffer().funds);
        let isDaemonRunning = false;
        ns.ps().forEach((process) => {
          if (process.filename !== DAEMON_SCRIPT_NAME) {
            return;
          }
          if (process.args.includes("--maintainCorporation")) {
            isDaemonRunning = true;
          }
        });
        doc.getElementById("hud-corp-maintain").innerText = `${isDaemonRunning}`;
        if (runCorpMaintain) {
          if (ns.exec("daemon.js", "home", 1, "--maintainCorporation") === 0) {
            ns.toast("Failed to run daemon.js --maintainCorporation");
          }
          runCorpMaintain = false;
        }
        if (runDelScripts) {
          ns.killall("home", true);
          if (ns.exec("tools.js", "home", 1, "--deleteAllScripts") === 0) {
            ns.toast("Failed to run tools.js --deleteAllScripts");
          }
          runDelScripts = false;
        }
        if (reload) {
          rerun(ns);
          reload = false;
        }
        if (runCorpRound) {
          if (!hasDivision(ns, DivisionName.CHEMICAL)) {
            if (ns.exec("corporation.js", "home", 1, "--round2", "--benchmark") === 0) {
              ns.toast("Failed to run corporation.js --round2 --benchmark");
            }
          } else if (!hasDivision(ns, DivisionName.TOBACCO)) {
            if (ns.exec("corporation.js", "home", 1, "--round3", "--benchmark") === 0) {
              ns.toast("Failed to run corporation.js --round3 --benchmark");
            }
          } else {
            if (ns.exec("corporation.js", "home", 1, "--improveAllDivisions", "--benchmark") === 0) {
              ns.toast("Failed to run corporation.js --improveAllDivisions --benchmark");
            }
          }
          runCorpRound = false;
        }
        if (runCorpTest) {
          if (ns.exec("corporation.js", "home", 1, "--test", "--benchmark") === 0) {
            ns.toast("Failed to run corporation.js --test --benchmark");
          }
          runCorpTest = false;
        }
      } else {
        if (runCorpRound) {
          if (ns.exec("corporation.js", "home", 1, "--round1", "--benchmark") === 0) {
            ns.toast("Failed to run corporation.js --round1 --benchmark");
          }
          await ns.sleep(1e3);
          ns.exec("daemon.js", "home", 1, "--maintainCorporation");
          testingTools.setUnlimitedBonusTime();
          runCorpRound = false;
        }
      }
    } catch (ex) {
      ns.print(`HUD error: ${JSON.stringify(ex)}`);
    }
    await ns.asleep(1e3);
  }
}
export {
  main
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2N1c3RvbUhVRC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTlMgfSBmcm9tIFwiQG5zXCI7XG5pbXBvcnQgeyBOZXRzY3JpcHRFeHRlbnNpb24gfSBmcm9tIFwiL2xpYnMvTmV0c2NyaXB0RXh0ZW5zaW9uXCI7XG5pbXBvcnQgeyBEQUVNT05fU0NSSVBUX05BTUUgfSBmcm9tIFwiL2xpYnMvY29uc3RhbnRzXCI7XG5pbXBvcnQgeyBwYXJzZU51bWJlciB9IGZyb20gXCIvbGlicy91dGlsc1wiO1xuaW1wb3J0IHsgVXBncmFkZU5hbWUgfSBmcm9tIFwiL2NvcnBvcmF0aW9uRm9ybXVsYXNcIjtcbmltcG9ydCB7IGNsZWFyUHVyY2hhc2VPcmRlcnMsIERpdmlzaW9uTmFtZSwgaGFzRGl2aXNpb24gfSBmcm9tIFwiL2NvcnBvcmF0aW9uVXRpbHNcIjtcbmltcG9ydCAqIGFzIHRlc3RpbmdUb29scyBmcm9tIFwiL2NvcnBvcmF0aW9uVGVzdGluZ1Rvb2xzXCI7XG5pbXBvcnQgeyBleHBvc2VHYW1lSW50ZXJuYWxPYmplY3RzIH0gZnJvbSBcIi9leHBsb2l0c1wiO1xuXG5sZXQgbnM6IE5TO1xubGV0IG5zeDogTmV0c2NyaXB0RXh0ZW5zaW9uO1xubGV0IGRvYzogRG9jdW1lbnQ7XG5cbmNvbnN0IGVuYWJsZVRlc3RpbmdUb29scyA9IHRydWU7XG5sZXQgcnVuQ29ycE1haW50YWluID0gZmFsc2U7XG5sZXQgcnVuRGVsU2NyaXB0cyA9IGZhbHNlO1xubGV0IHJlbG9hZCA9IGZhbHNlO1xubGV0IHJ1bkNvcnBSb3VuZCA9IGZhbHNlO1xubGV0IHJ1bkNvcnBUZXN0ID0gZmFsc2U7XG5cbmZ1bmN0aW9uIHJlcnVuKG5zOiBOUykge1xuICAgIG5zLnNwYXduKG5zLmdldFNjcmlwdE5hbWUoKSwgeyBzcGF3bkRlbGF5OiAxMDAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVRlc3RpbmdUb29sKCkge1xuICAgIGNvbnN0IHRlc3RpbmdUb29sc0RpdiA9IGRvYy5xdWVyeVNlbGVjdG9yKFwiI3Rlc3RpbmctdG9vbHNcIik7XG4gICAgLy8gUmVtb3ZlIG9sZCB0b29sc1xuICAgIGlmICh0ZXN0aW5nVG9vbHNEaXYpIHtcbiAgICAgICAgdGVzdGluZ1Rvb2xzRGl2LnJlbW92ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlVGVzdGluZ1Rvb2woKSB7XG4gICAgLy8gVGVzdGluZyB0b29sc1xuICAgIGlmIChlbmFibGVUZXN0aW5nVG9vbHMpIHtcbiAgICAgICAgcmVtb3ZlVGVzdGluZ1Rvb2woKTtcblxuICAgICAgICAvLyBDcmVhdGUgdG9vbHNcbiAgICAgICAgY29uc3Qgcm9vdDogRWxlbWVudCA9IGRvYy5xdWVyeVNlbGVjdG9yKFwiI3Jvb3RcIikhO1xuICAgICAgICBjb25zdCB0ZXN0aW5nVG9vbHNUZW1wbGF0ZSA9IGRvYy5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIik7XG4gICAgICAgIHRlc3RpbmdUb29sc1RlbXBsYXRlLmlubmVySFRNTCA9IGBcbjxkaXYgaWQ9XCJ0ZXN0aW5nLXRvb2xzXCI+XG4gICAgPGRpdj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1jb3JwLW1haW50YWluXCI+Q29ycE1haW50YWluPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gaWQ9XCJidG4tdW5saW1pdGVkLWJvbnVzLXRpbWVcIj5VbmxpbWl0ZWRCb251c1RpbWU8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1yZW1vdmUtYm9udXMtdGltZVwiPlJlbW92ZUJvbnVzVGltZTwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLWNvcnAtcm91bmRcIj5Db3JwUm91bmQ8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1jb3JwLXRlc3RcIj5Db3JwVGVzdDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLWltcG9ydC1zYXZlXCI+SW1wb3J0U2F2ZTwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLWRlbGV0ZS1hbGwtc2NyaXB0c1wiPkRlbFNjcmlwdHM8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1yZWxvYWRcIj5SZWxvYWQ8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1leGl0XCI+RXhpdDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICAgIDxkaXY+XG4gICAgICAgIDxsYWJlbCBmb3I9XCJ0ZXN0aW5nLXRvb2xzLWlucHV0XCI+SW5wdXQ6PC9sYWJlbD5cbiAgICAgICAgPGlucHV0IGlkPVwidGVzdGluZy10b29scy1pbnB1dFwiIHR5cGU9XCJ0ZXh0XCIvPlxuICAgICAgICA8aW5wdXQgaWQ9XCJ0ZXN0aW5nLXRvb2xzLWZpbGUtaW5wdXRcIiB0eXBlPVwiZmlsZVwiLz5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1mdW5kc1wiPkZ1bmRzPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gaWQ9XCJidG4tc21hcnQtZmFjdG9yaWVzXCI+U21hcnRGYWN0b3JpZXM8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1zbWFydC1zdG9yYWdlXCI+U21hcnRTdG9yYWdlPC9idXR0b24+XG4gICAgICAgIDxzZWxlY3QgaWQ9XCJzZWxlY3Qtc2F2ZS1kYXRhXCI+XG4gICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiY3VycmVudFwiPkN1cnJlbnQ8L29wdGlvbj5cbiAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgIDxidXR0b24gaWQ9XCJidG4taW1wb3J0LXNhdmUtZGF0YVwiPkltcG9ydDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLWV4cG9ydC1zYXZlLWRhdGFcIj5FeHBvcnQ8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1kZWxldGUtc2F2ZS1kYXRhXCI+RGVsZXRlPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGRpdj5cbiAgICAgICAgPGxhYmVsIGZvcj1cInRlc3RpbmctdG9vbHMtZGl2aXNpb25zXCI+RGl2aXNpb246PC9sYWJlbD5cbiAgICAgICAgPHNlbGVjdCBuYW1lPVwiZGl2aXNpb25zXCIgaWQ9XCJ0ZXN0aW5nLXRvb2xzLWRpdmlzaW9uc1wiPlxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIkFncmljdWx0dXJlXCI+QWdyaWN1bHR1cmU8L29wdGlvbj5cbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJDaGVtaWNhbFwiPkNoZW1pY2FsPC9vcHRpb24+XG4gICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiVG9iYWNjb1wiPlRvYmFjY288L29wdGlvbj5cbiAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgIDxidXR0b24gaWQ9XCJidG4tcnBcIj5SUDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLW9mZmljZVwiPk9mZmljZTwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLXdhcmVob3VzZVwiPldhcmVob3VzZTwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLWJvb3N0LW1hdGVyaWFsc1wiPkJvb3N0TWF0czwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGlkPVwiYnRuLWNsZWFyLWJvb3N0LW1hdGVyaWFsc1wiPkNsZWFyQm9vc3RNYXRzPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gaWQ9XCJidG4tY2xlYXItaW5wdXQtbWF0ZXJpYWxzXCI+Q2xlYXJJbnB1dE1hdHM8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBpZD1cImJ0bi1jbGVhci1vdXRwdXQtbWF0ZXJpYWxzXCI+Q2xlYXJPdXRwdXRNYXRzPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gaWQ9XCJidG4tY2xlYXItc3RvcmFnZVwiPkNsZWFyU3RvcmFnZTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICAgIDxkaXY+XG4gICAgPC9kaXY+XG4gICAgPHN0eWxlPlxuICAgICAgICAjdGVzdGluZy10b29scyB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSg4NTBweCwgNXB4KTt6LWluZGV4OiA5OTk5O2Rpc3BsYXk6IGZsZXg7ZmxleC1mbG93OiB3cmFwO3Bvc2l0aW9uOiBmaXhlZDttaW4td2lkdGg6IDE1MHB4O1xuICAgICAgICAgICAgbWF4LXdpZHRoOiA4NDBweDttaW4taGVpZ2h0OiAzM3B4O2JvcmRlcjogMXB4IHNvbGlkIHJnYig2OCwgNjgsIDY4KTtjb2xvcjogd2hpdGU7XG4gICAgICAgIH1cbiAgICAgICAgI3Rlc3RpbmctdG9vbHMgPiBkaXYge1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7ZGlzcGxheTogZmxleDtcbiAgICAgICAgfVxuICAgICAgICAjYnRuLWNvcnAtdGVzdCB7XG4gICAgICAgICAgICBtYXJnaW4tcmlnaHQ6IGF1dG87XG4gICAgICAgIH1cbiAgICAgICAgI2J0bi1pbXBvcnQtc2F2ZSB7XG4gICAgICAgICAgICBtYXJnaW4tbGVmdDogYXV0bztcbiAgICAgICAgfVxuICAgICAgICAjYnRuLWZ1bmRzIHtcbiAgICAgICAgICAgIG1hcmdpbi1sZWZ0OiAxMHB4O1xuICAgICAgICB9XG4gICAgICAgICNidG4tcnAge1xuICAgICAgICAgICAgbWFyZ2luLWxlZnQ6IDEwcHg7XG4gICAgICAgIH1cbiAgICAgICAgI3Rlc3RpbmctdG9vbHMtZmlsZS1pbnB1dCB7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgICNzZWxlY3Qtc2F2ZS1kYXRhIHtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMTk1cHg7XG4gICAgICAgIH1cbiAgICA8L3N0eWxlPlxuPC9kaXY+XG4gICAgICAgIGAudHJpbSgpO1xuICAgICAgICByb290LmFwcGVuZENoaWxkKHRlc3RpbmdUb29sc1RlbXBsYXRlLmNvbnRlbnQuZmlyc3RDaGlsZCEpO1xuICAgICAgICBjb25zdCB0ZXN0aW5nVG9vbHNEaXYgPSBkb2MucXVlcnlTZWxlY3RvcihcIiN0ZXN0aW5nLXRvb2xzXCIpITtcbiAgICAgICAgY29uc3Qgc2F2YURhdGFTZWxlY3RFbGVtZW50ID0gZG9jLmdldEVsZW1lbnRCeUlkKFwic2VsZWN0LXNhdmUtZGF0YVwiKSBhcyBIVE1MU2VsZWN0RWxlbWVudDtcblxuICAgICAgICBjb25zdCByZWxvYWRTYXZlRGF0YVNlbGVjdEVsZW1lbnQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBrZXlzID0gYXdhaXQgdGVzdGluZ1Rvb2xzLmdldEFsbFNhdmVEYXRhS2V5cygpO1xuICAgICAgICAgICAga2V5cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGEgPT09IFwic2F2ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gYi50b1N0cmluZygpLmxvY2FsZUNvbXBhcmUoYS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgc2F2YURhdGFTZWxlY3RFbGVtZW50LmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIm9wdGlvblwiKTtcbiAgICAgICAgICAgICAgICBvcHRpb24udGV4dCA9IGtleSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgICAgb3B0aW9uLnZhbHVlID0ga2V5IGFzIHN0cmluZztcbiAgICAgICAgICAgICAgICBzYXZhRGF0YVNlbGVjdEVsZW1lbnQuYWRkKG9wdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVsb2FkU2F2ZURhdGFTZWxlY3RFbGVtZW50KCkudGhlbigpO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tY29ycC1tYWludGFpblwiKSEuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJ1bkNvcnBNYWludGFpbiA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tdW5saW1pdGVkLWJvbnVzLXRpbWVcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0ZXN0aW5nVG9vbHMuc2V0VW5saW1pdGVkQm9udXNUaW1lKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tcmVtb3ZlLWJvbnVzLXRpbWVcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0ZXN0aW5nVG9vbHMucmVtb3ZlQm9udXNUaW1lKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tY29ycC1yb3VuZFwiKSEuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJ1bkNvcnBSb3VuZCA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tY29ycC10ZXN0XCIpIS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcnVuQ29ycFRlc3QgPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiYnRuLWltcG9ydC1zYXZlXCIpIS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlucHV0ID0gZG9jLmdldEVsZW1lbnRCeUlkKFwidGVzdGluZy10b29scy1maWxlLWlucHV0XCIpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgICAgICBmaWxlSW5wdXQub25jaGFuZ2UgPSAoZSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGUgPSAoPEhUTUxJbnB1dEVsZW1lbnQ+ZS50YXJnZXQpLmZpbGVzIVswXTtcbiAgICAgICAgICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgICAgICAgICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbiAodGhpczogRmlsZVJlYWRlciwgZTogUHJvZ3Jlc3NFdmVudDxGaWxlUmVhZGVyPikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXJyb3IgaW1wb3J0aW5nIGZpbGVcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXhlZERiUmVxdWVzdDogSURCT3BlbkRCUmVxdWVzdCA9IHdpbmRvdy5pbmRleGVkREIub3BlbihcImJpdGJ1cm5lclNhdmVcIiwgMSk7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZWREYlJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24gKHRoaXM6IElEQlJlcXVlc3Q8SURCRGF0YWJhc2U+KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYiA9IHRoaXMucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkYikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBhY2Nlc3MgZGF0YWJhc2VcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IGRiLnRyYW5zYWN0aW9uKFtcInNhdmVzdHJpbmdcIl0sIFwicmVhZHdyaXRlXCIpLm9iamVjdFN0b3JlKFwic2F2ZXN0cmluZ1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3QgPSBvYmplY3RTdG9yZS5wdXQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKHJlc3VsdCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSA/IG5ldyBVaW50OEFycmF5KHJlc3VsdCkgOiByZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJzYXZlXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbG9iYWxUaGlzLnNldFRpbWVvdXQoKCkgPT4gZ2xvYmFsVGhpcy5sb2NhdGlvbi5yZWxvYWQoKSwgMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGZpbGUubmFtZS5lbmRzV2l0aChcIi5nelwiKSkge1xuICAgICAgICAgICAgICAgICAgICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoZmlsZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGZpbGVJbnB1dC5jbGljaygpO1xuICAgICAgICB9KTtcbiAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiYnRuLWRlbGV0ZS1hbGwtc2NyaXB0c1wiKSEuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJ1bkRlbFNjcmlwdHMgPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiYnRuLXJlbG9hZFwiKSEuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJlbG9hZCA9IHRydWU7XG4gICAgICAgICAgICB0ZXN0aW5nVG9vbHNEaXYhLnJlbW92ZSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiYnRuLWV4aXRcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0ZXN0aW5nVG9vbHNEaXYhLnJlbW92ZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBnZXRJbnB1dFZhbHVlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGRvYy5xdWVyeVNlbGVjdG9yPEhUTUxJbnB1dEVsZW1lbnQ+KFwiI3Rlc3RpbmctdG9vbHMtaW5wdXRcIikhLnZhbHVlO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCB1c2VJbnB1dFZhbHVlQXNOdW1iZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2s6ICgoaW5wdXRWYWx1ZTogbnVtYmVyKSA9PiB2b2lkKSkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBwYXJzZU51bWJlcihnZXRJbnB1dFZhbHVlKCkpO1xuICAgICAgICAgICAgaWYgKE51bWJlci5pc05hTih2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBhbGVydChcIkludmFsaWQgaW5wdXRcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2sodmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCB1c2VJbnB1dFZhbHVlQXNTdHJpbmcgPSBmdW5jdGlvbiAoY2FsbGJhY2s6ICgoaW5wdXRWYWx1ZTogc3RyaW5nKSA9PiB2b2lkKSkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBnZXRJbnB1dFZhbHVlKCk7XG4gICAgICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgICAgICAgYWxlcnQoXCJJbnZhbGlkIGlucHV0XCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgZ2V0RGl2aXNpb25OYW1lID0gZnVuY3Rpb24gKCk6IHN0cmluZyB7XG4gICAgICAgICAgICByZXR1cm4gZG9jLnF1ZXJ5U2VsZWN0b3I8SFRNTFNlbGVjdEVsZW1lbnQ+KFwiI3Rlc3RpbmctdG9vbHMtZGl2aXNpb25zXCIpIS52YWx1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiYnRuLWZ1bmRzXCIpIS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdXNlSW5wdXRWYWx1ZUFzTnVtYmVyKChpbnB1dFZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICB0ZXN0aW5nVG9vbHMuc2V0RnVuZHMoaW5wdXRWYWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRvYy5nZXRFbGVtZW50QnlJZChcImJ0bi1zbWFydC1mYWN0b3JpZXNcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB1c2VJbnB1dFZhbHVlQXNOdW1iZXIoKGlucHV0VmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIHRlc3RpbmdUb29scy5zZXRVcGdyYWRlTGV2ZWwoVXBncmFkZU5hbWUuU01BUlRfRkFDVE9SSUVTLCBpbnB1dFZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiYnRuLXNtYXJ0LXN0b3JhZ2VcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB1c2VJbnB1dFZhbHVlQXNOdW1iZXIoKGlucHV0VmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIHRlc3RpbmdUb29scy5zZXRVcGdyYWRlTGV2ZWwoVXBncmFkZU5hbWUuU01BUlRfU1RPUkFHRSwgaW5wdXRWYWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRvYy5nZXRFbGVtZW50QnlJZChcImJ0bi1pbXBvcnQtc2F2ZS1kYXRhXCIpIS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGVzdGluZ1Rvb2xzLmdldFNhdmVEYXRhKHNhdmFEYXRhU2VsZWN0RWxlbWVudC52YWx1ZSkudGhlbihzYXZlRGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFzYXZlRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRlc3RpbmdUb29scy51cGRhdGVTYXZlRGF0YShcInNhdmVcIiwgc2F2ZURhdGEpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBucy5raWxsYWxsKFwiaG9tZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudEFsbFNlcnZlcnMgPSBnbG9iYWxUaGlzLkFsbFNlcnZlcnMuc2F2ZUFsbFNlcnZlcnMoKTtcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsVGhpcy5TYXZlT2JqZWN0LmxvYWRHYW1lKHNhdmVEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbG9iYWxUaGlzLkFsbFNlcnZlcnMubG9hZEFsbFNlcnZlcnMoY3VycmVudEFsbFNlcnZlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbnMuZXhlYyhcImRhZW1vbi5qc1wiLCBcImhvbWVcIiwgMSwgXCItLW1haW50YWluQ29ycG9yYXRpb25cIik7XG4gICAgICAgICAgICAgICAgICAgIH0sIDEwMDApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tZXhwb3J0LXNhdmUtZGF0YVwiKSEuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRlc3RpbmdUb29scy5pbnNlcnRTYXZlRGF0YShhd2FpdCBnbG9iYWxUaGlzLlNhdmVPYmplY3Quc2F2ZU9iamVjdC5nZXRTYXZlRGF0YSh0cnVlLCB0cnVlKSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVsb2FkU2F2ZURhdGFTZWxlY3RFbGVtZW50KCkudGhlbigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tZGVsZXRlLXNhdmUtZGF0YVwiKSEuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnN0IGtleSA9IHNhdmFEYXRhU2VsZWN0RWxlbWVudC52YWx1ZTtcbiAgICAgICAgICAgIGlmICgha2V5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGtleSA9PT0gXCJzYXZlXCIpIHtcbiAgICAgICAgICAgICAgICBhbGVydChgWW91IGNhbm5vdCBkZWxldGUgdGhlIGJ1aWx0LWluIFwic2F2ZVwiYCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGVzdGluZ1Rvb2xzLmRlbGV0ZVNhdmVEYXRhKHNhdmFEYXRhU2VsZWN0RWxlbWVudC52YWx1ZSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVsb2FkU2F2ZURhdGFTZWxlY3RFbGVtZW50KCkudGhlbigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tcnBcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB1c2VJbnB1dFZhbHVlQXNOdW1iZXIoKGlucHV0VmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIHRlc3RpbmdUb29scy5zZXRSZXNlYXJjaFBvaW50cyhnZXREaXZpc2lvbk5hbWUoKSwgaW5wdXRWYWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRvYy5nZXRFbGVtZW50QnlJZChcImJ0bi1vZmZpY2VcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB1c2VJbnB1dFZhbHVlQXNTdHJpbmcoKGlucHV0VmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVtcGxveWVlSm9iczogbnVtYmVyW10gPSBpbnB1dFZhbHVlLnRyaW0oKS5zcGxpdChcIixcIilcbiAgICAgICAgICAgICAgICAgICAgLm1hcCh2YWx1ZSA9PiBwYXJzZU51bWJlcih2YWx1ZSkpXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIodmFsdWUgPT4gIU51bWJlci5pc05hTih2YWx1ZSkpO1xuICAgICAgICAgICAgICAgIGlmIChlbXBsb3llZUpvYnMubGVuZ3RoICE9PSA1KSB7XG4gICAgICAgICAgICAgICAgICAgIGFsZXJ0KFwiSW52YWxpZCBpbnB1dFwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0ZXN0aW5nVG9vbHMuc2V0T2ZmaWNlU2V0dXAoZ2V0RGl2aXNpb25OYW1lKCksIGVtcGxveWVlSm9icyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRvYy5nZXRFbGVtZW50QnlJZChcImJ0bi13YXJlaG91c2VcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB1c2VJbnB1dFZhbHVlQXNOdW1iZXIoKGlucHV0VmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIHRlc3RpbmdUb29scy5zZXRXYXJlaG91c2VMZXZlbChnZXREaXZpc2lvbk5hbWUoKSwgaW5wdXRWYWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRvYy5nZXRFbGVtZW50QnlJZChcImJ0bi1ib29zdC1tYXRlcmlhbHNcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB1c2VJbnB1dFZhbHVlQXNTdHJpbmcoKGlucHV0VmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvb3N0TWF0ZXJpYWxzOiBudW1iZXJbXSA9IGlucHV0VmFsdWUudHJpbSgpLnNwbGl0KFwiLFwiKVxuICAgICAgICAgICAgICAgICAgICAubWFwKHZhbHVlID0+IHBhcnNlTnVtYmVyKHZhbHVlKSlcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcih2YWx1ZSA9PiAhTnVtYmVyLmlzTmFOKHZhbHVlKSk7XG4gICAgICAgICAgICAgICAgaWYgKGJvb3N0TWF0ZXJpYWxzLmxlbmd0aCAhPT0gNCkge1xuICAgICAgICAgICAgICAgICAgICBhbGVydChcIkludmFsaWQgaW5wdXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGVzdGluZ1Rvb2xzLnNldEJvb3N0TWF0ZXJpYWxzKGdldERpdmlzaW9uTmFtZSgpLCBib29zdE1hdGVyaWFscyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRvYy5nZXRFbGVtZW50QnlJZChcImJ0bi1jbGVhci1ib29zdC1tYXRlcmlhbHNcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0ZXN0aW5nVG9vbHMuc2V0Qm9vc3RNYXRlcmlhbHMoZ2V0RGl2aXNpb25OYW1lKCksIFswLCAwLCAwLCAwXSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tY2xlYXItaW5wdXQtbWF0ZXJpYWxzXCIpIS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGVzdGluZ1Rvb2xzLmNsZWFyTWF0ZXJpYWxzKGdldERpdmlzaW9uTmFtZSgpLCB7IGlucHV0OiB0cnVlLCBvdXRwdXQ6IGZhbHNlIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiYnRuLWNsZWFyLW91dHB1dC1tYXRlcmlhbHNcIikhLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0ZXN0aW5nVG9vbHMuY2xlYXJNYXRlcmlhbHMoZ2V0RGl2aXNpb25OYW1lKCksIHsgaW5wdXQ6IGZhbHNlLCBvdXRwdXQ6IHRydWUgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJidG4tY2xlYXItc3RvcmFnZVwiKSEuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNsZWFyUHVyY2hhc2VPcmRlcnMobnMpO1xuICAgICAgICAgICAgdGVzdGluZ1Rvb2xzLnNldEJvb3N0TWF0ZXJpYWxzKGdldERpdmlzaW9uTmFtZSgpLCBbMCwgMCwgMCwgMF0pO1xuICAgICAgICAgICAgdGVzdGluZ1Rvb2xzLmNsZWFyTWF0ZXJpYWxzKGdldERpdmlzaW9uTmFtZSgpLCB7IGlucHV0OiB0cnVlLCBvdXRwdXQ6IHRydWUgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4obnNDb250ZXh0OiBOUyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGV4cG9zZUdhbWVJbnRlcm5hbE9iamVjdHMoKTtcbiAgICBucyA9IG5zQ29udGV4dDtcbiAgICBuc3ggPSBuZXcgTmV0c2NyaXB0RXh0ZW5zaW9uKG5zKTtcbiAgICBuc3gua2lsbFByb2Nlc3Nlc1NwYXduRnJvbVNhbWVTY3JpcHQoKTtcblxuICAgIG5zLmRpc2FibGVMb2coXCJBTExcIik7XG4gICAgbnMuY2xlYXJMb2coKTtcbiAgICAvLyBucy50YWlsKCk7XG5cbiAgICBkb2MgPSBldmFsKFwiZG9jdW1lbnRcIik7XG4gICAgY29uc3QgaG9vazAgPSBkb2MuZ2V0RWxlbWVudEJ5SWQoXCJvdmVydmlldy1leHRyYS1ob29rLTBcIikhO1xuICAgIGNvbnN0IGhvb2sxID0gZG9jLmdldEVsZW1lbnRCeUlkKFwib3ZlcnZpZXctZXh0cmEtaG9vay0xXCIpITtcbiAgICBuc3guYWRkQXRFeGl0Q2FsbGJhY2soKCkgPT4ge1xuICAgICAgICBob29rMC5pbm5lclRleHQgPSBcIlwiO1xuICAgICAgICBob29rMS5pbm5lclRleHQgPSBcIlwiO1xuICAgICAgICByZW1vdmVUZXN0aW5nVG9vbCgpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgaGVhZGVycyA9IFtdO1xuICAgIGNvbnN0IHZhbHVlcyA9IFtdO1xuXG4gICAgaGVhZGVycy5wdXNoKFwiPGRpdj5TZXJ2ZXJMb2FkPC9kaXY+XCIpO1xuICAgIHZhbHVlcy5wdXNoKFwiPGRpdiBpZD0naHVkLXNlcnZlci1sb2FkJz4wJTwvZGl2PlwiKTtcbiAgICBpZiAobnMuc3RvY2suaGFzV1NFQWNjb3VudCgpKSB7XG4gICAgICAgIGhlYWRlcnMucHVzaChcIjxkaXY+U3RvY2tXb3J0aDwvZGl2PlwiKTtcbiAgICAgICAgdmFsdWVzLnB1c2goXCI8ZGl2IGlkPSdodWQtc3RvY2std29ydGgnPjA8L2Rpdj5cIik7XG4gICAgfVxuICAgIGlmIChucy5jb3Jwb3JhdGlvbi5oYXNDb3Jwb3JhdGlvbigpKSB7XG4gICAgICAgIGhlYWRlcnMucHVzaChcIjxkaXY+SW52ZXN0bWVudE9mZmVyPC9kaXY+XCIpO1xuICAgICAgICB2YWx1ZXMucHVzaChcIjxkaXYgaWQ9J2h1ZC1pbnZlc3RtZW50LW9mZmVyJz4wPC9kaXY+XCIpO1xuICAgICAgICBoZWFkZXJzLnB1c2goXCI8ZGl2PkNvcnBNYWludGFpbjwvZGl2PlwiKTtcbiAgICAgICAgdmFsdWVzLnB1c2goXCI8ZGl2IGlkPSdodWQtY29ycC1tYWludGFpbic+ZmFsc2U8L2Rpdj5cIik7XG4gICAgfVxuXG4gICAgaG9vazAuaW5uZXJIVE1MID0gaGVhZGVycy5qb2luKFwiXCIpO1xuICAgIGhvb2sxLmlubmVySFRNTCA9IHZhbHVlcy5qb2luKFwiXCIpO1xuXG4gICAgaWYgKGdsb2JhbFRoaXMuUGxheWVyKSB7XG4gICAgICAgIGNyZWF0ZVRlc3RpbmdUb29sKCk7XG4gICAgfVxuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFNjYW4gYWxsIHJ1bm5lcnMgYW5kIGNhbGN1bGF0ZSBzZXJ2ZXIgbG9hZFxuICAgICAgICAgICAgbGV0IHRvdGFsTWF4UkFNT2ZBbGxSdW5uZXJzID0gMDtcbiAgICAgICAgICAgIGxldCB0b3RhbFVzZWRSQU1PZkFsbFJ1bm5lcnMgPSAwO1xuICAgICAgICAgICAgbnN4LnNjYW5CRlMoXCJob21lXCIpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihob3N0ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5zLmdldFNlcnZlck1heFJhbShob3N0Lmhvc3RuYW1lKSA+IDAgJiYgbnMuaGFzUm9vdEFjY2Vzcyhob3N0Lmhvc3RuYW1lKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5mb3JFYWNoKHJ1bm5lciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsTWF4UkFNT2ZBbGxSdW5uZXJzICs9IG5zLmdldFNlcnZlck1heFJhbShydW5uZXIuaG9zdG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICB0b3RhbFVzZWRSQU1PZkFsbFJ1bm5lcnMgKz0gbnMuZ2V0U2VydmVyVXNlZFJhbShydW5uZXIuaG9zdG5hbWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiaHVkLXNlcnZlci1sb2FkXCIpIS5pbm5lclRleHQgPVxuICAgICAgICAgICAgICAgIGAkeyh0b3RhbFVzZWRSQU1PZkFsbFJ1bm5lcnMgLyB0b3RhbE1heFJBTU9mQWxsUnVubmVycyAqIDEwMCkudG9GaXhlZCgyKX0lYDtcblxuICAgICAgICAgICAgaWYgKG5zLnN0b2NrLmhhc1dTRUFjY291bnQoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGh1ZFN0b2NrV29ydGhWYWx1ZSA9IGRvYy5nZXRFbGVtZW50QnlJZChcImh1ZC1zdG9jay13b3J0aFwiKTtcbiAgICAgICAgICAgICAgICBpZiAoaHVkU3RvY2tXb3J0aFZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcnVuKG5zKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBzdG9ja1N0YXRzID0gbnN4LmNhbGN1bGF0ZVN0b2NrU3RhdHMoKTtcbiAgICAgICAgICAgICAgICBodWRTdG9ja1dvcnRoVmFsdWUuaW5uZXJUZXh0ID0gbnMuZm9ybWF0TnVtYmVyKHN0b2NrU3RhdHMuY3VycmVudFdvcnRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5zLmNvcnBvcmF0aW9uLmhhc0NvcnBvcmF0aW9uKCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBodWRJbnZlc3RtZW50T2ZmZXJWYWx1ZSA9IGRvYy5nZXRFbGVtZW50QnlJZChcImh1ZC1pbnZlc3RtZW50LW9mZmVyXCIpO1xuICAgICAgICAgICAgICAgIGlmIChodWRJbnZlc3RtZW50T2ZmZXJWYWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXJ1bihucyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaHVkSW52ZXN0bWVudE9mZmVyVmFsdWUuaW5uZXJUZXh0ID0gbnMuZm9ybWF0TnVtYmVyKG5zLmNvcnBvcmF0aW9uLmdldEludmVzdG1lbnRPZmZlcigpLmZ1bmRzKTtcblxuICAgICAgICAgICAgICAgIGxldCBpc0RhZW1vblJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBucy5wcygpLmZvckVhY2gocHJvY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLmZpbGVuYW1lICE9PSBEQUVNT05fU0NSSVBUX05BTUUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5hcmdzLmluY2x1ZGVzKFwiLS1tYWludGFpbkNvcnBvcmF0aW9uXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc0RhZW1vblJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZG9jLmdldEVsZW1lbnRCeUlkKFwiaHVkLWNvcnAtbWFpbnRhaW5cIikhLmlubmVyVGV4dCA9IGAke2lzRGFlbW9uUnVubmluZ31gO1xuXG4gICAgICAgICAgICAgICAgLy8gVGVzdGluZyB0b29sc1xuICAgICAgICAgICAgICAgIGlmIChydW5Db3JwTWFpbnRhaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5zLmV4ZWMoXCJkYWVtb24uanNcIiwgXCJob21lXCIsIDEsIFwiLS1tYWludGFpbkNvcnBvcmF0aW9uXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBucy50b2FzdChcIkZhaWxlZCB0byBydW4gZGFlbW9uLmpzIC0tbWFpbnRhaW5Db3Jwb3JhdGlvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBydW5Db3JwTWFpbnRhaW4gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJ1bkRlbFNjcmlwdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbnMua2lsbGFsbChcImhvbWVcIiwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChucy5leGVjKFwidG9vbHMuanNcIiwgXCJob21lXCIsIDEsIFwiLS1kZWxldGVBbGxTY3JpcHRzXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBucy50b2FzdChcIkZhaWxlZCB0byBydW4gdG9vbHMuanMgLS1kZWxldGVBbGxTY3JpcHRzXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJ1bkRlbFNjcmlwdHMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlbG9hZCkge1xuICAgICAgICAgICAgICAgICAgICByZXJ1bihucyk7XG4gICAgICAgICAgICAgICAgICAgIHJlbG9hZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocnVuQ29ycFJvdW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIChucy5leGVjKFwiY29ycG9yYXRpb24uanNcIiwgXCJob21lXCIsIDEsIFwiLS1yb3VuZDFcIiwgXCItLWJlbmNobWFya1wiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyAgICAgbnMudG9hc3QoXCJGYWlsZWQgdG8gcnVuIGNvcnBvcmF0aW9uLmpzIC0tcm91bmQxIC0tYmVuY2htYXJrXCIpO1xuICAgICAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIChucy5leGVjKFwiY29ycG9yYXRpb24uanNcIiwgXCJob21lXCIsIDEsIFwiLS1yb3VuZDJcIiwgXCItLWJlbmNobWFya1wiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyAgICAgbnMudG9hc3QoXCJGYWlsZWQgdG8gcnVuIGNvcnBvcmF0aW9uLmpzIC0tcm91bmQyIC0tYmVuY2htYXJrXCIpO1xuICAgICAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIChucy5leGVjKFwiY29ycG9yYXRpb24uanNcIiwgXCJob21lXCIsIDEsIFwiLS1yb3VuZDNcIiwgXCItLWJlbmNobWFya1wiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyAgICAgbnMudG9hc3QoXCJGYWlsZWQgdG8gcnVuIGNvcnBvcmF0aW9uLmpzIC0tcm91bmQzIC0tYmVuY2htYXJrXCIpO1xuICAgICAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghaGFzRGl2aXNpb24obnMsIERpdmlzaW9uTmFtZS5DSEVNSUNBTCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChucy5leGVjKFwiY29ycG9yYXRpb24uanNcIiwgXCJob21lXCIsIDEsIFwiLS1yb3VuZDJcIiwgXCItLWJlbmNobWFya1wiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5zLnRvYXN0KFwiRmFpbGVkIHRvIHJ1biBjb3Jwb3JhdGlvbi5qcyAtLXJvdW5kMiAtLWJlbmNobWFya1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghaGFzRGl2aXNpb24obnMsIERpdmlzaW9uTmFtZS5UT0JBQ0NPKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5zLmV4ZWMoXCJjb3Jwb3JhdGlvbi5qc1wiLCBcImhvbWVcIiwgMSwgXCItLXJvdW5kM1wiLCBcIi0tYmVuY2htYXJrXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnMudG9hc3QoXCJGYWlsZWQgdG8gcnVuIGNvcnBvcmF0aW9uLmpzIC0tcm91bmQzIC0tYmVuY2htYXJrXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5zLmV4ZWMoXCJjb3Jwb3JhdGlvbi5qc1wiLCBcImhvbWVcIiwgMSwgXCItLWltcHJvdmVBbGxEaXZpc2lvbnNcIiwgXCItLWJlbmNobWFya1wiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5zLnRvYXN0KFwiRmFpbGVkIHRvIHJ1biBjb3Jwb3JhdGlvbi5qcyAtLWltcHJvdmVBbGxEaXZpc2lvbnMgLS1iZW5jaG1hcmtcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcnVuQ29ycFJvdW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChydW5Db3JwVGVzdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobnMuZXhlYyhcImNvcnBvcmF0aW9uLmpzXCIsIFwiaG9tZVwiLCAxLCBcIi0tdGVzdFwiLCBcIi0tYmVuY2htYXJrXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBucy50b2FzdChcIkZhaWxlZCB0byBydW4gY29ycG9yYXRpb24uanMgLS10ZXN0IC0tYmVuY2htYXJrXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJ1bkNvcnBUZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAocnVuQ29ycFJvdW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChucy5leGVjKFwiY29ycG9yYXRpb24uanNcIiwgXCJob21lXCIsIDEsIFwiLS1yb3VuZDFcIiwgXCItLWJlbmNobWFya1wiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbnMudG9hc3QoXCJGYWlsZWQgdG8gcnVuIGNvcnBvcmF0aW9uLmpzIC0tcm91bmQxIC0tYmVuY2htYXJrXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG5zLnNsZWVwKDEwMDApO1xuICAgICAgICAgICAgICAgICAgICBucy5leGVjKFwiZGFlbW9uLmpzXCIsIFwiaG9tZVwiLCAxLCBcIi0tbWFpbnRhaW5Db3Jwb3JhdGlvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgdGVzdGluZ1Rvb2xzLnNldFVubGltaXRlZEJvbnVzVGltZSgpO1xuICAgICAgICAgICAgICAgICAgICBydW5Db3JwUm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGV4OiB1bmtub3duKSB7XG4gICAgICAgICAgICBucy5wcmludChgSFVEIGVycm9yOiAke0pTT04uc3RyaW5naWZ5KGV4KX1gKTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBucy5hc2xlZXAoMTAwMCk7XG4gICAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBQ0EsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxxQkFBcUIsY0FBYyxtQkFBbUI7QUFDL0QsWUFBWSxrQkFBa0I7QUFDOUIsU0FBUyxpQ0FBaUM7QUFFMUMsSUFBSTtBQUNKLElBQUk7QUFDSixJQUFJO0FBRUosTUFBTSxxQkFBcUI7QUFDM0IsSUFBSSxrQkFBa0I7QUFDdEIsSUFBSSxnQkFBZ0I7QUFDcEIsSUFBSSxTQUFTO0FBQ2Is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
