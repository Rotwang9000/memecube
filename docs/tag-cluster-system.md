# Tag Cluster System Architecture

The Tag Cluster system creates a 3D isometric structure of cryptocurrency tags that organically grow and interact. This document explains the architecture and components of the system.

## System Components

The system consists of the following key components:

1. **TagsManager** (`js/interactions/tag-cluster/tags.js`)
   - High-level compatibility wrapper around the new physics-based system
   - Handles tag aging, demo functionality, and backwards compatibility 
   - Main public API for adding/removing tags used by the rest of the application

2. **TagManager** (`js/interactions/tag-cluster/tag-manager.js`)
   - Core component for tag creation, visualization and interaction
   - Handles font loading, tag styling, and user interaction (hover/click)
   - Integrates with TagPhysics for positioning and movement

3. **TagPhysics** (`js/interactions/tag-cluster/tag-physics.js`)
   - Physics engine for tag movement and positioning
   - Implements cube structure, collision detection, and force calculations
   - Handles tag entry animations, movement chains, and structure maintenance

4. **TagCluster** (`js/interactions/tag-cluster/tag-cluster.js`)
   - Integration layer between TokenVisualizationManager token data and tag system
   - Manages token-specific tags with market cap-based sizing
   - Updates token appearance based on price changes

## Key Concepts

### Tag Structure
- Tags form a 3D isometric cube structure
- Tags are 3D text elements that physically interact
- New tags fly in from outside and push existing tags inward
- Tags are oriented at right angles to form cube faces

### Physics System
- Tags have mass, velocity, and size properties
- Collision chains propagate movement through the structure
- Force system balances repulsion, cohesion, and attraction
- Prevents tag intersections while maintaining structure

### Tag Lifecycle
1. Tag is created with text, URL, and size
2. Tag flies in from random entry point
3. Tag collides with structure and finds position
4. Tag ages over time (shrinks and moves inward)
5. Eventually may be removed

## Usage Flow

1. Application initializes TagsManager
2. TokenVisualizationManager communicates with TagsManager to add/update tokens
3. Users can add tags via form or view demo tags
4. TagsManager delegates to TagManager for creation
5. TagManager handles visualization and interactions
6. TagPhysics maintains the structure and movement

## Integration Notes

The system uses a compatibility layer approach to support transitioning from an older implementation to the new physics-based system. This allows for:

1. Gradual code migration without breaking existing functionality
2. Reuse of the same tag data structures across components
3. Progressive enhancement of physics and visualization

When extending the system, always use the TagsManager API rather than directly accessing the inner components. 