import * as THREE from 'three';
import { Scene } from './core/scene.js';
import { TagsManager } from './interactions/tag-cluster/tags.js';
import { initControls } from './core/controls.js';
import { Utils } from './utils/utils.js';
import { DexScreenerManager } from './ui/DexScreenerManager.js';

class MemeCube {
	constructor() {
		this.canvas = document.getElementById('canvas');
		this.scene = null;
		this.tagsManager = null;
		this.controls = null;
		this.utils = new Utils();
		this.dexScreenerManager = null;
		this.demoMode = false;
		this.demoInterval = null;
		this.clock = new THREE.Clock();
		this.lastTime = 0;
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.lastCameraPosition = null;
		this.lastCameraQuaternion = null;
		
		// We'll use DexScreener data instead of hardcoded tags
		this.initialTokens = [];
		this.maxInitialTokens = 15; // Limit to 15 initial tokens
		
		this.init();
	}
	
	async init() {
		// Initialize scene
		this.scene = new Scene(this.canvas);
		
		// Initialize tags manager
		this.tagsManager = new TagsManager(this.scene.scene, this.scene.camera);
		
		// Initialize controls
		this.controls = initControls(this.scene.camera, this.canvas);
		
		// Initialize DexScreener module first to get token data
		await this.initDexScreener();
		
		// Add initial tags from DexScreener data
		await this.addInitialTokensFromDexScreener();
		
		// If we couldn't get DexScreener data and have no tags, add some fallback tags
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
		this.tagsManager.initializeTagAgeSystem();
		
		// Set up form submission
		this.setupFormSubmission();
		
		// Add demo mode toggle
		this.setupDemoModeToggle();
		
		// Add information button
		this.setupInfoButton();
		
		// Start demo mode if enabled or if we have very few tags
		if (this.demoMode || this.tagsManager.tags.length < 5) {
			this.startDemoMode();
		}
		
		// Add mouse event listeners for interaction
		this.setupMouseEvents();
		
		// Start animation loop
		this.animate();
	}
	
	// Initialize DexScreener integration
	async initDexScreener() {
		// Initialize DexScreener with scene, camera, and tagsManager references
		this.dexScreenerManager = new DexScreenerManager(this.scene.scene, this.scene.camera, this.tagsManager);
		
		// Create UI elements
		this.dexScreenerManager.createTokenListUI();
		
		// Fetch initial token data
		if (this.dexScreenerManager.dataProcessor) {
			await this.dexScreenerManager.dataProcessor.refreshAllTokenData();
		}
		
		// Ensure visualizations are visible
		if (this.dexScreenerManager.tokenScoreboard) {
			this.dexScreenerManager.tokenScoreboard.isVisible = true;
			console.log("Initializing token scoreboard");
			this.dexScreenerManager.tokenScoreboard.updateScreenPosition();
		}
		
		if (this.dexScreenerManager.tokenChart) {
			this.dexScreenerManager.tokenChart.isVisible = true;
			this.dexScreenerManager.tokenChart.updateScreenPosition();
		}
		
		if (this.dexScreenerManager.tokenCube) {
			this.dexScreenerManager.tokenCube.cubeGroup.visible = true;
		}
		
		// Set up event listener for adding tokens to cube
		document.addEventListener('add-token-to-cube', async (event) => {
			const { text, url, size } = event.detail;
			
			try {
				await this.tagsManager.addTag(text, url, size);
				this.utils.showTemporaryMessage(`Added token ${text} to the cube!`);
			} catch (error) {
				console.error('Error adding token to cube:', error);
				this.utils.showTemporaryMessage('Failed to add token to cube');
			}
		});
	}
	
