import { TagManager } from './tag-manager.js';

/**
 * TagSystemDemo - Demonstrates how to use the new tag physics system
 */
export class TagSystemDemo {
	constructor(scene, camera) {
		// Create the tag manager
		this.tagManager = new TagManager(scene, camera);
		
		// Demo coin data
		this.demoCoins = [
			{ name: 'BTC', url: 'https://bitcoin.org', marketCap: 1000000000000 },
			{ name: 'ETH', url: 'https://ethereum.org', marketCap: 500000000000 },
			{ name: 'SOL', url: 'https://solana.org', marketCap: 50000000000 },
			{ name: 'DOGE', url: 'https://dogecoin.com', marketCap: 20000000000 },
			{ name: 'SHIB', url: 'https://shibatoken.com', marketCap: 10000000000 },
			{ name: 'PEPE', url: 'https://pepe.com', marketCap: 5000000000 },
			{ name: 'FLOKI', url: 'https://floki.com', marketCap: 1000000000 },
			{ name: 'BONK', url: 'https://bonk.com', marketCap: 500000000 },
			{ name: 'WIF', url: 'https://dogwifhat.com', marketCap: 250000000 },
			{ name: 'MEME', url: 'https://memecoin.org', marketCap: 100000000 }
		];
		
		// Demo parameters
		this.initialTagCount = 5;          // Start with 5 tags
		this.addInterval = 3000;           // Add a new tag every 3 seconds
		this.resizeInterval = 5000;        // Resize a random tag every 5 seconds
		this.removeInterval = 10000;       // Remove a random tag every 10 seconds
		
		// Store timers
		this.timers = {
			add: null,
			resize: null,
			remove: null
		};
		
		// Setup complete flag
		this.isSetup = false;
	}
	
	/**
	 * Initialize the demo with initial tags
	 */
	initialize() {
		// Add initial tags
		for (let i = 0; i < Math.min(this.initialTagCount, this.demoCoins.length); i++) {
			this.addRandomTag();
		}
		
		// Set up intervals
		this.timers.add = setInterval(() => this.addRandomTag(), this.addInterval);
		this.timers.resize = setInterval(() => this.resizeRandomTag(), this.resizeInterval);
		this.timers.remove = setInterval(() => this.removeRandomTag(), this.removeInterval);
		
		// Mark as set up
		this.isSetup = true;
		
		// Log success
		console.log('Tag system demo initialized');
	}
	
	/**
	 * Add a random tag from the demo coins
	 */
	addRandomTag() {
		// Get available coins (those not already added)
		const addedNames = this.tagManager.tags.map(tag => tag.originalName);
		const availableCoins = this.demoCoins.filter(coin => !addedNames.includes(coin.name));
		
		// If we've used all demo coins, skip
		if (availableCoins.length === 0) {
			console.log('All demo coins have been added');
			
			// Clear the add timer if we've used all coins
			if (this.timers.add) {
				clearInterval(this.timers.add);
				this.timers.add = null;
			}
			
			return;
		}
		
		// Select a random coin
		const coin = availableCoins[Math.floor(Math.random() * availableCoins.length)];
		
		// Calculate size based on market cap (logarithmic scale)
		const minMarketCap = 100000000;         // 100M
		const maxMarketCap = 1000000000000;     // 1T
		const minSize = 0.5;
		const maxSize = 2.0;
		
		// Calculate size using logarithmic scale
		const logMin = Math.log(minMarketCap);
		const logMax = Math.log(maxMarketCap);
		const logValue = Math.log(coin.marketCap);
		const normalizedValue = (logValue - logMin) / (logMax - logMin);
		const size = minSize + (maxSize - minSize) * normalizedValue;
		
		// Create the tag
		const tag = this.tagManager.createTag(coin.name, coin.url, {
			scale: size,
			size: 0.5, // Base text size before scaling
		});
		
		// Log addition
		if (tag) {
			console.log(`Added tag: ${coin.name} with size ${size.toFixed(2)}`);
		}
	}
	
	/**
	 * Resize a random existing tag
	 */
	resizeRandomTag() {
		// Need at least one tag
		if (this.tagManager.tags.length === 0) return;
		
		// Select a random tag
		const randomIndex = Math.floor(Math.random() * this.tagManager.tags.length);
		const tag = this.tagManager.tags[randomIndex];
		
		// Generate a new random size
		const currentSize = tag.mesh.scale.x;
		const newSize = Math.max(0.5, Math.min(2.0, currentSize * (0.7 + Math.random() * 0.6)));
		
		// Resize the tag
		this.tagManager.resizeTag(tag.id, newSize);
		
		// Log resizing
		console.log(`Resized tag: ${tag.originalName} from ${currentSize.toFixed(2)} to ${newSize.toFixed(2)}`);
	}
	
	/**
	 * Remove a random existing tag
	 */
	removeRandomTag() {
		// Need at least one tag
		if (this.tagManager.tags.length === 0) return;
		
		// Select a random tag
		const randomIndex = Math.floor(Math.random() * this.tagManager.tags.length);
		const tag = this.tagManager.tags[randomIndex];
		
		// Store name for logging
		const name = tag.originalName;
		
		// Remove the tag
		this.tagManager.removeTag(tag.id);
		
		// Log removal
		console.log(`Removed tag: ${name}`);
	}
	
	/**
	 * Update function called each frame
	 */
	update() {
		// Initialize if not already set up - wait for the font to load
		if (!this.isSetup && this.tagManager.fontLoaded) {
			this.initialize();
		}
		
		// Update tag manager
		this.tagManager.update();
	}
	
	/**
	 * Clean up resources when done
	 */
	dispose() {
		// Clear all intervals
		Object.values(this.timers).forEach(timer => {
			if (timer) clearInterval(timer);
		});
		
		// Remove event listeners (handled by tag manager)
		
		// Log cleanup
		console.log('Tag system demo cleaned up');
	}
} 