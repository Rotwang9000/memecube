# Visualization Management

## Overview

This directory contains the visualization management system for MemeCube. It provides a unified interface for managing all 3D visualizations, handling UI interactions, and connecting to data providers.

## Core Components

### VisualizationManager

`VisualizationManager.js` is the central hub for all visualization functionality:

- Creates and manages all visualization components (scoreboard, chart, tag cluster)
- Connects to any TokenDataProvider for data
- Handles UI creation and interaction
- Manages visibility toggle functionality
- Updates visualization positions during camera movement
- Processes user interactions via raycasting

## Visualization Components

The manager works with several visualization components:

1. **TokenScoreboard** - 3D LED display for token prices
2. **TokenChart3D** - 3D price history chart
3. **TagCluster** - 3D cluster of token tags

## Provider-Agnostic Design

The VisualizationManager doesn't depend on any specific data provider implementation. Instead, it:

1. Takes any TokenDataProvider in its constructor
2. Registers callbacks with the provider for data updates
3. Uses the provider's interface methods to access data
4. Can have its provider changed at runtime via `setDataProvider()`

## Usage Example

```javascript
// Create a data provider
const dataProvider = new DexScreenerProvider();

// Create the visualization manager with the provider
const visualizationManager = new VisualizationManager(
    scene,          // THREE.Scene instance
    camera,         // THREE.Camera instance
    tagsManager,    // TagsManager instance
    dataProvider    // Any TokenDataProvider implementation
);

// Later, in your animation loop
function animate() {
    // Update visualizations, passing camera movement state
    visualizationManager.update(deltaTime, isCameraMoving);
    
    // Handle user interactions
    raycaster.setFromCamera(mouse, camera);
    visualizationManager.handleInteraction(raycaster);
}
```

## Benefits

1. **Centralized Management** - Single point of control for all visualizations
2. **Provider-Agnostic** - Works with any data provider
3. **Consistent UI** - Unified UI creation and styling
4. **Separation of Concerns** - Data handling, visualization, and interaction are separate
5. **Testability** - Can be tested with mock providers and scene objects 