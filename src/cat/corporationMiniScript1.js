function autocomplete(data, flags) {
  return ["--divisionName", "Agriculture"];
}
var CityName = /* @__PURE__ */ ((CityName2) => {
  CityName2["Aevum"] = "Aevum";
  CityName2["Chongqing"] = "Chongqing";
  CityName2["Sector12"] = "Sector-12";
  CityName2["NewTokyo"] = "New Tokyo";
  CityName2["Ishima"] = "Ishima";
  CityName2["Volhaven"] = "Volhaven";
  return CityName2;
})(CityName || {});
const cities = [
  "Sector-12" /* Sector12 */,
  "Aevum" /* Aevum */,
  "Chongqing" /* Chongqing */,
  "New Tokyo" /* NewTokyo */,
  "Ishima" /* Ishima */,
  "Volhaven" /* Volhaven */
];
const defaultConfig = [
  ["divisionName", "Agriculture"]
];
async function main(ns) {
  const config = ns.flags(defaultConfig);
  const divisionName = config.divisionName;
  while (true) {
    let finish = true;
    for (const city of cities) {
      const office = ns.corporation.getOffice(divisionName, city);
      if (office.avgEnergy < office.maxEnergy - 0.5) {
        ns.corporation.buyTea(divisionName, city);
        finish = false;
      }
      if (office.avgMorale < office.maxMorale - 0.5) {
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
export {
  autocomplete,
  main
};
