/**
 * Clean script for LanChat-CLI
 * Cleans the dist directory and prepares for fresh build
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

async function clean() {
  console.log('Cleaning dist directory...');

  // Items to preserve
  const preserveItems = ['.gitkeep'];

  if (fs.existsSync(distDir)) {
    const entries = fs.readdirSync(distDir, { withFileTypes: true });

    for (const entry of entries) {
      if (preserveItems.includes(entry.name)) {
        continue;
      }

      const entryPath = path.join(distDir, entry.name);

      try {
        if (entry.isDirectory()) {
          fs.rmSync(entryPath, { recursive: true, force: true });
          console.log(`  Removed directory: ${entry.name}`);
        } else {
          fs.unlinkSync(entryPath);
          console.log(`  Removed file: ${entry.name}`);
        }
      } catch (err) {
        console.warn(`  Warning: Could not remove ${entry.name}: ${err.message}`);
      }
    }
  }

  // Create required directories
  const requiredDirs = [
    'dist',
    'dist/releases',
    'dist/bundles'
  ];

  for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`  Created directory: ${dir}`);
    }
  }

  console.log('\nClean completed successfully!');
}

clean().catch(err => {
  console.error('Clean failed:', err);
  process.exit(1);
});
