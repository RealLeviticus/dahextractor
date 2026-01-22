/**
 * DAH File Parser
 * Parses Designated Airspace Handbook files from Air Services Australia
 *
 * Note: This parser is designed to be flexible and handle various DAH formats.
 * Once a sample file is provided, this can be refined for the specific format.
 */

/**
 * Parse a DAH file content and extract airspace data
 * @param {string} fileContent - The content of the DAH file
 * @returns {Object} Parsed airspace data
 */
function parseDAHFile(fileContent) {
  try {
    // Initialize the parsed data structure
    const parsedData = {
      airspaces: [],
      positions: [],
      airports: [],
      metadata: {
        parseDate: new Date().toISOString(),
        source: 'Air Services Australia DAH'
      }
    };

    // Detect the file format
    const format = detectFileFormat(fileContent);

    switch (format) {
      case 'csv':
        return parseCSVFormat(fileContent, parsedData);
      case 'structured_text':
        return parseStructuredText(fileContent, parsedData);
      case 'json':
        return parseJSONFormat(fileContent, parsedData);
      default:
        return parseGenericFormat(fileContent, parsedData);
    }
  } catch (error) {
    throw new Error(`Failed to parse DAH file: ${error.message}`);
  }
}

/**
 * Detect the format of the DAH file
 * @param {string} content - File content
 * @returns {string} Format type
 */
function detectFileFormat(content) {
  // Try to detect JSON
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    try {
      JSON.parse(content);
      return 'json';
    } catch (e) {
      // Not valid JSON
    }
  }

  // Check for CSV (comma-separated with headers)
  const lines = content.split('\n');
  if (lines.length > 1 && lines[0].includes(',')) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('airspace') || firstLine.includes('latitude') || firstLine.includes('name')) {
      return 'csv';
    }
  }

  // Check for structured text format
  if (content.includes('AIRSPACE') || content.includes('Airspace') ||
      content.includes('UPPER LIMIT') || content.includes('LOWER LIMIT')) {
    return 'structured_text';
  }

  return 'generic';
}

/**
 * Parse CSV format DAH file
 * Expected columns: Airspace ID, Sequence Number, Airspace Name, Conditional Status,
 *                   Boundary Via, Latitude, Longitude, Upper Limit, Lower Limit, etc.
 */
function parseCSVFormat(content, parsedData) {
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must have headers and at least one data row');
  }

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  // Map common column variations
  const columnMap = mapColumnNames(headers);

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const airspace = {};
    headers.forEach((header, index) => {
      airspace[header] = values[index].trim();
    });

    // Create structured airspace object
    const structuredAirspace = {
      id: airspace[columnMap.id] || `AIRSPACE_${i}`,
      name: airspace[columnMap.name] || 'Unknown',
      type: airspace[columnMap.type] || 'UNKNOWN',
      boundaries: [],
      upperLimit: airspace[columnMap.upperLimit] || 'UNL',
      lowerLimit: airspace[columnMap.lowerLimit] || 'GND',
      conditional: airspace[columnMap.conditional] || false
    };

    // Add coordinate if present
    if (airspace[columnMap.latitude] && airspace[columnMap.longitude]) {
      structuredAirspace.boundaries.push({
        latitude: parseCoordinate(airspace[columnMap.latitude]),
        longitude: parseCoordinate(airspace[columnMap.longitude]),
        sequence: parseInt(airspace[columnMap.sequence]) || 0
      });
    }

    parsedData.airspaces.push(structuredAirspace);
  }

  // Group by airspace ID and merge boundaries
  parsedData.airspaces = mergeAirspaceBoundaries(parsedData.airspaces);

  return parsedData;
}

/**
 * Parse structured text format (common in PDF extracts)
 */
function parseStructuredText(content, parsedData) {
  const lines = content.split('\n');
  let currentAirspace = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Look for airspace name/ID patterns
    if (trimmed.match(/^[A-Z0-9-]+\s+[A-Z]/)) {
      // Start of new airspace
      if (currentAirspace) {
        parsedData.airspaces.push(currentAirspace);
      }
      currentAirspace = {
        id: extractAirspaceId(trimmed),
        name: extractAirspaceName(trimmed),
        boundaries: [],
        upperLimit: 'UNL',
        lowerLimit: 'GND'
      };
    }

    // Look for altitude limits
    if (currentAirspace) {
      const upperMatch = trimmed.match(/UPPER[:\s]+([^\s]+)/i);
      const lowerMatch = trimmed.match(/LOWER[:\s]+([^\s]+)/i);

      if (upperMatch) currentAirspace.upperLimit = upperMatch[1];
      if (lowerMatch) currentAirspace.lowerLimit = lowerMatch[1];

      // Look for coordinates
      const coordMatch = extractCoordinates(trimmed);
      if (coordMatch) {
        currentAirspace.boundaries.push(coordMatch);
      }
    }
  }

  if (currentAirspace) {
    parsedData.airspaces.push(currentAirspace);
  }

  return parsedData;
}

