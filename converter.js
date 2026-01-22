/**
 * VATGlasses JSON Converter
 * Converts parsed DAH data to VATGlasses-compatible JSON format
 *
 * VATGlasses format structure:
 * {
 *   "airspace": [...],
 *   "positions": [...],
 *   "airports": [...]
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
    positions: [],
    airports: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      source: parsedData.metadata?.source || 'DAH File',
      version: '1.0'
    }
  };

  // Convert airspaces
  if (parsedData.airspaces && parsedData.airspaces.length > 0) {
    vatglassesData.airspace = parsedData.airspaces.map(convertAirspace);
  }

  // Convert positions
  if (parsedData.positions && parsedData.positions.length > 0) {
    vatglassesData.positions = parsedData.positions.map(convertPosition);
  }

  // Convert airports
  if (parsedData.airports && parsedData.airports.length > 0) {
    vatglassesData.airports = parsedData.airports.map(convertAirport);
  }

  return vatglassesData;
}

/**
 * Convert a single airspace to VATGlasses format
 */
function convertAirspace(airspace) {
  const vatAirspace = {
    id: airspace.id || generateId('AIRSPACE'),
    name: airspace.name || 'Unknown Airspace',
    type: normalizeAirspaceType(airspace.type),
    boundaries: []
  };

  // Add altitude information
  if (airspace.upperLimit) {
    vatAirspace.ceiling = normalizeAltitude(airspace.upperLimit);
  }

  if (airspace.lowerLimit) {
    vatAirspace.floor = normalizeAltitude(airspace.lowerLimit);
  }

  // Convert boundaries
  if (airspace.boundaries && airspace.boundaries.length > 0) {
    vatAirspace.boundaries = airspace.boundaries.map(boundary => ({
      lat: normalizeCoordinate(boundary.latitude),
      lon: normalizeCoordinate(boundary.longitude)
    }));
  }

  // Add additional properties if present
  if (airspace.conditional !== undefined) {
    vatAirspace.conditional = airspace.conditional;
  }

  if (airspace.class) {
    vatAirspace.class = airspace.class;
  }

  if (airspace.frequency) {
    vatAirspace.frequency = airspace.frequency;
  }

  return vatAirspace;
}

/**
 * Convert a position to VATGlasses format
 */
function convertPosition(position) {
  const vatPosition = {
    id: position.id || generateId('POS'),
    callsign: position.callsign || position.name,
    frequency: position.frequency || '000.000',
    name: position.name || 'Unknown Position'
  };

  // Add position type (e.g., CTR, APP, TWR, GND, DEL)
  if (position.type) {
    vatPosition.type = position.type.toUpperCase();
  }

  // Add coordinates if present
  if (position.latitude && position.longitude) {
    vatPosition.coordinates = {
      lat: normalizeCoordinate(position.latitude),
      lon: normalizeCoordinate(position.longitude)
    };
  }

  // Add airspace ownership if present
  if (position.airspace) {
    vatPosition.airspace = Array.isArray(position.airspace)
      ? position.airspace
      : [position.airspace];
  }

  return vatPosition;
}

/**
 * Convert an airport to VATGlasses format
 */
function convertAirport(airport) {
  const vatAirport = {
    icao: airport.icao || airport.code,
    name: airport.name || 'Unknown Airport',
    coordinates: {
      lat: normalizeCoordinate(airport.latitude),
      lon: normalizeCoordinate(airport.longitude)
    }
  };

  // Add elevation if present
  if (airport.elevation !== undefined) {
    vatAirport.elevation = airport.elevation;
  }

  // Add runways if present
  if (airport.runways) {
    vatAirport.runways = airport.runways;
  }

  // Add ownership (positions that control this airport)
  if (airport.positions) {
    vatAirport.ownership = Array.isArray(airport.positions)
      ? airport.positions
      : [airport.positions];
  }

  return vatAirport;
}

// Helper functions

/**
 * Normalize airspace type to standard codes
 */
