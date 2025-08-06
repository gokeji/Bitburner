import { readFile, writeFile } from "fs/promises";
import { dirname, basename, extname, join } from "path";

/**
 * Compresses a data string (typically JSON) into a gzipped Uint8Array
 * @param {string} dataString - The string data to compress
 * @returns {Promise<Uint8Array>} - The compressed data as a Uint8Array
 */
async function compress(dataString) {
    const compressedReadableStream = new Blob([dataString]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(compressedReadableStream).arrayBuffer());
}

/**
 * Decompresses a gzipped Uint8Array back into a string
 * @param {Uint8Array} compressedData - The compressed data to decompress
 * @returns {Promise<string>} - The decompressed string
 */
async function decompress(compressedData) {
    const decompressedReadableStream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(decompressedReadableStream).text();
}

/**
 * Compresses a JSON file and saves the compressed version to the same directory
 * @param {string} filePath - Path to the JSON file to compress
 */
async function compressFile(filePath) {
    try {
        // Read the JSON file
        const jsonData = await readFile(filePath, "utf8");

        // Compress the data
        const compressed = await compress(jsonData);

        // Generate output filename (remove .json extension and add .json.gz)
        const dir = dirname(filePath);
        const name = basename(filePath, extname(filePath));
        const outputPath = join(dir, `${name}.json.gz`);

        // Save the compressed file
        await writeFile(outputPath, compressed);

        console.log(`Original file: ${filePath}`);
        console.log(`Compressed file: ${outputPath}`);
        console.log(`Original size: ${jsonData.length} bytes`);
        console.log(`Compressed size: ${compressed.length} bytes`);
        console.log(`Compression ratio: ${(jsonData.length / compressed.length).toFixed(2)}:1`);
        console.log(`Space saved: ${((1 - compressed.length / jsonData.length) * 100).toFixed(1)}%`);
    } catch (error) {
        console.error("Error processing file:", error.message);
        process.exit(1);
    }
}

/**
 * Decompresses a .gz file back to JSON
 * @param {string} filePath - Path to the .gz file to decompress
 */
async function decompressFile(filePath) {
    try {
        // Read the compressed file
        const compressedData = await readFile(filePath);

        // Decompress the data
        const decompressed = await decompress(new Uint8Array(compressedData));

        // Generate output filename (remove .gz extension)
        const outputPath = filePath.replace(/\.gz$/, "");

        // Save the decompressed file
        await writeFile(outputPath, decompressed, "utf8");

        console.log(`Decompressed: ${filePath} -> ${outputPath}`);
    } catch (error) {
        console.error("Error decompressing file:", error.message);
        process.exit(1);
    }
}

// Command-line interface
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log("Usage:");
        console.log("  node compress.js <path-to-json-file>     # Compress JSON file");
        console.log("  node compress.js -d <path-to-gz-file>    # Decompress .gz file");
        console.log("");
        console.log("Examples:");
        console.log("  node compress.js data.json               # Creates data.json.gz");
        console.log("  node compress.js -d data.json.gz         # Creates data.json");
        process.exit(1);
    }

    if (args[0] === "-d" || args[0] === "--decompress") {
        if (args.length < 2) {
            console.error("Error: Please provide a .gz file path to decompress");
            process.exit(1);
        }
        await decompressFile(args[1]);
    } else {
        await compressFile(args[0]);
    }
}

// Export functions for use in other scripts
if (typeof module !== "undefined" && module.exports) {
    module.exports = { compress, decompress, compressFile, decompressFile };
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
