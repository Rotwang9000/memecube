# MemeCube

An interactive 3D visualization of cryptocurrency meme coin tags that form a Borg-like cube structure.

## Overview

MemeCube is a Three.js-based web application where meme coin tags are displayed as 3D text elements that physically form a cube structure. New tags fly in from space and push existing tags inward as they join the structure. The cube grows organically as more tags are added, with older tags shrinking and moving toward the center. Viewers can navigate around this 3D structure and click on tags to visit the associated websites.

## Features

- Interactive 3D space environment with dynamic lighting
- Cube structure formed entirely by the 3D text elements themselves
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

## How It Works

1. The application creates a 3D space environment where tags form a cube structure
2. Each tag is rendered as deep 3D text with a cube-like appearance
3. The tags themselves form the entire structure - there is no wireframe
4. All tags are treated as solid objects that cannot overlap or intersect
5. New tags fly in from random directions outside the structure
6. Tags collide with existing tags causing dynamic chain reactions
7. Collisions create dramatic movements with tags pushing each other aside
8. Larger tags create more powerful collisions and push smaller tags further
9. The system supports varying tag sizes with occasional larger tags for visual interest
10. When tags collide, energy propagates through the structure creating secondary collisions
11. Organic movement is created through randomized jitter in collision responses
12. Tags shrink in response to collisions, with shrink amount based on collision energy
13. Users can navigate around using intuitive controls (orbit by default or fly mode)
14. Clicking on a tag opens the associated URL in a new tab
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

1. Tokens from DexScreener are represented as colourful spheres in a 3D cube
2. Each token's size is proportional to its market capitalization (logarithmic scale)
3. The visualization refreshes every 6 seconds with the latest market data
4. New tokens fly into the cube from random directions outside the visualization
5. Tokens no longer in the latest list fly out of the cube with smooth animations
6. Existing tokens dynamically resize based on changes in their market cap
7. Tokens periodically reposition themselves within the cube for better visibility
8. The entire cube gently rotates to showcase all tokens from different angles
9. The visualization provides an intuitive real-time view of market activity

## Tag Interaction System Rules

The 3D tag visualisation follows these strict, non-negotiable rules:

1. **Single Cohesive Unit**: All established tags (not currently flying in/out) MUST form a single cohesive unit called the "cube". The system enforces this by:
   - Continuously identifying the largest connected cluster of tags
   - Applying strong attraction forces to any disconnected tags
   - Ensuring no tag drifts away from the main structure
   - Maintaining appropriate spacing while preserving the cube structure

2. **No Space Sharing**: Tags must NEVER occupy the same space. The system ensures this through multiple mechanisms:
   - Immediate collision resolution when overlaps are detected (sorted by severity)
   - Predictive collision avoidance that anticipates potential overlaps 0.2 seconds ahead
   - Preemptive movement when tags resize to make space before collisions occur
   - Tags move just enough to allow passage without disrupting the cohesive structure
   - Movement is primarily vertical (up/down) to maintain readability 
   - Cascading movements occur as needed - one tag pushing others in a chain reaction

3. **Smart Movement Priorities**: The system intelligently determines which tags should move:
   - Smaller tags yield to larger ones (preserving prominence of important tokens)
   - Non-core tags (outside the main cluster) move more readily than core tags
   - Tags prefer vertical movement whenever possible to maintain readability
   - Movement is dampened over time to prevent oscillations or instability

4. **Dynamic Resizing Accommodation**: When tags change size:
   - Surrounding tags pre-emptively move out of the way before the collision occurs
   - The system calculates predicted boundaries and initiates avoidance early
   - Growth is smooth and accompanied by appropriate rearrangements
   - The cube structure adapts organically to size changes

5. **Elastic Structure Integrity**: The entire cube acts like an elastic, self-healing structure:
   - All tags are loosely attracted to the main cluster's center of mass
   - Stronger attractions apply to disconnected tags to pull them back into the structure
   - The system maintains an appropriate balance between cohesion and spacing
   - The structure automatically reorganizes after significant changes

These rules ensure a dynamic but stable visualisation where all tags maintain logical positioning without overlaps while always forming a single, visually coherent unit.

## Future Plans

- Integration with Solana blockchain for payments
- Tag size proportional to the amount paid
- Analytics for tag impressions and clicks
- Enhanced visual effects
- Additional DexScreener data integrations
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