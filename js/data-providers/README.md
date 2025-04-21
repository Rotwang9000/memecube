# Data Provider Architecture

## Overview

This directory contains the data provider system that powers MemeCube's visualizations. The system is designed to be provider-agnostic, allowing any data source to be used with the visualization system.

## Core Components

### TokenDataProvider (Base Interface)

`TokenDataProvider.js` defines the base interface that all data providers must implement. It includes:

- Methods for fetching and managing token data
- Callback registration for data updates
- Auto-refresh capabilities
- Common utility methods for token visualizations

### Specific Provider Implementations

#### DexScreenerProvider

`DexScreenerProvider.js` implements the TokenDataProvider interface for the DexScreener API. It handles:

- Fetching token profiles and market data from DexScreener
- Processing and normalizing the data
- Calculating token sizes based on market cap
- Formatting market cap values for display

#### CoinGeckoProvider

`CoinGeckoProvider.js` implements the TokenDataProvider interface for the CoinGecko API. It offers:

- Access to market data for thousands of cryptocurrencies 
- Support for price history, market caps, and volume
- Integration with the same visualization system as other providers

## Adding a New Provider

To add a new data provider:

1. Create a new file named `YourProviderName.js`
2. Import and extend the TokenDataProvider base class
3. Implement all required methods from the interface
4. Use your provider with the VisualizationManager by passing it in the constructor

Example:

```javascript
import { TokenDataProvider } from './TokenDataProvider.js';

export class MyCustomProvider extends TokenDataProvider {
	constructor() {
		super();
		// Your initialization code here
	}
	
	// Implement all required methods
	async refreshData() {
		// Your implementation
	}
	
	async getTopTokens(limit = 10) {
		// Your implementation
	}
	
	// ... other required methods
}
```

## Using Multiple Providers

The system supports switching between providers at runtime:

```javascript
// Initialize with one provider
const dexScreenerProvider = new DexScreenerProvider();
const visualizationManager = new VisualizationManager(
	scene, 
	camera, 
	tagsManager, 
	dexScreenerProvider
);

// Later, switch to a different provider
const coingeckoProvider = new CoinGeckoProvider();
visualizationManager.setDataProvider(coingeckoProvider);
```

## Provider-Agnostic Design

The MemeCube application is designed to be completely provider-agnostic:

1. The visualization system only depends on the TokenDataProvider interface
2. Data processing logic is encapsulated within each provider implementation
3. UI components consume standardized data formats regardless of source

This design allows for:

1. **Decoupling** - Data sources and visualization are completely separate
2. **Testability** - Can test visualizations with mock data providers
3. **Flexibility** - Switch data sources without changing visualization code
4. **Extensibility** - Add new data sources without modifying existing code
5. **Maintainability** - Each component has a single responsibility 