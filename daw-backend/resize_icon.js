const sharp = require('sharp');
const fs = require('fs');

const inputPath = '../daw-frontend/public/favicon.png';
const outputPath = '../daw-frontend/public/favicon_resized.png';

async function resizeIcon() {
  try {
    await sharp(inputPath)
      .resize(192, 192, {
        fit: sharp.fit.contain,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile(outputPath);
    console.log("Resized successfully");
    
    // Replace original
    fs.renameSync(outputPath, inputPath);
  } catch(e) {
    console.error("Error resizing:", e);
  }
}
resizeIcon();
