# MemeIsometric Cluster

An interactive 3D visualization of cryptocurrency meme coin tags that form a Borg-like Isometric Cluster structure.

## Overview

MemeIsometric Cluster is a Three.js-based web application where meme coin tags are displayed as 3D text elements that physically form an Isometric Cluster structure. New tags fly in from space and push existing tags inward as they join the structure. The Isometric Cluster grows organically as more tags are added, with older tags shrinking and moving toward the centre. Viewers can navigate around this 3D structure and click on tags to visit the associated websites.

## Features

- Interactive 3D space environment with dynamic lighting
- Isometric interlocking cluster structure with strict right angles and minimal spacing
- Balanced tag distribution across all 6 cube faces
- Tags only move up/down relative to themselves during collisions
- No wireframe - the letters themselves ARE the Isometric Cluster
- Tags physically touch with hair's width spacing between them
- 3D text with deep extrusion and blocky appearance
- Tags prefixed with "$" symbol
- Borg-like construction where new tags push older ones inward
- Older tags shrink and move toward the centre as the structure grows
- Free-flight camera navigation
- Clickable tags that open URLs
- Demo mode with random tags appearing periodically
- DexScreener API integration to display and add latest tokens sized by market cap
- Size-based tag prominence (future feature tied to SOL payments)
- Dynamic token Isometric Cluster visualization showing real-time market movements

## Recent Updates

### Borg Structure Enhancement

The tag structure has been refined to create a true Borg-like appearance:

- **Zero-width Spacing**: Tags now have no spacing between them, creating a perfect Borg-like unified structure
- **Bevels Removed**: Text geometry no longer has bevels, eliminating visual gaps between tags
- **Metallic Appearance**: Increased metalness and unified coloring to enhance the Borg aesthetic
- **Minimal Separation**: Collision response now maintains near-perfect alignment with minimal separation
- **Stronger Central Pull**: Tags are pulled more strongly toward the center, maintaining the dense structure
- **Enhanced Face Balancing**: Tags distribute more evenly across all faces, improving the cube formation
- **Improved Visual Cohesion**: The structure appears as one perfectly unified entity with no visible seams

### Physics Engine Improvements 

The tag physics system has been refined for a more organized structure:

- **Strict Right Angles**: Tags are now oriented at precise right angles to create a clean isometric structure
- **Balanced Face Distribution**: Tags are evenly distributed across all 6 faces of the cluster
- **Constrained Movement**: Tags only move up/down relative to themselves during collisions
- **Hair's Width Spacing**: Minimal spacing between tags creates a dense Borg-like appearance
- **Directional Entry**: Tags always fly in along their reading direction for a more natural approach
- **Improved Face Tracking**: System now tracks and balances tag distribution automatically
- **Optimized Collision Response**: Tags respond to collisions in a more organized manner

### Physics Engine Enhancements 

The tag physics system had been completely rewritten for more accurate and stable behavior:

- **Proper Isometric Cluster Structure**: Tags properly align at right angles to form a cohesive structure
- **Improved Tag Entry**: New tags fly in like arrows from random entry points outside the cluster
- **Realistic Collisions**: Tags now create chain reactions when they collide, with movement propagating
- **Size-Based Physics**: Larger tags have more mass and naturally create space by pushing other tags aside
- **Stable Positioning**: Tags maintain their positions with proper forces that prevent excessive movement
- **Smooth Transitions**: Tag resizing now features smooth animations with proper physics effects
- **Intelligent Force Balancing**: The system balances repulsion, cohesion, and attraction forces

### Tag System Refactoring (April 2023)

The tag system has been completely refactored to use a more robust physics-based approach:

- The old tag positioning system has been replaced with a new TagManager and TagPhysics implementation
- Font handling has been simplified and streamlined
- The older tag components have been consolidated into a more efficient system
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

1. The application creates a 3D space environment where tags form an isometric cluster structure
2. Each tag is rendered as deep 3D text with proper right-angle alignment
3. The tags themselves form the entire structure - there is no wireframe
4. All tags are treated as solid objects with hair's width spacing between them
5. New tags fly in along their reading direction from outside the structure
6. Tags are evenly distributed across all 6 faces of the cube structure
7. Tags only move up/down relative to themselves when colliding with other tags
8. Collisions create chain reactions with movement propagating through the structure
9. The system supports varying tag sizes with occasional larger tags for visual interest
10. When tags collide, movement propagates through the structure creating secondary movements
11. A secondary movement will not cause the initiating mover to move again until the chain completes
12. Users can navigate around using intuitive controls (orbit by default or fly mode)
13. Clicking on a tag opens the details in the token-scoreboard and a graph in the token-chart-3d
14. The cluster has a constant slow spin to showcase all faces

## Tag Physics Rules

The physics system enforces several key principles for a precise and visually appealing structure:

1. **Right-Angle Orientation**: Tags are oriented at exact right angles to align with the 6 cube faces, ensuring all text is perfectly readable and properly aligned.

2. **Constrained Movement**: Tags primarily move up and down relative to their own orientation, not sideways, which maintains the clean structure. Tags always fly in and out along their text reading direction.

3. **Balanced Face Distribution**: Tags are evenly distributed across all 6 faces of the cube structure. The system tracks face utilization and prioritizes placing new tags on less utilized faces.

4. **Hair's Width Spacing**: Tags are positioned with minimal separation (hair's width) while ensuring no intersections, creating a dense Borg-like appearance.

5. **Proper Collisions**: When tags collide, forces are applied primarily along their movement axis, with larger tags having more influence based on their mass.

