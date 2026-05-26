const fs = require('fs');
const path = require('path');

const dirsToScan = ['controllers', 'services', 'middleware', 'utils'];

function cleanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            cleanDir(fullPath);
        } else if (fullPath.endsWith('.js') && !fullPath.includes('cleanupWorker.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let lines = content.split('\n');
            let modified = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('console.log(') && !lines[i].trim().startsWith('//')) {
                    lines[i] = lines[i].replace(/console\.log\(/g, '// console.log(');
                    modified = true;
                }
            }
            if (modified) {
                fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
                console.log(`Cleaned ${fullPath}`);
            }
        }
    }
}

dirsToScan.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) cleanDir(fullPath);
});
console.log('Cleanup complete!');
