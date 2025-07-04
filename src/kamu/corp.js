import { NS } from "@ns";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("disableLog");
    ns.disableLog("sleep");

    if (!ns.getPlayer().hasCorporation) {
        ns.corporation.createCorporation("MyCorp", false);
    }
    var corp = ns.corporation.getCorporation();
    if (corp.divisions.length < 1) {
        // initial Company setup
        ns.corporation.expandIndustry("Tobacco", "Tobacco");
        corp = ns.corporation.getCorporation();
        initialCorpUpgrade(ns);
        const tobaccoDivision = ns.corporation.getDivision("Tobacco");
        initCities(ns, tobaccoDivision);
    }

    while (true) {
        corp = ns.corporation.getCorporation();

        // Debug logging
        ns.print("Corporation divisions: " + JSON.stringify(corp.divisions));

        for (const division of corp.divisions.map((division) => ns.corporation.getDivision(division)).reverse()) {
            // Safety check
            if (!division || !division.name) {
                ns.print("ERROR: Invalid division object: " + JSON.stringify(division));
                continue;
            }

            ns.print("Processing division: " + division.name);

            // Debug: Check division state
            ns.print("Division " + division.name + " cities: " + JSON.stringify(division.cities));
            ns.print("Division " + division.name + " products: " + JSON.stringify(division.products));

            // Check if division has basic setup in Sector-12 (minimum requirement)
            if (!division.cities.includes("Sector-12")) {
                ns.print("Division " + division.name + " not expanded to Sector-12, expanding...");
                try {
                    // Only expand to Sector-12 first, not all cities
                    ns.corporation.expandCity(division.name, "Sector-12");
                    ns.corporation.purchaseWarehouse(division.name, "Sector-12");
                    ns.print("Successfully expanded " + division.name + " to Sector-12");
                } catch (error) {
                    ns.print("Cannot expand to Sector-12: " + error.message);
                    continue; // Skip this division if we can't even expand to the main city
                }
            }

            // Check if office actually exists even if city is listed
            try {
                const office = ns.corporation.getOffice(division.name, "Sector-12");
                ns.print(
                    "Office found for " + division.name + " in Sector-12 with " + office.numEmployees + " employees",
                );
            } catch (error) {
                ns.print("Office missing for " + division.name + " in Sector-12");
                ns.print("WARNING: City is expanded but office doesn't exist");
                ns.print("This can happen during corporation initialization");
                ns.print("Continuing with limited operations (no employee management)");
                ns.print("Current corporation funds: " + ns.formatNumber(ns.corporation.getCorporation().funds, 1));
                ns.print("Existing products should continue generating revenue");
                // Continue with the cycle but skip employee-related operations
            }

            upgradeWarehouses(ns, division);
            upgradeCorp(ns);
            hireEmployees(ns, division);
            newProduct(ns, division);
            doResearch(ns, division);
        }
        if (corp.divisions.length < 2 && corp.numShares == corp.totalShares) {
            const firstDivision = ns.corporation.getDivision(corp.divisions[0]);
            if (firstDivision.products.length > 2) {
                trickInvest(ns, firstDivision);
            }
        }
        await ns.sleep(5000);
    }
}

/**
 * @param {NS} ns
 * @param {import("@ns").Division} division
 * @param {string} productCity
 */
