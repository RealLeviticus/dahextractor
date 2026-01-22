/**
 * VATGlasses JSON Converter
 * Converts parsed DAH data to VATGlasses-compatible JSON format
 *
 * VATGlasses format structure:
 * {
 *   "airspace": [...],
 *   "groups": {...},
 *   "positions": {...},
 *   "callsigns": {...},
 *   "airports": {...}
 * }
 */

/**
 * Convert parsed DAH data to VATGlasses JSON format
 * @param {Object} parsedData - Data parsed from DAH file
 * @returns {Object} VATGlasses-compatible JSON object
 */
function convertToVATGlasses(parsedData) {
  const vatglassesData = {
    airspace: [],
    groups: {},
    positions: {},
    callsigns: {
      "DEL": { "": "Clearance Delivery" },
      "GND": { "": "Ground" },
      "TWR": { "": "Tower" },
      "APP": { "": "Approach" },
      "DEP": { "": "Departure" }
    },
    airports: {}
  };

  // Convert airspaces
  if (parsedData.airspaces && parsedData.airspaces.length > 0) {
    parsedData.airspaces.forEach(airspace => {
      const converted = convertAirspace(airspace);
      if (converted) {
        vatglassesData.airspace.push(converted);

        // Add group if specified
        if (airspace.locations && airspace.locations.length > 0) {
          airspace.locations.forEach(location => {
            if (!vatglassesData.groups[location]) {
              vatglassesData.groups[location] = {
                name: extractLocationName(location),
                colour: "#ffffff"
              };
            }
          });
        }

        // Add position if controlling authority exists
        if (airspace.controllingAuthority && airspace.frequencies && airspace.frequencies.length > 0) {
          const posId = extractPositionId(airspace.id, airspace.name);
          if (posId && !vatglassesData.positions[posId]) {
            vatglassesData.positions[posId] = {
              colours: [{ hex: "#56de37" }],
              pre: [determinePositionPrefix(airspace.locations, posId)],
              type: "FSS",
              frequency: airspace.frequencies[0].toFixed(3),
              callsign: airspace.controllingAuthority
            };
          }
        }
      }
    });
  }

  return vatglassesData;
}

/**
 * Convert a single airspace to VATGlasses format
 */
function convertAirspace(airspace) {
  if (!airspace.boundaries || airspace.boundaries.length === 0) {
    return null;
  }

  const vatAirspace = {
    id: airspace.name || airspace.id || 'Unknown',
    owner: []
  };

  // Add group (location)
  if (airspace.locations && airspace.locations.length > 0) {
    vatAirspace.group = airspace.locations[0];
  }

  // Add owner (position controlling this airspace)
  const posId = extractPositionId(airspace.id, airspace.name);
  if (posId) {
    vatAirspace.owner.push(posId);
  }

  // Convert boundaries to sectors
  vatAirspace.sectors = [];

  const sector = {
    points: airspace.boundaries.map(boundary =>
      formatCoordinate(boundary.latitude, boundary.longitude)
    )
  };

  // Add altitude limits
  if (airspace.upperLimit && airspace.upperLimit !== 'UNL') {
    const ceiling = parseAltitude(airspace.upperLimit);
    if (ceiling !== null) {
      sector.max = ceiling;
    }
  }

  if (airspace.lowerLimit && airspace.lowerLimit !== 'GND' && airspace.lowerLimit !== 'SFC') {
    const floor = parseAltitude(airspace.lowerLimit);
    if (floor !== null) {
      sector.min = floor;
    }
  }

  vatAirspace.sectors.push(sector);

  return vatAirspace;
}

/**
 * Format coordinate to VATGlasses format (DDMMSS without decimal point)
 */
function formatCoordinate(lat, lon) {
  const formatDMS = (decimal, isLat) => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = Math.floor((minutesDecimal - minutes) * 60);

    // Format as DDMMSS or DDDMMSS
    const degStr = isLat
      ? degrees.toString().padStart(2, '0')
      : degrees.toString().padStart(3, '0');
    const minStr = minutes.toString().padStart(2, '0');
    const secStr = seconds.toString().padStart(2, '0');

    // Add sign
    const sign = decimal < 0 ? '-' : '';

    return sign + degStr + minStr + secStr;
  };

  return [formatDMS(lat, true), formatDMS(lon, false)];
}

/**
 * Parse altitude to flight level number
 */
function parseAltitude(altStr) {
  if (!altStr) return null;

  const str = altStr.toString().toUpperCase().trim();

  // Handle unlimited
  if (str === 'UNL' || str === 'UNLIMITED') {
    return 999;
  }

  // Handle ground level
  if (str === 'GND' || str === 'GROUND' || str === 'SFC') {
    return null; // Don't set min for ground
  }

  // Parse flight level (e.g., "FL350", "F350")
  const flMatch = str.match(/F?L?(\d+)/);
  if (flMatch) {
    return parseInt(flMatch[1]);
  }

  // Parse feet and convert to flight level (e.g., "24500FT" -> FL245)
  const ftMatch = str.match(/(\d+)\s*(FT|'|FEET)?/);
  if (ftMatch) {
    const feet = parseInt(ftMatch[1]);
    // Convert feet to flight level (divide by 100)
    return Math.floor(feet / 100);
  }

  return null;
}

/**
 * Extract position ID from airspace info
 */
function extractPositionId(id, name) {
  // Try to extract from ID (e.g., "YMMM/ADELAIDE" -> extract position code)
  // For now, use a simple extraction - this may need refinement based on actual data

  // Look for common position identifiers in the name
  const nameUpper = (name || id || '').toUpperCase();

  if (nameUpper.includes('CORAL')) return 'COL';
  if (nameUpper.includes('FLINDERS')) return 'FLD';
  if (nameUpper.includes('HOWE')) return 'HWE';
  if (nameUpper.includes('TASMAN')) return 'TSN';
  if (nameUpper.includes('INDIAN EAST')) return 'INE';
  if (nameUpper.includes('INDIAN SOUTH')) return 'INS';
  if (nameUpper.includes('INDIAN')) return 'IND';
  if (nameUpper.includes('HONIARA')) return 'AGGG';
  if (nameUpper.includes('NAURU')) return 'ANAU';

  // Default: try to extract first 3-4 letter code
  const codeMatch = nameUpper.match(/([A-Z]{3,4})/);
  if (codeMatch) {
    return codeMatch[1];
  }

  return null;
}

/**
 * Extract location name from ICAO code
 */
function extractLocationName(icao) {
  const locationMap = {
    'YBBB': 'Brisbane',
    'YBBO': 'Brisbane',
    'YMMM': 'Melbourne',
    'YMMO': 'Melbourne',
    'YSSY': 'Sydney',
    'YSSO': 'Sydney',
    'YPAD': 'Adelaide',
    'YPPH': 'Perth'
  };

  return locationMap[icao] || icao;
}

/**
 * Determine position prefix based on location and position
 */
function determinePositionPrefix(locations, posId) {
  if (!locations || locations.length === 0) return posId;

  const location = locations[0];

  // Map location to prefix
  const prefixMap = {
    'YBBB': 'BN',
    'YBBO': 'BN',
    'YMMM': 'ML',
    'YMMO': 'ML',
    'YSSY': 'SY',
    'YSSO': 'SY',
    'YPAD': 'AD',
    'YPPH': 'PH'
  };

  const prefix = prefixMap[location] || location.substring(1, 3).toUpperCase();

  return `${prefix}-${posId}`;
}

module.exports = {
  convertToVATGlasses
};