	/**
	 * Add initial tokens from DexScreener data
	 */
	async addInitialTokensFromDexScreener() {
		// Check if we have token data from DexScreener
		if (!this.dexScreenerManager || !this.dexScreenerManager.dataProcessor) {
			console.warn("DexScreener data not available for initial tags");
			return;
		}
		
		try {
			// Get token data or refresh if needed
			let tokenData = this.dexScreenerManager.dataProcessor.data;
			
			// If no data available yet, refresh
			if (!tokenData || tokenData.length === 0) {
				tokenData = await this.dexScreenerManager.dataProcessor.refreshAllTokenData();
			}
			
			// Still no data? Use demo mode
			if (!tokenData || tokenData.length === 0) {
				console.warn("No token data available, using demo mode");
				this.startDemoMode();
				return;
			}
			
			// Limit number of initial tokens
			const tokensToAdd = tokenData.slice(0, this.maxInitialTokens);
			
			// Add each token with small delay for better physics
			for (const token of tokensToAdd) {
				if (!token.baseToken?.symbol) continue;
				
				const symbol = token.baseToken.symbol;
				const url = token.url || `https://dexscreener.com/${token.chainId || 'eth'}/${token.pairAddress || ''}`;
				
				// Calculate size based on market cap
				let size = 0.7; // Default size
				if (token.marketCap && this.dexScreenerManager.calculateTokenSize) {
					size = this.dexScreenerManager.calculateTokenSize(token);
				}
				
				// Add tag
				await this.tagsManager.addTag(symbol, url, size);
				
				// Small delay to allow physics to position properly
				await new Promise(resolve => setTimeout(resolve, 50));
			}
			
			// Store added tokens reference
			this.initialTokens = tokensToAdd;
			
			this.utils.showTemporaryMessage(`Added ${tokensToAdd.length} tokens from DexScreener!`);
		} catch (error) {
			console.error("Error adding initial tokens from DexScreener:", error);
			this.startDemoMode(); // Fallback to demo mode
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
					await this.tagsManager.addTag(tagName, tagUrl, randomSize);
					
					// Clear form
					document.getElementById('tag-name').value = '';
					document.getElementById('tag-url').value = '';
					
					// Animate the submit button to show success
					const button = form.querySelector('button');
					button.classList.add('tag-submit-animation');
					button.textContent = 'Tag Launched!';
					
					setTimeout(() => {
						button.classList.remove('tag-submit-animation');
						button.textContent = 'Launch Tag';
					}, 2000);
				} catch (error) {
					console.error('Error adding tag:', error);
					alert('Failed to add tag. Please try again.');
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
				<li>Space-themed LED scoreboard showing live token data</li>
				<li>3D price chart visualization</li>
				<li>Integration with DexScreener API</li>
			</ul>
			<p>Controls:</p>
			<ul>
				<li>Drag to rotate the view</li>
				<li>Scroll to zoom in/out</li>
				<li>Right-click drag to pan</li>
				<li>Click on any tag to visit its URL</li>
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
		// Ensure we have a DexScreener manager
		if (!this.dexScreenerManager) return;
		
		this.utils.showTemporaryMessage('Loading demo token...');
		
		try {
			// If we don't have token data yet, fetch it
			if (!this.dexScreenerManager.tokenData || this.dexScreenerManager.tokenData.length === 0) {
				await this.dexScreenerManager.refreshAllTokenData();
			}
			
			// Choose a showcase token (use the first one with complete data)
			let demoToken = null;
			
			// Find a token with complete data
			for (const token of this.dexScreenerManager.tokenData) {
				if (token.priceUsd && token.marketCap && token.baseToken?.symbol) {
					demoToken = token;
					break;
				}
			}
			
			// If no token found with complete data, use the first one
			if (!demoToken && this.dexScreenerManager.tokenData && this.dexScreenerManager.tokenData.length > 0) {
				demoToken = this.dexScreenerManager.tokenData[0];
			}
			
			// If we still don't have a token, create a sample one
			if (!demoToken) {
				demoToken = {
					baseToken: { symbol: 'DEMO' },
					priceUsd: '1.2345',
					marketCap: 1000000,
					priceChange: { h24: 5.67 },
					url: 'https://example.com',
					chainId: 'eth'
				};
			}
			
			// Ensure visualizations are visible
			if (this.dexScreenerManager.showVisualizations === false) {
				this.dexScreenerManager.toggleVisualizations();
			}
			
			// Update scoreboard
			if (this.dexScreenerManager.tokenScoreboard && this.dexScreenerManager.tokenData) {
				// Create an array with the demo token and a few more if available
				const displayTokens = [demoToken];
				
				// Add a few more tokens if available
				for (let i = 0; i < 4; i++) {
					if (i < this.dexScreenerManager.tokenData.length && 
						this.dexScreenerManager.tokenData[i] !== demoToken) {
						displayTokens.push(this.dexScreenerManager.tokenData[i]);
					}
				}
				
				this.dexScreenerManager.tokenScoreboard.updateTokenData(displayTokens);
			}
			
			// Update chart
			if (this.dexScreenerManager.tokenChart) {
				await this.dexScreenerManager.fetchAndUpdateTokenChart(demoToken);
			}
			
			// Get token symbol
			const tokenSymbol = demoToken.baseToken?.symbol || demoToken.tokenAddress?.substring(0, 8) || 'DEMO';
			
			// Check if token is already in cluster
			const existingTag = this.tagsManager.tags.find(tag => 
				tag.originalName === tokenSymbol || 
				tag.name === `$${tokenSymbol}`
			);
			
			if (existingTag) {
				// Token already exists, just provide visual feedback
				this.tagsManager.tagManager.pulseTag(existingTag);
				this.utils.showTemporaryMessage(`Token $${tokenSymbol} is already in the cluster!`);
			} else {
				// Calculate size but ensure it's visible
				const tokenSize = Math.max(0.6, this.dexScreenerManager.calculateTokenSize(demoToken));
				
				// Add new token to cluster
				await this.tagsManager.addTag(
					tokenSymbol,
					demoToken.url || '#',
					tokenSize
				);
				
				this.utils.showTemporaryMessage(`Showing demo token: $${tokenSymbol}`);
			}
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
			
			// Add it to the cube - ensure it's visible by setting a minimum size
			const size = Math.max(0.6, randomTag.size);
			await this.tagsManager.addTag(randomTag.text, randomTag.url, size);
			
			// Limit the total number of tags to prevent overcrowding
			// Increase limit from 40 to 50 for a more impressive cluster
			const maxTags = 50;
			if (this.tagsManager.tags.length > maxTags) {
				// Find and remove the oldest non-token tag (demo tag)
				const oldestDemoTag = this.tagsManager.tags.find(tag => !tag.metadata?.isToken);
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
		
		// Check if click was handled by DexScreener visualizations
		if (this.dexScreenerManager && this.dexScreenerManager.handleInteraction(this.raycaster)) {
			return; // Interaction was handled by visualizations
		}
		
		// Handle clicks on cube tags via the TagManager's interaction handler
		// Use raycaster to check for intersections with any tag
		const intersectedTag = this.tagsManager.tagManager.findIntersectedTag();
		
		if (intersectedTag) {
			// Provide visual feedback
			this.tagsManager.tagManager.pulseTag(intersectedTag);
			
			// Open the URL if available
			if (intersectedTag.url && intersectedTag.url !== '#') {
				window.open(intersectedTag.url, '_blank');
			}
		}
	}
	
	animate() {
		requestAnimationFrame(this.animate.bind(this));
		
		// Calculate delta time
		const currentTime = this.clock.getElapsedTime();
		const deltaTime = currentTime - this.lastTime;
		this.lastTime = currentTime;
		
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
		
		// Update DexScreener visualizations with camera movement info
		if (this.dexScreenerManager) {
			this.dexScreenerManager.update(deltaTime, isCameraMoving);
		}
	}
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	window.memeCube = new MemeCube();
}); 