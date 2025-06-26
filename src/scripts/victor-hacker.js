const MS_BETWEEN_STEPS = 20;
const MIN_HOME_RAM = 640;
const KNAPSACK_BUCKETS = 100;
const MAX_MINUTES_TO_HACK = 10;

const HACK_SCRIPT = "/kamu/hack.js";
const GROW_SCRIPT = "/kamu/grow.js";
const WEAKEN_SCRIPT = "/kamu/weaken.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    let all_servers = RecursiveScan(ns);
    let thread_overestimation = 1;
    let to_optimize = ns.args[0] || "";
    if (to_optimize == "") {
        to_optimize = [];
    } else {
        to_optimize = to_optimize.split(",");
        ns.print(to_optimize);
    }
    let level_start = ns.getHackingLevel();
    let prepping_servers = new Set();
    let reset_servers = 10;
    // Core loop
    // Get total available thread count
    // Fill knapsack w/ potential solutions
    // Solve knapsack for targets
    // Prep targets
    // Run batches for a while
    while (true) {
        all_servers = RecursiveScan(ns);
        level_start = ns.getHackingLevel();
        let available_threads = get_all_thread_count(ns, all_servers);
        let bucket_size = Math.floor((thread_overestimation * available_threads) / KNAPSACK_BUCKETS);
        if (reset_servers < 0) {
            reset_servers = 100;
            prepping_servers = new Set();
        }
        ns.print("Currently prepping servers: ", prepping_servers);
        let knapsack = fill_knapsack(
            ns,
            available_threads,
            bucket_size,
            to_optimize.length == 0 ? all_servers : to_optimize,
            prepping_servers,
        );
        let settings = solve_group_knapsack(knapsack);
        // If any of the target servers are not prepped yet, prep them, remove them and recalc
        let rescore_prep = [];
        for (const setting of settings) {
            ns.print(setting);
            setting.batch_start_w_time = -1;
            let prep = await prepare_server(ns, setting.target, all_servers);

            if (prep != 0) {
                prepping_servers.add(setting.target);
                rescore_prep.push(setting.target);
            }
        }
        await ns.sleep(MS_BETWEEN_STEPS * 5);
        if (rescore_prep.length > 0) {
            ns.print("Rescore because we just started some preps: ", rescore_prep);
            continue;
        }
        if (settings.length == 0) {
            ns.print("0 to hack, full reset");
            thread_overestimation = 1.5;
            continue;
        }
        let expected_batches = 1000 * settings.length;
        let failed_batches = 0;
        let executed_batches = 0;
        for (let i = 0; i < 500; ++i) {
            // If level drifted too far, just recalc
            if (level_start + 10 < ns.getHackingLevel()) {
                ns.print("Hack level exceeded, recalc");
                break;
            }
            for (const setting of settings) {
                let si = ns.getServer(setting.target);
                if (si.minDifficulty != si.hackDifficulty || si.moneyAvailable != si.moneyMax) {
                    failed_batches += 1;
                    await ns.sleep(1);
                    continue;
                }
                let timings = get_hgw_timings(ns, si);
                let w_time = align_batch_time(timings);
                if (setting.batch_start_w_time == -1) {
                    setting.batch_start_w_time = w_time + timings.w;
                }
                // ns.print("CHECK")
                // ns.print("H: ", setting.batch_start_w_time - timings.h - 2 * MS_BETWEEN_STEPS, " + ", timings.h, " ~= ", setting.batch_start_w_time - 2 * MS_BETWEEN_STEPS)
                // ns.print("G: ", setting.batch_start_w_time - timings.g - 1 * MS_BETWEEN_STEPS, " + ", timings.g, " ~= ", setting.batch_start_w_time - 1 * MS_BETWEEN_STEPS)
                // ns.print("W: ", setting.batch_start_w_time - timings.w - 0 * MS_BETWEEN_STEPS, " + ", timings.w, " ~= ", setting.batch_start_w_time - 0 * MS_BETWEEN_STEPS)

                let run_configs = [];
                while (run_configs.length == 0) {
                    run_configs = get_runner_threads(ns, setting, all_servers);
                    // ns.print(run_configs)
                    for (const config of run_configs) {
                        switch (config.script) {
                            case HACK_SCRIPT:
                                ns.exec(
                                    config.script,
                                    config.runner,
                                    config.threads,
                                    config.target,
                                    setting.batch_start_w_time - timings.h - 2 * MS_BETWEEN_STEPS,
                                );
                                break;
                            case GROW_SCRIPT:
                                ns.exec(
                                    config.script,
                                    config.runner,
                                    config.threads,
                                    config.target,
                                    setting.batch_start_w_time - timings.g - 1 * MS_BETWEEN_STEPS,
                                );
                                break;
                            case WEAKEN_SCRIPT:
                                ns.exec(
                                    config.script,
                                    config.runner,
                                    config.threads,
                                    config.target,
                                    setting.batch_start_w_time - timings.w - 0 * MS_BETWEEN_STEPS,
                                );
                                break;
                            default:
                                ns.print("Bad setting definition");
                        }
                    }
                    if (run_configs.length == 0) {
                        // ns.print("Failed to get RAM for batch, wait 1s")
                        failed_batches += 1;
                        await ns.sleep(1);
                    }
                }
                executed_batches += 1;
            }
            // Wait 4 steps because we will are doing HGWX
            await ns.sleep(MS_BETWEEN_STEPS * 4);
        }
        reset_servers -= 1;
        ns.print(
            "INFO: Batches done: ",
            executed_batches,
            " out of ",
            failed_batches + executed_batches,
            " for a success rate of ",
            ns.formatNumber((100 * executed_batches) / (failed_batches + executed_batches + 1)),
        );
        let ram_stats = getTotalRamUtilization(ns, all_servers);
        let pct_ram_usage = ram_stats.used_ram / ram_stats.total_ram;
        ns.print(
            "RAM utilization: ",
            ns.formatRam(ram_stats.used_ram),
            " / ",
            ns.formatRam(ram_stats.total_ram),
            "(",
            ns.formatNumber(100 * pct_ram_usage),
            "%)",
        );
        // Keep RAM usage at 90 ~ 95%
        if (pct_ram_usage >= 0.9 && pct_ram_usage <= 0.95) {
            ns.print(
                "RAM utilization healthy, no adjustments: ",
                ns.formatRam(ram_stats.used_ram),
                " out of ",
                ns.formatRam(ram_stats.total_ram),
            );
        } else if (pct_ram_usage < 0.9) {
            thread_overestimation = thread_overestimation / pct_ram_usage;
            ns.print("RAM utilization low: adjusted thread_overestimation to ", thread_overestimation);
        } else {
            thread_overestimation =
                (thread_overestimation * executed_batches) / (failed_batches + executed_batches + 1);
            ns.print(
                "RAM utilization high, adjusted thread_overestimation to ",
                thread_overestimation,
                ": ",
                executed_batches / (failed_batches + executed_batches + 1),
                " success rate.",
            );
        }
    }
}

