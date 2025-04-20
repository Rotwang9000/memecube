# MemeCube Project Outline

## Overview
A Three.js-based interactive 3D application that displays meme coin tags as a coherent 3D cube structure. Users can submit tags that fly into the structure, and viewers can navigate around the 3D space and click on tags to visit associated URLs.

## Core Features
- Space-themed environment with stars and ambient lighting
- 3D cube structure formed by the 3D text elements themselves
- Deep text extrusion to create cube-like appearances for each tag
- Grid-based layout with all text aligned to X, Y, or Z axes
- Tags prefixed with "$" symbol in a square font style
- Dynamic structure growth as more tags are added
- "Squeezing" behaviour where neighboring tags resize to accommodate new ones
- Animation system for new tags flying in and integrating into the structure
- Interactive camera controls for viewers to navigate the 3D space
- Click detection on text elements to open associated information in the scoreboard.
- Demo mode with random tags appearing periodically
- DexScreener API integration to display latest tokens sized by market cap
- Payment integration (future feature) to allow users to pay in SOL for larger text size

## Technical Structure
- `/index.html` - Main entry point
- `/css/style.css` - Styling
- `/js/main.js` - Application initialization and demo mode
- `/js/core/scene.js` - Three.js scene setup and lighting management
- `/js/interactions/tags.js` - Tag management, grid system, and animations
- `/js/core/controls.js` - Camera and user interaction
- `/js/utils/utils.js` - Utility functions
- `/js/data-processors/` - Data processing modules for API integration
  - `/js/data-processors/DataProcessor.js` - Generic data processor base class
  - `/js/data-processors/DexScreenerProcessor.js` - DexScreener implementation
  - `/js/data-processors/CoinGeckoProcessor.js` - Sample CoinGecko implementation
- `/js/ui/DexScreenerManager.js` - UI management for token data
- `/js/visualizations/` - 3D visualizations
  - `/js/visualizations/token-scoreboard.js` - LED scoreboard for token data
  - `/js/visualizations/token-chart-3d.js` - 3D chart visualization
  - `/js/visualizations/token-cube.js` - Token cube visualization


## Implementation Details
- Deep text extrusion with reduced curve segments for blocky appearance
- Tags are positioned at right angles to each other
- Each new tag triggers a check of neighboring positions
- Older tags naturally fill the inner spaces as the structure grows
- Smooth animations for flying in, resizing,
- Dynamic lighting to enhance 3D appearance
- DexScreener API integration to fetch latest token profiles and market data
- Modal interface for displaying tokens with market cap-based sizing

## Technical Requirements
- Three.js for 3D rendering
- Modern JavaScript (ES6+)
- Responsive design for various screen sizes 
- DexScreener API for token data 

## Architecture

The application follows a modular architecture to allow for better maintainability and extensibility.

### Data Flow

1. Token data is fetched and processed by provider-agnostic data providers
2. Visualizations use this data to render 3D representations
3. User interactions with visualizations trigger actions

### Provider-Agnostic System

The system is designed to be provider-agnostic, separating data providers from visualizations:

1. `TokenDataProvider` - Base interface for any data provider
2. Specific implementations (like `DexScreenerProvider`) handle provider-specific logic
3. `VisualizationManager` uses any `TokenDataProvider` to display data

This architecture allows:
- Easy switching between different data sources
- Consistent visualization regardless of data source
- Testing with mock data providers
- Adding new data sources without changing visualization code

### Directory Structure

```
memecube/
├── 📁 assets/
│   └── [...]
├── 📁 css/
│   └── [...]
├── 📁 js/
│   ├── 📁 core/
│   │   ├── scene.js
│   │   └── [...]
│   ├── 📁 data-providers/
│   │   ├── TokenDataProvider.js
│   │   ├── DexScreenerProvider.js
│   │   └── [...]
│   ├── 📁 interactions/
│   │   ├── 📁 tag-cluster/
│   │   │   ├── tags.js
│   │   │   └── tag-cluster.js
│   │   └── [...]
│   ├── 📁 ui/
│   │   └── VisualizationManager.js
│   ├── 📁 utils/
│   │   └── [...]
│   ├── 📁 visualizations/
│   │   ├── token-scoreboard.js
│   │   ├── token-chart-3d.js
│   │   └── [...]
│   └── main.js
└── index.html
``` 