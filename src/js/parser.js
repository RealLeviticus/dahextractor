/**
 * DAH File Parser
 * Parses Designated Airspace Handbook PDF files from Air Services Australia
 */

const pdf = require('pdf-parse');

/**
 * Parse a DAH file content and extract airspace data
 * @param {string|Buffer} fileContent - The content of the DAH file
 * @returns {Object} Parsed airspace data
 */
async function parseDAHFile(fileContent) {
  try {
    // Initialize the parsed data structure
    const parsedData = {
      airspaces: [],
      metadata: {
        parseDate: new Date().toISOString(),
        source: 'Air Services Australia DAH'
      }
    };

    let textContent = fileContent;

    // If it's a Buffer (PDF file), extract text
    if (Buffer.isBuffer(fileContent)) {
      const data = await pdf(fileContent);
      textContent = data.text;
    }

    // Parse the text content
    const airspaces = parseAirspaceText(textContent);
    parsedData.airspaces = airspaces;

    return parsedData;
  } catch (error) {
    throw new Error(`Failed to parse DAH file: ${error.message}`);
  }
}

/**
 * Parse airspace text content
 */
function parseAirspaceText(text) {
  const airspaces = [];
  const lines = text.split('\n').map(l => l.trim());

  let currentAirspace = null;
  let readingLateralLimits = false;
  let readingVerticalLimits = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect new airspace by title pattern (e.g., "YBBB-YMMM/MELBOURNE FIR CTA A1")
    const titleMatch = line.match(/^([A-Z]{4}(?:-[A-Z]{4})?(?:\/[A-Z]{4})?)\/(.+?)(?:\s+CTA|CTR|TMA|CLASS)?\s*([A-Z]?\d+)?$/);
    if (titleMatch) {
      // Save previous airspace
      if (currentAirspace && currentAirspace.boundaries.length > 0) {
        airspaces.push(currentAirspace);
      }

      // Start new airspace
      const locations = titleMatch[1].split(/[-\/]/).filter(l => l.length === 4);
      const name = titleMatch[2].trim();
      const suffix = titleMatch[3] || '';

      currentAirspace = {
        id: `${titleMatch[1]}/${name} ${suffix}`.trim(),
        name: `${name} ${suffix}`.trim(),
        locations: locations,
        boundaries: [],
        upperLimit: 'UNL',
        lowerLimit: 'GND',
        controllingAuthority: null,
        frequencies: [],
        hoursOfOperation: null
      };

      readingLateralLimits = false;
      readingVerticalLimits = false;
      continue;
    }

    if (!currentAirspace) continue;

    // Detect LATERAL LIMITS section
    if (line.match(/^LATERAL\s+LIMITS:/i)) {
      readingLateralLimits = true;
      readingVerticalLimits = false;

      // Extract coordinates from the same line if present
      const coordsOnSameLine = line.replace(/^LATERAL\s+LIMITS:\s*/i, '').trim();
      if (coordsOnSameLine) {
        extractCoordinatesFromLine(coordsOnSameLine, currentAirspace);
      }
      continue;
    }

    // Detect VERTICAL LIMITS section
    if (line.match(/^VERTICAL\s+LIMITS:/i)) {
      readingLateralLimits = false;
      readingVerticalLimits = true;

      // Extract limits from the same line
      const limitsText = line.replace(/^VERTICAL\s+LIMITS:\s*/i, '').trim();
      extractVerticalLimits(limitsText, currentAirspace);
      continue;
    }

    // Detect HOURS OF ACTIVATION
    if (line.match(/^HOURS?\s+OF\s+ACTIVATION:/i)) {
      const hours = line.replace(/^HOURS?\s+OF\s+ACTIVATION:\s*/i, '').trim();
      currentAirspace.hoursOfOperation = hours;
      readingLateralLimits = false;
      readingVerticalLimits = false;
      continue;
    }

    // Detect CONTROLLING AUTHORITY
    if (line.match(/^CONTROLLING\s+AUTHORITY:/i)) {
      const authority = line.replace(/^CONTROLLING\s+AUTHORITY:\s*/i, '').trim();
      currentAirspace.controllingAuthority = authority;
      readingLateralLimits = false;
      readingVerticalLimits = false;
      continue;
    }

    // If we're reading lateral limits, extract coordinates
    if (readingLateralLimits) {
      extractCoordinatesFromLine(line, currentAirspace);
    }

    // If we're reading vertical limits
    if (readingVerticalLimits) {
      extractVerticalLimits(line, currentAirspace);
    }
  }

  // Save last airspace
  if (currentAirspace && currentAirspace.boundaries.length > 0) {
    airspaces.push(currentAirspace);
  }

  return airspaces;
}