function hireEmployees(ns, division, productCity = "Sector-12") {
    // Check if division exists in product city
    if (!division.cities.includes(productCity)) {
        ns.print("Division " + division.name + " not expanded to " + productCity + " yet");
        return;
    }

    // Get initial employee count safely
    let employees = ns.corporation.getOffice(division.name, productCity).numEmployees;

    // Upgrade offices and hire employees
    while (
        ns.corporation.getCorporation().funds >
        cities.length * ns.corporation.getOfficeSizeUpgradeCost(division.name, productCity, 3)
    ) {
        // upgrade all cities + 3 employees if sufficient funds
        ns.print(division.name + " Upgrade office size");
        for (const city of cities) {
            // Only upgrade offices in cities where division exists
            if (division.cities.includes(city)) {
                ns.corporation.upgradeOfficeSize(division.name, city, 3);
                for (var i = 0; i < 3; i++) {
                    ns.corporation.hireEmployee(division.name, city);
                }
            }
        }
    }

    const newEmployeeCount = ns.corporation.getOffice(division.name, productCity).numEmployees;
    if (newEmployeeCount > employees) {
        // set jobs after hiring people just in case we hire lots of people at once and setting jobs is slow
        for (const city of cities) {
            // Only set jobs in cities where division exists
            if (!division.cities.includes(city)) {
                continue;
            }

            let cityEmployees = 0;
            try {
                cityEmployees = ns.corporation.getOffice(division.name, city).numEmployees;
            } catch (error) {
                ns.print("No office found for " + division.name + " in " + city);
                continue;
            }

            if (ns.corporation.hasResearched(division.name, "Market-TA.II")) {
                // TODO: Simplify here. ProductCity config can always be used
                if (city == productCity) {
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Operations",
                        Math.ceil(cityEmployees / 5),
                    );
                    ns.corporation.setAutoJobAssignment(division.name, city, "Engineer", Math.ceil(cityEmployees / 5));
                    ns.corporation.setAutoJobAssignment(division.name, city, "Business", Math.ceil(cityEmployees / 5));
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Management",
                        Math.ceil(cityEmployees / 10),
                    );
                    var remainingEmployees =
                        cityEmployees - (3 * Math.ceil(cityEmployees / 5) + Math.ceil(cityEmployees / 10));
                    ns.corporation.setAutoJobAssignment(division.name, city, "Training", Math.ceil(remainingEmployees));
                } else {
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Operations",
                        Math.floor(cityEmployees / 10),
                    );
                    ns.corporation.setAutoJobAssignment(division.name, city, "Engineer", 1);
                    ns.corporation.setAutoJobAssignment(division.name, city, "Business", Math.floor(cityEmployees / 5));
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Management",
                        Math.ceil(cityEmployees / 100),
                    );
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Research & Development",
                        Math.ceil(cityEmployees / 2),
                    );
                    var remainingEmployees =
                        cityEmployees -
                        (Math.floor(cityEmployees / 5) +
                            Math.floor(cityEmployees / 10) +
                            1 +
                            Math.ceil(cityEmployees / 100) +
                            Math.ceil(cityEmployees / 2));
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Training",
                        Math.floor(remainingEmployees),
                    );
                }
            } else {
                if (city == productCity) {
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Operations",
                        Math.floor((cityEmployees - 2) / 2),
                    );
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Engineer",
                        Math.ceil((cityEmployees - 2) / 2),
                    );
                    ns.corporation.setAutoJobAssignment(division.name, city, "Management", 2);
                } else {
                    ns.corporation.setAutoJobAssignment(division.name, city, "Operations", 1);
                    ns.corporation.setAutoJobAssignment(division.name, city, "Engineer", 1);
                    ns.corporation.setAutoJobAssignment(
                        division.name,
                        city,
                        "Research & Development",
                        cityEmployees - 2,
                    );
                }
            }
        }
    }
}

/**
 * @param {NS} ns
 * @param {import("@ns").Division} division
 */
function upgradeWarehouses(ns, division) {
    for (const city of cities) {
        // check if warehouses are near max capacity and upgrade if needed
        // First check if the division has a warehouse in this city
        if (!division.cities.includes(city)) {
            continue; // Skip cities where division doesn't exist
        }

        var cityWarehouse = ns.corporation.getWarehouse(division.name, city);
        if (cityWarehouse.sizeUsed > 0.9 * cityWarehouse.size) {
            if (ns.corporation.getCorporation().funds > ns.corporation.getUpgradeWarehouseCost(division.name, city)) {
                ns.print(division.name + " Upgrade warehouse in " + city);
                ns.corporation.upgradeWarehouse(division.name, city);
            }
        }
    }
    if (ns.corporation.getUpgradeLevel("Wilson Analytics") > 20) {
        // Upgrade AdVert.Inc after a certain amount of Wilson Analytivs upgrades are available
        if (ns.corporation.getCorporation().funds > 4 * ns.corporation.getHireAdVertCost(division.name)) {
            ns.print(division.name + " Hire AdVert");
            ns.corporation.hireAdVert(division.name);
        }
    }
}

/**
 * @param {NS} ns
 */
