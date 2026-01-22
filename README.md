# DAH Extractor

A cross-platform desktop application that extracts airspace data from DAH (Designated Airspace Handbook) files from Air Services Australia and converts them to VATGlasses-compatible JSON format.

## Features

- **User-friendly GUI** - Simple drag-and-drop interface
- **Multiple format support** - Handles CSV, structured text, JSON, and PDF text exports
- **Automatic parsing** - Intelligently detects and parses DAH file formats
- **VATGlasses compatible** - Outputs standardized JSON for VATGlasses applications
- **Cross-platform** - Works on Windows, macOS, and Linux
- **Preview & Export** - Preview converted data before saving

## Installation

### Prerequisites

- Node.js 16.x or higher
- npm (comes with Node.js)

### Setup on Windows

1. **Clone or download this repository** to your desired location:
   ```
   C:\Users\levis\Documents\Development files\dahextractor
   ```

2. **Open Command Prompt or PowerShell** in the project directory

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the application:**
   ```bash
   npm start
   ```

### Setup on macOS/Linux

1. **Clone or download this repository**

2. **Open Terminal** in the project directory

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the application:**
   ```bash
   npm start
   ```

## Usage

### Basic Workflow

1. **Launch the application** using `npm start`

2. **Select a DAH file:**
   - Click "Select DAH File" button, or
   - Drag and drop a DAH file onto the window

3. **Convert the file:**
   - Click "Convert to VATGlasses JSON"
   - Wait for the conversion to complete

4. **Preview the results:**
   - Review the converted JSON in the preview pane
   - Check the summary of extracted data

5. **Save or copy:**
   - Click "Save JSON File" to export to a file
   - Click "Copy to Clipboard" to copy the JSON

### Keyboard Shortcuts

- `Ctrl+O` (or `Cmd+O` on Mac) - Open file dialog
- `Ctrl+S` (or `Cmd+S` on Mac) - Save converted file
- `Ctrl+Enter` (or `Cmd+Enter` on Mac) - Convert file

## Supported DAH File Formats

The parser automatically detects and handles:

1. **CSV Format** - Comma-separated values with headers
   - Expected columns: Airspace ID, Name, Latitude, Longitude, Upper Limit, Lower Limit, etc.

2. **Structured Text** - Common in PDF text exports
   - Airspace definitions with coordinate pairs
   - Altitude limits (UPPER, LOWER)

3. **JSON Format** - Pre-structured JSON data

4. **Generic Text** - Attempts to extract coordinate pairs and airspace information

## Output Format

The application generates VATGlasses-compatible JSON with the following structure:

```json
{
  "airspace": [
    {
      "id": "AIRSPACE_ID",
      "name": "Airspace Name",
      "type": "CTR",
      "ceiling": {
        "value": 5000,
        "unit": "FT",
        "reference": "AMSL"
      },
      "floor": {
        "value": 0,
        "unit": "FT",
        "reference": "AGL"
      },
      "boundaries": [
        { "lat": -33.946111, "lon": 151.177222 },
        { "lat": -33.956111, "lon": 151.187222 }
      ]
    }
  ],
  "positions": [],
  "airports": [],
  "metadata": {
    "generatedAt": "2026-01-22T...",
    "source": "Air Services Australia DAH",
    "version": "1.0"
  }
}
```

## Building Executables

To create standalone executables for distribution:

### Windows

```bash
npm run build:win
```

This creates:
- `dist/DAH Extractor Setup.exe` - Installer
- `dist/DAH Extractor Portable.exe` - Portable version

### macOS

```bash
npm run build:mac
```

Creates: `dist/DAH Extractor.dmg`

### Linux

```bash
npm run build:linux
```

Creates:
- `dist/DAH Extractor.AppImage`
- `dist/dah-extractor.deb`

## Development

### Project Structure

```
dahextractor/
├── main.js           # Electron main process
├── renderer.js       # UI logic and event handlers
├── parser.js         # DAH file parser
├── converter.js      # VATGlasses format converter
├── index.html        # Application UI
├── styles.css        # Styling
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

### Adding Custom Parsers

To add support for additional DAH formats:

1. Open `parser.js`
2. Add a new detection pattern in `detectFileFormat()`
3. Implement a parsing function (e.g., `parseCustomFormat()`)
4. Add the format to the switch statement in `parseDAHFile()`

### Modifying VATGlasses Output

To customize the VATGlasses output format:

1. Open `converter.js`
2. Modify the conversion functions:
   - `convertAirspace()` - Airspace structure
   - `convertPosition()` - Position structure
   - `convertAirport()` - Airport structure

## Data Sources

- **DAH Files:** [Air Services Australia](https://www.airservicesaustralia.com/aip/aip.asp)
- **VATGlasses:** [VATGlasses Project](https://vatglasses.uk/)

## Troubleshooting

### "Cannot find module" errors

Run `npm install` to ensure all dependencies are installed.

### Parser not detecting format

The parser may need adjustment for specific DAH file formats. Please:
1. Check that the file contains valid airspace data
2. Try converting the PDF to plain text first
3. Open an issue with a sample file (if shareable)

### Conversion produces empty data

Ensure the DAH file contains:
- Airspace names or IDs
- Coordinate information (latitude/longitude)
- Altitude data (optional but recommended)

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

## Acknowledgments

- Air Services Australia for providing DAH data
- VATGlasses project for the JSON format specification
- Electron framework for enabling cross-platform desktop development
