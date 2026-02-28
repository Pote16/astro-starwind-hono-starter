import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/rename.js <new-project-name>");
  process.exit(1);
}

const newName = args[0]; // e.g., "wogenfels-ro"
const oldProjectName = "Astro+Hono-Setup";
const oldScopeName = "ho-setup";

const excludeDirs = ['.git', 'node_modules', 'dist', '.next', '.astro', 'pnpm-lock.yaml'];

function replaceInFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return;

    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    if (content.includes(oldProjectName)) {
      content = content.replaceAll(oldProjectName, newName);
      modified = true;
    }
    
    if (content.includes(oldScopeName)) {
      content = content.replaceAll(oldScopeName, newName);
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`Updated: ${path.relative(rootDir, filePath)}`);
    }
  } catch (err) {
    if (err.code !== 'EISDIR' && err.code !== 'ENOENT') {
      console.warn(`Could not read/write ${filePath}:`, err.message);
    }
  }
}

function traverseDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (excludeDirs.includes(file)) continue;

    const fullPath = path.join(dir, file);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        traverseDirectory(fullPath);
      } else {
        replaceInFile(fullPath);
      }
    } catch (e) {
      continue;
    }
  }
}

console.log(`Renaming project to '${newName}'...`);
traverseDirectory(rootDir);
console.log('Done! Please run `pnpm install` afterwards to update lockfiles.');