function normalizeAirspaceType(type) {
  if (!type) return 'OTHER';

  const typeMap = {
    'CLASS A': 'A',
    'CLASS B': 'B',
    'CLASS C': 'C',
    'CLASS D': 'D',
    'CLASS E': 'E',
    'CLASS F': 'F',
    'CLASS G': 'G',
    'CONTROL ZONE': 'CTR',
    'CTR': 'CTR',
    'CONTROL AREA': 'CTA',
    'CTA': 'CTA',
    'TERMINAL CONTROL AREA': 'TMA',
    'TMA': 'TMA',
    'RESTRICTED': 'R',
    'PROHIBITED': 'P',
    'DANGER': 'D',
    'MILITARY': 'M'
  };

  const upperType = type.toUpperCase().trim();
  return typeMap[upperType] || upperType;
}

/**
 * Normalize altitude to standard format
 * @param {string|number} altitude - Altitude string or number
 * @returns {Object} Normalized altitude object
 */
function normalizeAltitude(altitude) {
  if (typeof altitude === 'object') return altitude;

  const altStr = altitude.toString().toUpperCase().trim();

  // Handle unlimited
  if (altStr === 'UNL' || altStr === 'UNLIMITED') {
    return {
      value: 999,
      unit: 'FL',
      reference: 'STD'
    };
  }

  // Handle ground level
  if (altStr === 'GND' || altStr === 'GROUND' || altStr === 'SFC') {
    return {
      value: 0,
      unit: 'FT',
      reference: 'AGL'
    };
  }

  // Parse flight level (e.g., "FL350", "F350")
  const flMatch = altStr.match(/F?L?(\d+)/);
  if (flMatch && parseInt(flMatch[1]) > 180) {
    return {
      value: parseInt(flMatch[1]),
      unit: 'FL',
      reference: 'STD'
    };
  }

  // Parse feet (e.g., "5000FT", "5000'", "5000 AMSL")
  const ftMatch = altStr.match(/(\d+)\s*(FT|'|FEET|AMSL|AGL)?/);
  if (ftMatch) {
    const isAGL = altStr.includes('AGL') || altStr.includes('ABOVE GROUND');
    return {
      value: parseInt(ftMatch[1]),
      unit: 'FT',
      reference: isAGL ? 'AGL' : 'AMSL'
    };
  }

  // Default
  return {
    value: 0,
    unit: 'FT',
    reference: 'AMSL'
  };
}

/**
 * Normalize coordinate to decimal degrees
 */
function normalizeCoordinate(coord) {
  if (typeof coord === 'number') {
    return parseFloat(coord.toFixed(6));
  }

  const num = parseFloat(coord);
  if (!isNaN(num)) {
    return parseFloat(num.toFixed(6));
  }

  return 0;
}

/**
 * Generate a unique ID
 */
function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

/**
 * Validate VATGlasses data structure
 * @param {Object} data - VATGlasses data to validate
 * @returns {Object} Validation result
 */
function validateVATGlassesData(data) {
  const errors = [];
  const warnings = [];

  // Check required top-level properties
  if (!data.airspace && !data.positions && !data.airports) {
    errors.push('Data must contain at least one of: airspace, positions, or airports');
  }

  // Validate airspaces
  if (data.airspace) {
    if (!Array.isArray(data.airspace)) {
      errors.push('airspace must be an array');
    } else {
      data.airspace.forEach((airspace, index) => {
        if (!airspace.id) warnings.push(`Airspace at index ${index} missing id`);
        if (!airspace.name) warnings.push(`Airspace at index ${index} missing name`);
        if (!airspace.boundaries || airspace.boundaries.length === 0) {
          warnings.push(`Airspace ${airspace.id || index} has no boundaries`);
        }
      });
    }
  }

  // Validate positions
  if (data.positions) {
    if (!Array.isArray(data.positions)) {
      errors.push('positions must be an array');
    } else {
      data.positions.forEach((position, index) => {
        if (!position.callsign) warnings.push(`Position at index ${index} missing callsign`);
        if (!position.frequency) warnings.push(`Position at index ${index} missing frequency`);
      });
    }
  }

  // Validate airports
  if (data.airports) {
    if (!Array.isArray(data.airports)) {
      errors.push('airports must be an array');
    } else {
      data.airports.forEach((airport, index) => {
        if (!airport.icao) warnings.push(`Airport at index ${index} missing ICAO code`);
        if (!airport.coordinates) warnings.push(`Airport at index ${index} missing coordinates`);
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  convertToVATGlasses,
  validateVATGlassesData
};
