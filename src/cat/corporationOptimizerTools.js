import * as comlink from "libs/comlink";
import {
    BenchmarkType,
    CorporationOptimizer,
    defaultPerformanceModifierForOfficeBenchmark,
    getComparator,
    getReferenceData,
    minStepForOfficeBenchmark,
} from "./corporationOptimizer";
import { calculateEmployeeStats, formatNumber, ResearchName } from "./corporationFormulas";
import {
    getCorporationUpgradeLevels,
    getDivisionResearches,
    isProduct,
    Logger,
    sampleProductName,
} from "./corporationUtils";
import { generateBlobUrl } from "./scriptUtils";
let workerModuleUrl = new CorporationOptimizer().getScriptUrl();
async function validateWorkerModuleUrl(ns) {
    let fetchResult;
    let valid = true;
    try {
        fetchResult = await fetch(workerModuleUrl);
    } catch (e) {
        valid = false;
    }
    if (fetchResult && !fetchResult.ok) {
        valid = false;
    }
    if (!valid) {
        workerModuleUrl = generateBlobUrl(ns, "corporationOptimizer.js");
    }
}
async function splitWorkload(nsx, divisionName, city, operationsJob, engineerJob, managementJob, workload, logger) {
    const numberOfThreads = globalThis.navigator?.hardwareConcurrency ?? 8;
    const workers = [];
    const promises = [];
    let current = operationsJob.min;
    const step = Math.floor((operationsJob.max - operationsJob.min) / numberOfThreads);
    const loggerLabel = `Office benchmark execution time: ${divisionName}|${city}|${Date.now()}`;
    logger.time(loggerLabel);
    for (let i = 0; i < numberOfThreads; ++i) {
        const from = current;
        if (from > operationsJob.max) {
            break;
        }
        const to = Math.min(current + step, operationsJob.max);
        logger.log(`from: ${from}, to: ${to}`);
        const worker = new Worker(workerModuleUrl, { type: "module" });
        workers.push(worker);
        const workerWrapper = comlink.wrap(worker);
        promises.push(
            workload(
                worker,
                workerWrapper,
                {
                    min: from,
                    max: to,
                },
                {
                    min: engineerJob.min,
                    max: engineerJob.max,
                },
                {
                    min: managementJob.min,
                    max: managementJob.max,
                },
            ),
        );
        current += step + 1;
    }
    nsx.addAtExitCallback(() => {
        workers.forEach((worker) => {
            worker.terminate();
        });
    });
    await Promise.allSettled(promises);
    logger.timeLog(loggerLabel);
}
async function optimizeOffice(
    nsx,
    division,
    industryData,
    city,
    nonRnDEmployees,
    rndEmployee,
    item,
    useCurrentItemData,
    sortType,
    balancingModifierForProfitProgress,
    maxRerun = 1,
    performanceModifier = defaultPerformanceModifierForOfficeBenchmark,
    enableLogging = false,
    employeeJobsRequirement,
) {
    if (useCurrentItemData && item.name === sampleProductName) {
        throw new Error("Do not use useCurrentItemData = true with sample product");
    }
    await validateWorkerModuleUrl(nsx.ns);
    const logger = new Logger(enableLogging);
    const data = [];
    const office = nsx.ns.corporation.getOffice(division.name, city);
    let avgMorale = office.avgMorale;
    let avgEnergy = office.avgEnergy;
    const corporationUpgradeLevels = getCorporationUpgradeLevels(nsx.ns);
    const divisionResearches = getDivisionResearches(nsx.ns, division.name);
    if (nonRnDEmployees < 4) {
        throw new Error(`Invalid employees' data. maxTotalEmployees: ${nonRnDEmployees}`);
    }
    const numberOfNewEmployees = nonRnDEmployees + rndEmployee - office.numEmployees;
    if (numberOfNewEmployees < 0) {
        throw new Error(
            `Invalid employees' data. maxTotalEmployees: ${nonRnDEmployees}, numberOfNewEmployees: ${numberOfNewEmployees}`,
        );
    }
    const totalExperience = office.totalExperience + 75 * numberOfNewEmployees;
    let avgStats;
    try {
        avgStats = await calculateEmployeeStats(
            {
                avgMorale: office.avgMorale,
                avgEnergy: office.avgEnergy,
                totalExperience: office.totalExperience,
                numEmployees: office.numEmployees,
                employeeJobs: office.employeeJobs,
                employeeProductionByJob: office.employeeProductionByJob,
            },
            corporationUpgradeLevels,
            divisionResearches,
        );
    } catch (e) {
        logger.warn(e);
        avgStats = {
            avgIntelligence: 75,
            avgCharisma: 75,
            avgCreativity: 75,
            avgEfficiency: 75,
        };
    }
    for (let i = 0; i < numberOfNewEmployees; i++) {
        avgMorale = divisionResearches[ResearchName.STIMU] ? 110 : 100;
        avgEnergy = divisionResearches[ResearchName.GO_JUICE] ? 110 : 100;
        avgStats.avgIntelligence = (avgStats.avgIntelligence * office.numEmployees + 75) / (office.numEmployees + 1);
        avgStats.avgCharisma = (avgStats.avgCharisma * office.numEmployees + 75) / (office.numEmployees + 1);
        avgStats.avgCreativity = (avgStats.avgCreativity * office.numEmployees + 75) / (office.numEmployees + 1);
        avgStats.avgEfficiency = (avgStats.avgEfficiency * office.numEmployees + 75) / (office.numEmployees + 1);
    }
    const customData = {
        office: {
            avgMorale,
            avgEnergy,
            avgIntelligence: avgStats.avgIntelligence,
            avgCharisma: avgStats.avgCharisma,
            avgCreativity: avgStats.avgCreativity,
            avgEfficiency: avgStats.avgEfficiency,
            totalExperience,
        },
        corporationUpgradeLevels,
        divisionResearches,
        performanceModifier,
    };
    const printDataEntryLog = (dataEntry) => {
        let message = `{operations:${dataEntry.operations}, engineer:${dataEntry.engineer}, business:${dataEntry.business}, management:${dataEntry.management}, `;
        message += `totalExperience:${formatNumber(dataEntry.totalExperience)}, `;
        message += `rawProduction:${formatNumber(dataEntry.rawProduction)}, maxSalesVolume:${formatNumber(dataEntry.maxSalesVolume)}, optimalPrice:${formatNumber(dataEntry.optimalPrice)}, profit:${dataEntry.profit.toExponential(5)}, salesEfficiency: ${Math.min(dataEntry.maxSalesVolume / dataEntry.rawProduction, 1).toFixed(3)}`;
        if (isProduct(item)) {
            message += `, progress: ${dataEntry.productDevelopmentProgress.toFixed(5)}`;
            message += `, progressCycle: ${Math.ceil(100 / dataEntry.productDevelopmentProgress)}`;
            message += `, estimatedRP: ${formatNumber(dataEntry.estimatedRP)}`;
            message += `, rating: ${formatNumber(dataEntry.productRating)}`;
            message += `, markup: ${formatNumber(dataEntry.productMarkup)}`;
            message += `, profit_progress: ${(dataEntry.profit * dataEntry.productDevelopmentProgress).toExponential(5)}}`;
        } else {
            message += "}";
        }
        logger.log(message);
    };
    const referenceData = await getReferenceData(
        division,
        industryData,
        nonRnDEmployees,
        item,
        useCurrentItemData,
        customData,
    );
    const comparatorCustomData = {
        referenceData,
        balancingModifierForProfitProgress,
    };
    let nonRnDEmployeesWithRequirement = nonRnDEmployees;
    if (employeeJobsRequirement) {
        nonRnDEmployeesWithRequirement =
            nonRnDEmployees - employeeJobsRequirement.engineer - employeeJobsRequirement.business;
    }
    const min = 1;
    const max = Math.floor(nonRnDEmployeesWithRequirement * 0.6);
    let maxUsedStep = 0;
    let error;
    const workload = async (worker, workerWrapper, operationsJob, engineerJob, managementJob) => {
        maxUsedStep = 0;
        return workerWrapper
            .optimizeOffice(
                division,
                industryData,
                {
                    min: operationsJob.min,
                    max: operationsJob.max,
                },
                {
                    min: engineerJob.min,
                    max: engineerJob.max,
                },
                {
                    min: managementJob.min,
                    max: managementJob.max,
                },
                rndEmployee,
                nonRnDEmployees,
                // Do not use nonRnDEmployeesWithRequirement
                item,
                useCurrentItemData,
                customData,
                sortType,
                comparatorCustomData,
                enableLogging,
                employeeJobsRequirement,
            )
            .then((result) => {
                maxUsedStep = Math.max(maxUsedStep, result.step);
                data.push(...result.data);
                worker.terminate();
            })
            .catch((reason) => {
                console.error(reason);
                error = reason;
            });
    };
    const operationsMin = min;
    const operationsMax = max;
    let engineerMin = min;
    let engineerMax = max;
    const managementMin = min;
    const managementMax = max;
    if (employeeJobsRequirement) {
        engineerMin = employeeJobsRequirement.engineer;
        engineerMax = employeeJobsRequirement.engineer;
    }
    await splitWorkload(
        nsx,
        division.name,
        city,
        {
            min: operationsMin,
            max: operationsMax,
        },
        {
            min: engineerMin,
            max: engineerMax,
        },
        {
            min: managementMin,
            max: managementMax,
        },
        workload,
        logger,
    );
    if (error) {
        throw new Error(`Error occurred in worker: ${JSON.stringify(error)}`);
    }
    data.sort(getComparator(BenchmarkType.OFFICE, sortType, comparatorCustomData));
    let count = 0;
    while (true) {
        logger.log(`maxUsedStep: ${maxUsedStep}`);
        if (count >= maxRerun) {
            break;
        }
        if (maxUsedStep === minStepForOfficeBenchmark) {
            break;
        }
        logger.log("Rerun benchmark to get more accurate data");
        const currentBestResult = data[data.length - 1];
        logger.log("Current best result:");
        printDataEntryLog(currentBestResult);
        let newEngineerMin = Math.max(currentBestResult.engineer - maxUsedStep, 1);
        let newEngineerMax = Math.min(currentBestResult.engineer + maxUsedStep, nonRnDEmployees - 3);
        if (employeeJobsRequirement) {
            newEngineerMin = employeeJobsRequirement.engineer;
            newEngineerMax = employeeJobsRequirement.engineer;
        }
        await splitWorkload(
            nsx,
            division.name,
            city,
            {
                min: Math.max(currentBestResult.operations - maxUsedStep, 1),
                max: Math.min(currentBestResult.operations + maxUsedStep, nonRnDEmployees - 3),
            },
            {
                min: newEngineerMin,
                max: newEngineerMax,
            },
            {
                min: Math.max(currentBestResult.management - maxUsedStep, 1),
                max: Math.min(currentBestResult.management + maxUsedStep, nonRnDEmployees - 3),
            },
            workload,
            logger,
        );
        if (error) {
            throw new Error(`Error occurred in worker: ${JSON.stringify(error)}`);
        }
        data.sort(getComparator(BenchmarkType.OFFICE, sortType, comparatorCustomData));
        ++count;
    }
    let dataForLogging = data;
    if (dataForLogging.length > 10) {
        dataForLogging = dataForLogging.slice(-10);
    }
    dataForLogging.forEach((dataEntry) => {
        printDataEntryLog(dataEntry);
    });
    return data;
}
export { optimizeOffice };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2NvcnBvcmF0aW9uT3B0aW1pemVyVG9vbHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7Q29ycEluZHVzdHJ5RGF0YSwgRGl2aXNpb24sIE1hdGVyaWFsLCBOUywgUHJvZHVjdCx9IGZyb20gXCJAbnNcIjtcbmltcG9ydCAqIGFzIGNvbWxpbmsgZnJvbSBcIi9saWJzL2NvbWxpbmtcIjtcbmltcG9ydCB7UmVtb3RlfSBmcm9tIFwiL2xpYnMvY29tbGlua1wiO1xuaW1wb3J0IHtcbiAgICBCYWxhbmNpbmdNb2RpZmllckZvclByb2ZpdFByb2dyZXNzLFxuICAgIEJlbmNobWFya1R5cGUsXG4gICAgQ29tcGFyYXRvckN1c3RvbURhdGEsXG4gICAgQ29ycG9yYXRpb25PcHRpbWl6ZXIsXG4gICAgZGVmYXVsdFBlcmZvcm1hbmNlTW9kaWZpZXJGb3JPZmZpY2VCZW5jaG1hcmssXG4gICAgRW1wbG95ZWVKb2JSZXF1aXJlbWVudCxcbiAgICBnZXRDb21wYXJhdG9yLFxuICAgIGdldFJlZmVyZW5jZURhdGEsXG4gICAgbWluU3RlcEZvck9mZmljZUJlbmNobWFyayxcbiAgICBPZmZpY2VCZW5jaG1hcmtDdXN0b21EYXRhLFxuICAgIE9mZmljZUJlbmNobWFya0RhdGEsXG4gICAgT2ZmaWNlQmVuY2htYXJrU29ydFR5cGVcbn0gZnJvbSBcIi9jb3Jwb3JhdGlvbk9wdGltaXplclwiO1xuaW1wb3J0IHtjYWxjdWxhdGVFbXBsb3llZVN0YXRzLCBDaXR5TmFtZSwgZm9ybWF0TnVtYmVyLCBSZXNlYXJjaE5hbWV9IGZyb20gXCIvY29ycG9yYXRpb25Gb3JtdWxhc1wiO1xuaW1wb3J0IHtcbiAgICBnZXRDb3Jwb3JhdGlvblVwZ3JhZGVMZXZlbHMsXG4gICAgZ2V0RGl2aXNpb25SZXNlYXJjaGVzLFxuICAgIGlzUHJvZHVjdCxcbiAgICBMb2dnZXIsXG4gICAgc2FtcGxlUHJvZHVjdE5hbWVcbn0gZnJvbSBcIi9jb3Jwb3JhdGlvblV0aWxzXCI7XG5pbXBvcnQge2dlbmVyYXRlQmxvYlVybH0gZnJvbSBcIi9zY3JpcHRVdGlsc1wiO1xuaW1wb3J0IHtTY3JpcHRGaWxlUGF0aH0gZnJvbSBcIi9saWJzL3BhdGhzL1NjcmlwdEZpbGVQYXRoXCI7XG5pbXBvcnQge05ldHNjcmlwdEV4dGVuc2lvbn0gZnJvbSBcIi9saWJzL05ldHNjcmlwdEV4dGVuc2lvblwiO1xuXG5sZXQgd29ya2VyTW9kdWxlVXJsID0gbmV3IENvcnBvcmF0aW9uT3B0aW1pemVyKCkuZ2V0U2NyaXB0VXJsKCk7XG5cbmFzeW5jIGZ1bmN0aW9uIHZhbGlkYXRlV29ya2VyTW9kdWxlVXJsKG5zOiBOUyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGxldCBmZXRjaFJlc3VsdDtcbiAgICBsZXQgdmFsaWQgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICAgIGZldGNoUmVzdWx0ID0gYXdhaXQgZmV0Y2god29ya2VyTW9kdWxlVXJsKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHZhbGlkID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChmZXRjaFJlc3VsdCAmJiAhZmV0Y2hSZXN1bHQub2spIHtcbiAgICAgICAgdmFsaWQgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCF2YWxpZCkge1xuICAgICAgICB3b3JrZXJNb2R1bGVVcmwgPSBnZW5lcmF0ZUJsb2JVcmwobnMsIFwiY29ycG9yYXRpb25PcHRpbWl6ZXIuanNcIiBhcyBTY3JpcHRGaWxlUGF0aCk7XG4gICAgfVxufVxuXG50eXBlIFdvcmtsb2FkID0gKFxuICAgIHdvcmtlcjogV29ya2VyLFxuICAgIHdvcmtlcldyYXBwZXI6IFJlbW90ZTxDb3Jwb3JhdGlvbk9wdGltaXplcj4sXG4gICAgb3BlcmF0aW9uc0pvYjoge1xuICAgICAgICBtaW46IG51bWJlcjtcbiAgICAgICAgbWF4OiBudW1iZXI7XG4gICAgfSxcbiAgICBlbmdpbmVlckpvYjoge1xuICAgICAgICBtaW46IG51bWJlcjtcbiAgICAgICAgbWF4OiBudW1iZXI7XG4gICAgfSxcbiAgICBtYW5hZ2VtZW50Sm9iOiB7XG4gICAgICAgIG1pbjogbnVtYmVyO1xuICAgICAgICBtYXg6IG51bWJlcjtcbiAgICB9XG4pID0+IFByb21pc2U8dm9pZD47XG5cbmFzeW5jIGZ1bmN0aW9uIHNwbGl0V29ya2xvYWQoXG4gICAgbnN4OiBOZXRzY3JpcHRFeHRlbnNpb24sXG4gICAgZGl2aXNpb25OYW1lOiBzdHJpbmcsXG4gICAgY2l0eTogQ2l0eU5hbWUsXG4gICAgb3BlcmF0aW9uc0pvYjoge1xuICAgICAgICBtaW46IG51bWJlcjtcbiAgICAgICAgbWF4OiBudW1iZXI7XG4gICAgfSxcbiAgICBlbmdpbmVlckpvYjoge1xuICAgICAgICBtaW46IG51bWJlcjtcbiAgICAgICAgbWF4OiBudW1iZXI7XG4gICAgfSxcbiAgICBtYW5hZ2VtZW50Sm9iOiB7XG4gICAgICAgIG1pbjogbnVtYmVyO1xuICAgICAgICBtYXg6IG51bWJlcjtcbiAgICB9LFxuICAgIHdvcmtsb2FkOiBXb3JrbG9hZCxcbiAgICBsb2dnZXI6IExvZ2dlclxuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbnVtYmVyT2ZUaHJlYWRzID0gZ2xvYmFsVGhpcy5uYXZpZ2F0b3I/LmhhcmR3YXJlQ29uY3VycmVuY3kgPz8gODtcbiAgICBjb25zdCB3b3JrZXJzOiBXb3JrZXJbXSA9IFtdO1xuICAgIGNvbnN0IHByb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcbiAgICBsZXQgY3VycmVudCA9IG9wZXJhdGlvbnNKb2IubWluO1xuICAgIGNvbnN0IHN0ZXAgPSBNYXRoLmZsb29yKChvcGVyYXRpb25zSm9iLm1heCAtIG9wZXJhdGlvbnNKb2IubWluKSAvIG51bWJlck9mVGhyZWFkcyk7XG4gICAgY29uc3QgbG9nZ2VyTGFiZWwgPSBgT2ZmaWNlIGJlbmNobWFyayBleGVjdXRpb24gdGltZTogJHtkaXZpc2lvbk5hbWV9fCR7Y2l0eX18JHtEYXRlLm5vdygpfWA7XG4gICAgbG9nZ2VyLnRpbWUobG9nZ2VyTGFiZWwpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtYmVyT2ZUaHJlYWRzOyArK2kpIHtcbiAgICAgICAgY29uc3QgZnJvbSA9IGN1cnJlbnQ7XG4gICAgICAgIGlmIChmcm9tID4gb3BlcmF0aW9uc0pvYi5tYXgpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRvID0gTWF0aC5taW4oY3VycmVudCArIHN0ZXAsIG9wZXJhdGlvbnNKb2IubWF4KTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgZnJvbTogJHtmcm9tfSwgdG86ICR7dG99YCk7XG4gICAgICAgIGNvbnN0IHdvcmtlciA9IG5ldyBXb3JrZXIod29ya2VyTW9kdWxlVXJsLCB7dHlwZTogXCJtb2R1bGVcIn0pO1xuICAgICAgICB3b3JrZXJzLnB1c2god29ya2VyKTtcbiAgICAgICAgY29uc3Qgd29ya2VyV3JhcHBlciA9IGNvbWxpbmsud3JhcDxDb3Jwb3JhdGlvbk9wdGltaXplcj4od29ya2VyKTtcbiAgICAgICAgcHJvbWlzZXMucHVzaChcbiAgICAgICAgICAgIHdvcmtsb2FkKFxuICAgICAgICAgICAgICAgIHdvcmtlcixcbiAgICAgICAgICAgICAgICB3b3JrZXJXcmFwcGVyLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgbWluOiBmcm9tLFxuICAgICAgICAgICAgICAgICAgICBtYXg6IHRvXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG1pbjogZW5naW5lZXJKb2IubWluLFxuICAgICAgICAgICAgICAgICAgICBtYXg6IGVuZ2luZWVySm9iLm1heFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBtaW46IG1hbmFnZW1lbnRKb2IubWluLFxuICAgICAgICAgICAgICAgICAgICBtYXg6IG1hbmFnZW1lbnRKb2IubWF4XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgICBjdXJyZW50ICs9IChzdGVwICsgMSk7XG4gICAgfVxuICAgIG5zeC5hZGRBdEV4aXRDYWxsYmFjaygoKSA9PiB7XG4gICAgICAgIHdvcmtlcnMuZm9yRWFjaCh3b3JrZXIgPT4ge1xuICAgICAgICAgICAgd29ya2VyLnRlcm1pbmF0ZSgpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQocHJvbWlzZXMpO1xuICAgIGxvZ2dlci50aW1lTG9nKGxvZ2dlckxhYmVsKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wdGltaXplT2ZmaWNlKFxuICAgIG5zeDogTmV0c2NyaXB0RXh0ZW5zaW9uLFxuICAgIGRpdmlzaW9uOiBEaXZpc2lvbixcbiAgICBpbmR1c3RyeURhdGE6IENvcnBJbmR1c3RyeURhdGEsXG4gICAgY2l0eTogQ2l0eU5hbWUsXG4gICAgbm9uUm5ERW1wbG95ZWVzOiBudW1iZXIsXG4gICAgcm5kRW1wbG95ZWU6IG51bWJlcixcbiAgICBpdGVtOiBNYXRlcmlhbCB8IFByb2R1Y3QsXG4gICAgdXNlQ3VycmVudEl0ZW1EYXRhOiBib29sZWFuLFxuICAgIHNvcnRUeXBlOiBPZmZpY2VCZW5jaG1hcmtTb3J0VHlwZSxcbiAgICBiYWxhbmNpbmdNb2RpZmllckZvclByb2ZpdFByb2dyZXNzOiBCYWxhbmNpbmdNb2RpZmllckZvclByb2ZpdFByb2dyZXNzLFxuICAgIG1heFJlcnVuID0gMSxcbiAgICBwZXJmb3JtYW5jZU1vZGlmaWVyID0gZGVmYXVsdFBlcmZvcm1hbmNlTW9kaWZpZXJGb3JPZmZpY2VCZW5jaG1hcmssXG4gICAgZW5hYmxlTG9nZ2luZyA9IGZhbHNlLFxuICAgIGVtcGxveWVlSm9ic1JlcXVpcmVtZW50PzogRW1wbG95ZWVKb2JSZXF1aXJlbWVudFxuKTogUHJvbWlzZTxPZmZpY2VCZW5jaG1hcmtEYXRhW10+IHtcbiAgICBpZiAodXNlQ3VycmVudEl0ZW1EYXRhICYmIGl0ZW0ubmFtZSA9PT0gc2FtcGxlUHJvZHVjdE5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRG8gbm90IHVzZSB1c2VDdXJyZW50SXRlbURhdGEgPSB0cnVlIHdpdGggc2FtcGxlIHByb2R1Y3RcIik7XG4gICAgfVxuXG4gICAgYXdhaXQgdmFsaWRhdGVXb3JrZXJNb2R1bGVVcmwobnN4Lm5zKTtcblxuICAgIGNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoZW5hYmxlTG9nZ2luZyk7XG4gICAgY29uc3QgZGF0YTogT2ZmaWNlQmVuY2htYXJrRGF0YVtdID0gW107XG4gICAgY29uc3Qgb2ZmaWNlID0gbnN4Lm5zLmNvcnBvcmF0aW9uLmdldE9mZmljZShkaXZpc2lvbi5uYW1lLCBjaXR5KTtcblxuICAgIGxldCBhdmdNb3JhbGUgPSBvZmZpY2UuYXZnTW9yYWxlO1xuICAgIGxldCBhdmdFbmVyZ3kgPSBvZmZpY2UuYXZnRW5lcmd5O1xuICAgIGNvbnN0IGNvcnBvcmF0aW9uVXBncmFkZUxldmVscyA9IGdldENvcnBvcmF0aW9uVXBncmFkZUxldmVscyhuc3gubnMpO1xuICAgIGNvbnN0IGRpdmlzaW9uUmVzZWFyY2hlcyA9IGdldERpdmlzaW9uUmVzZWFyY2hlcyhuc3gubnMsIGRpdmlzaW9uLm5hbWUpO1xuXG4gICAgaWYgKG5vblJuREVtcGxveWVlcyA8IDQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVtcGxveWVlcycgZGF0YS4gbWF4VG90YWxFbXBsb3llZXM6ICR7bm9uUm5ERW1wbG95ZWVzfWApO1xuICAgIH1cblxuICAgIGNvbnN0IG51bWJlck9mTmV3RW1wbG95ZWVzID1cbiAgICAgICAgbm9uUm5ERW1wbG95ZWVzXG4gICAgICAgICsgcm5kRW1wbG95ZWVcbiAgICAgICAgLSBvZmZpY2UubnVtRW1wbG95ZWVzO1xuICAgIGlmIChudW1iZXJPZk5ld0VtcGxveWVlcyA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVtcGxveWVlcycgZGF0YS4gbWF4VG90YWxFbXBsb3llZXM6ICR7bm9uUm5ERW1wbG95ZWVzfSwgbnVtYmVyT2ZOZXdFbXBsb3llZXM6ICR7bnVtYmVyT2ZOZXdFbXBsb3llZXN9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRvdGFsRXhwZXJpZW5jZSA9IG9mZmljZS50b3RhbEV4cGVyaWVuY2UgKyA3NSAqIG51bWJlck9mTmV3RW1wbG95ZWVzO1xuICAgIC8vIENhbGN1bGF0ZSBhdmdTdGF0cyBiYXNlZCBvbiBjdXJyZW50IG9mZmljZSBkYXRhXG4gICAgbGV0IGF2Z1N0YXRzO1xuICAgIHRyeSB7XG4gICAgICAgIGF2Z1N0YXRzID0gYXdhaXQgY2FsY3VsYXRlRW1wbG95ZWVTdGF0cyhcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhdmdNb3JhbGU6IG9mZmljZS5hdmdNb3JhbGUsXG4gICAgICAgICAgICAgICAgYXZnRW5lcmd5OiBvZmZpY2UuYXZnRW5lcmd5LFxuICAgICAgICAgICAgICAgIHRvdGFsRXhwZXJpZW5jZTogb2ZmaWNlLnRvdGFsRXhwZXJpZW5jZSxcbiAgICAgICAgICAgICAgICBudW1FbXBsb3llZXM6IG9mZmljZS5udW1FbXBsb3llZXMsXG4gICAgICAgICAgICAgICAgZW1wbG95ZWVKb2JzOiBvZmZpY2UuZW1wbG95ZWVKb2JzLFxuICAgICAgICAgICAgICAgIGVtcGxveWVlUHJvZHVjdGlvbkJ5Sm9iOiBvZmZpY2UuZW1wbG95ZWVQcm9kdWN0aW9uQnlKb2IsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29ycG9yYXRpb25VcGdyYWRlTGV2ZWxzLFxuICAgICAgICAgICAgZGl2aXNpb25SZXNlYXJjaGVzXG4gICAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBsb2dnZXIud2FybihlKTtcbiAgICAgICAgYXZnU3RhdHMgPSB7XG4gICAgICAgICAgICBhdmdJbnRlbGxpZ2VuY2U6IDc1LFxuICAgICAgICAgICAgYXZnQ2hhcmlzbWE6IDc1LFxuICAgICAgICAgICAgYXZnQ3JlYXRpdml0eTogNzUsXG4gICAgICAgICAgICBhdmdFZmZpY2llbmN5OiA3NSxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1iZXJPZk5ld0VtcGxveWVlczsgaSsrKSB7XG4gICAgICAgIC8vIGF2Z01vcmFsZSA9IChhdmdNb3JhbGUgKiBvZmZpY2UubnVtRW1wbG95ZWVzICsgNzUpIC8gKG9mZmljZS5udW1FbXBsb3llZXMgKyAxKTtcbiAgICAgICAgLy8gYXZnRW5lcmd5ID0gKGF2Z0VuZXJneSAqIG9mZmljZS5udW1FbXBsb3llZXMgKyA3NSkgLyAob2ZmaWNlLm51bUVtcGxveWVlcyArIDEpO1xuICAgICAgICAvLyBBc3N1bWUgdGhhdCB3ZSBhbHdheXMgbWFpbnRhaW4gbWF4IG1vcmFsZS9lbmVyZ3lcbiAgICAgICAgYXZnTW9yYWxlID0gZGl2aXNpb25SZXNlYXJjaGVzW1Jlc2VhcmNoTmFtZS5TVElNVV0gPyAxMTAgOiAxMDA7XG4gICAgICAgIGF2Z0VuZXJneSA9IGRpdmlzaW9uUmVzZWFyY2hlc1tSZXNlYXJjaE5hbWUuR09fSlVJQ0VdID8gMTEwIDogMTAwO1xuICAgICAgICBhdmdTdGF0cy5hdmdJbnRlbGxpZ2VuY2UgPSAoYXZnU3RhdHMuYXZnSW50ZWxsaWdlbmNlICogb2ZmaWNlLm51bUVtcGxveWVlcyArIDc1KSAvIChvZmZpY2UubnVtRW1wbG95ZWVzICsgMSk7XG4gICAgICAgIGF2Z1N0YXRzLmF2Z0NoYXJpc21hID0gKGF2Z1N0YXRzLmF2Z0NoYXJpc21hICogb2ZmaWNlLm51bUVtcGxveWVlcyArIDc1KSAvIChvZmZpY2UubnVtRW1wbG95ZWVzICsgMSk7XG4gICAgICAgIGF2Z1N0YXRzLmF2Z0NyZWF0aXZpdHkgPSAoYXZnU3RhdHMuYXZnQ3JlYXRpdml0eSAqIG9mZmljZS5udW1FbXBsb3llZXMgKyA3NSkgLyAob2ZmaWNlLm51bUVtcGxveWVlcyArIDEpO1xuICAgICAgICBhdmdTdGF0cy5hdmdFZmZpY2llbmN5ID0gKGF2Z1N0YXRzLmF2Z0VmZmljaWVuY3kgKiBvZmZpY2UubnVtRW1wbG95ZWVzICsgNzUpIC8gKG9mZmljZS5udW1FbXBsb3llZXMgKyAxKTtcbiAgICB9XG5cbiAgICBjb25zdCBjdXN0b21EYXRhOiBPZmZpY2VCZW5jaG1hcmtDdXN0b21EYXRhID0ge1xuICAgICAgICBvZmZpY2U6IHtcbiAgICAgICAgICAgIGF2Z01vcmFsZTogYXZnTW9yYWxlLFxuICAgICAgICAgICAgYXZnRW5lcmd5OiBhdmdFbmVyZ3ksXG4gICAgICAgICAgICBhdmdJbnRlbGxpZ2VuY2U6IGF2Z1N0YXRzLmF2Z0ludGVsbGlnZW5jZSxcbiAgICAgICAgICAgIGF2Z0NoYXJpc21hOiBhdmdTdGF0cy5hdmdDaGFyaXNtYSxcbiAgICAgICAgICAgIGF2Z0NyZWF0aXZpdHk6IGF2Z1N0YXRzLmF2Z0NyZWF0aXZpdHksXG4gICAgICAgICAgICBhdmdFZmZpY2llbmN5OiBhdmdTdGF0cy5hdmdFZmZpY2llbmN5LFxuICAgICAgICAgICAgdG90YWxFeHBlcmllbmNlOiB0b3RhbEV4cGVyaWVuY2UsXG4gICAgICAgIH0sXG4gICAgICAgIGNvcnBvcmF0aW9uVXBncmFkZUxldmVsczogY29ycG9yYXRpb25VcGdyYWRlTGV2ZWxzLFxuICAgICAgICBkaXZpc2lvblJlc2VhcmNoZXM6IGRpdmlzaW9uUmVzZWFyY2hlcyxcbiAgICAgICAgcGVyZm9ybWFuY2VNb2RpZmllcjogcGVyZm9ybWFuY2VNb2RpZmllclxuICAgIH07XG4gICAgY29uc3QgcHJpbnREYXRhRW50cnlMb2cgPSAoZGF0YUVudHJ5OiBPZmZpY2VCZW5jaG1hcmtEYXRhKSA9PiB7XG4gICAgICAgIGxldCBtZXNzYWdlID0gYHtvcGVyYXRpb25zOiR7ZGF0YUVudHJ5Lm9wZXJhdGlvbnN9LCBlbmdpbmVlcjoke2RhdGFFbnRyeS5lbmdpbmVlcn0sIGBcbiAgICAgICAgICAgICsgYGJ1c2luZXNzOiR7ZGF0YUVudHJ5LmJ1c2luZXNzfSwgbWFuYWdlbWVudDoke2RhdGFFbnRyeS5tYW5hZ2VtZW50fSwgYDtcbiAgICAgICAgbWVzc2FnZSArPSBgdG90YWxFeHBlcmllbmNlOiR7Zm9ybWF0TnVtYmVyKGRhdGFFbnRyeS50b3RhbEV4cGVyaWVuY2UpfSwgYDtcbiAgICAgICAgbWVzc2FnZSArPVxuICAgICAgICAgICAgYHJhd1Byb2R1Y3Rpb246JHtmb3JtYXROdW1iZXIoZGF0YUVudHJ5LnJhd1Byb2R1Y3Rpb24pfSwgYCArXG4gICAgICAgICAgICBgbWF4U2FsZXNWb2x1bWU6JHtmb3JtYXROdW1iZXIoZGF0YUVudHJ5Lm1heFNhbGVzVm9sdW1lKX0sIGAgK1xuICAgICAgICAgICAgYG9wdGltYWxQcmljZToke2Zvcm1hdE51bWJlcihkYXRhRW50cnkub3B0aW1hbFByaWNlKX0sIGAgK1xuICAgICAgICAgICAgYHByb2ZpdDoke2RhdGFFbnRyeS5wcm9maXQudG9FeHBvbmVudGlhbCg1KX0sIGAgK1xuICAgICAgICAgICAgYHNhbGVzRWZmaWNpZW5jeTogJHtNYXRoLm1pbihkYXRhRW50cnkubWF4U2FsZXNWb2x1bWUgLyBkYXRhRW50cnkucmF3UHJvZHVjdGlvbiwgMSkudG9GaXhlZCgzKX1gO1xuICAgICAgICBpZiAoaXNQcm9kdWN0KGl0ZW0pKSB7XG4gICAgICAgICAgICBtZXNzYWdlICs9IGAsIHByb2dyZXNzOiAke2RhdGFFbnRyeS5wcm9kdWN0RGV2ZWxvcG1lbnRQcm9ncmVzcy50b0ZpeGVkKDUpfWA7XG4gICAgICAgICAgICBtZXNzYWdlICs9IGAsIHByb2dyZXNzQ3ljbGU6ICR7TWF0aC5jZWlsKDEwMCAvIGRhdGFFbnRyeS5wcm9kdWN0RGV2ZWxvcG1lbnRQcm9ncmVzcyl9YDtcbiAgICAgICAgICAgIG1lc3NhZ2UgKz0gYCwgZXN0aW1hdGVkUlA6ICR7Zm9ybWF0TnVtYmVyKGRhdGFFbnRyeS5lc3RpbWF0ZWRSUCl9YDtcbiAgICAgICAgICAgIG1lc3NhZ2UgKz0gYCwgcmF0aW5nOiAke2Zvcm1hdE51bWJlcihkYXRhRW50cnkucHJvZHVjdFJhdGluZyl9YDtcbiAgICAgICAgICAgIG1lc3NhZ2UgKz0gYCwgbWFya3VwOiAke2Zvcm1hdE51bWJlcihkYXRhRW50cnkucHJvZHVjdE1hcmt1cCl9YDtcbiAgICAgICAgICAgIG1lc3NhZ2UgKz0gYCwgcHJvZml0X3Byb2dyZXNzOiAkeyhkYXRhRW50cnkucHJvZml0ICogZGF0YUVudHJ5LnByb2R1Y3REZXZlbG9wbWVudFByb2dyZXNzKS50b0V4cG9uZW50aWFsKDUpfX1gO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVzc2FnZSArPSBcIn1cIjtcbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIubG9nKG1lc3NhZ2UpO1xuICAgIH07XG5cbiAgICBjb25zdCByZWZlcmVuY2VEYXRhID0gYXdhaXQgZ2V0UmVmZXJlbmNlRGF0YShcbiAgICAgICAgZGl2aXNpb24sXG4gICAgICAgIGluZHVzdHJ5RGF0YSxcbiAgICAgICAgbm9uUm5ERW1wbG95ZWVzLFxuICAgICAgICBpdGVtLFxuICAgICAgICB1c2VDdXJyZW50SXRlbURhdGEsXG4gICAgICAgIGN1c3RvbURhdGFcbiAgICApO1xuICAgIGNvbnN0IGNvbXBhcmF0b3JDdXN0b21EYXRhOiBDb21wYXJhdG9yQ3VzdG9tRGF0YSA9IHtcbiAgICAgICAgcmVmZXJlbmNlRGF0YTogcmVmZXJlbmNlRGF0YSxcbiAgICAgICAgYmFsYW5jaW5nTW9kaWZpZXJGb3JQcm9maXRQcm9ncmVzczogYmFsYW5jaW5nTW9kaWZpZXJGb3JQcm9maXRQcm9ncmVzc1xuICAgIH07XG5cbiAgICAvLyBub25SbkRFbXBsb3llZXNXaXRoUmVxdWlyZW1lbnQgaXMgb25seSB1c2VkIGZvciBjYWxjdWxhdGluZyBtaW4vbWF4XG4gICAgbGV0IG5vblJuREVtcGxveWVlc1dpdGhSZXF1aXJlbWVudCA9IG5vblJuREVtcGxveWVlcztcbiAgICBpZiAoZW1wbG95ZWVKb2JzUmVxdWlyZW1lbnQpIHtcbiAgICAgICAgbm9uUm5ERW1wbG95ZWVzV2l0aFJlcXVpcmVtZW50ID0gbm9uUm5ERW1wbG95ZWVzIC0gZW1wbG95ZWVKb2JzUmVxdWlyZW1lbnQuZW5naW5lZXIgLSBlbXBsb3llZUpvYnNSZXF1aXJlbWVudC5idXNpbmVzcztcbiAgICB9XG4gICAgY29uc3QgbWluID0gMTtcbiAgICBjb25zdCBtYXggPSBNYXRoLmZsb29yKG5vblJuREVtcGxveWVlc1dpdGhSZXF1aXJlbWVudCAqIDAuNik7XG4gICAgbGV0IG1heFVzZWRTdGVwID0gMDtcbiAgICBsZXQgZXJyb3I6IHVua25vd247XG4gICAgY29uc3Qgd29ya2xvYWQ6IFdvcmtsb2FkID0gYXN5bmMgKFxuICAgICAgICB3b3JrZXI6IFdvcmtlcixcbiAgICAgICAgd29ya2VyV3JhcHBlcjogUmVtb3RlPENvcnBvcmF0aW9uT3B0aW1pemVyPixcbiAgICAgICAgb3BlcmF0aW9uc0pvYjoge1xuICAgICAgICAgICAgbWluOiBudW1iZXI7XG4gICAgICAgICAgICBtYXg6IG51bWJlcjtcbiAgICAgICAgfSxcbiAgICAgICAgZW5naW5lZXJKb2I6IHtcbiAgICAgICAgICAgIG1pbjogbnVtYmVyO1xuICAgICAgICAgICAgbWF4OiBudW1iZXI7XG4gICAgICAgIH0sXG4gICAgICAgIG1hbmFnZW1lbnRKb2I6IHtcbiAgICAgICAgICAgIG1pbjogbnVtYmVyO1xuICAgICAgICAgICAgbWF4OiBudW1iZXI7XG4gICAgICAgIH1cbiAgICApID0+IHtcbiAgICAgICAgbWF4VXNlZFN0ZXAgPSAwO1xuICAgICAgICByZXR1cm4gd29ya2VyV3JhcHBlci5vcHRpbWl6ZU9mZmljZShcbiAgICAgICAgICAgIGRpdmlzaW9uLFxuICAgICAgICAgICAgaW5kdXN0cnlEYXRhLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG1pbjogb3BlcmF0aW9uc0pvYi5taW4sXG4gICAgICAgICAgICAgICAgbWF4OiBvcGVyYXRpb25zSm9iLm1heFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBtaW46IGVuZ2luZWVySm9iLm1pbixcbiAgICAgICAgICAgICAgICBtYXg6IGVuZ2luZWVySm9iLm1heFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBtaW46IG1hbmFnZW1lbnRKb2IubWluLFxuICAgICAgICAgICAgICAgIG1heDogbWFuYWdlbWVudEpvYi5tYXhcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBybmRFbXBsb3llZSxcbiAgICAgICAgICAgIG5vblJuREVtcGxveWVlcywgLy8gRG8gbm90IHVzZSBub25SbkRFbXBsb3llZXNXaXRoUmVxdWlyZW1lbnRcbiAgICAgICAgICAgIGl0ZW0sXG4gICAgICAgICAgICB1c2VDdXJyZW50SXRlbURhdGEsXG4gICAgICAgICAgICBjdXN0b21EYXRhLFxuICAgICAgICAgICAgc29ydFR5cGUsXG4gICAgICAgICAgICBjb21wYXJhdG9yQ3VzdG9tRGF0YSxcbiAgICAgICAgICAgIGVuYWJsZUxvZ2dpbmcsXG4gICAgICAgICAgICBlbXBsb3llZUpvYnNSZXF1aXJlbWVudFxuICAgICAgICApLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgICAgIG1heFVzZWRTdGVwID0gTWF0aC5tYXgobWF4VXNlZFN0ZXAsIHJlc3VsdC5zdGVwKTtcbiAgICAgICAgICAgIGRhdGEucHVzaCguLi5yZXN1bHQuZGF0YSk7XG4gICAgICAgICAgICB3b3JrZXIudGVybWluYXRlKCk7XG4gICAgICAgIH0pLmNhdGNoKHJlYXNvbiA9PiB7XG4gICAgICAgICAgICAvLyBCeXBhc3MgdXNhZ2Ugb2YgbG9nZ2VyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKHJlYXNvbik7XG4gICAgICAgICAgICBlcnJvciA9IHJlYXNvbjtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBjb25zdCBvcGVyYXRpb25zTWluID0gbWluO1xuICAgIGNvbnN0IG9wZXJhdGlvbnNNYXggPSBtYXg7XG4gICAgbGV0IGVuZ2luZWVyTWluID0gbWluO1xuICAgIGxldCBlbmdpbmVlck1heCA9IG1heDtcbiAgICBjb25zdCBtYW5hZ2VtZW50TWluID0gbWluO1xuICAgIGNvbnN0IG1hbmFnZW1lbnRNYXggPSBtYXg7XG4gICAgaWYgKGVtcGxveWVlSm9ic1JlcXVpcmVtZW50KSB7XG4gICAgICAgIGVuZ2luZWVyTWluID0gZW1wbG95ZWVKb2JzUmVxdWlyZW1lbnQuZW5naW5lZXI7XG4gICAgICAgIGVuZ2luZWVyTWF4ID0gZW1wbG95ZWVKb2JzUmVxdWlyZW1lbnQuZW5naW5lZXI7XG4gICAgfVxuICAgIGF3YWl0IHNwbGl0V29ya2xvYWQoXG4gICAgICAgIG5zeCxcbiAgICAgICAgZGl2aXNpb24ubmFtZSxcbiAgICAgICAgY2l0eSxcbiAgICAgICAge1xuICAgICAgICAgICAgbWluOiBvcGVyYXRpb25zTWluLFxuICAgICAgICAgICAgbWF4OiBvcGVyYXRpb25zTWF4XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1pbjogZW5naW5lZXJNaW4sXG4gICAgICAgICAgICBtYXg6IGVuZ2luZWVyTWF4XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG1pbjogbWFuYWdlbWVudE1pbixcbiAgICAgICAgICAgIG1heDogbWFuYWdlbWVudE1heFxuICAgICAgICB9LFxuICAgICAgICB3b3JrbG9hZCxcbiAgICAgICAgbG9nZ2VyXG4gICAgKTtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBvY2N1cnJlZCBpbiB3b3JrZXI6ICR7SlNPTi5zdHJpbmdpZnkoZXJyb3IpfWApO1xuICAgIH1cbiAgICBkYXRhLnNvcnQoZ2V0Q29tcGFyYXRvcihCZW5jaG1hcmtUeXBlLk9GRklDRSwgc29ydFR5cGUsIGNvbXBhcmF0b3JDdXN0b21EYXRhKSk7XG5cbiAgICBsZXQgY291bnQgPSAwO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYG1heFVzZWRTdGVwOiAke21heFVzZWRTdGVwfWApO1xuICAgICAgICBpZiAoY291bnQgPj0gbWF4UmVydW4pIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXhVc2VkU3RlcCA9PT0gbWluU3RlcEZvck9mZmljZUJlbmNobWFyaykge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmxvZyhcIlJlcnVuIGJlbmNobWFyayB0byBnZXQgbW9yZSBhY2N1cmF0ZSBkYXRhXCIpO1xuICAgICAgICBjb25zdCBjdXJyZW50QmVzdFJlc3VsdCA9IGRhdGFbZGF0YS5sZW5ndGggLSAxXTtcbiAgICAgICAgbG9nZ2VyLmxvZyhcIkN1cnJlbnQgYmVzdCByZXN1bHQ6XCIpO1xuICAgICAgICBwcmludERhdGFFbnRyeUxvZyhjdXJyZW50QmVzdFJlc3VsdCk7XG4gICAgICAgIC8vIERvIG5vdCB1c2Ugbm9uUm5ERW1wbG95ZWVzV2l0aFJlcXVpcmVtZW50IGluIGZvbGxvd2luZyBjYWxjdWxhdGlvbnNcbiAgICAgICAgbGV0IG5ld0VuZ2luZWVyTWluID0gTWF0aC5tYXgoY3VycmVudEJlc3RSZXN1bHQuZW5naW5lZXIgLSBtYXhVc2VkU3RlcCwgMSk7XG4gICAgICAgIGxldCBuZXdFbmdpbmVlck1heCA9IE1hdGgubWluKGN1cnJlbnRCZXN0UmVzdWx0LmVuZ2luZWVyICsgbWF4VXNlZFN0ZXAsIG5vblJuREVtcGxveWVlcyAtIDMpO1xuICAgICAgICBpZiAoZW1wbG95ZWVKb2JzUmVxdWlyZW1lbnQpIHtcbiAgICAgICAgICAgIG5ld0VuZ2luZWVyTWluID0gZW1wbG95ZWVKb2JzUmVxdWlyZW1lbnQuZW5naW5lZXI7XG4gICAgICAgICAgICBuZXdFbmdpbmVlck1heCA9IGVtcGxveWVlSm9ic1JlcXVpcmVtZW50LmVuZ2luZWVyO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IHNwbGl0V29ya2xvYWQoXG4gICAgICAgICAgICBuc3gsXG4gICAgICAgICAgICBkaXZpc2lvbi5uYW1lLFxuICAgICAgICAgICAgY2l0eSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBtaW46IE1hdGgubWF4KGN1cnJlbnRCZXN0UmVzdWx0Lm9wZXJhdGlvbnMgLSBtYXhVc2VkU3RlcCwgMSksXG4gICAgICAgICAgICAgICAgbWF4OiBNYXRoLm1pbihjdXJyZW50QmVzdFJlc3VsdC5vcGVyYXRpb25zICsgbWF4VXNlZFN0ZXAsIG5vblJuREVtcGxveWVlcyAtIDMpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG1pbjogbmV3RW5naW5lZXJNaW4sXG4gICAgICAgICAgICAgICAgbWF4OiBuZXdFbmdpbmVlck1heFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBtaW46IE1hdGgubWF4KGN1cnJlbnRCZXN0UmVzdWx0Lm1hbmFnZW1lbnQgLSBtYXhVc2VkU3RlcCwgMSksXG4gICAgICAgICAgICAgICAgbWF4OiBNYXRoLm1pbihjdXJyZW50QmVzdFJlc3VsdC5tYW5hZ2VtZW50ICsgbWF4VXNlZFN0ZXAsIG5vblJuREVtcGxveWVlcyAtIDMpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgd29ya2xvYWQsXG4gICAgICAgICAgICBsb2dnZXJcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIG9jY3VycmVkIGluIHdvcmtlcjogJHtKU09OLnN0cmluZ2lmeShlcnJvcil9YCk7XG4gICAgICAgIH1cbiAgICAgICAgZGF0YS5zb3J0KGdldENvbXBhcmF0b3IoQmVuY2htYXJrVHlwZS5PRkZJQ0UsIHNvcnRUeXBlLCBjb21wYXJhdG9yQ3VzdG9tRGF0YSkpO1xuICAgICAgICArK2NvdW50O1xuICAgIH1cblxuICAgIGxldCBkYXRhRm9yTG9nZ2luZyA9IGRhdGE7XG4gICAgaWYgKGRhdGFGb3JMb2dnaW5nLmxlbmd0aCA+IDEwKSB7XG4gICAgICAgIGRhdGFGb3JMb2dnaW5nID0gZGF0YUZvckxvZ2dpbmcuc2xpY2UoLTEwKTtcbiAgICB9XG4gICAgZGF0YUZvckxvZ2dpbmcuZm9yRWFjaChkYXRhRW50cnkgPT4ge1xuICAgICAgICBwcmludERhdGFFbnRyeUxvZyhkYXRhRW50cnkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRhdGE7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFDQSxZQUFZLGFBQWE7QUFFekI7QUFBQSxFQUVJO0FBQUEsRUFFQTtBQUFBLEVBQ0E7QUFBQSxFQUVBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxPQUlHO0FBQ1AsU0FBUSx3QkFBa0MsY0FBYyxvQkFBbUI7QUFDM0U7QUFBQSxFQUNJO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BQ0c7QUFDUCxTQUFRLHVCQUFzQjtBQUk5QixJQUFJLGtCQUFrQixJQUFJLHFCQUFxQixFQUFFLGFBQWE7QUFFOUQsZUFBZSx3QkFBd0IsSUFBdUI7QUFDMUQsTUFBSTtBQUNKLE1BQUksUUFBUTtBQUNaLE1BQUk7QUFDQSxrQkFBYyxNQUFNLE1BQU0sZUFBZTtBQUFBLEVBQzdDLFNBQVMsR0FBRztBQUNSLFlBQVE7QUFBQSxFQUNaO0FBQ0EsTUFBSSxlQUFlLENBQUMsWUFBWSxJQUFJO0FBQ2hDLFlBQVE7QUFBQSxFQUNaO0FBQ0EsTUFBSSxDQUFDLE9BQU87QUFDUixzQkFBa0IsZ0JBQWdCLElBQUkseUJBQTJDO0FBQUEsRUFDckY7QUFDSjtBQW1CQSxlQUFlLGNBQ1gsS0FDQSxjQUNBLE1BQ0EsZUFJQSxhQUlBLGVBSUEsVUFDQSxRQUNhO0FBQ2IsUUFBTSxrQkFBa0IsV0FBVyxXQUFXLHVCQUF1QjtBQUNyRSxRQUFNLFVBQW9CLENBQUM7QUFDM0IsUUFBTSxXQUE0QixDQUFDO0FBQ25DLE1BQUksVUFBVSxjQUFjO0FBQzVCLFFBQU0sT0FBTyxLQUFLLE9BQU8sY0FBYyxNQUFN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
