# MemeIsometric Cluster

An interactive 3D visualization of cryptocurrency meme coin tags that form a Borg-like Isometric Cluster structure.

## Overview

MemeIsometric Cluster is a Three.js-based web application where meme coin tags are displayed as 3D text elements that physically form a Isometric Cluster structure. New tags fly in from space and push existing tags inward as they join the structure. The Isometric Cluster grows organically as more tags are added, with older tags shrinking and moving toward the center. Viewers can navigate around this 3D structure and click on tags to visit the associated websites.

## Features

- Interactive 3D space environment with dynamic lighting
- Isometric Cluster structure formed entirely by the 3D text elements themselves
- No wireframe - the letters themselves ARE the Isometric Cluster
- Tags physically touch and form the outer shell of the Isometric Cluster
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
- Dynamic token Isometric Cluster visualization showing real-time market movements

## Recent Updates

### Physics Engine Enhancements (June 2024)

The tag physics system has been completely rewritten for more accurate and stable behavior:

- **Proper Isometric Cluster Structure**: Tags now properly align at right angles to form a cohesive Isometric Cluster structure
- **Improved Tag Entry**: New tags fly in like arrows from random entry points outside the Isometric Cluster
- **Realistic Collisions**: Tags now create chain reactions when they collide, with movement propagating through the structure
- **Size-Based Physics**: Larger tags have more mass and naturally create space by pushing other tags aside
- **Stable Positioning**: Tags maintain their positions in the structure with proper forces that prevent excessive movement
- **Smooth Transitions**: Tag resizing now features smooth animations with proper physics effects
- **Intelligent Force Balancing**: The system balances repulsion, cohesion, and attraction forces for natural movement

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

## Tag Interaction System Architecture

The tag system is built with a modular architecture:

1. **TagsManager** (`js/interactions/tag-cluster/tags.js`): High-level compatibility wrapper for backward compatibility with the old system
2. **TagManager** (`js/interactions/tag-cluster/tag-manager.js`): Manages tag creation, user interaction, and rendering
3. **TagPhysics** (`js/interactions/tag-cluster/tag-physics.js`): Core physics engine with force-based positioning and isometric structure maintenance
4. **TagCluster** (`js/interactions/tag-cluster/tag-cluster.js`): Integration layer between DexScreener token data and the tag system

This modular design allows for clear separation of concerns while maintaining a cohesive system. For more detailed information, see the comprehensive documentation in `docs/tag-cluster-system.md`.

The TagPhysics module is independently testable and has unit tests available in the `tests/` directory. You can run these tests by opening `tests/tag-system.html` in your browser.

## How It Works

1. The application creates a 3D space environment where tags form a Isometric Cluster structure
2. Each tag is rendered as deep 3D text with a Isometric Cluster-like appearance
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
16. The Isometric Cluster is an irregular, living thing where things are always moving (plus should have a constant slow spin)

## Tag Physics Rules

The physics system enforces several key principles for a realistic and visually appealing tag structure:

1. **Right-Angle Orientation**: Tags are oriented to align with the six faces of the Isometric Cluster structure, ensuring all text is easily readable and properly aligned.

2. **Proper Collisions**: When tags collide, forces are applied based on their mass and velocity, with larger tags having more influence.

3. **Coherent Structure**: The system maintains the overall Isometric Cluster shape through balanced forces:
   - Surface-facing tags experience forces keeping them near the outer shell
   - Interior tags experience gentle pressure toward the center
   - Each tag's orientation is aligned with its closest Isometric Cluster face

4. **Movement Chains**: When a tag is moved (through collision or size change):
   - The movement propagates to tags it contacts
   - Secondary and tertiary movements occur naturally
   - A single initiator can't be affected by its own chain until the chain completes

5. **Stable Positioning**: Tags move only enough to maintain the structure:
   - Heavy damping prevents excessive oscillation or bouncing
   - Speed limiting prevents tags from flying off
   - Gentle central attraction keeps the structure cohesive

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

## Testing

### Unit Tests

The project includes unit tests for core components:

1. **Physics Tests**: Validate the behavior of the tag physics system:
   ```
   http://localhost:3008/tests/physics.html?run_tests=true
   ```

2. **Tag System Tests**: Verify tag creation, positioning and interaction:
   ```
   http://localhost:3008/tests/tags.html
   ```

## Future Plans

- Integration with Solana blockchain for payments for advertising and promotion
- Tag size proportional to the amount paid
- Analytics for tag impressions and clicks
- Enhanced visual effects
- Additional  data integrations
- Historical token performance visualization
- Touch-based interaction with token Isometric Cluster on mobile devices
- More detailed token metrics visualization
- Filtering and sorting options for token Isometric Cluster

## Code Organization

The codebase is organized into the following folders:

### Core Structure
- `js/core/` - Core application components (scene, controls)
- `js/data-processors/` - Data processing classes for different API sources
- `js/interactions/` - Tag-related interactions and components
- `js/ui/` - UI components and managers
- `js/utils/` - Utility functions and helpers
- `js/visualizations/` - 3D visualizations (scoreboard, chart, Isometric Cluster)

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