import { NetscriptExtension } from "./libs/NetscriptExtension";
function isPrimeNumberNotOptimized(input) {
    if (input === 2) {
        return true;
    }
    if (input <= 1 || input % 2 === 0) {
        return false;
    }
    const squareRootOfInput = Math.sqrt(input);
    for (let i = 3; i <= squareRootOfInput; i += 2) {
        if (input % i === 0) {
            return false;
        }
    }
    return true;
}
function isPrimeNumber(input) {
    if (input === 2 || input === 3) {
        return true;
    }
    if (input <= 1 || input % 2 === 0 || input % 3 === 0) {
        return false;
    }
    const squareRootOfInput = Math.sqrt(input);
    for (
        let potentialPrimeInFormOf6kMinus1 = 5;
        potentialPrimeInFormOf6kMinus1 <= squareRootOfInput;
        potentialPrimeInFormOf6kMinus1 += 6
    ) {
        if (input % potentialPrimeInFormOf6kMinus1 === 0 || input % (potentialPrimeInFormOf6kMinus1 + 2) === 0) {
            return false;
        }
    }
    return true;
}
function findLargestPrimeFactor(input) {
    let largestPrime = -1;
    while (input % 2 === 0) {
        largestPrime = 2;
        input /= 2;
    }
    while (input % 3 === 0) {
        largestPrime = 3;
        input /= 3;
    }
    const squareRootOfInput = Math.sqrt(input);
    for (
        let potentialPrimeInFormOf6kMinus1 = 5;
        potentialPrimeInFormOf6kMinus1 <= squareRootOfInput;
        potentialPrimeInFormOf6kMinus1 += 6
    ) {
        while (input % potentialPrimeInFormOf6kMinus1 === 0) {
            largestPrime = potentialPrimeInFormOf6kMinus1;
            input /= potentialPrimeInFormOf6kMinus1;
        }
        while (input % (potentialPrimeInFormOf6kMinus1 + 2) === 0) {
            largestPrime = potentialPrimeInFormOf6kMinus1 + 2;
            input /= potentialPrimeInFormOf6kMinus1 + 2;
        }
    }
    if (input > 4) {
        largestPrime = input;
    }
    return largestPrime;
}
var ContractType = /* @__PURE__ */ ((ContractType2) => {
    ContractType2[(ContractType2["Find Largest Prime Factor"] = 0)] = "Find Largest Prime Factor";
    ContractType2[(ContractType2["Subarray with Maximum Sum"] = 1)] = "Subarray with Maximum Sum";
    ContractType2[(ContractType2["Total Ways to Sum"] = 2)] = "Total Ways to Sum";
    ContractType2[(ContractType2["Total Ways to Sum II"] = 3)] = "Total Ways to Sum II";
    ContractType2[(ContractType2["Spiralize Matrix"] = 4)] = "Spiralize Matrix";
    ContractType2[(ContractType2["Array Jumping Game"] = 5)] = "Array Jumping Game";
    ContractType2[(ContractType2["Array Jumping Game II"] = 6)] = "Array Jumping Game II";
    ContractType2[(ContractType2["Merge Overlapping Intervals"] = 7)] = "Merge Overlapping Intervals";
    ContractType2[(ContractType2["Generate IP Addresses"] = 8)] = "Generate IP Addresses";
    ContractType2[(ContractType2["Algorithmic Stock Trader I"] = 9)] = "Algorithmic Stock Trader I";
    ContractType2[(ContractType2["Algorithmic Stock Trader II"] = 10)] = "Algorithmic Stock Trader II";
    ContractType2[(ContractType2["Algorithmic Stock Trader III"] = 11)] = "Algorithmic Stock Trader III";
    ContractType2[(ContractType2["Algorithmic Stock Trader IV"] = 12)] = "Algorithmic Stock Trader IV";
    ContractType2[(ContractType2["Minimum Path Sum in a Triangle"] = 13)] = "Minimum Path Sum in a Triangle";
    ContractType2[(ContractType2["Unique Paths in a Grid I"] = 14)] = "Unique Paths in a Grid I";
    ContractType2[(ContractType2["Unique Paths in a Grid II"] = 15)] = "Unique Paths in a Grid II";
    ContractType2[(ContractType2["Shortest Path in a Grid"] = 16)] = "Shortest Path in a Grid";
    ContractType2[(ContractType2["Sanitize Parentheses in Expression"] = 17)] = "Sanitize Parentheses in Expression";
    ContractType2[(ContractType2["Find All Valid Math Expressions"] = 18)] = "Find All Valid Math Expressions";
    ContractType2[(ContractType2["HammingCodes: Integer to Encoded Binary"] = 19)] =
        "HammingCodes: Integer to Encoded Binary";
    ContractType2[(ContractType2["HammingCodes: Encoded Binary to Integer"] = 20)] =
        "HammingCodes: Encoded Binary to Integer";
    ContractType2[(ContractType2["Proper 2-Coloring of a Graph"] = 21)] = "Proper 2-Coloring of a Graph";
    ContractType2[(ContractType2["Compression I: RLE Compression"] = 22)] = "Compression I: RLE Compression";
    ContractType2[(ContractType2["Compression II: LZ Decompression"] = 23)] = "Compression II: LZ Decompression";
    ContractType2[(ContractType2["Compression III: LZ Compression"] = 24)] = "Compression III: LZ Compression";
    ContractType2[(ContractType2["Encryption I: Caesar Cipher"] = 25)] = "Encryption I: Caesar Cipher";
    ContractType2[(ContractType2["Encryption II: Vigen\xE8re Cipher"] = 26)] = "Encryption II: Vigen\xE8re Cipher";
    return ContractType2;
})(ContractType || {});
function contractTypeToString(contractType) {
    return ContractType[contractType];
}
let nsx;
function main(ns) {
    nsx = new NetscriptExtension(ns);
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();
    nsx.scanBFS("home", (host) => {
        const filenames = ns.ls(host.hostname, ".cct");
        filenames.forEach((filename) => {
            const contractType = ns.codingcontract.getContractType(filename, host.hostname);
            switch (contractType) {
                case contractTypeToString(0 /* Find Largest Prime Factor */): {
                    const input = ns.codingcontract.getData(filename, host.hostname);
                    ns.print(`Input: ${input}`);
                    const output = findLargestPrimeFactor(input);
                    ns.print(`Output: ${output}`);
                    const result = ns.codingcontract.attempt(output, filename, host.hostname);
                    ns.print(result !== "" ? `Success. Reward: ${result}` : "Fail");
                    break;
                }
            }
        });
    });
}
export { main };
