import { log, getConfiguration, getNsDataThroughFile, getErrorInfo, tail } from "../helpers.js";

let doc = eval("document");
let options;
const argsSchema = [
    ["click-sleep-time", 5], // Time to sleep in milliseconds before and after clicking any button
    // ["find-sleep-time", 0], // Time to sleep in milliseconds before trying to find any element on screen
    ["enable-logging", false], // Set to true to pop up a tail window and generate logs
    ["roulette-script", "scripts/roulette.js"], // Path to the roulette script to run
];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    const lastFlag = args.length > 1 ? args[args.length - 2] : null;
    if (["--roulette-script"].includes(lastFlag)) return data.scripts;
    return [];
}

let verbose = false;

/** @param {NS} ns **/
export async function main(ns) {
    options = getConfiguration(ns, argsSchema);
    if (!options) return; // Invalid options, or ran in --help mode.
    verbose = options["enable-logging"];
    if (verbose) tail(ns);
    else ns.disableLog("ALL");

    /** Helper function to detect if focus was stolen by (e.g.) faction|company work|studying|training and send that work to the background */
    async function checkForStolenFocus(throwError = true, retries = 0, silent = false) {
        const btnUnfocus = await tryfindElement(ns, "//button[text()='Do something else simultaneously']");
        if (!btnUnfocus) return false; // All good, we aren't focus-working on anything
        let baseMessage =
            "It looks like something stole focus while roulette-navigator.js was trying to navigate to the casino.";
        if (throwError) throw new Error(baseMessage + `\nPlease ensure no other scripts are running and try again.`);
        log(
            ns,
            (silent ? `INFO` : `WARNING`) + `: ${baseMessage}\nTrying to un-focus it so we can keep going...`,
            false,
            silent ? undefined : `WARNING`,
        );
        await click(ns, btnUnfocus); // Click the button that should let us take back focus and return to the casino
        retries--; // Decrement "retries" each time we discover we're still on the focus screen.
        return await checkStillAtCasino(retries <= 0, retries); // If out of retries, throw error on next failure
    }

    /** Helper function to detect if we're still at the casino */
    async function checkStillAtCasino(throwError = true, silent = false) {
        let stillAtCasino = await tryfindElement(ns, "//h4[text()='Iker Molina Casino']", silent ? 3 : 10);
        if (stillAtCasino) return true; // All seems good, nothing is stealing focus
        const focusWasStolen = await checkForStolenFocus(throwError, silent ? 3 : 1);
        if (focusWasStolen || silent) return false; // Do not log a warning
        let baseMessage =
            "It looks like the user (or another script) navigated away from the casino page" +
            " while roulette-navigator.js was trying to navigate to the casino.";
        if (throwError)
            throw new Error(
                baseMessage +
                    `\nPlease ensure no other scripts are running and try again ` +
                    `(or ignore this error if you left the casino on purpose.)`,
            );
        log(ns, `WARNING: ${baseMessage}`, false, "warning");
        return false;
    }

    // Step 1: Start the roulette script first
    const rouletteScript = options["roulette-script"];
    if (ns.run(rouletteScript)) {
        log(ns, `INFO: Started ${rouletteScript} before navigation...`, true, "info");
    } else {
        log(ns, `WARNING: Failed to start ${rouletteScript}...`, true, "warning");
        return;
    }

    // Step 2: Navigate to the roulette game (with retries in case of transient errors)
    let priorAttempts = 0;
    while (true) {
        if (priorAttempts > 0) await ns.sleep(1000);
        try {
            // Step 2.1: Check if the player is focused, and stop whatever they're doing.
            await checkForStolenFocus(
                false, // throwError: false - because we have yet to travel to the casino
                3,
                true,
            ); // silent: true - means don't raise a warning if we're focus-working. Just background it.

            // Step 2.2: Go to Aevum if we aren't already there.
            if (ns.getPlayer().city != "Aevum") {
                if (ns.getPlayer().money < 200000)
                    throw new Error("Sorry, you need at least 200k to travel to the casino.");
                let travelled = false;
                try {
                    travelled = await getNsDataThroughFile(ns, "ns.singularity.travelToCity(ns.args[0])", null, [
                        "Aevum",
                    ]);
                } catch {}
                if (!travelled) {
                    log(
                        ns,
                        "INFO: Cannot use singularity travel to Aevum. We will try to go there manually for now.",
                        true,
                    );
                    // Try clicking our way there!
                    await click(ns, await findRequiredElement(ns, "//div[@role='button' and ./div/p/text()='Travel']"));
                    await click(
                        ns,
                        await findRequiredElement(ns, "//span[contains(@class,'travel') and ./text()='A']"),
                    );
                    // If this didn't put us in Aevum, there's likely a travel confirmation dialog we need to click through
                    if (ns.getPlayer().city != "Aevum")
                        await click(ns, await findRequiredElement(ns, "//button[p/text()='Travel']"));
                }
                if (ns.getPlayer().city == "Aevum") log(ns, `SUCCESS: We're now in Aevum!`);
                else
                    throw new Error(
                        `We thought we travelled to Aevum, but we're apparently still in ${ns.getPlayer().city}...`,
                    );
            }

            // Step 2.3: Navigate to the City Casino
            try {
                // Try to do this without SF4, because it's faster
                await click(
                    ns,
                    await findRequiredElement(
                        ns,
                        "//div[(@role = 'button') and (contains(., 'City'))]",
                        15,
                        `Couldn't find the "🏙 City" menu button. Is your "World" nav menu collapsed?`,
                    ),
                );
                await click(ns, await findRequiredElement(ns, "//span[@aria-label = 'Iker Molina Casino']"));
            } catch (err) {
                // Try to use SF4 as a fallback (if available) - it's more reliable.
                let success = false,
                    err2;
                try {
                    success = await getNsDataThroughFile(ns, "ns.singularity.goToLocation(ns.args[0])", null, [
                        "Iker Molina Casino",
                    ]);
                } catch (singErr) {
                    err2 = singErr;
                }
                if (!success)
                    throw new Error(
                        "Failed to travel to the casino both using UI navigation and using SF4 as a fall-back." +
                            `\nUI navigation error was: ${getErrorInfo(err)}\n` +
                            (err2
                                ? `Singularity error was: ${getErrorInfo(err2)}`
                                : '`ns.singularity.goToLocation("Iker Molina Casino")` returned false, but no error...'),
                    );
            }

            // Step 2.4: Try to start the roulette game
            await click(ns, await findRequiredElement(ns, "//button[contains(text(), 'roulette')]"));

            // Step 2.5: Verify we're at the roulette table by looking for the characteristic "1 to 12" text
            await findRequiredElement(ns, "//button[text()='1 to 12']", 15, "Could not find roulette table elements");

            log(ns, "SUCCESS: Successfully navigated to the roulette table!", true);
            break; // We achieved everything we wanted, we can exit the retry loop.
        } catch (err) {
            // The first 5 errors that occur, we will start over and retry
            if (++priorAttempts < 5) {
                tail(ns); // Since we're having difficulty, pop open a tail window so the user is aware and can monitor.
                verbose = true; // Switch on verbose logs
                log(
                    ns,
                    `WARNING: roulette-navigator.js Caught (and suppressed) an unexpected error while navigating to roulette. ` +
                        `Error was:\n${getErrorInfo(err)}\nWill try again (attempt ${priorAttempts} of 5)...`,
                    false,
                    "warning",
                );
            } // More than 5 errors, give up and prompt the user to investigate
            else
                return log(
                    ns,
                    `ERROR: After ${priorAttempts} attempts, roulette-navigator.js continues to catch unexpected errors ` +
                        `while navigating to roulette. The final error was:\n  ${getErrorInfo(err)}\n` +
                        `Consider posting a screenshot and save file for help debugging this issue.`,
                    true,
                    "error",
                );
        }
    }

    // Navigation complete - the roulette script is already running and should now be at the table
    log(
        ns,
        "INFO: roulette-navigator.js navigation complete - roulette script should now be active at the table!",
        true,
    );
}

