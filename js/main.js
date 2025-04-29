import * as THREE from 'three';
import { Scene } from './core/scene.js';
import { TagsManager } from './interactions/tag-cluster/tags.js';
import { initControls } from './core/controls.js';
import { Utils } from './utils/utils.js';
import { VisualizationManager } from './ui/VisualizationManager.js';
import { DexScreenerProvider } from './data-providers/DexScreenerProvider.js';

class MemeCube {
	constructor() {
		this.canvas = document.getElementById('canvas');
		this.scene = null;
		this.tagsManager = null;
		this.controls = null;
		this.utils = new Utils();
		this.visualizationManager = null;
		this.dataProvider = null;
		this.demoMode = false;
		this.demoInterval = null;
		this.clock = new THREE.Clock();
		this.lastTime = 0;
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.lastCameraPosition = null;
		this.lastCameraQuaternion = null;
		this.lastManagerCheck = 0;
		
		// We'll use token data instead of hardcoded tags
		this.initialTokens = [];
		this.maxInitialTokens = 50; // Limit to 50 initial tokens
		
		this.init();
	}
	
	async init() {
		// Initialize scene
		this.scene = new Scene(this.canvas);
		
		// Initialize tags manager
		this.tagsManager = new TagsManager(this.scene.scene, this.scene.camera);
		
		// Initialize controls
		this.controls = initControls(this.scene.camera, this.canvas);
		
		// Create the data provider
		this.dataProvider = new DexScreenerProvider();
		
		// Initialize visualization module first to get token data
		await this.initVisualizations();
		
		// Now that visualizationManager is created, connect it to the tagsManager
		if (this.visualizationManager) {
			console.log('Connecting VisualizationManager to TagManager');
			this.tagsManager.setVisualizationManager(this.visualizationManager);
		}
		
		// Add initial tags from token data
		await this.addInitialTokensFromProvider();
		
		// If we couldn't get token data and have no tags, add some fallback tags
		if (this.tagsManager.tags.length === 0) {
			console.log("No tags added yet - adding fallback tags");
			
			// Fallback tags with consistent sizing for isometric structure
			const fallbackTags = [
			
			];
			
			// Add fallback tags with small delays for better positioning
			for (const tag of fallbackTags) {
				await this.tagsManager.addTag(tag.text, tag.url, tag.size);
				await new Promise(resolve => setTimeout(resolve, 50));
			}
			
			this.utils.showTemporaryMessage('Using fallback tokens for demo');
		}
		
		// Initialize tag age system to enable shrinking and inward movement
		// this.tagsManager.initializeTagAgeSystem();
		
		// Set up form submission
		this.setupFormSubmission();
		
		// Add demo mode toggle
		this.setupDemoModeToggle();
		
		// Add information button
		this.setupInfoButton();
		
		// Add test button for scoreboard
		this.setupTestScoreboardButton();
		
		// Start demo mode ONLY if explicitly enabled via demoMode flag
		// Do not auto-start based on tag count
		if (this.demoMode) {
			console.log("Demo mode explicitly enabled, starting demo");
			this.startDemoMode();
		}
		
		// Add mouse event listeners for interaction
		this.setupMouseEvents();
		
		// Start animation loop
		this.animate();
	}
	