function fill_knapsack(ns, total_threads, bucket_size, all_servers, prepping_servers) {
    const home_cores = ns.getServer("home").cpuCores;
    let values = [];
    let weights = [];
    let metadata = [];
    for (const ps of prepping_servers) {
        let si = ns.getServer(ps);
        if (si.moneyAvailable == si.moneyMax && si.hackDifficulty == si.minDifficulty) prepping_servers.delete(ps);
    }
    for (const server of all_servers.filter(
        (s) => ns.hasRootAccess(s) && ns.getServer(s).moneyMax > 0 && !prepping_servers.has(s),
    )) {
        let server_values = [];
        let server_weights = [];
        let server_metadata = [];

        let si = ns.getServer(server);
        let timings = get_hgw_timings(ns, si);
        // Skip ones that take too long
        if (timings.w > 1000 * MAX_MINUTES_TO_HACK * 60) continue;
        si.moneyAvailable = si.moneyMax;
        si.hackDifficulty = si.minDifficulty;
        timings = get_hgw_timings(ns, si);

        let hack_pct = ns.formulas.hacking.hackPercent(si, ns.getPlayer());

        let prev_value = 0;
        let prev_weight = 0;
        let prev_metadata = [];
        let w_time = align_batch_time(timings);
        for (let hack_threads = 1; hack_threads < 1000; ++hack_threads) {
            si.moneyAvailable = Math.max(Math.floor(si.moneyMax - hack_pct * si.moneyMax * hack_threads), 0);
            si.hackDifficulty = si.minDifficulty + hack_threads * ns.hackAnalyzeSecurity(hack_threads, server);
            let grow_threads = Math.ceil(ns.formulas.hacking.growThreads(si, ns.getPlayer(), si.moneyMax, 1) * 1.01);
            let grow_threads_w_core = Math.ceil(
                ns.formulas.hacking.growThreads(si, ns.getPlayer(), si.moneyMax, home_cores) * 1.01,
            );
            // Weaken is based on the formula
            // -0.002H - 0.004G + weakenAnalyze() * W = 0
            // W = (H + G ) / (weakenAnalyze() * 500)
            let weaken_threads = Math.ceil((hack_threads + grow_threads * 2) / (ns.weakenAnalyze(1, 1) * 500));
            let weaken_threads_w_core = Math.ceil(
                (hack_threads + grow_threads * 2) / (ns.weakenAnalyze(1, home_cores) * 500),
            );
            // H/G/W into bucket
            // Assume fully loaded cycles and then size them on how many chunks of RAM they would take
            let weight_bucket = Math.ceil(
                ((hack_threads + grow_threads + weaken_threads) * ((timings.w + w_time) / (4 * MS_BETWEEN_STEPS))) /
                    bucket_size,
            );

            // If this is a new bucket, add it to knapsack
            if (prev_weight != 0 && weight_bucket != prev_weight) {
                server_values.push(prev_value);
                server_weights.push(prev_weight);
                server_metadata.push(prev_metadata);
            }
            if (weight_bucket > 100) {
                break;
            }
            // We don't immediately push because some H/G/W setups are similar enough to be one bucket
            prev_value = hack_threads * hack_pct * si.moneyMax;
            prev_weight = weight_bucket;
            prev_metadata = {
                value: prev_value,
                weight: weight_bucket,
                target: server,
                h: hack_threads,
                g: grow_threads,
                g_c: grow_threads_w_core,
                w: weaken_threads,
                w_c: weaken_threads_w_core,
            };
            // End iteration if server is drained
            if (si.moneyAvailable == 0) {
                // Add current setup too since it's not been added yet
                server_values.push(prev_value);
                server_weights.push(prev_weight);
                server_metadata.push(prev_metadata);
                break;
            }
        }
        values.push(server_values);
        weights.push(server_weights);
        metadata.push(server_metadata);
    }
    return {
        values: values,
        weights: weights,
        metadata: metadata,
    };
}

