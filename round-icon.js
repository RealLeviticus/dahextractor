const sharp = require('sharp');

const size = 512;
const radius = 128; // Adjust this for more/less rounding (use size/2 for circle)

const roundedCorners = Buffer.from(
  `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`
);

sharp('build/icon.png')
  .resize(size, size)
  .composite([{
    input: roundedCorners,
    blend: 'dest-in'
  }])
  .toFile('build/icon-rounded.png')
  .then(() => {
    console.log('Rounded icon created: build/icon-rounded.png');
  })
  .catch(err => console.error(err));