	// Initialize visualizations
	async initVisualizations() {
		// Initialize visualization manager with scene, camera, and tagsManager references
		this.visualizationManager = new VisualizationManager(
			this.scene.scene, 
			this.scene.camera, 
			this.tagsManager,
			this.dataProvider
		);
		
		// Make visualization manager accessible globally for recovery
		if (window.memeCube) {
			window.memeCube.visualizationManager = this.visualizationManager;
		}
		
		// Validate that visualizationManager was correctly created
		if (!this.visualizationManager) {
			console.error('Failed to create VisualizationManager');
		} else if (!this.visualizationManager.tokenScoreboard) {
			console.warn('VisualizationManager created but tokenScoreboard is not available');
		} else {
			console.log('VisualizationManager and tokenScoreboard successfully initialized');
		}
		
		// Fetch initial token data only once and wait for completion
		if (this.dataProvider) {
			console.log("Fetching initial token data...");
			await this.dataProvider.refreshData();
			console.log("Initial token data fetch completed.");
		}
		
		// Ensure visualizations are visible
		if (this.visualizationManager.tokenScoreboard) {
			this.visualizationManager.tokenScoreboard.isVisible = true;
			console.log("Initializing token scoreboard");
			this.visualizationManager.tokenScoreboard.updateScreenPosition();
		}
		
		if (this.visualizationManager.tokenChart) {
			this.visualizationManager.tokenChart.isVisible = true;
			this.visualizationManager.tokenChart.updateScreenPosition();
		}
		
		if (this.visualizationManager.tokenCluster) {
			this.visualizationManager.tokenCluster.initialize([]);
		}
		
		// Set up event listener for adding tokens to cube
		document.addEventListener('add-token-to-cube', async (event) => {
			const { text, url, size, tokenData, source } = event.detail;
			
			// Check for duplicates before adding
			if (this.tagsManager.tags.some(tag => tag.originalName === text || tag.name === `$${text}`)) {
				console.log(`Token ${text} already exists, skipping.`);
				this.utils.showTemporaryMessage(`Token ${text} already exists!`);
				return;
			}
			
			try {
				const addedTag = await this.tagsManager.addTag(text, url, size, tokenData, {
					source: source || 'eventListener'
				});
				this.utils.showTemporaryMessage(`Added token ${text} to the cube!`);
				
				// Show popup for user-submitted tokens and demo tokens after startup
				if (addedTag && source !== 'initialProvider' && this.visualizationManager) {
					// Make sure token data is available
					if (!addedTag.token && tokenData) {
						addedTag.token = tokenData;
					}
					// Let VisualizationManager handle the popup with a clickable toast
					this.visualizationManager.showNewTokenPopup(addedTag.token || { 
						baseToken: { symbol: text } 
					}, addedTag, { clickable: true });
				}
				
			} catch (error) {
				console.error('Error adding token to cube:', error);
				this.utils.showTemporaryMessage('Failed to add token to cube');
			}
		});
		
		// Set up event listener for data updates to remove outdated tags
		if (this.dataProvider) {
			this.dataProvider.registerUpdateCallback((updatedData) => {
				this.removeOutdatedTags(updatedData);
			});
		}
	}
	
	/**
	 * Remove tags from visualization if they are no longer in the token data
	 * @param {Array} updatedData The updated token data from the provider
	 */
	async removeOutdatedTags(updatedData) {
		if (!updatedData || updatedData.length === 0) {
			console.warn("No updated data to check for outdated tags.");
			return;
		}

		// Get the current page tokens (should be more accurate than just using any updated data)
		const currentPageTokens = await this.dataProvider.getCurrentPageTokens();
		
		// Extract symbols from current token data
		const currentTokenSymbols = currentPageTokens.map(token => {
			if (token.baseToken?.symbol) return token.baseToken.symbol.toUpperCase();
			if (token.symbol) return token.symbol.toUpperCase();
			if (token.name) return token.name.toUpperCase();
			return null;
		}).filter(symbol => symbol !== null);

		console.log(`Current token count: ${currentTokenSymbols.length}`);
		
		// Find tags that are no longer in the data feed
		// Only remove tokens that were originally from the data provider,
		// don't touch user-submitted or demo tokens
		const tagsToRemove = this.tagsManager.tags.filter(tag => {
			// Only consider removing tags that were added from the provider
			const isFromProvider = tag.metadata?.source === 'initialProvider';
			
			if (!isFromProvider) return false;
			
			// Get the tag symbol
			const tagSymbol = (tag.originalName || tag.name.replace('$', '')).toUpperCase();
			
			// Check if this tag's symbol is still in the current data
			const stillExists = currentTokenSymbols.includes(tagSymbol);
			
			return !stillExists;
		});

		console.log(`Found ${tagsToRemove.length} outdated token tags to remove`);

		// Use animated removal for a better visual effect, with a slower animation
		for (const tag of tagsToRemove) {
			console.log(`Removing outdated token tag: ${tag.name}`);
			try {
				// If possible, use animated removal with a slower speed
				if (this.tagsManager.tagManager.physics.removeTagWithAnimation) {
					await this.tagsManager.tagManager.physics.removeTagWithAnimation(tag.id, { duration: 2000, speed: 0.5 });
				}
				// Actually remove the tag
				this.tagsManager.tagManager.removeTag(tag.id);
			} catch (error) {
				console.error(`Error removing tag ${tag.name}:`, error);
				// Fallback to direct removal
				this.tagsManager.tagManager.removeTag(tag.id);
			}
		}

		if (tagsToRemove.length > 0) {
			this.utils.showTemporaryMessage(`Removed ${tagsToRemove.length} outdated token(s) from the cube.`, 5000);
		}
	}
	