async function prepare_server(ns, server, all_servers) {
    let si = ns.getServer(server);
    // If server is prepped, just return 0
    if (si.moneyAvailable == si.moneyMax && si.minDifficulty == si.hackDifficulty) return 0;
    // Do a WGW
    const home_cores = ns.getServer("home").cpuCores;
    // See if we need to do first W
    let cnt = 5;
    let curr_sec = ns.getServerSecurityLevel(server);
    let min_sec = ns.getServerMinSecurityLevel(server);
    if (curr_sec > min_sec) {
        let setting = {
            target: server,
            h: 0,
            g: 0,
            g_c: 0,
            w: Math.ceil((curr_sec - min_sec) / ns.weakenAnalyze(1, 1)),
            w_c: Math.ceil((curr_sec - min_sec) / ns.weakenAnalyze(1, home_cores)),
        };
        let run_configs = [];
        while (run_configs.length == 0) {
            run_configs = get_runner_threads(ns, setting, all_servers);
            for (const config of run_configs) {
                // ns.print("First weaken prep: ", config)
                ns.exec(config.script, config.runner, config.threads, config.target, 0);
            }
            if (run_configs.length == 0) {
                ns.print("Failed at first W step, wait 10s", setting);
                await ns.sleep(1000 * 10);
                cnt -= 1;
                if (cnt == 0) return 1;
            }
        }
    }
    // Wait 2 steps because we will send G/W based on the final W timing
    await ns.sleep(MS_BETWEEN_STEPS * 3);
    // G
    let sec_impact = 0;
    let curr_money = si.moneyAvailable;
    let max_money = si.moneyMax;
    let timings = get_hgw_timings(ns, si);
    cnt = 5;
    if (curr_money < max_money) {
        // Get current timings
        // Project G impact based on prepped server
        si.hackDifficulty = si.minDifficulty;
        let setting = {
            target: server,
            h: 0,
            g: ns.formulas.hacking.growThreads(si, ns.getPlayer(), max_money, 1),
            g_c: ns.formulas.hacking.growThreads(si, ns.getPlayer(), max_money, home_cores),
            w: 0,
            w_c: 0,
        };
        if (setting.g > 0 && setting.g_c > 0) {
            let run_configs = [];
            while (run_configs.length == 0) {
                run_configs = get_runner_threads(ns, setting, all_servers);
                for (const config of run_configs) {
                    // ns.print("Grow prep: ", config, " G: ", ns.tFormat(timings.g), " W: ", ns.tFormat(timings.w), " Delay: ", ns.tFormat(timings.w - timings.g - MS_BETWEEN_STEPS))
                    let pid = await ns.exec(
                        config.script,
                        config.runner,
                        config.threads,
                        config.target,
                        timings.w - timings.g - MS_BETWEEN_STEPS,
                    );
                    // ns.print("Grow PID for ", config.runner, ": ", pid)
                    // Update security impact based on what was run
                    if (config.runner == "home") {
                        sec_impact = ns.growthAnalyzeSecurity(setting.g_c, server, home_cores);
                    } else {
                        sec_impact = ns.growthAnalyzeSecurity(setting.g, server, 1);
                    }
                }
                if (run_configs.length == 0) {
                    ns.print("Failed at G step, wait 10s", setting);
                    await ns.sleep(1000 * 10);
                    cnt -= 1;
                    if (cnt == 0) return 1;
                }
            }
        }
    }
    // Last W only happens if we did a G
    cnt = 5;
    if (sec_impact > 0) {
        let setting = {
            target: server,
            h: 0,
            g: 0,
            g_c: 0,
            w: Math.ceil(sec_impact / ns.weakenAnalyze(1, 1)),
            w_c: Math.ceil(sec_impact / ns.weakenAnalyze(1, home_cores)),
        };
        let run_configs = [];
        while (run_configs.length == 0) {
            run_configs = get_runner_threads(ns, setting, all_servers);
            for (const config of run_configs) {
                // ns.print("Final weaken prep: ", config)
                ns.exec(config.script, config.runner, config.threads, config.target, 0);
            }
            if (run_configs.length == 0) {
                ns.print("Failed at second W step, wait 10s", setting);
                await ns.sleep(1000 * 10);
                cnt -= 1;
                if (cnt == 0) return 1;
            }
        }
    }
    return timings.w;
}

