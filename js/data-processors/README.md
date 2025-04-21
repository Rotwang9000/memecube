# ⚠️ DEPRECATED: Data Processors

## Important: Directory Deprecated

This directory and its contents are **deprecated** and have been replaced by the improved `/js/data-providers/` architecture.

## Migration Path

All functionality has been moved to the new data providers system:

| Old Component | New Component |
|---------------|---------------|
| `DataProcessor.js` | `TokenDataProvider.js` |
| `DexScreenerProcessor.js` | `DexScreenerProvider.js` |
| `CoinGeckoProcessor.js` | `CoinGeckoProvider.js` |

## Why We Changed

The new data providers architecture offers several benefits:

1. **Provider-Agnostic Design**: Clear separation between data sources and visualization
2. **Simpler Interface**: More consistent approach to data fetching and processing
3. **Enhanced Testability**: Easier to create mock providers for testing
4. **Standardized Data Format**: Consistent data structures across providers

## How to Migrate

If you have code that uses the old processors:

```javascript
// OLD WAY
import { DexScreenerProcessor } from './data-processors/DexScreenerProcessor.js';
const processor = new DexScreenerProcessor();
processor.registerProcessingCallback(onDataUpdate);
processor.fetchData();

// NEW WAY
import { DexScreenerProvider } from './data-providers/DexScreenerProvider.js';
const provider = new DexScreenerProvider();
provider.registerUpdateCallback(onDataUpdate);
provider.refreshData();
```

Please update all references to use the new data providers in `/js/data-providers/` instead. 