function upgradeCorp(ns) {
    for (const upgrade of upgradeList) {
        // purchase upgrades based on available funds and priority; see upgradeList
        if (ns.corporation.getCorporation().funds > upgrade.prio * ns.corporation.getUpgradeLevelCost(upgrade.name)) {
            // those two upgrades ony make sense later once we can afford a bunch of them and already have some base marketing from DreamSense
            if (
                (upgrade.name != "ABC SalesBots" && upgrade.name != "Wilson Analytics") ||
                ns.corporation.getUpgradeLevel("DreamSense") > 20
            ) {
                ns.print("Upgrade " + upgrade.name + " to " + (ns.corporation.getUpgradeLevel(upgrade.name) + 1));
                ns.corporation.levelUpgrade(upgrade.name);
            }
        }
    }
    if (
        !ns.corporation.hasUnlock("Shady Accounting") &&
        ns.corporation.getUnlockCost("Shady Accounting") * 2 < ns.corporation.getCorporation().funds
    ) {
        ns.print("Unlock Shady Accounting");
        ns.corporation.purchaseUnlock("Shady Accounting");
    } else if (
        !ns.corporation.hasUnlock("Government Partnership") &&
        ns.corporation.getUnlockCost("Government Partnership") * 2 < ns.corporation.getCorporation().funds
    ) {
        ns.print("Unlock Government Partnership");
        ns.corporation.purchaseUnlock("Government Partnership");
    }
}

/**
 * @param {NS} ns
 * @param {import("@ns").Division} division
 */
async function trickInvest(ns, division, productCity = "Sector-12") {
    ns.print("Prepare to trick investors");
    for (var product of division.products) {
        // stop selling products
        ns.corporation.sellProduct(division.name, productCity, product, "0", "MP", true);
    }

    for (const city of cities) {
        // put all employees into production to produce as fast as possible
        const employees = ns.corporation.getOffice(division.name, city).numEmployees;

        ns.corporation.setAutoJobAssignment(division.name, city, "Engineer", 0);
        ns.corporation.setAutoJobAssignment(division.name, city, "Management", 0);
        ns.corporation.setAutoJobAssignment(division.name, city, "Research & Development", 0);
        ns.corporation.setAutoJobAssignment(division.name, city, "Operations", employees - 2); // workaround for bug
        ns.corporation.setAutoJobAssignment(division.name, city, "Operations", employees - 1); // workaround for bug
        ns.corporation.setAutoJobAssignment(division.name, city, "Operations", employees);
    }

    ns.print("Wait for warehouses to fill up");
    //ns.print("Warehouse usage: " + refWarehouse.sizeUsed + " of " + refWarehouse.size);
    let allWarehousesFull = false;
    while (!allWarehousesFull) {
        allWarehousesFull = true;
        for (const city of cities) {
            if (
                ns.corporation.getWarehouse(division.name, city).sizeUsed <=
                0.98 * ns.corporation.getWarehouse(division.name, city).size
            ) {
                allWarehousesFull = false;
                break;
            }
        }
        await ns.sleep(5000);
    }
    ns.print("Warehouses are full, start selling");

    var initialInvestFunds = ns.corporation.getInvestmentOffer().funds;
    ns.print("Initial investmant offer: " + ns.nFormat(initialInvestFunds, "0.0a"));
    for (const city of cities) {
        // put all employees into business to sell as much as possible
        const employees = ns.corporation.getOffice(division.name, city).numEmployees;
        ns.corporation.setAutoJobAssignment(division.name, city, "Operations", 0);
        ns.corporation.setAutoJobAssignment(division.name, city, "Business", employees - 2); // workaround for bug
        ns.corporation.setAutoJobAssignment(division.name, city, "Business", employees - 1); // workaround for bug
        ns.corporation.setAutoJobAssignment(division.name, city, "Business", employees);
    }
    for (var product of division.products) {
        // sell products again
        ns.corporation.sellProduct(division.name, productCity, product, "MAX", "MP", true);
    }

    while (ns.corporation.getInvestmentOffer().funds < 4 * initialInvestFunds) {
        // wait until the stored products are sold, which should lead to huge investment offers
        await ns.sleep(200);
    }

    ns.print("Investment offer for 10% shares: " + ns.nFormat(ns.corporation.getInvestmentOffer().funds, "0.0a"));
    ns.print("Funds before public: " + ns.nFormat(ns.corporation.getCorporation().funds, "0.0a"));

    ns.corporation.goPublic(800e6);

    ns.print("Funds after  public: " + ns.nFormat(ns.corporation.getCorporation().funds, "0.0a"));

    for (const city of cities) {
        // set employees back to normal operation
        const employees = ns.corporation.getOffice(division.name, city).numEmployees;
        ns.corporation.setAutoJobAssignment(division.name, city, "Business", 0);
        if (city == productCity) {
            ns.corporation.setAutoJobAssignment(division.name, city, "Operations", 1);
            ns.corporation.setAutoJobAssignment(division.name, city, "Engineer", employees - 2);
            ns.corporation.setAutoJobAssignment(division.name, city, "Management", 1);
        } else {
            ns.corporation.setAutoJobAssignment(division.name, city, "Operations", 1);
            ns.corporation.setAutoJobAssignment(division.name, city, "Research & Development", employees - 1);
        }
    }

    // with gained money, expand to the most profitable division
    ns.corporation.expandIndustry("Healthcare", "Healthcare");
    const healthcareDivision = ns.corporation.getDivision("Healthcare");
    initCities(ns, healthcareDivision);
}

