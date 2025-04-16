# MemeCube Project Outline

## Overview
A Three.js-based interactive 3D application that displays meme coin tags as a coherent 3D cube structure. Users can submit tags that fly into the structure, and viewers can navigate around the 3D space and click on tags to visit associated URLs.

## Core Features
- Space-themed environment with stars and ambient lighting
- 3D cube structure formed by the 3D text elements themselves
- Deep text extrusion to create cube-like appearances for each tag
- Grid-based layout with all text aligned to X, Y, or Z axes
- Shell-based positioning system that prioritizes outer positions
- Tags prefixed with "$" symbol in a square font style
- Varying random sizes for visual interest
- Dynamic structure growth as more tags are added
- "Squeezing" behaviour where neighboring tags resize to accommodate new ones
- Animation system for new tags flying in and integrating into the structure
- Interactive camera controls for viewers to navigate the 3D space
- Click detection on text elements to open associated URLs
- Demo mode with random tags appearing periodically
- Optional wireframe visualization
- DexScreener API integration to display latest tokens sized by market cap
- Payment integration (future feature) to allow users to pay in SOL for larger text size

## Technical Structure
- `/index.html` - Main entry point
- `/css/style.css` - Styling
- `/js/main.js` - Application initialization and demo mode
- `/js/scene.js` - Three.js scene setup and lighting management
- `/js/tags.js` - Tag management, grid system, and animations
- `/js/controls.js` - Camera and user interaction
- `/js/utils.js` - Utility functions
- `/js/dex-screener.js` - DexScreener API integration and token display

## Development Phases
1. Basic setup and space environment creation
2. 3D text rendering with cube-like appearance
3. Grid-based structure and shell-based positioning system
4. Tag animation and dynamic resizing system
5. Structure growth and management
6. Demo mode with periodic random tag generation
7. User interaction and navigation
8. URL linking functionality
9. DexScreener API integration
10. Payment integration (future phase)

## Implementation Details
- Deep text extrusion with reduced curve segments for blocky appearance
- Grid-based system for positioning tags in 3D space
- Shell-layer calculation to prioritize outer positions
- Tags are positioned at right angles to each other
- Each new tag triggers a check of neighboring positions
- Neighboring tags are resized to make room for new additions
- When grid is full, the entire structure grows to accommodate more tags
- Older tags naturally fill the inner spaces as the structure grows
- Smooth animations for flying in, resizing, and subtle movement
- Dynamic lighting to enhance 3D appearance
- DexScreener API integration to fetch latest token profiles and market data
- Modal interface for displaying tokens with market cap-based sizing

## Technical Requirements
- Three.js for 3D rendering
- Modern JavaScript (ES6+)
- Responsive design for various screen sizes 
- DexScreener API for token data 

## Architecture

### Data Processing Architecture

The application now uses a modular data processing architecture:

1. **Base DataProcessor Class**
   - Handles common operations like fetching, caching, and data management
   - Provides callback system for notifying components of data updates
   - Defines a common interface that all processors must implement

2. **Specific Processors**
   - `DexScreenerProcessor`: Fetches and processes data from DexScreener API
   - `CoinGeckoProcessor`: Sample implementation for CoinGecko API (for demonstration)
   - Future processors can be added for other data sources

3. **UI Components**
   - UI elements are decoupled from specific data sources
   - Components register as listeners with data processors
   - This allows any visualization to be used with any data source

### Folder Structure

```
js/
├── core/             # Core application components
│   ├── controls.js
│   └── scene.js
├── data-processors/  # Data processing modules
│   ├── DataProcessor.js
│   ├── DexScreenerProcessor.js
│   └── CoinGeckoProcessor.js
├── interactions/     # Tag interactions
│   ├── tags.js
│   ├── tag-animation.js
│   ├── tag-creator.js
│   └── ...
├── ui/               # UI components
│   └── DexScreenerManager.js
├── utils/            # Utility functions
│   └── utils.js
├── visualizations/   # 3D visualizations
│   ├── token-chart-3d.js
│   ├── token-cube.js
│   └── token-scoreboard.js
└── main.js           # Main application entry point
``` 