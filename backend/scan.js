const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] || '.'; // Default to current directory

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath); // Recurse
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');

      const hasImport = /^\s*import\s.+from\s.+;?/m.test(content);
      const hasExport = /^\s*export\s.+/m.test(content);

      if (hasImport || hasExport) {
        console.log(`⚠️  ESM syntax found in: ${fullPath}`);
        if (hasImport) console.log('   → uses `import`');
        if (hasExport) console.log('   → uses `export`');
      }
    }
  }
}

console.log(`🔍 Scanning "${targetDir}" for ESM syntax...\n`);
scanDirectory(targetDir);