function get_runner_threads(ns, setting, all_servers) {
    // Given a H/G/W setting, return what to run where

    // 1. Try to fit G/W into home server
    // 2. Try to fit into general threads
    // 3. If still not done, try to fit into home server again
    // ns.print("Start: ", setting)
    let res = [];
    let ram_per_thread = ns.getScriptRam(WEAKEN_SCRIPT);
    let h = setting.h;
    let g = setting.g;
    let w = setting.w;
    let g_c = setting.g_c;
    let w_c = setting.w_c;
    let hack_done = setting.h == 0;
    let grow_done = setting.g == 0 && setting.g_c == 0;
    let weak_done = setting.w == 0 && setting.w_c == 0;
    // 1. Try to fit G/W into home server
    let available_ram = ns.getServerMaxRam("home") - ns.getServerUsedRam("home") - MIN_HOME_RAM;
    let possible_home_threads = Math.floor(available_ram / ram_per_thread);
    if (!grow_done && possible_home_threads >= g_c) {
        res.push({
            runner: "home",
            script: GROW_SCRIPT,
            threads: g_c,
            target: setting.target,
        });
        possible_home_threads -= g_c;
        grow_done = true;
    }
    if (!weak_done && possible_home_threads >= w_c) {
        res.push({
            runner: "home",
            script: WEAKEN_SCRIPT,
            threads: w_c,
            target: setting.target,
        });
        possible_home_threads -= w_c;
        weak_done = true;
    }
    // 2. Try to fit into general threads
    for (const server of all_servers.filter((s) => ns.hasRootAccess(s) && s != "home")) {
        let available_ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        let possible_threads = Math.floor(available_ram / ram_per_thread);
        if (possible_threads > 0) {
            // Fill G, W and H if possible
            if (!grow_done && g > 0) {
                if (g < possible_threads) {
                    res.push({
                        runner: server,
                        script: GROW_SCRIPT,
                        threads: g,
                        target: setting.target,
                    });
                    possible_threads -= g;
                    grow_done = true;
                } else {
                    res.push({
                        runner: server,
                        script: GROW_SCRIPT,
                        threads: possible_threads,
                        target: setting.target,
                    });
                    g -= possible_threads;
                    if (g == 0) grow_done = true;
                    continue;
                }
            }
            if (possible_threads == 0) continue;
            if (!weak_done && w > 0) {
                if (w < possible_threads) {
                    res.push({
                        runner: server,
                        script: WEAKEN_SCRIPT,
                        threads: w,
                        target: setting.target,
                    });
                    possible_threads -= w;
                    weak_done = true;
                } else {
                    res.push({
                        runner: server,
                        script: WEAKEN_SCRIPT,
                        threads: possible_threads,
                        target: setting.target,
                    });
                    w -= possible_threads;
                    if (w == 0) weak_done = true;
                    continue;
                }
            }
            if (possible_threads == 0) continue;
            if (!hack_done && h > 0) {
                if (h < possible_threads) {
                    res.push({
                        runner: server,
                        script: HACK_SCRIPT,
                        threads: h,
                        target: setting.target,
                    });
                    possible_threads -= h;
                    hack_done = true;
                } else {
                    res.push({
                        runner: server,
                        script: HACK_SCRIPT,
                        threads: possible_threads,
                        target: setting.target,
                    });
                    h -= possible_threads;
                    if (h == 0) hack_done = true;
                    continue;
                }
            }
        }
    }
    // 3. If still not done, try to fit into home server again
    if (!grow_done && g > 0) {
        if (g <= possible_home_threads) {
            res.push({
                runner: "home",
                script: GROW_SCRIPT,
                threads: g,
                target: setting.target,
            });
            possible_home_threads -= g;
            grow_done = true;
        }
    }
    if (!weak_done && w > 0) {
        if (w <= possible_home_threads) {
            res.push({
                runner: "home",
                script: WEAKEN_SCRIPT,
                threads: w,
                target: setting.target,
            });
            possible_home_threads -= w;
            weak_done = true;
        }
    }
    if (!hack_done && h > 0) {
        if (h <= possible_home_threads) {
            res.push({
                runner: "home",
                script: HACK_SCRIPT,
                threads: h,
                target: setting.target,
            });
            possible_home_threads -= h;
            hack_done = true;
        }
    }
    // ns.print("End: ", h, "/", g, "/", w, " H: ", hack_done, " G: ", grow_done, " W: ", weak_done)
    if (hack_done && grow_done && weak_done) return res;
    return [];
}

