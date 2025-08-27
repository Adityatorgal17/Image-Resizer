#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createTestImage() {
  try {
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 100, b: 50 }
      }
    })
    .png()
    .toBuffer();

    const testImagePath = path.join(process.cwd(), 'test-small.png');
    fs.writeFileSync(testImagePath, testImageBuffer);
    
    console.log(`✅ Created small test image: ${testImagePath}`);
    console.log(`📏 Size: ${(testImageBuffer.length / 1024).toFixed(1)}KB`);
    
    const base64Image = testImageBuffer.toString('base64');
    const payload = {
      data: `data:image/png;base64,${base64Image}`,
      filename: "test-small.png"
    };
    
    const payloadPath = path.join(process.cwd(), 'test-small-payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
    
    console.log(`✅ Created payload: ${payloadPath}`);
    console.log(`📄 Payload size: ${(JSON.stringify(payload).length / 1024).toFixed(1)}KB`);
    
    console.log('\n🧪 Test with:');
    console.log('curl -X POST http://localhost:3000/upload-image \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d @test-small-payload.json');
    
  } catch (error) {
    console.error('❌ Error creating test image:', error);
  }
}

createTestImage();
