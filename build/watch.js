const fs = require('node:fs');
const path = require('node:path');
const syncDirectory = require('sync-directory');
const fg = require('fast-glob');
const chokidar = require('chokidar');
const { src, dist, allowedFiletypes } = require('./config');

/**
 * Filter out all imports of the form import { NS } from "@ns";
 * This way you can use the NS object in the script without getting errors in game.
 */
function filterBitBurnerImports(content, filePath) {
  const ext = path.extname(filePath);
  if (ext === '.js' || ext === '.ts') {
    // Remove the specific import line that BitBurner doesn't recognize
    // Handle both commented and uncommented imports with more flexible whitespace matching
    return content.replace(/^\/\/\s*import\s*\{\s*NS\s*\}\s*from\s*["']@ns["']\s*;?\s*$/gm, '')
                  .replace(/^import\s*\{\s*NS\s*\}\s*from\s*["']@ns["']\s*;?\s*$/gm, '');
  }
  return content;
}

/** Format dist path for printing */
function normalize(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Sync static files.
 * Include init and watch phase.
 */
async function syncStatic() {
  return syncDirectory.async(path.resolve(src), path.resolve(dist), {
    exclude: (file) => {
      const { ext } = path.parse(file);
      // Only exclude files with disallowed extensions
      return ext && !allowedFiletypes.includes(ext);
    },
    forceSync: (filePath) => {
      const { ext } = path.parse(filePath);
      // Force sync for JS/TS files so we can process them even if they haven't changed
      return ext === '.js' || ext === '.ts';
    },
    filter: (filePath) => {
      const { ext } = path.parse(filePath);

      // For JS/TS files, we need to process them for BitBurner imports
      if ((ext === '.js' || ext === '.ts') && fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const filteredContent = filterBitBurnerImports(content, filePath);

          // If content needs filtering, we'll handle it in the sync process
          if (content !== filteredContent) {
            // Create a temporary processed version
            const relativePath = path.relative(path.resolve(src), filePath);
            const targetPath = path.resolve(dist, relativePath);

            // Ensure target directory exists
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            // Write filtered content directly to target
            fs.writeFileSync(targetPath, filteredContent, 'utf8');

            // Return false to prevent normal sync since we handled it manually
            return false;
          }
        } catch (error) {
          console.warn(`Could not filter BitBurner imports for ${filePath}:`, error.message);
        }
      }

      // Return true to include the file in normal sync
      return true;
    },
    async afterEachSync(event) {
      // log file action
      let eventType;
      if (event.eventType === 'add' || event.eventType === 'init:copy') {
        eventType = 'changed';
      } else if (event.eventType === 'unlink') {
        eventType = 'deleted';
      }
      if (eventType) {
        let relative = event.relativePath;
        if (relative[0] === '\\') {
          relative = relative.substring(1);
        }
        console.log(`${normalize(relative)} ${eventType}`);
      }
    },
    watch: true,
    deleteOrphaned: true,
  });
}

/**
 * Sync ts script files.
 * Init phase only.
 */
async function initTypeScript() {
  const distFiles = await fg(`${dist}/**/*.js`);
  for (const distFile of distFiles) {
    // search existing *.js file in dist
    const relative = path.relative(dist, distFile);
    const srcFile = path.resolve(src, relative);
    // if srcFile does not exist, delete distFile
    if (
      !fs.existsSync(srcFile) &&
      !fs.existsSync(srcFile.replace(/\.js$/, '.ts'))
    ) {
      await fs.promises.unlink(distFile);
      console.log(`${normalize(relative)} deleted`);
    }
  }
}

/**
 * Sync ts script files.
 * Watch phase only.
 */
async function watchTypeScript() {
  chokidar.watch(`${src}/**/*.ts`).on('unlink', async (p) => {
    // called on *.ts file get deleted
    const relative = path.relative(src, p).replace(/\.ts$/, '.js');
    const distFile = path.resolve(dist, relative);
    // if distFile exists, delete it
    if (fs.existsSync(distFile)) {
      await fs.promises.unlink(distFile);
      console.log(`${normalize(relative)} deleted`);
    }
  });
}

/**
 * Sync ts script files.
 * Include init and watch phase.
 */
async function syncTypeScript() {
  await initTypeScript();
  return watchTypeScript();
}

console.log('Start watching static and ts files...');
syncStatic();
syncTypeScript();