function get_hgw_timings(ns, si) {
    return {
        h: ns.formulas.hacking.hackTime(si, ns.getPlayer()),
        g: ns.formulas.hacking.growTime(si, ns.getPlayer()),
        w: ns.formulas.hacking.weakenTime(si, ns.getPlayer()),
    };
}

function align_batch_time(timings) {
    // Given timings, return weaken wait time so it doesn't collide based on current MS_BETWEEN_STEPS
    let w_time = 0;
    // In order to make sure there's no overlap, make the W land on the latter half of the move before it finishes so the batch can start before next W - 2*step
    //    H
    //     G
    //      W
    //       X
    //    --
    // Basically we move W so that we never hit -- by taking 4 * MS_BETWEEN_STEPS sleeps
    if (timings.w % (4 * MS_BETWEEN_STEPS) < 2 * MS_BETWEEN_STEPS) {
        w_time = 4 * MS_BETWEEN_STEPS - (timings.w % (4 * MS_BETWEEN_STEPS));
    }
    return w_time;
}

function RecursiveScan(ns, root = "home", found = []) {
    if (!found.includes(root)) {
        found.push(root);
        for (const server of ns.scan(root)) {
            if (!found.includes(server)) {
                ns.scp("kamu/hack.js", server);
                ns.scp("kamu/grow.js", server);
                ns.scp("kamu/weaken.js", server);
                RecursiveScan(ns, server, found);
            }
        }
    }
    return found;
}

