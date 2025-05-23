import * as THREE from 'three';
import { Scene } from './core/scene.js';
import { TagsManager } from './interactions/tag-cluster/tags.js';
import { initControls } from './core/controls.js';
import { Utils } from './utils/utils.js';
import { VisualizationManager } from './ui/VisualizationManager.js';
import { DexScreenerProvider } from './data-providers/DexScreenerProvider.js';
import { getTokenKey } from './utils/tokenKey.js';
import { SponsoredTokenUI } from './ui/SponsoredTokenUI.js';

class MemeCube {
	constructor() {
		this.canvas = document.getElementById('canvas');
		this.scene = null;
		this.tagsManager = null;
		this.controls = null;
		this.utils = new Utils();
		this.visualizationManager = null;
		this.dataProvider = null;
		this.sponsoredTokenUI = null;
		this.demoMode = false;
		this.demoInterval = null;
		this.clock = new THREE.Clock();
		this.lastTime = 0;
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.lastCameraPosition = null;
		this.lastCameraQuaternion = null;
		this.lastManagerCheck = 0;
		this.frameCounter = 0;
		this.lastFpsUpdate = 0;
		this.tagCountDisplay = null;
		this.fpsDisplay = null;
		this.callbackRegistered = false;
		
		// Token tracking system
		this.pendingTokens = new Map(); // Maps token keys/symbols to { timestamp, token, confirmed }
		this.tokenCleanupInterval = null;
		
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
		await this.initVisualizations(true);
		
		// Initialize the sponsored token UI with the data provider
		this.sponsoredTokenUI = new SponsoredTokenUI(this.dataProvider);
		
		// Now that visualizationManager is created, connect it to the tagsManager
		if (this.visualizationManager) {
			console.log('Connecting VisualizationManager to TagManager');
			this.tagsManager.setVisualizationManager(this.visualizationManager);
		}
		
		// Set up the token cleanup interval
		this.setupTokenCleanup();
		
		// Add initial tokens from data provider - THIS IS THE ONLY PLACE WE SHOULD DIRECTLY CALL THIS
		await this.refreshTokensFromProvider(true);
		
		// Add information button
		this.setupInfoButton();
		
		// Add mouse event listeners for interaction
		this.setupMouseEvents();
		
		// Start animation loop
		this.animate();
	}
	
