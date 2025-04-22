/**
 * DexScreener Module (Legacy Compatibility)
 * 
 * This module provides backward compatibility for existing code
 * that references the old DexScreenerManager. New code should
 * use TokenVisualizationManager directly.
 */

import { TokenVisualizationManager } from './ui/TokenVisualizationManager.js';
import { DexScreenerProvider } from './data-providers/DexScreenerProvider.js';

// For backward compatibility with older code and tests
// We export TokenVisualizationManager as DexScreenerManager
export class DexScreenerManager extends TokenVisualizationManager {
	constructor(scene = null, camera = null, tagsManager = null) {
		// Always use DexScreenerProvider for backward compatibility
		const dataProvider = new DexScreenerProvider();
		super(scene, camera, tagsManager, dataProvider);
	}
}

// Export TokenVisualizationManager as the preferred class to use
export { TokenVisualizationManager }; 