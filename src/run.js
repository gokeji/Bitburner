import { NS } from "@ns";

export function autocomplete(data, args) {
    // Use data.scripts to get all scripts on the current server
    // Extract just the filenames for autocomplete
    const scriptFilenames = data.scripts
        .filter((script) => script.endsWith(".js"))
        .map((script) => script.split("/").pop())
        .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates
        .sort();

    return scriptFilenames;
}

/** @param {NS} ns **/
export async function main(ns) {
    if (ns.args.length === 0) {
        ns.tprint("ERROR: Please specify a script name to run.");
        ns.tprint("Usage: run run.js <scriptname> [additional args...]");
        ns.tprint("Available scripts:");

        // Create script mapping and show available scripts
        const scriptMap = createScriptMap(ns);
        Object.keys(scriptMap)
            .sort()
            .forEach((scriptName) => {
                ns.tprint(`  ${scriptName} (${scriptMap[scriptName]})`);
            });
        return;
    }

    // Get the script name (first argument)
    let scriptName = ns.args[0];
    ns.tprint(`Args: ${ns.args}`);

    // Add .js extension if not present
    if (!scriptName.endsWith(".js")) {
        scriptName += ".js";
    }

    // Remaining arguments are passed to the script
    const remainingArgs = ns.args.slice(1);

    // Create mapping from script names to full paths
    const scriptMap = createScriptMap(ns);

    if (!scriptMap[scriptName]) {
        ns.tprint(`ERROR: Script "${scriptName}" not found.`);
        ns.tprint("Available scripts:");
        Object.keys(scriptMap)
            .sort()
            .forEach((name) => {
                ns.tprint(`  ${name} (${scriptMap[name]})`);
            });
        return;
    }

    // Get the full path
    const fullPath = scriptMap[scriptName];

    // Run the script with provided arguments
    ns.tprint(`Running ${scriptName} from ${fullPath}...`);

    try {
        const pid = ns.exec(fullPath, "home", 1, ...remainingArgs);
        if (pid === 0) {
            ns.tprint(`ERROR: Failed to run ${fullPath}. Check if the script exists and has no syntax errors.`);
        } else {
            ns.tprint(`Successfully started ${scriptName} with PID ${pid}`);
        }
    } catch (error) {
        ns.tprint(`ERROR: Failed to run ${fullPath}: ${error.message}`);
    }
}

function createScriptMap(ns) {
    const scriptMap = {};

    try {
        // Get all scripts on the current server
        const allScripts = ns.ls("home", "/").filter((file) => file.endsWith(".js"));

        // Create mapping from filename to full path
        allScripts.forEach((scriptPath) => {
            const filename = scriptPath.split("/").pop();
            if (filename) {
                // If there's a duplicate filename, prefer the one in the scripts folder
                // or keep the first one found if neither is in scripts folder
                if (!scriptMap[filename] || scriptPath.includes("/scripts/")) {
                    scriptMap[filename] = scriptPath;
                }
            }
        });
    } catch (error) {
        ns.tprint(`ERROR: Failed to scan for scripts: ${error.message}`);
    }

    return scriptMap;
}