6. **Coherent Structure**: The system maintains the overall isometric shape through balanced forces:
   - Surface-facing tags experience forces keeping them near the outer shell
   - Interior tags experience gentle pressure toward the centre
   - Each tag's orientation is strictly aligned with its cube face

7. **Movement Chains**: When a tag is moved (through collision or size change):
   - The movement propagates to tags it contacts
   - Secondary and tertiary movements occur naturally
   - A single initiator can't be affected by its own chain until the chain completes

8. **Stable Positioning**: Tags move only enough to maintain the structure:
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
   http://localhost:3008/tests/tag-system.html
   ```

### Mock Testing

To facilitate unit testing without Three.js dependencies, the project uses mock implementations:

1. **Mock Tag System**: The `tests/mock-tag-system.js` file provides mock implementations of:
   - THREE.js core components (Vector3, Mesh, etc.)
   - TagManager
   - TagPhysics
   - TagsManager

These mocks enable testing the tag system's logic without requiring the full Three.js library or WebGL context, making tests faster and more reliable.

## Future Plans

- Integration with Solana blockchain for payments for advertising and promotion
- Tag size proportional to the amount paid
- Analytics for tag impressions and clicks
- Enhanced visual effects
- Additional data integrations
- Historical token performance visualization
- Touch-based interaction with token Isometric Cluster on mobile devices
- More detailed token metrics visualization
- Filtering and sorting options for token Isometric Cluster

## Code Organization

The codebase is organized into the following folders:

### Core Structure
- `js/core/` - Core application components (scene, controls)
- `js/data-providers/` - Provider-agnostic data integration system
- `js/interactions/` - Tag-related interactions and components
- `js/ui/` - UI components and managers
- `js/utils/` - Utility functions and helpers
- `js/visualizations/` - 3D visualizations (scoreboard, chart, Isometric Cluster)

### Data Provider Architecture
The application uses a provider-agnostic architecture that allows for multiple data sources:
- `TokenDataProvider.js` - Base interface for all data providers
- `DexScreenerProvider.js` - Implementation for DexScreener API
- `CoinGeckoProvider.js` - Implementation for CoinGecko API

This architecture makes it easy to:
- Add new data sources without changing visualization code
- Switch between data sources at runtime
- Test visualizations with mock data providers
- Maintain consistent data formatting across different sources

### Tag System
The new tag interaction system uses a more robust physics-based approach:
- `TagPhysics.js` - Core physics engine for tag positioning and movement
- `TagManager.js` - High-level manager for creating and controlling tags
- `TagSystemDemo.js` - Demonstration of the tag system capabilities

The physics-based approach provides more realistic and stable tag interactions while maintaining the core visual concept.

## UI Enhancements - May 2023

### Pop-up Notifications for New Tokens
The system now displays pop-up notifications for new tokens appearing in the cube. These notifications:
- Appear in the bottom right corner
- Show the token symbol
- Auto-dismiss after 5 seconds
- Are clickable to show detailed token information in the scoreboard
- Stack vertically if multiple tokens appear simultaneously

This provides better visibility when new tokens are added to the cube, whether from API updates or user submissions.

### Improved Message Handling
- System messages (like "Removed X tokens from the cube") now remain visible for 5 seconds instead of 3, giving users more time to read them.
- All temporary messages use a fade-in/fade-out animation for a smoother user experience.

## Token Sponsorship System

### Sponsored Tokens Feature
The platform now supports token sponsorships that highlight specific tokens:

- Users can sponsor any token visible in the platform or add new ones
- Each 0.1 SOL payment provides a 6-hour sponsorship period
- Sponsored tokens appear larger and with a gold colour in the isometric cluster
- Multiple people can sponsor the same token, with effects stacking for greater visibility
- Sponsorship options:
  - Increase Size: Make the token larger and more prominent
  - Extend Duration: Keep the current size boost for a longer period

### Sponsorship UI
The sponsorship system includes a user-friendly interface:

- "Sponsor Tokens" button in the top-right corner opens the sponsorship modal
- Token search functionality to find any token from DexScreener
- Payment amount selection with 0.1 SOL minimum
- Option to either increase token size or extend sponsorship duration
- Wallet integration for payment processing
- "Sponsored" button shows a list of all currently sponsored tokens

### Sponsored Token Visual Effects
Sponsored tokens receive special visual treatment:

- Gold coloration with subtle glow effect
- Size boost proportional to sponsorship amount
- Higher visual priority, always appearing in the outer layer of the isometric cluster
- Visibility across all site visitors during the sponsorship period

## 3D Coordinate System Notes

When working with the 3D visualizations in this project (particularly the token scoreboard), be aware of the following coordinate system conventions:

### Z-Axis Orientation
- **NEGATIVE Z values** bring objects FORWARD (toward the camera)
- **POSITIVE Z values** push objects BACK (away from the camera)
- Use z-index values between -0.5 and -2.0 to ensure elements are visible in front of the scoreboard

### After Rotation (For X/Y Positioning)
- **RIGHT side** will have **POSITIVE X** values
- **LEFT side** will have **NEGATIVE X** values
- **TOP side** will have **POSITIVE Y** values
- **BOTTOM side** will have **NEGATIVE Y** values

### Render Order
- Use higher `renderOrder` values (10-20) for elements that should appear in front
- This works alongside Z-positioning to ensure proper layering

Developers frequently get confused by the Z-axis orientation because it's counterintuitive - remember that **more negative Z values bring objects closer to the viewer**.