/**
 * @param {NS} ns
 */
function doResearch(ns, division) {
    const laboratory = "Hi-Tech R&D Laboratory";
    const marketTAI = "Market-TA.I";
    const marketTAII = "Market-TA.II";
    if (!ns.corporation.hasResearched(division.name, laboratory)) {
        // always research labaratory first
        if (division.research > ns.corporation.getResearchCost(division.name, laboratory)) {
            ns.print(division.name + " Research " + laboratory);
            ns.corporation.research(division.name, laboratory);
        }
    } else if (!ns.corporation.hasResearched(division.name, marketTAII)) {
        // always research Market-TA.I plus .II first and in one step
        var researchCost =
            ns.corporation.getResearchCost(division.name, marketTAI) +
            ns.corporation.getResearchCost(division.name, marketTAII);

        if (division.research > researchCost * 1.1) {
            ns.print(division.name + " Research " + marketTAI);
            ns.corporation.research(division.name, marketTAI);
            ns.print(division.name + " Research " + marketTAII);
            ns.corporation.research(division.name, marketTAII);
            for (var product of division.products) {
                ns.corporation.setProductMarketTA1(division.name, product, true);
                ns.corporation.setProductMarketTA2(division.name, product, true);
            }
        }
        return;
    } else {
        for (const researchObject of researchList) {
            // research other upgrades based on available funds and priority; see researchList
            if (!ns.corporation.hasResearched(division.name, researchObject.name)) {
                if (
                    division.research >
                    researchObject.prio * ns.corporation.getResearchCost(division.name, researchObject.name)
                ) {
                    ns.print(division.name + " Research " + researchObject.name);
                    ns.corporation.research(division.name, researchObject.name);
                }
            }
        }
    }
}

/**
 * @param {NS} ns
 * @param {import("@ns").Division} division
 */
function newProduct(ns, division) {
    //ns.print("Products: " + division.products);
    var productNumbers = [];

    for (var product of division.products) {
        const productData = ns.corporation.getProduct(division.name, "Sector-12", product);
        if (productData.developmentProgress < 100) {
            ns.print(
                division.name + " Product development progress: " + productData.developmentProgress.toFixed(1) + "%",
            );
            return false;
        } else {
            productNumbers.push(product.charAt(product.length - 1));
            ns.print(
                "Product " + product + " is ready to sell with desired sell price " + productData.desiredSellPrice,
            );
            // initial sell value if nothing is defined yet is 0
            if (productData.desiredSellPrice == 0) {
                ns.print(division.name + " Start selling product " + product);
                ns.corporation.sellProduct(division.name, "Sector-12", product, "MAX", "MP", true);
                if (ns.corporation.hasResearched(division.name, "Market-TA.II")) {
                    ns.corporation.setProductMarketTA1(division.name, product, true);
                    ns.corporation.setProductMarketTA2(division.name, product, true);
                }
            }
        }
    }

    var numProducts = 3;
    // amount of products which can be sold in parallel is 3; can be upgraded
    if (ns.corporation.hasResearched(division.name, "uPgrade: Capacity.I")) {
        numProducts++;
        if (ns.corporation.hasResearched(division.name, "uPgrade: Capacity.II")) {
            numProducts++;
        }
    }

    if (division.products.length >= numProducts) {
        // discontinue the oldest product if at max amount of products
        const oldestProduct = division.products[0];
        ns.print(division.name + " Discontinue product " + oldestProduct);

        ns.corporation.discontinueProduct(division.name, oldestProduct);
    }

    // get the product number of the latest product and increase it by 1 for the next product. Product names must be unique.
    var newProductNumber = 0;
    if (productNumbers.length > 0) {
        newProductNumber = parseInt(productNumbers[productNumbers.length - 1]) + 1;
        // cap product numbers to one digit and restart at 0 if > 9.
        if (newProductNumber > 9) {
            newProductNumber = 0;
        }
    }
    const newProductName = "Product-" + newProductNumber;
    var productInvest = 1e9;
    if (ns.corporation.getCorporation().funds < 2 * productInvest) {
        if (ns.corporation.getCorporation().funds <= 0) {
            ns.print(
                "WARN negative funds, cannot start new product development " +
                    ns.formatNumber(ns.corporation.getCorporation().funds, 1),
            );
            return;
        } else {
            productInvest = Math.floor(ns.corporation.getCorporation().funds / 2);
        }
    }
    ns.print("Start new product development " + newProductName);
    ns.corporation.makeProduct(division.name, "Sector-12", newProductName, productInvest, productInvest);
}

