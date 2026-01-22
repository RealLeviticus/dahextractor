const fs = require('fs');
const png2icons = require('png2icons');

async function createIco() {
  const input = fs.readFileSync('build/icon.png');
  
  // Create ICO with multiple sizes
  const ico = png2icons.createICO(input, png2icons.BICUBIC2, 0, true, true);
  
  if (ico) {
    fs.writeFileSync('build/icon.ico', ico);
    console.log('ICO file created: build/icon.ico');
  } else {
    console.error('Failed to create ICO');
  }
}

createIco().catch(console.error);