	/**
	 * Add initial tokens from data provider
	 */
	async addInitialTokensFromProvider() {
		// Check if we have a data provider
		if (!this.dataProvider) {
			console.warn("Data provider not available for initial tags");
			return;
		}
		
		try {
			// Get tokens for the current page (default is 'dexscreener/latest')
			let tokenData = await this.dataProvider.getCurrentPageTokens();
			
			// If no data available, log warning
			if (!tokenData || tokenData.length === 0) {
				console.warn("No token data available after initial fetch");
				this.utils.showTemporaryMessage('No token data available - consider using demo mode');
				return;
			}
			
			console.log("Token data loaded:", tokenData.length, "tokens");
			
			// Limit number of initial tokens
			const tokensToAdd = tokenData.slice(0, this.maxInitialTokens);
			
			// Add each token with small delay for better physics
			for (const token of tokensToAdd) {
				// Check for different token data structures and handle them appropriately
				let symbol;
				
				// Try to get the symbol from different possible locations in the token data
				if (token.baseToken?.symbol) {
					symbol = token.baseToken.symbol;
				} else if (token.symbol) {
					symbol = token.symbol;
				} else if (token.name) {
					// Fallback to name if symbol not present
					symbol = token.name;
				} else {
					// Skip tokens without symbol or name
					console.warn("Skipping token without symbol:", token);
					continue;
				}
				
				// Check if token already exists in the visualization
				if (this.tagsManager.tags.some(tag => tag.originalName === symbol || tag.name === `$${symbol}`)) {
					console.log(`Token ${symbol} already exists, skipping.`);
					continue;
				}
				
				// Generate URL from different possible data structures
				let url;
				if (token.url) {
					url = token.url;
				} else if (token.pairAddress) {
					url = `https://dexscreener.com/${token.chainId || 'eth'}/${token.pairAddress}`;
				} else if (token.tokenAddress) {
					url = `https://dexscreener.com/${token.chainId || 'eth'}/${token.tokenAddress}`;
				} else {
					url = 'https://dexscreener.com/';
				}
				
				// Calculate size based on market cap or other metrics
				let size = 0.7; // Default size
				if (this.dataProvider.calculateTokenSize) {
					size = this.dataProvider.calculateTokenSize(token);
				}
				
				console.log(`Adding token tag: ${symbol} with size ${size.toFixed(2)}`);
				
				// Add tag with token data and metadata
				await this.tagsManager.addTag(symbol, url, size, token, {
					source: 'initialProvider',
					providerSource: token._metadata?.source || 'unknown',
					providerPage: token._metadata?.page || 'unknown',
					fetchedAt: token._metadata?.fetchedAt || Date.now()
				});
				
				// Ensure visualization manager is properly set
				if (this.visualizationManager && this.tagsManager && !this.tagsManager.tagManager.visualizationManager) {
					console.log('Reconnecting VisualizationManager during token addition');
					this.tagsManager.setVisualizationManager(this.visualizationManager);
				}
				
				// Small delay to allow physics to position properly
				await new Promise(resolve => setTimeout(resolve, 10));
			}
			
			// Store added tokens reference
			this.initialTokens = tokensToAdd;
			
			this.utils.showTemporaryMessage(`Added ${tokensToAdd.length} tokens to the cube!`);
		} catch (error) {
			console.error("Error adding initial tokens:", error);
			// Don't auto-start demo mode on error
			this.utils.showTemporaryMessage('Error loading token data - check console for details');
		}
	}
	