/**
 * @param {NS} ns
 * @param {import("@ns").Division} division
 */
function initCities(ns, division, productCity = "Sector-12") {
    const availableFunds = ns.corporation.getCorporation().funds;
    const estimatedCostPerCity = 4e9; // Approximately 4 billion per city

    for (const city of cities) {
        if (!division.cities.includes(city)) {
            // Check if we have enough funds before attempting expansion
            if (availableFunds < estimatedCostPerCity) {
                continue;
            }

            ns.print("Expand " + division.name + " to City " + city);
            ns.corporation.expandCity(division.name, city);
            ns.corporation.purchaseWarehouse(division.name, city);
            ns.print("Successfully expanded " + division.name + " to " + city);
        }

        //ns.corporation.setSmartSupply(division.name, city, true); // does not work anymore, bug?

        if (city != productCity) {
            // setup employees
            for (let i = 0; i < 3; i++) {
                ns.corporation.hireEmployee(division.name, city);
            }
            ns.corporation.setAutoJobAssignment(division.name, city, "Research & Development", 3);
        } else {
            const warehouseUpgrades = 3;
            // get a bigger warehouse in the product city. we can produce and sell more here
            for (let i = 0; i < warehouseUpgrades; i++) {
                ns.corporation.upgradeWarehouse(division.name, city);
            }
            // get more employees in the main product development city
            const newEmployees = 9;
            ns.corporation.upgradeOfficeSize(division.name, productCity, newEmployees);
            for (let i = 0; i < newEmployees + 3; i++) {
                ns.corporation.hireEmployee(division.name, productCity);
            }
            ns.corporation.setAutoJobAssignment(division.name, productCity, "Operations", 4);
            ns.corporation.setAutoJobAssignment(division.name, productCity, "Engineer", 6);
            ns.corporation.setAutoJobAssignment(division.name, productCity, "Management", 2);
        }
        const warehouseUpgrades = 3;
        for (let i = 0; i < warehouseUpgrades; i++) {
            ns.corporation.upgradeWarehouse(division.name, city);
        }
    }

    ns.corporation.makeProduct(division.name, productCity, "Product-0", "1e9", "1e9");
}

/**
 * @param {NS} ns
 */
function initialCorpUpgrade(ns) {
    ns.print("unlock upgrades");
    ns.corporation.purchaseUnlock("Smart Supply");
    ns.corporation.levelUpgrade("Smart Storage");
    ns.corporation.levelUpgrade("Smart Storage");
    ns.corporation.levelUpgrade("Smart Storage");
    ns.corporation.levelUpgrade("Smart Storage");
    ns.corporation.levelUpgrade("DreamSense");
    // upgrade employee stats
    ns.corporation.levelUpgrade("Nuoptimal Nootropic Injector Implants");
    ns.corporation.levelUpgrade("Speech Processor Implants");
    ns.corporation.levelUpgrade("Neural Accelerators");
    ns.corporation.levelUpgrade("FocusWires");
}

const cities = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

const upgradeList = [
    // lower priority value -> upgrade faster
    { prio: 2, name: "Project Insight" },
    { prio: 2, name: "DreamSense" },
    { prio: 4, name: "ABC SalesBots" },
    { prio: 4, name: "Smart Factories" },
    { prio: 4, name: "Smart Storage" },
    { prio: 8, name: "Neural Accelerators" },
    { prio: 8, name: "Nuoptimal Nootropic Injector Implants" },
    { prio: 8, name: "FocusWires" },
    { prio: 8, name: "Speech Processor Implants" },
    { prio: 8, name: "Wilson Analytics" },
];

const researchList = [
    // lower priority value -> upgrade faster
    { prio: 10, name: "Overclock" },
    { prio: 10, name: "uPgrade: Fulcrum" },
    { prio: 3, name: "uPgrade: Capacity.I" },
    { prio: 4, name: "uPgrade: Capacity.II" },
    { prio: 10, name: "Self-Correcting Assemblers" },
    { prio: 21, name: "Drones" },
    { prio: 4, name: "Drones - Assembly" },
    { prio: 10, name: "Drones - Transport" },
    { prio: 26, name: "Automatic Drug Administration" },
    { prio: 10, name: "CPH4 Injections" },
];