// DOM helper functions (adapted from casino.js)
export async function click(ns, button) {
    if (button === null || button === undefined)
        throw new Error(
            "click was called on a null reference. This means the prior button detection failed, but was assumed to have succeeded.",
        );
    // Sleep before clicking, if so configured
    let sleepDelay = options["click-sleep-time"];
    if (sleepDelay > 0) await ns.sleep(sleepDelay);
    // Find the onclick method on the button
    let fnOnClick = button[Object.keys(button)[1]].onClick;
    if (!fnOnClick)
        throw new Error(
            `Odd, we found the button we were looking for (${button.text()}), but couldn't find its onclick method!`,
        );
    if (verbose) log(ns, `Clicking the button.`);
    // Click the button. The "secret" to this working is just to pass any object containing isTrusted:true
    await fnOnClick({ isTrusted: true });
    // Sleep after clicking, if so configured
    if (sleepDelay > 0) await ns.sleep(sleepDelay);
}

/** Try to find an element, with retries. Throws an error if the element could not be found. */
export async function findRequiredElement(ns, xpath, retries = 15, customErrorMessage = null) {
    return await internalfindWithRetry(ns, xpath, false, retries, customErrorMessage);
}

/** Try to find an element, with retries. Returns null if the element is not found. */
async function tryfindElement(ns, xpath, retries = 4) {
    return await internalfindWithRetry(ns, xpath, true, retries);
}