/**
 * Extract coordinates from a line of text
 */
function extractCoordinatesFromLine(line, airspace) {
  // Pattern for DMS coordinates: DDMMSSS DDDMMSSS or DD°MM'SS"D DDD°MM'SS"D
  // Examples: "3322225 14822227E", "332°22'25" 148°22'27"E"

  // First try format: DDMMSSS DDDMMSSE (like "3322225 14822227E")
  const pattern1 = /(\d{7})([NS])?\s+(\d{8})([EW])/g;
  let matches = [...line.matchAll(pattern1)];

  if (matches.length > 0) {
    matches.forEach(match => {
      const lat = parseDMSCoordinate(match[1], match[2] || 'S'); // Default to S for southern hemisphere
      const lon = parseDMSCoordinate(match[3], match[4]);

      if (lat !== null && lon !== null) {
        airspace.boundaries.push({ latitude: lat, longitude: lon });
      }
    });
    return;
  }

  // Try format with degrees/minutes/seconds symbols
  const pattern2 = /(\d+)°(\d+)'(\d+)"?([NS])\s+(\d+)°(\d+)'(\d+)"?([EW])/g;
  matches = [...line.matchAll(pattern2)];

  if (matches.length > 0) {
    matches.forEach(match => {
      const lat = dmsToDecimal(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4]);
      const lon = dmsToDecimal(parseInt(match[5]), parseInt(match[6]), parseInt(match[7]), match[8]);

      airspace.boundaries.push({ latitude: lat, longitude: lon });
    });
    return;
  }

  // Try simpler pattern: DDMMSSS (CBDME format in the image)
  const pattern3 = /(\d{7})/g;
  const coords = [...line.matchAll(pattern3)];

  if (coords.length >= 2) {
    for (let i = 0; i < coords.length - 1; i += 2) {
      const lat = parseDMSCoordinate(coords[i][1], 'S');
      const lon = parseDMSCoordinate(coords[i + 1][1], 'E');

      if (lat !== null && lon !== null) {
        airspace.boundaries.push({ latitude: lat, longitude: lon });
      }
    }
  }
}

/**
 * Parse DMS coordinate from format DDMMSSS
 */
function parseDMSCoordinate(dmsStr, direction) {
  // Format: DDMMSSS for lat or DDDMMSSS for lon
  const str = dmsStr.replace(/[^\d]/g, '');

  let degrees, minutes, seconds;

  if (str.length === 7) {
    // Latitude: DDMMSSS
    degrees = parseInt(str.substring(0, 2));
    minutes = parseInt(str.substring(2, 4));
    seconds = parseInt(str.substring(4, 7)) / 10; // Last 3 digits are tenths of seconds
  } else if (str.length === 8) {
    // Longitude: DDDMMSSS
    degrees = parseInt(str.substring(0, 3));
    minutes = parseInt(str.substring(3, 5));
    seconds = parseInt(str.substring(5, 8)) / 10;
  } else {
    return null;
  }

  return dmsToDecimal(degrees, minutes, seconds, direction);
}

/**
 * Convert DMS to decimal degrees
 */
function dmsToDecimal(degrees, minutes, seconds, direction) {
  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (direction === 'S' || direction === 'W') {
    decimal *= -1;
  }

  return decimal;
}

/**
 * Extract vertical limits
 */
function extractVerticalLimits(text, airspace) {
  // Pattern: "FL180 - FL245" or "SFC - 1500" etc.
  const rangeMatch = text.match(/(SFC|GND|FL\d+|\d+)\s*-\s*(UNL|FL\d+|\d+)/i);

  if (rangeMatch) {
    airspace.lowerLimit = rangeMatch[1];
    airspace.upperLimit = rangeMatch[2];
    return;
  }

  // Single limit
  if (text.match(/^(FL\d+|UNL|SFC|GND)/i)) {
    // Determine if it's upper or lower based on context
    if (text.match(/^(SFC|GND)/i)) {
      airspace.lowerLimit = text;
    } else {
      airspace.upperLimit = text;
    }
  }
}

module.exports = {
  parseDAHFile
};
