import { assertIsNumber } from "./libs/utils";
import { SHARE_SCRIPT_NAME } from "./libs/constants";
import { NetscriptExtension } from "./libs/NetscriptExtension";
let nsx;
async function main(ns) {
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    const threads = ns.args[0];
    assertIsNumber(threads, "Invalid number of threads");
    while (true) {
        nsx.runScriptOnAvailablePrivateRunners(true, true, true, SHARE_SCRIPT_NAME, threads);
        await ns.sleep(1e4);
    }
}
export { main };