/* Used to search for an element in the document. This can fail if the dom isn't fully re-rendered yet. */
function internalFind(xpath) {
    return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

/** Try to find an element, with retries. */
async function internalfindWithRetry(ns, xpath, expectFailure, maxRetries, customErrorMessage = null) {
    try {
        let logSafeXPath = xpath.substring(2, 20) + "...";
        if (verbose)
            log(
                ns,
                `INFO: ${expectFailure ? "Checking if element is on screen" : "Searching for expected element"}: "${logSafeXPath}"`,
                false,
            );
        // If enabled give the game some time to render an item before we try to find it on screen
        // if (options["find-sleep-time"]) await ns.sleep(options["find-sleep-time"]);
        let attempts = 0,
            retryDelayMs = 1; // starting retry delay (ms), will be increased with each attempt
        while (attempts++ <= maxRetries) {
            // Sleep between attempts
            if (attempts > 1) {
                if (verbose || !expectFailure)
                    log(
                        ns,
                        (expectFailure ? "INFO" : "WARN") +
                            `: Attempt ${attempts - 1} of ${maxRetries} to find "${logSafeXPath}" failed. Retrying...`,
                        false,
                    );
                await ns.sleep(retryDelayMs);
                retryDelayMs *= 2; // back-off rate (increases next sleep time before retrying)
                retryDelayMs = Math.min(retryDelayMs, 200); // Cap the retry rate at 200 ms (game tick rate)
            }
            const findAttempt = internalFind(xpath);
            if (findAttempt !== null) return findAttempt;
        }
        if (expectFailure) {
            if (verbose) log(ns, `INFO: Element doesn't appear to be present, moving on...`, false);
        } else {
            const errMessage =
                customErrorMessage ??
                `Could not find the element with xpath: "${logSafeXPath}"\n` +
                    `Something may have stolen focus or otherwise routed the UI away from the Casino.`;
            log(ns, "ERROR: " + errMessage, true, "error");
            throw new Error(errMessage, true, "error");
        }
    } catch (e) {
        if (!expectFailure) throw e;
    }
    return null;
}