	setupFormSubmission() {
		const form = document.getElementById('tag-form');
		
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			
			const tagName = document.getElementById('tag-name').value.trim().toUpperCase();
			const tagUrl = document.getElementById('tag-url').value.trim();
			
			if (tagName && tagUrl) {
				// Generate random size for now (later based on payment)
				const randomSize = 0.8 + Math.random() * 0.8;
				
				try {
					// Check if we have token data for this tag
					let tokenData = null;
					
					if (this.dataProvider) {
						// Try to find token data by symbol
						const allTokens = await this.dataProvider.getCurrentPageTokens();
						tokenData = allTokens.find(token => {
							const symbol = token.baseToken?.symbol || token.symbol || token.name;
							return symbol && symbol.toUpperCase() === tagName;
						});
						
						// Log whether we found token data
						console.log(`Token data for ${tagName}: ${tokenData ? 'Found' : 'Not found'}`);
						if (tokenData) {
							console.log("Token data details:", JSON.stringify(tokenData, null, 2));
						}
						
						if (!tokenData) {
							// If no token data found, try to fetch it from the API
							console.log(`No token data found for ${tagName}, searching...`);
							try {
								// This would ideally call a method to search for a token by symbol
								// but we'll keep it simple for now
								// Future enhancement: this.dataProvider.searchTokenBySymbol(tagName)
							} catch (searchError) {
								console.warn(`Could not fetch token data for ${tagName}:`, searchError);
							}
						}
					}
					
					// Add tag with any token data we found
					await this.tagsManager.addTag(tagName, tagUrl, randomSize, tokenData, {
						source: 'userSubmit'
					});
					
					// Clear form
					document.getElementById('tag-name').value = '';
					document.getElementById('tag-url').value = '';
					
					// Animate the submit button to show success
					const submitButton = form.querySelector('button[type="submit"]');
					submitButton.classList.add('success');
					setTimeout(() => {
						submitButton.classList.remove('success');
					}, 1000);
					
					this.utils.showTemporaryMessage(`Added $${tagName} to the cube!`);
				} catch (error) {
					console.error('Error adding tag:', error);
					this.utils.showTemporaryMessage('Error adding tag - please try again');
				}
			}
		});
	}
	
	setupDemoModeToggle() {
		// Create toggle button
		const demoToggle = document.createElement('button');
		demoToggle.textContent = this.demoMode ? 'Disable Demo Mode' : 'Enable Demo Mode';
		demoToggle.style.position = 'absolute';
		demoToggle.style.bottom = '60px';
		demoToggle.style.right = '20px';
		demoToggle.style.zIndex = '1000';
		document.body.appendChild(demoToggle);
		
		// Add click handler
		demoToggle.addEventListener('click', () => {
			this.demoMode = !this.demoMode;
			demoToggle.textContent = this.demoMode ? 'Disable Demo Mode' : 'Enable Demo Mode';
			
			if (this.demoMode) {
				this.startDemoMode();
				this.utils.showTemporaryMessage('Demo mode enabled - random tags will appear');
			} else {
				this.stopDemoMode();
				this.utils.showTemporaryMessage('Demo mode disabled');
			}
		});
	}
	
	setupInfoButton() {
		// Create info button
		const infoButton = document.createElement('button');
		infoButton.textContent = 'ℹ️ Info';
		infoButton.style.position = 'absolute';
		infoButton.style.bottom = '100px';
		infoButton.style.right = '20px';
		infoButton.style.zIndex = '1000';
		document.body.appendChild(infoButton);
		
		// Create demo token button
		const demoTokenButton = document.createElement('button');
		demoTokenButton.textContent = '🚀 Demo Token';
		demoTokenButton.style.position = 'absolute';
		demoTokenButton.style.bottom = '180px';
		demoTokenButton.style.right = '20px';
		demoTokenButton.style.zIndex = '1000';
		demoTokenButton.style.backgroundColor = 'rgba(0, 100, 150, 0.8)';
		demoTokenButton.style.color = 'white';
		demoTokenButton.style.border = '1px solid rgba(0, 255, 255, 0.3)';
		demoTokenButton.style.borderRadius = '4px';
		demoTokenButton.style.padding = '5px 10px';
		demoTokenButton.style.cursor = 'pointer';
		demoTokenButton.title = 'Show a featured token in 3D visualizations';
		demoTokenButton.onclick = () => this.showDemoToken();
		document.body.appendChild(demoTokenButton);
		
		// Create debug button to fix visualization manager connections
		const debugButton = document.createElement('button');
		debugButton.textContent = '🔧 Debug';
		debugButton.style.position = 'absolute';
		debugButton.style.bottom = '260px';
		debugButton.style.right = '20px';
		debugButton.style.zIndex = '1000';
		debugButton.style.backgroundColor = 'rgba(50, 50, 200, 0.8)';
		debugButton.style.color = 'white';
		debugButton.style.border = '1px solid rgba(100, 100, 255, 0.3)';
		debugButton.style.borderRadius = '4px';
		debugButton.style.padding = '5px 10px';
		debugButton.style.cursor = 'pointer';
		debugButton.title = 'Fix VisualizationManager connections';
		debugButton.onclick = () => {
			console.log('Manually fixing VisualizationManager connections');
			if (this.visualizationManager) {
				this.tagsManager.setVisualizationManager(this.visualizationManager);
				this.utils.showTemporaryMessage('VisualizationManager connections repaired');
			} else {
				console.error('No VisualizationManager available to repair connections');
				this.utils.showTemporaryMessage('VisualizationManager not available');
			}
		};
		document.body.appendChild(debugButton);
		
		// Create info panel (hidden by default)
		const infoPanel = document.createElement('div');
		infoPanel.style.position = 'absolute';
		infoPanel.style.bottom = '150px';
		infoPanel.style.right = '20px';
		infoPanel.style.width = '300px';
		infoPanel.style.padding = '15px';
		infoPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
		infoPanel.style.color = 'white';
		infoPanel.style.borderRadius = '8px';
		infoPanel.style.border = '1px solid rgba(0, 255, 255, 0.3)';
		infoPanel.style.zIndex = '999';
		infoPanel.style.display = 'none';
		
		infoPanel.innerHTML = `
			<h3 style="color: #0ff; margin-top: 0;">About MemeCube</h3>
			<p>MemeCube is a 3D visualization of cryptocurrency meme coin tags.</p>
			<p>The cube structure is formed by the words themselves, with newer tags pushing older ones inward.</p>
			<p>Features:</p>
			<ul>
				<li>3D cube of meme coin tags</li>
				<li>Detailed token scoreboard when tags are clicked</li>
				<li>Social media links displayed as mini planets</li>
				<li>Space-themed LED scoreboard showing live token data</li>
				<li>3D price chart visualization</li>
				<li>Integration with DexScreener API</li>
			</ul>
			<p>Controls:</p>
			<ul>
				<li>Drag to rotate the view</li>
				<li>Scroll to zoom in/out</li>
				<li>Right-click drag to pan</li>
				<li>Click on any tag to view token information</li>
			</ul>
			<p>Submit your own tag using the form in the top right!</p>
		`;
		
		document.body.appendChild(infoPanel);
		
		// Toggle info panel on button click
		infoButton.addEventListener('click', () => {
			if (infoPanel.style.display === 'none') {
				infoPanel.style.display = 'block';
			} else {
				infoPanel.style.display = 'none';
			}
		});
	}
	
	/**
	 * Display a demo token in the visualizations
	 */
	async showDemoToken() {
		// Ensure we have a visualization manager
		if (!this.visualizationManager) return;
		
		this.utils.showTemporaryMessage('Loading demo token...');
		
		try {
			// Use the visualization manager's showDemoToken method
			await this.visualizationManager.showDemoToken();
		} catch (error) {
			console.error('Error showing demo token:', error);
			this.utils.showTemporaryMessage('Error loading demo token');
		}
	}
	
	startDemoMode() {
		// Clear any existing interval
		if (this.demoInterval) {
			clearInterval(this.demoInterval);
		}
		
		// Add a random tag every 4-7 seconds (slightly slower for better positioning)
		this.demoInterval = setInterval(async () => {
			// Generate a random tag
			const randomTag = this.tagsManager.generateRandomTag();
			
			// Check if we already have this tag in the cluster
			const existingTag = this.tagsManager.tags.find(tag => 
				tag.originalName === randomTag.text || 
				tag.name === `$${randomTag.text}`
			);
			
			if (existingTag) {
				// Skip duplicate tags
				return;
			}
			
			// Create demo token data for this tag
			const demoTokenData = {
				baseToken: {
					symbol: randomTag.text,
					name: `${randomTag.text} Token`
				},
				quoteToken: {
					symbol: "ETH"
				},
				priceUsd: `$${(Math.random() * 10).toFixed(4)}`,
				marketCap: Math.floor(Math.random() * 10000000),
				volume: { h24: Math.floor(Math.random() * 1000000) },
				priceChange: { h24: (Math.random() * 40) - 20 }, // -20% to +20%
				liquidity: { usd: Math.floor(Math.random() * 500000) },
				pairCreatedAt: Date.now() - Math.floor(Math.random() * 30) * 86400000, // 0-30 days ago
				_metadata: {
					source: 'demoMode',
					generated: true
				}
			};
			
			// Add it to the cube - ensure it's visible by setting a minimum size
			const size = Math.max(0.6, randomTag.size);
			await this.tagsManager.addTag(randomTag.text, randomTag.url, size, demoTokenData, {
				source: 'demoMode',
				isDemo: true
			});
			
			// Ensure all tags have visualization manager set
			if (this.visualizationManager && !this.tagsManager.visualizationManager) {
				console.log('Re-connecting VisualizationManager to TagManager during demo');
				this.tagsManager.setVisualizationManager(this.visualizationManager);
			}
			
			// Limit the total number of tags to prevent overcrowding
			// Increase limit from 40 to 50 for a more impressive cluster
			const maxTags = 50;
			if (this.tagsManager.tags.length > maxTags) {
				// Find and remove the oldest demo tag
				const oldestDemoTag = this.tagsManager.tags.find(tag => 
					tag.metadata?.source === 'demoMode' || tag.metadata?.isDemo
				);
				if (oldestDemoTag) {
					this.tagsManager.tagManager.removeTag(oldestDemoTag.id);
				} else {
					// If all tags are real tokens, remove the oldest tag
					const oldestTag = this.tagsManager.tags[0];
					this.tagsManager.tagManager.removeTag(oldestTag.id);
				}
			}
		}, 4000 + Math.random() * 3000);
	}
	
	stopDemoMode() {
		if (this.demoInterval) {
			clearInterval(this.demoInterval);
			this.demoInterval = null;
		}
	}
	
	setupMouseEvents() {
		// Event listeners for mouse interaction
		this.canvas.addEventListener('mousemove', (event) => {
			// Calculate mouse position in normalized device coordinates (-1 to +1)
			this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
		});
		
		this.canvas.addEventListener('click', (event) => {
			// Handle click on visualizations 
			this.handleClick();
		});
	}
	
	handleClick() {
		// Update the raycaster with the mouse position and camera
		this.raycaster.setFromCamera(this.mouse, this.scene.camera);
		
		// Check if click was handled by visualizations
		if (this.visualizationManager && this.visualizationManager.handleInteraction(this.raycaster)) {
			return; // Interaction was handled by visualizations
		}
		
		// Handle clicks on cube tags via the TagManager's interaction handler
		// Use raycaster to check for intersections with any tag
		const intersectedTag = this.tagsManager.tagManager.findIntersectedTag();
		
		if (intersectedTag) {
			console.log("Tag clicked:", intersectedTag.name);
			
			// Track the click in analytics or for debugging
			if (intersectedTag.metadata) {
				console.log("Tag metadata:", JSON.stringify(intersectedTag.metadata));
			}
			
			// Ensure token data is attached to the tag before handling click
			if (!intersectedTag.tokenData && this.dataProvider) {
				try {
					// Get token data asynchronously
					console.log("Finding token data before handling click");
					this.getTokenDataForTag(intersectedTag).then(() => {
						// Let TagManager handle all tag clicks - it will show scoreboard
						// and display URL as a clickable planet
						this.tagsManager.tagManager.handleTagClick(intersectedTag);
					}).catch(error => {
						console.error("Error getting token data:", error);
						// Still handle the click even if we couldn't get token data
						this.tagsManager.tagManager.handleTagClick(intersectedTag);
					});
				} catch (error) {
					console.error("Error in tag click handling:", error);
					// Fallback to just handling the click with what we have
					this.tagsManager.tagManager.handleTagClick(intersectedTag);
				}
				return;
			}
			
			// Let TagManager handle all tag clicks - it will show scoreboard
			// and display URL as a clickable planet
			this.tagsManager.tagManager.handleTagClick(intersectedTag);
		}
	}
	
	/**
	 * Get token data for a tag asynchronously
	 * @param {Object} tag The tag to get token data for
	 * @returns {Promise<void>}
	 */
	async getTokenDataForTag(tag) {
		if (!this.dataProvider) return;
		
		const symbolName = tag.originalName || tag.name.replace('$', '');
		console.log("Looking for token data for symbol:", symbolName);
		
		// Get all token data and find the one matching our symbol
		const allTokenData = await this.dataProvider.getCurrentPageTokens();
		console.log("Available tokens:", allTokenData.length);
		
		const tokenData = allTokenData.find(token => {
			const tokenSymbol = token.baseToken?.symbol || token.symbol || '';
			const match = tokenSymbol.toUpperCase() === symbolName.toUpperCase();
			if (match) {
				console.log("Found matching token:", tokenSymbol);
			}
			return match;
		});
		
		if (tokenData) {
			console.log("Found token data for", symbolName);
			tag.tokenData = tokenData;
			
			// Update metadata to reflect this is a token
			if (!tag.metadata) tag.metadata = {};
			tag.metadata.isToken = true;
			tag.metadata.dataFoundAt = Date.now();
		} else {
			console.log("No token data found for", symbolName);
			
			// Ensure metadata exists
			if (!tag.metadata) tag.metadata = {};
		}
	}
	
	animate() {
		requestAnimationFrame(this.animate.bind(this));
		
		// Calculate delta time
		const currentTime = this.clock.getElapsedTime();
		const deltaTime = currentTime - this.lastTime;
		this.lastTime = currentTime;
		
		// Every 10 seconds, check if visualization manager is still connected
		// This will fix issues where the connection is lost
		if (Math.floor(currentTime) % 10 === 0 && Math.floor(currentTime) !== this.lastManagerCheck) {
			this.lastManagerCheck = Math.floor(currentTime);
			
			// Check if TagManager still has visualizationManager
			if (this.visualizationManager && !this.tagsManager.tagManager.visualizationManager) {
				console.log('Auto-repairing VisualizationManager connection');
				this.tagsManager.setVisualizationManager(this.visualizationManager);
			}
		}
		
		// Get current camera state
		const currentCameraPosition = this.scene.camera.position.clone();
		const currentCameraQuaternion = this.scene.camera.quaternion.clone();
		
		// Check if camera moved since last frame
		const isCameraMoving = this.lastCameraPosition && (
			!this.lastCameraPosition.equals(currentCameraPosition) ||
			!this.lastCameraQuaternion.equals(currentCameraQuaternion)
		);
		
		// Only update the stored camera state if it actually changed
		// This ensures we maintain a stable reference point for future comparisons
		if (isCameraMoving || !this.lastCameraPosition) {
			this.lastCameraPosition = currentCameraPosition;
			this.lastCameraQuaternion = currentCameraQuaternion;
		}
		
		// Update scene
		this.scene.update();
		
		// Update tags
		this.tagsManager.update(deltaTime);
		
		// Update controls
		this.controls.update();
		
		// Update visualizations with camera movement info
		if (this.visualizationManager) {
			this.visualizationManager.update(deltaTime, isCameraMoving);
		}
	}
	
	// Setup test button for scoreboard
	setupTestScoreboardButton() {
		const testButton = document.createElement('button');
		testButton.textContent = '🔍 Test Scoreboard';
		testButton.style.position = 'absolute';
		testButton.style.bottom = '220px';
		testButton.style.right = '20px';
		testButton.style.zIndex = '1000';
		testButton.style.backgroundColor = 'rgba(200, 50, 50, 0.8)';
		testButton.style.color = 'white';
		testButton.style.border = '1px solid rgba(255, 100, 100, 0.3)';
		testButton.style.borderRadius = '4px';
		testButton.style.padding = '5px 10px';
		testButton.style.cursor = 'pointer';
		document.body.appendChild(testButton);
		
		// Create a test tag with known data
		testButton.onclick = () => {
			console.log("Testing scoreboard display");
			
			// Create a test token with all fields populated
			const testToken = {
				baseToken: {
					symbol: "TEST",
					name: "Test Token"
				},
				quoteToken: {
					symbol: "ETH"
				},
				priceUsd: "$0.12345",
				priceNative: "0.00012 ETH",
				liquidity: {
					usd: 1000000
				},
				marketCap: 5000000,
				fdv: 10000000,
				chainId: "eth",
				dexId: "uniswap",
				pairAddress: "0x1234567890abcdef",
				url: "https://example.com/token/TEST"
			};
			
			// Create a test tag
			const testTag = {
				id: "test_tag_" + Date.now(),
				name: "$TEST",
				originalName: "TEST",
				url: "https://example.com/token/TEST",
				createdAt: Date.now(),
				tokenData: testToken
			};
			
			// Display the scoreboard directly
			this.tagsManager.tagManager.displayTokenScoreboard(testTag);
			
			this.utils.showTemporaryMessage("Displaying test scoreboard");
		};
	}
	
	/**
	 * Check that all tags have proper visualization manager references
	 * For debugging the "VisualizationManager not available" issue
	 */
	checkVisualizationManagerLinks() {
		console.log('Checking VisualizationManager references:');
		console.log('- Main VisualizationManager exists:', !!this.visualizationManager);
		console.log('- TagsManager has VisualizationManager:', !!this.tagsManager.visualizationManager);
		console.log('- TagManager has VisualizationManager:', !!this.tagsManager.tagManager.visualizationManager);
		
		// Check some random tags
		const sampleSize = Math.min(5, this.tagsManager.tags.length);
		if (sampleSize > 0) {
			console.log(`Checking ${sampleSize} random tags:`);
			const randomIndexes = new Set();
			while (randomIndexes.size < sampleSize) {
				randomIndexes.add(Math.floor(Math.random() * this.tagsManager.tags.length));
			}
			
			for (const index of randomIndexes) {
				const tag = this.tagsManager.tags[index];
				console.log(`- Tag ${tag.name} (source: ${tag.metadata?.source}):`);
				console.log(`  - Can access VisualizationManager:`, 
					!!this.tagsManager.tagManager.visualizationManager);
				console.log(`  - Has TokenData:`, !!tag.tokenData);
			}
		}
	}
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	window.memeCube = new MemeCube();
}); 