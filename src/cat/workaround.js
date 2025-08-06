let originalRevokeObjectURLFunction = null;
function disableURLRevokeObjectURL() {
  if (originalRevokeObjectURLFunction === null) {
    originalRevokeObjectURLFunction = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => {
      console.log(`Url ${url} has been requested to be revoked. This request has been cancelled.`);
    };
    console.log("URL.revokeObjectURL has been disabled");
  }
}
function enableURLRevokeObjectURL() {
  if (originalRevokeObjectURLFunction === null) {
    throw new Error("URL.revokeObjectURL has not been disabled");
  }
  URL.revokeObjectURL = originalRevokeObjectURLFunction;
  originalRevokeObjectURLFunction = null;
  console.log("URL.revokeObjectURL has been enabled");
}
function autocomplete(data, flags) {
  return ["--runHUDAndDaemon"];
}
function main(ns) {
  disableURLRevokeObjectURL();
  const config = ns.flags([
    ["runHUDAndDaemon", false]
  ]);
  if (config.runHUDAndDaemon) {
    ns.run("customHUD.js");
    ns.run("daemon.js", 1, "--maintainCorporation");
  }
}
export {
  autocomplete,
  disableURLRevokeObjectURL,
  enableURLRevokeObjectURL,
  main
};