/**
 * Parse JSON format DAH file
 */
function parseJSONFormat(content, parsedData) {
  const jsonData = JSON.parse(content);

  // Handle different JSON structures
  if (Array.isArray(jsonData)) {
    parsedData.airspaces = jsonData;
  } else if (jsonData.airspaces) {
    parsedData.airspaces = jsonData.airspaces;
  } else {
    parsedData.airspaces = [jsonData];
  }

  return parsedData;
}

/**
 * Generic parser for unknown formats
 */
function parseGenericFormat(content, parsedData) {
  // Try to extract any coordinate pairs
  const coordPattern = /(-?\d+\.?\d*)[°\s,]+([NSEW]?)\s*(-?\d+\.?\d*)[°\s,]+([NSEW]?)/gi;
  const matches = content.matchAll(coordPattern);

  const boundaries = [];
  for (const match of matches) {
    boundaries.push({
      latitude: parseCoordinate(match[1] + match[2]),
      longitude: parseCoordinate(match[3] + match[4])
    });
  }

  if (boundaries.length > 0) {
    parsedData.airspaces.push({
      id: 'EXTRACTED_AIRSPACE',
      name: 'Extracted from DAH',
      boundaries: boundaries,
      upperLimit: 'UNL',
      lowerLimit: 'GND'
    });
  }

  return parsedData;
}

// Helper functions

function mapColumnNames(headers) {
  const map = {
    id: null,
    name: null,
    type: null,
    latitude: null,
    longitude: null,
    upperLimit: null,
    lowerLimit: null,
    conditional: null,
    sequence: null
  };

  headers.forEach(header => {
    const lower = header.toLowerCase();
    if (lower.includes('airspace') && lower.includes('id')) map.id = header;
    else if (lower.includes('airspace') && lower.includes('name')) map.name = header;
    else if (lower === 'name' && !map.name) map.name = header;
    else if (lower.includes('type')) map.type = header;
    else if (lower.includes('lat')) map.latitude = header;
    else if (lower.includes('lon')) map.longitude = header;
    else if (lower.includes('upper')) map.upperLimit = header;
    else if (lower.includes('lower')) map.lowerLimit = header;
    else if (lower.includes('conditional')) map.conditional = header;
    else if (lower.includes('sequence')) map.sequence = header;
  });

  return map;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function parseCoordinate(coord) {
  if (typeof coord === 'number') return coord;

  const str = coord.toString().trim();

  // Handle decimal degrees
  const decimal = parseFloat(str);
  if (!isNaN(decimal)) return decimal;

  // Handle DMS format (e.g., "33°52'12"S")
  const dmsMatch = str.match(/(\d+)[°\s]+(\d+)['\s]+(\d+\.?\d*)["\s]*([NSEW])/i);
  if (dmsMatch) {
    const degrees = parseInt(dmsMatch[1]);
    const minutes = parseInt(dmsMatch[2]);
    const seconds = parseFloat(dmsMatch[3]);
    const direction = dmsMatch[4].toUpperCase();

    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (direction === 'S' || direction === 'W') decimal *= -1;

    return decimal;
  }

  return 0;
}

function extractAirspaceId(line) {
  const match = line.match(/^([A-Z0-9-]+)/);
  return match ? match[1] : 'UNKNOWN';
}

function extractAirspaceName(line) {
  const match = line.match(/^[A-Z0-9-]+\s+(.+?)(\s+UPPER|\s+LOWER|$)/i);
  return match ? match[1].trim() : 'Unknown Airspace';
}

function extractCoordinates(line) {
  const pattern = /(-?\d+\.?\d*)[°\s]+([NS])\s+(-?\d+\.?\d*)[°\s]+([EW])/i;
  const match = line.match(pattern);

  if (match) {
    return {
      latitude: parseCoordinate(match[1] + match[2]),
      longitude: parseCoordinate(match[3] + match[4])
    };
  }
  return null;
}

function mergeAirspaceBoundaries(airspaces) {
  const grouped = {};

  airspaces.forEach(airspace => {
    if (!grouped[airspace.id]) {
      grouped[airspace.id] = {
        ...airspace,
        boundaries: []
      };
    }
    grouped[airspace.id].boundaries.push(...airspace.boundaries);
  });

  // Sort boundaries by sequence if available
  Object.values(grouped).forEach(airspace => {
    airspace.boundaries.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  });

  return Object.values(grouped);
}

module.exports = {
  parseDAHFile
};
