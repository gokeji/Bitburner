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
      return ext && !allowedFiletypes.includes(ext);
    },
    async afterEachSync(event) {
      // log file action
      let eventType;
      if (event.eventType === 'add' || event.eventType === 'init:copy') {
        eventType = 'changed';

        // Filter BitBurner incompatible imports from copied files
        if (event.targetPath) {
          try {
            const content = await fs.promises.readFile(event.targetPath, 'utf8');
            const filteredContent = filterBitBurnerImports(content, event.targetPath);
            if (content !== filteredContent) {
              await fs.promises.writeFile(event.targetPath, filteredContent, 'utf8');
            }
          } catch (error) {
            // Ignore errors for non-text files
          }
        }
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
