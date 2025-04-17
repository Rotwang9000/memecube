# MemeCube

An interactive 3D visualization of cryptocurrency meme coin tags that form a Borg-like cube structure.

## Overview

MemeCube is a Three.js-based web application where meme coin tags are displayed as 3D text elements that physically form a cube structure. New tags fly in from space and push existing tags inward as they join the structure. The cube grows organically as more tags are added, with older tags shrinking and moving toward the center. Viewers can navigate around this 3D structure and click on tags to visit the associated websites.

## Features

- Interactive 3D space environment with dynamic lighting
- Cube structure formed entirely by the 3D text elements themselves (Cube being a loose term for the cohesive unit made up of tags that may not be an exact cube but all letters should be at right angles whatever way they face)
- No wireframe - the letters themselves ARE the cube
- Tags physically touch and form the outer shell of the cube
- 3D text with deep extrusion and blocky appearance
- Tags prefixed with "$" symbol
- Borg-like organic construction where new tags push older ones inward
- Older tags shrink and move toward the center as the structure grows
- Organic growth pattern with subtle imperfections
- Free-flight camera navigation
- Clickable tags that open URLs
- Demo mode with random tags appearing periodically
- DexScreener API integration to display and add latest tokens sized by market cap
- Size-based tag prominence (future feature tied to SOL payments)
- Dynamic token cube visualization showing real-time market movements

## Development

This project uses:
- Three.js for 3D rendering
- Modern JavaScript (ES6+)
- HTML5 and CSS3
- DexScreener API for token data

## Running the Project

### Quick Start

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3008`

### Development Mode

To run with auto-restart on file changes:
```
npm run dev
```

## Recent Updates

### Tag System Refactoring (April 2023)

The tag system has been completely refactored to use a more robust physics-based approach:

- The old tag positioning system has been replaced with a new TagManager and TagPhysics implementation
- Font handling has been simplified and streamlined
- The older tag components (tag-creator, tag-positioning, tag-animation, tag-interaction, tag-font-loader) have been consolidated into a more efficient system
- The new system provides better performance and more realistic tag interactions

### Font Setup

The project uses custom fonts for 3D text:
- Primary fonts are stored in the `/fonts` directory
- The system now uses the Three.js TextGeometry and FontLoader via the import map
- New fonts can be added to the fonts directory and will be automatically detected

## How It Works

1. The application creates a 3D space environment where tags form a cube structure
2. Each tag is rendered as deep 3D text with a cube-like appearance
3. The tags themselves form the entire structure - there is no wireframe
4. All tags are treated as solid objects that cannot overlap or intersect
5. New tags fly in like arrows from random directions outside the structure
6. Tags collide with existing tags causing dynamic chain reactions
7. Collisions create dramatic movements with tags pushing each other aside
9. The system supports varying tag sizes with occasional larger tags for visual interest, often based on a variable like Market cap.
10. When tags collide, movement propagates through the structure creating secondary movements.
11. A secondary movement will not cause the initiating mover to move again until the movement chain is complete.
12. Only one movement chain at a time.
13. Users can navigate around using intuitive controls (orbit by default or fly mode)
14. Clicking on a tag opens the details in the token-scoreboard and a graph in the token-chart-3d. 
15. In demo mode, random tags appear periodically to showcase the dynamic growth

## DexScreener Integration

The application integrates with the DexScreener API to fetch and display the latest token profiles:

1. Latest token profiles are fetched from the DexScreener API
2. Market data (including price and market cap) is retrieved for each token
3. Tokens are displayed in a modal window, sorted by market cap
4. Users can view token details or add tokens to the cube directly from the list
5. Token size in the cube is proportional to its market cap (larger market cap = larger tag)
6. The modal provides a clean interface for browsing the latest tokens in the crypto market

## Token Cube Visualization

The token cube is a dynamic 3D visualization of the latest cryptocurrencies:

1. Tokens from DexScreener are represented our "cube"
2. Each token's size is proportional to its market capitalization (logarithmic scale)
3. The visualization refreshes every 6 seconds with the latest market tokens and updates a few with further details like market cap.
4. New tokens fly into the cube from random directions outside the visualization
5. Tokens no longer in the latest list fly out of the cube with smooth animations
6. Existing tokens dynamically resize based on changes in their market cap
8. The entire cube gently rotates to showcase all tokens from different angles
9. The visualization provides an intuitive real-time view of market activity

## Tag Interaction System Rules

The 3D tag system now uses a physics-based approach for realistic and stable interactions:

1. **Force-Based Positioning**: Tags are positioned using a physics model with repulsion, attraction and damping forces:
   - Tags naturally repel each other to prevent overlaps
   - A central attraction force keeps the entire structure cohesive
   - Velocity damping ensures tags settle into stable positions
   - Mass-proportional forces ensure larger tags have more influence

2. **Smooth Tag Entry**: New tags enter the scene with a natural flight path:
   - They only fly like an arrow ie. Left or Right of reading diretion
   - Tags appear from random positions outside the visible area
   - They fly towards their destination with intelligent path adjustment
   - The flight path adapts to avoid collisions with existing tags
   - Upon arrival, they seamlessly join the physics system

3. **Dynamic Resizing**: When tags change size due to market cap updates:
   - Smooth animations make size transitions visually appealing 
   - The physics system automatically adjusts to accommodate size changes
   - Larger tags naturally create space pushing the other items around so it appears to bubble.
   - Mass calculations update automatically to maintain proper physics

4. **Collision Handling**: Tags react realistically when they come into contact:
   - Precise bounding box detection prevents any overlap
   - Vertical separation is prioritised to maintain readability
   - Collisions trigger appropriate forces based on tag mass
   - Higher damping after collisions prevents oscillation
   - Tags only move just enough.. They do not fly off if they are hit but stay in the structure.

5. **Cohesive Structure**: The entire cube maintains its integrity through:
   - Continuous calculation of the center of mass
   - Distance-based attraction forces pulling outliers back
   - Balanced repulsion forces maintaining appropriate spacing
   - Predictive collision avoidance to prevent disruptive movements

This new physics-based approach creates a more natural, stable and visually appealing representation of a bubbling, living tag cube while maintaining the core concept of a cohesive structure formed entirely by 3D text elements.

## Future Plans

- Integration with Solana blockchain for payments for advertising and promotion
- Tag size proportional to the amount paid
- Analytics for tag impressions and clicks
- Enhanced visual effects
- Additional  data integrations
- Historical token performance visualization
- Touch-based interaction with token cube on mobile devices
- More detailed token metrics visualization
- Filtering and sorting options for token cube

## Code Organization

The codebase is organized into the following folders:

### Core Structure
- `js/core/` - Core application components (scene, controls)
- `js/data-processors/` - Data processing classes for different API sources
- `js/interactions/` - Tag-related interactions and components
- `js/ui/` - UI components and managers
- `js/utils/` - Utility functions and helpers
- `js/visualizations/` - 3D visualizations (scoreboard, chart, cube)

### Data Processing
The application uses a generic data processing architecture that allows for adding multiple data sources:
- `DataProcessor.js` - Base class for all data processors
- `DexScreenerProcessor.js` - Implementation for DexScreener API

This architecture makes it easy to add new data sources while reusing the visualization components.

### Tag System
The new tag interaction system uses a more robust physics-based approach:
- `TagPhysics.js` - Core physics engine for tag positioning and movement
- `TagManager.js` - High-level manager for creating and controlling tags
- `TagSystemDemo.js` - Demonstration of the tag system capabilities

The physics-based approach provides more realistic and stable tag interactions while maintaining the core visual concept.