function getTotalRamUtilization(ns, servers) {
    let total_ram = 0;
    let used_ram = 0;
    for (const server of servers) {
        total_ram += ns.getServerMaxRam(server);
        used_ram += ns.getServerUsedRam(server);
    }
    return {
        used_ram: used_ram,
        total_ram: total_ram,
    };
}

function get_all_thread_count(ns, servers) {
    let res = 0;
    const ram_per_thread = ns.getScriptRam(HACK_SCRIPT);
    // Remove pserv-0 because we use it for faction sharing
    for (const server of servers.filter((s) => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0 && s != "pserv-00")) {
        let available_ram = ns.getServerMaxRam(server);
        if (server == "home") available_ram -= MIN_HOME_RAM;
        res += Math.floor(available_ram / ram_per_thread);
    }
    return res;
}

function solve_group_knapsack(knapsack) {
    function make_array(a, b) {
        var arr = new Array(a);
        for (let i = 0; i < a; i++) {
            arr[i] = new Array(b).fill(0);
        }
        return arr;
    }
    function solve_dp(dp, dp_val, values, weights) {
        // dp[i][j] represents the optimal value from group i with constraint of j weight
        // We keep dp_val updated to we can traverse backwards to figure out what items we picked
        for (let i = 1; i <= values.length; ++i) {
            for (let j = 0; j < KNAPSACK_BUCKETS; ++j) {
                dp[i][j] = dp[i - 1][j]; // If we don't take anything from this group
                dp_val[i][j] = dp[i - 1][j];
                for (let x = 0; x < values[i - 1].length; ++x) {
                    // Try different elements within weight of the group
                    if (j >= weights[i - 1][x]) {
                        // If taking this item is higher value, update dp and dp_val
                        if (dp[i - 1][j - weights[i - 1][x]] + values[i - 1][x] > dp[i][j]) {
                            dp[i][j] = dp[i - 1][j - weights[i - 1][x]] + values[i - 1][x];
                            dp_val[i][j] = weights[i - 1][x];
                        }
                    }
                }
            }
        }
    }
    let dp = make_array(knapsack.values.length + 1, KNAPSACK_BUCKETS);
    let dp_val = make_array(knapsack.values.length + 1, KNAPSACK_BUCKETS);
    solve_dp(dp, dp_val, knapsack.values, knapsack.weights);
    // Build optimal settings
    let x = knapsack.values.length;
    let y = KNAPSACK_BUCKETS - 1;
    let res = [];
    while (x > 0) {
        if (dp[x][y] == dp[x - 1][y]) {
            // ns.print("Didn't choose from Group ", x, ", metadata: ", knapsack.metadata[x-1].weight)
        } else {
            // ns.print("Picked item with weight ", dp_val[x][y], " from Group ", x, ", metadata: ", knapsack.metadata[x-1])
            for (const m of knapsack.metadata[x - 1]) {
                if (m.weight == dp_val[x][y]) res.push(m);
            }
            y -= dp_val[x][y];
        }
        x -= 1;
    }
    res.sort((a, b) => {
        return a.value - b.value;
    });
    return res;
}