	// Initialize visualizations
	async initVisualizations(isInitialLoad = false) {
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
			// Check for duplicate based on token address if available
			if (tokenData && (tokenData.tokenAddress || tokenData.pairAddress)) {
				// If we have token address, use that for duplicate check
				const addressToCheck = tokenData.tokenAddress || tokenData.pairAddress;
				if (this.tagsManager.tags.some(tag => 
					tag.token && (tag.token.tokenAddress === addressToCheck || tag.token.pairAddress === addressToCheck)
				)) {
					return; // Token with this address already exists
				}
			} else {
				// No token address - don't add the token
				console.log(`Token ${text} has no address for identification, skipping.`);
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
		

	}
	
	// Set up token cleanup interval to remove unconfirmed tokens
	setupTokenCleanup() {
		// Clear any existing interval
		if (this.tokenCleanupInterval) {
			clearInterval(this.tokenCleanupInterval);
		}
		
		// Check for expired tokens every 5 seconds
		this.tokenCleanupInterval = setInterval(() => {
			this.cleanupExpiredTokens();
		}, 5000);
	}
	
	// Clean up expired tokens (those that were never confirmed)
	cleanupExpiredTokens() {
		const now = Date.now();
		const expiryTime = 30000; // 30 seconds
		let expiredCount = 0;
		
		// Find expired tokens
		for (const [key, data] of this.pendingTokens.entries()) {
			// Skip confirmed tokens
			if (data.confirmed) continue;
			
			// Check if token has expired
			if (now - data.timestamp > expiryTime) {
				console.log(`Token expired without confirmation: ${data.token.baseToken?.symbol || data.token.symbol || 'unknown'}`);
				this.pendingTokens.delete(key);
				expiredCount++;
			}
		}
		
		if (expiredCount > 0) {
			console.log(`Cleaned up ${expiredCount} expired tokens`);
		}
	}
	
	// Get a unique identifier for a token (for pendingTokens map)
	getTokenIdentifier(token) {
		// Try to get a consistent token key
		const tokenKey = getTokenKey(token);
		if (tokenKey) return tokenKey;
		
		// Fall back to symbol if no key available
		const symbol = token.baseToken?.symbol || token.symbol || token.name;
		if (symbol) return `symbol-${symbol.toUpperCase()}`;
		
		// Last resort - random ID
		return `random-${Date.now()}-${Math.random().toString(36).substring(2)}`;
	}
	
	// Mark a token as confirmed
	confirmToken(token) {
		const tokenId = this.getTokenIdentifier(token);
		
		if (this.pendingTokens.has(tokenId)) {
			const data = this.pendingTokens.get(tokenId);
			data.confirmed = true;
			console.log(`Token confirmed: ${token.baseToken?.symbol || token.symbol || 'unknown'}`);
		}
	}
	
	/**
	 * Refresh tokens from the data provider
	 * @param {boolean} isInitialLoad Whether this is the initial loading of tokens
	 */
	async refreshTokensFromProvider(isInitialLoad = false) {
		// Check if we have a data provider
		if (!this.dataProvider) {
			console.warn("Data provider not available for tokens");
			return;
		}
		
		console.log(`Refreshing tokens from provider (${isInitialLoad ? 'initial load' : 'update'})`);
		
		try {
			// Get tokens from the data provider (DexScreener)
			const tokenData = await this.dataProvider.getCurrentPageTokens();
			
			// If no data available, log warning and exit
			if (!tokenData || tokenData.length === 0) {
				console.warn("No token data available from provider");
				return;
			}
			
			console.log(`Received ${tokenData.length} tokens from provider`);
			
			// CRITICAL: Clean up any potential duplicate tags from previous runs
			this.cleanupDuplicateTags();
			
			// Build maps for token lookup - to prevent duplicates
			const keyToTagId = new Map(); // Maps token keys to tag IDs
			const symbolToTagId = new Map(); // Maps token symbols to tag IDs (without $ prefix)
			
			// Track which tags should remain (everything else will be removed)
			const tagIdsToKeep = new Set();
			const processedKeysInThisBatch = new Set();
			
			// First, build maps of ALL existing tags by key and symbol - not just provider tags
			// This helps prevent duplication between manual and provider tags
			this.tagsManager.tags.forEach(tag => {
				// Add by token key if available
				if (tag.token) {
					const key = getTokenKey(tag.token);
					if (key) keyToTagId.set(key, tag.id);
				}
				
				// Add by normalized symbol (no $ prefix)
				const symbol = (tag.originalName || tag.name.replace(/^\$/, '')).toUpperCase();
				symbolToTagId.set(symbol, tag.id);
				
				// If it's a manual tag for a token that will come from the provider,
				// we'll upgrade it rather than creating a duplicate
				if (tag.metadata?.source === 'manual') {
					// Keep track so we don't remove it
					tagIdsToKeep.add(tag.id);
				}
			});
			
			// Process each token from the provider
			for (const token of tokenData) {
				// Get token identity information
				let symbol = token.baseToken?.symbol || token.symbol || token.name;
				if (!symbol) {
					console.warn("Skipping token without symbol:", token);
					continue;
				}
				
				// Clean the symbol (remove $ prefix if present) and normalize
				const cleanSymbol = symbol.replace(/^\$/, '');
				const normalizedSymbol = cleanSymbol.toUpperCase();
				
				// Get consistent token key and identifier
				const tokenKey = getTokenKey(token);
				const tokenId = this.getTokenIdentifier(token);
				
				// Skip duplicates in this batch
				if (processedKeysInThisBatch.has(tokenId) || 
					processedKeysInThisBatch.has(`symbol-${normalizedSymbol}`)) {
					continue;
				}
				
				// Mark as processed in this batch
				processedKeysInThisBatch.add(tokenId);
				processedKeysInThisBatch.add(`symbol-${normalizedSymbol}`);
				
				// Check if this token already exists by key or symbol
				let existingTagId = null;
				if (tokenKey) {
					existingTagId = keyToTagId.get(tokenKey);
				}
				
				// Fall back to symbol lookup if no key match
				if (!existingTagId) {
					existingTagId = symbolToTagId.get(normalizedSymbol);
				}
				
				// Check both with $ and without $ prefix
				if (!existingTagId) {
					// Check if there's a tag with the $ prefix version if our symbol doesn't have it
					if (!symbol.startsWith('$')) {
						const dollarTag = this.tagsManager.tags.find(tag => 
							(tag.name === `$${symbol}` || tag.originalName === `$${symbol}`)
						);
						if (dollarTag) {
							existingTagId = dollarTag.id;
						}
					} 
					// Check if there's a tag without the $ prefix if our symbol has it
					else if (symbol.startsWith('$')) {
						const noDollarTag = this.tagsManager.tags.find(tag => 
							(tag.name === symbol.substring(1) || tag.originalName === symbol.substring(1))
						);
						if (noDollarTag) {
							existingTagId = noDollarTag.id;
						}
					}
				}
				
				if (existingTagId) {
					// Tag exists - keep it and update if necessary
					tagIdsToKeep.add(existingTagId);
					
					// Update the existing tag with token data if it's missing
					const existingTag = this.tagsManager.tags.find(tag => tag.id === existingTagId);
					if (existingTag) {
						// Always update with the latest token data
						existingTag.token = token;
						
						// If the tag was manual, update its source to avoid future duplication
						if (existingTag.metadata?.source === 'manual') {
							existingTag.metadata.source = 'initialProvider';
							existingTag.metadata.upgradedFromManual = true;
							existingTag.metadata.providerSource = token._metadata?.source || 'unknown';
							existingTag.metadata.providerPage = token._metadata?.page || 'unknown';
							existingTag.metadata.fetchedAt = Date.now();
							console.log(`Upgraded manual tag ${existingTag.name} to provider tag`);
						} else {
							console.log(`Updated token data for existing tag ${existingTag.name}`);
						}
					}
				} else {
					// Generate URL
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
					
					// Calculate size
					let size = 1.0;
					if (this.dataProvider.calculateTokenSize) {
						size = Math.max(1.0, this.dataProvider.calculateTokenSize(token));
					}
					
					// IMPORTANT: Always add $ prefix to symbols if not present
					// This ensures consistency with how tags are displayed
					if (!symbol.startsWith('$')) {
						symbol = `$${symbol}`;
					}
					
					console.log(`Adding new token: ${symbol}`);
					
					// Add the tag
					const addedTag = await this.tagsManager.addTag(symbol, url, size, token, {
						source: 'initialProvider',
						providerSource: token._metadata?.source || 'unknown',
						providerPage: token._metadata?.page || 'unknown',
						fetchedAt: Date.now()
					});
					
					// If successfully added, track it
					if (addedTag) {
						tagIdsToKeep.add(addedTag.id);
						
						// Show popup for token only if it's not the initial load
						if (!isInitialLoad && this.visualizationManager) {
							this.visualizationManager.showNewTokenPopup(token || { 
								baseToken: { symbol }
							}, addedTag, { clickable: true });
						}
					}
				}
			}
			
			// Remove tags that are no longer in the provider's list
			let removedCount = 0;
			let actuallyRemoved = 0;
			const removedSymbols = [];
			
			for (const tag of this.tagsManager.tags) {
				// Only process provider tags - leave user tags and demo tags alone
				if (tag.metadata?.source !== 'initialProvider') continue;
				
				// If this tag isn't in our "keep" list, remove it
				if (!tagIdsToKeep.has(tag.id)) {
					removedCount++;
					const symbol = tag.originalName || tag.name.replace(/^\$/, '');
					removedSymbols.push(symbol);
					
					try {
						this.tagsManager.tagManager.removeTag(tag.id);
						actuallyRemoved++;
					} catch (error) {
						console.error(`Error removing tag ${tag.name}:`, error);
					}
				}
			}
			
			if (removedCount > 0) {
				console.log(`Removing ${removedCount} tokens no longer in provider list: ${removedSymbols.join(', ')}`);
				console.log(`Actually removed ${actuallyRemoved} tokens`);
			}
			
			// Run a duplicate check after all processing
			this.cleanupDuplicateTags();
			
			// Final count of provider tags
			const finalProviderTags = this.tagsManager.tags.filter(tag => tag.metadata?.source === 'initialProvider');
			console.log(`Final token count: ${finalProviderTags.length} (expected ${tokenData.length})`);
			
			// Log results
			console.log(`Token refresh complete: ${tagIdsToKeep.size} kept, ${removedCount} removed`);
			
			// Update tag counter display
			if (this.tagCountDisplay) {
				const tagCount = this.tagsManager ? this.tagsManager.tags.length : 0;
				this.tagCountDisplay.textContent = `Tags: ${tagCount}/${this.maxInitialTokens}`;
			}
		} catch (error) {
			console.error("Error refreshing tokens:", error);
		}

		// Set up event listener for data updates - only once
		if (this.dataProvider && isInitialLoad && !this.callbackRegistered) {
			console.log("Setting up token update callback");
			
			// Rate limiting variables
			let lastCallbackTime = 0;
			let isRefreshInProgress = false;
			const callbackMinInterval = 5000; // 15 seconds between refreshes
			
			// Create the callback function
			const updateCallback = (updatedData) => {
				// Prevent multiple refreshes from running at the same time
				if (isRefreshInProgress) {
					console.log("Token refresh already in progress, skipping update");
					return;
				}
				
				// Rate limit the refresh
				const now = Date.now();
				if (now - lastCallbackTime < callbackMinInterval) {
					console.log("Token refresh called too soon, skipping update");
					return;
				}
				
				// Update timing trackers
				lastCallbackTime = now;
				isRefreshInProgress = true;
				
				// Refresh the tokens
				this.refreshTokensFromProvider(false)
					.finally(() => {
						// Clear the in-progress flag when done
						isRefreshInProgress = false;
					});
			};
			
			// Register callback with the data provider
			this.dataProvider.registerUpdateCallback(updateCallback);
			this.callbackRegistered = true;
		}
	}
	
	/**
	 * Clean up duplicate tags by removing repeated tags with same symbol
	 */
	cleanupDuplicateTags() {
		console.log("Running duplicate tag cleanup...");
		
		// Group tags by normalized symbol (without $ prefix)
		const tagsBySymbol = new Map();
		
		// First pass: build map of tags by symbol
		for (const tag of this.tagsManager.tags) {
			// Normalize symbol by removing $ prefix
			const symbol = (tag.originalName || tag.name.replace(/^\$/, '')).toUpperCase();
			
			if (!tagsBySymbol.has(symbol)) {
				tagsBySymbol.set(symbol, []);
			}
			tagsBySymbol.get(symbol).push(tag);
		}
		
		// Second pass: find and remove duplicates
		let removedCount = 0;
		
		for (const [symbol, tags] of tagsBySymbol.entries()) {
			if (tags.length > 1) {
				console.log(`Found duplicate tags for symbol ${symbol}: ${tags.length} instances`);
				
				// Sort by preference:
				// 1. Prefer initialProvider tags with token data
				// 2. Then manual tags with token data
				// 3. Then initialProvider tags without token data
				// 4. Then manual tags without token data
				// 5. Fall back to ID comparison for same type (older tags)
				tags.sort((a, b) => {
					// Extract sources for easier comparison
					const aSource = a.metadata?.source || 'unknown';
					const bSource = b.metadata?.source || 'unknown';
					
					// Prefer tags with token data regardless of source
					if (a.token && !b.token) return -1;
					if (!a.token && b.token) return 1;
					
					// If both have token data or both don't have token data,
					// prefer initialProvider over manual
					if (aSource === 'initialProvider' && bSource !== 'initialProvider') return -1;
					if (aSource !== 'initialProvider' && bSource === 'initialProvider') return 1;
					
					// Prefer tags with $ prefix
					const aHasPrefix = a.name.startsWith('$');
					const bHasPrefix = b.name.startsWith('$');
					if (aHasPrefix && !bHasPrefix) return -1;
					if (!aHasPrefix && bHasPrefix) return 1;
					
					// Fall back to ID comparison (keep older tags)
					return a.id.localeCompare(b.id);
				});
				
				// Keep the first (best) tag, remove the rest
				const keptTag = tags[0];
				const duplicatesToRemove = tags.slice(1);
				
				console.log(`Keeping tag ${keptTag.name} (${keptTag.id}, source: ${keptTag.metadata?.source || 'unknown'}), removing ${duplicatesToRemove.length} duplicates`);
				
				// Remove duplicates
				for (const duplicateTag of duplicatesToRemove) {
					try {
						this.tagsManager.tagManager.removeTag(duplicateTag.id);
						removedCount++;
						console.log(`Removed duplicate tag ${duplicateTag.name} (${duplicateTag.id}, source: ${duplicateTag.metadata?.source || 'unknown'})`);
					} catch (error) {
						console.error(`Error removing duplicate tag ${duplicateTag.name}:`, error);
					}
				}
			}
		}
		
		if (removedCount > 0) {
			console.log(`Removed ${removedCount} duplicate tags`);
		} else {
			console.log("No duplicate tags found");
		}
	}
	
	setupFormSubmission() {
		return;
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
		
		// Create tag counter display
		this.tagCountDisplay = document.createElement('div');
		this.tagCountDisplay.style.position = 'absolute';
		this.tagCountDisplay.style.top = '10px';
		this.tagCountDisplay.style.left = '10px';
		this.tagCountDisplay.style.color = '#0ff';
		this.tagCountDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
		this.tagCountDisplay.style.padding = '5px 10px';
		this.tagCountDisplay.style.borderRadius = '4px';
		this.tagCountDisplay.style.zIndex = '1000';
		this.tagCountDisplay.style.fontSize = '14px';
		this.tagCountDisplay.style.fontFamily = 'monospace';
		this.tagCountDisplay.style.cursor = 'pointer'; // Add pointer cursor
		document.body.appendChild(this.tagCountDisplay);
		
		// Create tag list dialog (initially hidden)
		this.createTagListDialog();
		
		// Add click listener to tag counter to show the tag list
		this.tagCountDisplay.addEventListener('click', () => {
			this.showTagListDialog();
		});
		
		// Create FPS display
		this.fpsDisplay = document.createElement('div');
		this.fpsDisplay.style.position = 'absolute';
		this.fpsDisplay.style.top = '40px';
		this.fpsDisplay.style.left = '10px';
		this.fpsDisplay.style.color = '#0ff';
		this.fpsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
		this.fpsDisplay.style.padding = '5px 10px';
		this.fpsDisplay.style.borderRadius = '4px';
		this.fpsDisplay.style.zIndex = '1000';
		this.fpsDisplay.style.fontSize = '14px';
		this.fpsDisplay.style.fontFamily = 'monospace';
		document.body.appendChild(this.fpsDisplay);
		
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
	 * Create the tag list dialog
	 */
	createTagListDialog() {
		// Create the dialog container
		this.tagListDialog = document.createElement('div');
		this.tagListDialog.style.position = 'fixed';
		this.tagListDialog.style.top = '50%';
		this.tagListDialog.style.left = '50%';
		this.tagListDialog.style.transform = 'translate(-50%, -50%)';
		this.tagListDialog.style.width = '600px';
		this.tagListDialog.style.maxHeight = '80vh';
		this.tagListDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
		this.tagListDialog.style.color = '#fff';
		this.tagListDialog.style.padding = '20px';
		this.tagListDialog.style.borderRadius = '8px';
		this.tagListDialog.style.border = '1px solid rgba(0, 255, 255, 0.5)';
		this.tagListDialog.style.zIndex = '2000';
		this.tagListDialog.style.display = 'none';
		this.tagListDialog.style.overflow = 'auto';
		this.tagListDialog.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3)';
		this.tagListDialog.style.fontFamily = 'monospace';
		
		// Create header 
		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		header.style.marginBottom = '15px';
		header.style.borderBottom = '1px solid rgba(0, 255, 255, 0.3)';
		header.style.paddingBottom = '10px';
		
		const title = document.createElement('h2');
		title.textContent = 'All Tags';
		title.style.color = '#0ff';
		title.style.margin = '0';
		header.appendChild(title);
		
		// Create close button
		const closeBtn = document.createElement('button');
		closeBtn.textContent = '✕';
		closeBtn.style.background = 'none';
		closeBtn.style.border = 'none';
		closeBtn.style.color = '#0ff';
		closeBtn.style.fontSize = '20px';
		closeBtn.style.cursor = 'pointer';
		closeBtn.style.padding = '5px 10px';
		closeBtn.addEventListener('click', () => {
			this.tagListDialog.style.display = 'none';
		});
		header.appendChild(closeBtn);
		
		this.tagListDialog.appendChild(header);
		
		// Create table
		this.tagListTable = document.createElement('table');
		this.tagListTable.style.width = '100%';
		this.tagListTable.style.borderCollapse = 'collapse';
		this.tagListTable.style.fontSize = '14px';
		
		// Create table header
		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');
		
		// Add header cells
		const headers = ['#', 'Tag Name', 'ID', 'Source', 'Key'];
		headers.forEach(text => {
			const th = document.createElement('th');
			th.textContent = text;
			th.style.padding = '8px';
			th.style.textAlign = 'left';
			th.style.borderBottom = '1px solid rgba(0, 255, 255, 0.3)';
			th.style.color = '#0ff';
			headerRow.appendChild(th);
		});
		
		thead.appendChild(headerRow);
		this.tagListTable.appendChild(thead);
		
		// Create table body
		this.tagListTableBody = document.createElement('tbody');
		this.tagListTable.appendChild(this.tagListTableBody);
		
		this.tagListDialog.appendChild(this.tagListTable);
		
		// Create controls at the bottom
		const controls = document.createElement('div');
		controls.style.marginTop = '15px';
		controls.style.display = 'flex';
		controls.style.justifyContent = 'space-between';
		controls.style.paddingTop = '10px';
		controls.style.borderTop = '1px solid rgba(0, 255, 255, 0.3)';
		
		// Create filter controls
		const filterInput = document.createElement('input');
		filterInput.type = 'text';
		filterInput.placeholder = 'Filter tags...';
		filterInput.style.padding = '5px 10px';
		filterInput.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
		filterInput.style.color = '#fff';
		filterInput.style.border = '1px solid rgba(0, 255, 255, 0.3)';
		filterInput.style.borderRadius = '4px';
		filterInput.style.width = '200px';
		filterInput.addEventListener('input', () => {
			this.filterTagList(filterInput.value);
		});
		controls.appendChild(filterInput);
		
		// Create summary text
		this.tagSummaryText = document.createElement('div');
		this.tagSummaryText.style.color = '#0ff';
		controls.appendChild(this.tagSummaryText);
		
		this.tagListDialog.appendChild(controls);
		
		// Add to document
		document.body.appendChild(this.tagListDialog);
	}
	
	/**
	 * Show the tag list dialog with current tags
	 */
	showTagListDialog() {
		// Clear existing table rows
		this.tagListTableBody.innerHTML = '';
		
		// Get all tags and sort them alphabetically by name
		const tags = [...this.tagsManager.tags].sort((a, b) => {
			const nameA = (a.originalName || a.name.replace(/^\$/, '')).toUpperCase();
			const nameB = (b.originalName || b.name.replace(/^\$/, '')).toUpperCase();
			return nameA.localeCompare(nameB);
		});
		
		// Track counts by source
		const sourceCounts = {};
		
		// Add each tag as a table row
		tags.forEach((tag, index) => {
			const row = document.createElement('tr');
			
			// Index cell
			const indexCell = document.createElement('td');
			indexCell.textContent = (index + 1).toString();
			indexCell.style.padding = '8px';
			indexCell.style.borderBottom = '1px solid rgba(0, 255, 255, 0.2)';
			row.appendChild(indexCell);
			
			// Name cell
			const nameCell = document.createElement('td');
			nameCell.textContent = tag.originalName || tag.name.replace(/^\$/, '');
			nameCell.style.padding = '8px';
			nameCell.style.borderBottom = '1px solid rgba(0, 255, 255, 0.2)';
			nameCell.style.fontWeight = 'bold';
			row.appendChild(nameCell);
			
			// ID cell
			const idCell = document.createElement('td');
			idCell.textContent = tag.id;
			idCell.style.padding = '8px';
			idCell.style.borderBottom = '1px solid rgba(0, 255, 255, 0.2)';
			idCell.style.color = '#aaa';
			idCell.style.fontSize = '12px';
			row.appendChild(idCell);
			
			// Source cell
			const sourceCell = document.createElement('td');
			const source = tag.metadata?.source || 'unknown';
			sourceCell.textContent = source;
			sourceCell.style.padding = '8px';
			sourceCell.style.borderBottom = '1px solid rgba(0, 255, 255, 0.2)';
			
			// Track counts
			sourceCounts[source] = (sourceCounts[source] || 0) + 1;
			
			// Color-code source cells
			if (source === 'initialProvider') {
				sourceCell.style.color = '#00ff00'; // Green for provider
			} else if (source === 'userSubmit') {
				sourceCell.style.color = '#ff9900'; // Orange for user
			} else if (source === 'demoMode') {
				sourceCell.style.color = '#ff00ff'; // Purple for demo
			}
			
			row.appendChild(sourceCell);
			
			// Key cell (shows token key if available)
			const keyCell = document.createElement('td');
			if (tag.token) {
				const key = getTokenKey(tag.token);
				keyCell.textContent = key || 'no key';
				keyCell.title = key || 'no key'; // Add tooltip for long keys
			} else {
				keyCell.textContent = 'no token data';
			}
			keyCell.style.padding = '8px';
			keyCell.style.borderBottom = '1px solid rgba(0, 255, 255, 0.2)';
			keyCell.style.color = '#aaa';
			keyCell.style.fontSize = '12px';
			keyCell.style.maxWidth = '150px';
			keyCell.style.overflow = 'hidden';
			keyCell.style.textOverflow = 'ellipsis';
			keyCell.style.whiteSpace = 'nowrap';
			row.appendChild(keyCell);
			
			// Add highlighting for row hover
			row.style.transition = 'background-color 0.2s';
			row.addEventListener('mouseover', () => {
				row.style.backgroundColor = 'rgba(0, 255, 255, 0.1)';
			});
			row.addEventListener('mouseout', () => {
				row.style.backgroundColor = '';
			});
			
			// Add click handler to show token details
			row.style.cursor = 'pointer';
			row.addEventListener('click', () => {
				// Close the dialog
				this.tagListDialog.style.display = 'none';
				
				// Highlight the tag
				this.tagsManager.tagManager.handleTagClick(tag);
			});
			
			this.tagListTableBody.appendChild(row);
		});
		
		// Update summary text with counts by source
		let summaryText = `${tags.length} tags total: `;
		const sourceParts = [];
		
		if (sourceCounts.initialProvider) {
			sourceParts.push(`<span style="color: #00ff00">${sourceCounts.initialProvider} from provider</span>`);
		}
		if (sourceCounts.userSubmit) {
			sourceParts.push(`<span style="color: #ff9900">${sourceCounts.userSubmit} from users</span>`);
		}
		if (sourceCounts.demoMode) {
			sourceParts.push(`<span style="color: #ff00ff">${sourceCounts.demoMode} from demo</span>`);
		}
		if (sourceCounts.unknown) {
			sourceParts.push(`${sourceCounts.unknown} unknown`);
		}
		
		this.tagSummaryText.innerHTML = summaryText + sourceParts.join(', ');
		
		// Show the dialog
		this.tagListDialog.style.display = 'block';
	}
	
	/**
	 * Filter the tag list by search term
	 * @param {string} searchTerm - Text to filter by
	 */
	filterTagList(searchTerm) {
		const term = searchTerm.toLowerCase();
		const rows = this.tagListTableBody.querySelectorAll('tr');
		
		let visibleCount = 0;
		
		rows.forEach(row => {
			const name = row.cells[1].textContent.toLowerCase();
			const id = row.cells[2].textContent.toLowerCase();
			const source = row.cells[3].textContent.toLowerCase();
			const key = row.cells[4].textContent.toLowerCase();
			
			// Show row if any cell contains the search term
			if (name.includes(term) || id.includes(term) || source.includes(term) || key.includes(term)) {
				row.style.display = '';
				visibleCount++;
			} else {
				row.style.display = 'none';
			}
		});
		
		// Update the row numbers for visible rows
		let counter = 1;
		rows.forEach(row => {
			if (row.style.display !== 'none') {
				row.cells[0].textContent = counter++;
			}
		});
		
		// Update summary text
		if (searchTerm) {
			this.tagSummaryText.innerHTML += ` (${visibleCount} shown)`;
		}
	}
	
	/**
	 * Display a demo token in the visualizations
	 */
	async showDemoToken() {
		return;
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
		return;
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
		
		const symbolName = tag.originalName || tag.name.replace(/^\$/, '');
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
		
		// Performance monitoring
		const perfMetrics = {
			total: 0,
			deltaTime: 0,
			tagCount: 0,
			scene: 0,
			tagsManager: 0,
			controls: 0,
			visualization: 0
		};
		const perfStart = performance.now();
		
		// Calculate delta time
		const currentTime = this.clock.getElapsedTime();
		const deltaTime = currentTime - this.lastTime;
		this.lastTime = currentTime;
		perfMetrics.deltaTime = performance.now() - perfStart;

		// Update frame counter for FPS calculation
		this.frameCounter++;
		
		// Update tag count display every 30 frames (or about half a second)
		if (this.frameCounter % 30 === 0 && this.tagCountDisplay) {
			const tagCount = this.tagsManager ? this.tagsManager.tags.length : 0;
			this.tagCountDisplay.textContent = `Tags: ${tagCount}/${this.maxInitialTokens}`;
			perfMetrics.tagCount = tagCount;
			
			// Also update FPS counter
			const now = performance.now();
			if (now - this.lastFpsUpdate > 500) { // update every 500ms
				const fps = Math.round((this.frameCounter / (now - this.lastFpsUpdate)) * 1000);
				this.fpsDisplay.textContent = `FPS: ${fps}`;
				this.frameCounter = 0;
				this.lastFpsUpdate = now;
			}
		}
		
		// Check visualization manager connection every 10 seconds instead of using modulo on time
		// This reduces per-frame calculations
		if (currentTime - this.lastManagerCheck > 10) {
			this.lastManagerCheck = currentTime;
			
			// Check if TagManager still has visualizationManager
			if (this.visualizationManager && !this.tagsManager.tagManager.visualizationManager) {
				console.log('Auto-repairing VisualizationManager connection');
				this.tagsManager.setVisualizationManager(this.visualizationManager);
			}
		}
		
		// Only update camera movement tracking if controls are active
		// This avoids unnecessary object creation each frame
		let isCameraMoving = false;
		if (this.controls.enabled) {
		// Get current camera state
			const currentPosition = this.scene.camera.position;
			const currentQuaternion = this.scene.camera.quaternion;
		
		// Check if camera moved since last frame
			isCameraMoving = this.lastCameraPosition && (
				!this.lastCameraPosition.equals(currentPosition) ||
				!this.lastCameraQuaternion.equals(currentQuaternion)
		);
		
		// Only update the stored camera state if it actually changed
		if (isCameraMoving || !this.lastCameraPosition) {
				// Clone only when needed instead of every frame
				this.lastCameraPosition = currentPosition.clone();
				this.lastCameraQuaternion = currentQuaternion.clone();
			}
		}
		
		// Update scene
		const sceneStart = performance.now();
		this.scene.update();
		perfMetrics.scene = performance.now() - sceneStart;
		
		// Update tags
		const tagsStart = performance.now();
		this.tagsManager.update(deltaTime);
		perfMetrics.tagsManager = performance.now() - tagsStart;
		
		// Update controls
		const controlsStart = performance.now();
		this.controls.update();
		perfMetrics.controls = performance.now() - controlsStart;
		
		// Update visualizations only when needed (camera is moving or periodically)
		if (this.visualizationManager) {
			const vizStart = performance.now();
			// Only pass isCameraMoving when true to avoid unnecessary updates
			if (isCameraMoving || this.frameCounter % 10 === 0) {
				this.visualizationManager.update(deltaTime, isCameraMoving);
			} else {
				// Lightweight update without camera movement recalculation
				this.visualizationManager.update(deltaTime, false);
			}
			perfMetrics.visualization = performance.now() - vizStart;
		}
		
		// // Calculate total time and log if it's too high
		// perfMetrics.total = performance.now() - perfStart;
		// if (perfMetrics.total > 64) { // Over 16.67ms = under 60fps
		// 	console.log('Performance warning:', perfMetrics);
		// }
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