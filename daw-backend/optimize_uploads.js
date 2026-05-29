const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'public/uploads');

async function optimizeImages() {
  const files = fs.readdirSync(uploadsDir);
  for (const file of files) {
    if (!file.match(/\.(jpg|jpeg|png|webp)$/i)) continue;
    const filePath = path.join(uploadsDir, file);
    const tempPath = path.join(uploadsDir, `temp_${file}`);
    
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const metadata = await sharp(imageBuffer).metadata();
      let pipeline = sharp(imageBuffer);
      
      // Resize if too large (limit to max 1200x1200)
      if (metadata.width > 1200 || metadata.height > 1200) {
        pipeline = pipeline.resize(1200, 1200, {
          fit: sharp.fit.inside,
          withoutEnlargement: true
        });
      }
      
      // Format-specific compression
      if (file.endsWith('.png')) {
         pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
      } else if (file.endsWith('.webp')) {
         pipeline = pipeline.webp({ quality: 80 });
      } else {
         pipeline = pipeline.jpeg({ quality: 80 });
      }
      
      await pipeline.toFile(tempPath);
      
      const origSize = fs.statSync(filePath).size;
      const newSize = fs.statSync(tempPath).size;
      
      if (newSize < origSize) {
        fs.renameSync(tempPath, filePath);
        console.log(`Optimized ${file}: ${(origSize/1024).toFixed(1)}KB -> ${(newSize/1024).toFixed(1)}KB`);
      } else {
        fs.unlinkSync(tempPath); // keep original if compression didn't help
      }
    } catch (e) {
      console.error(`Skipping ${file}:`, e.message);
    }
  }
}

optimizeImages().then(() => console.log("Done"));
