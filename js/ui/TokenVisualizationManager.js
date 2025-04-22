/**
 * Token Visualization Manager
 * Handles UI and visualization for token data
 */

import { TokenScoreboard } from '../visualizations/token-scoreboard.js';
import { TokenChart3D } from '../visualizations/token-chart-3d.js';
import { TagCluster } from '../interactions/tag-cluster/tag-cluster.js';
import { Utils } from '../utils/utils.js';
import { DexScreenerProvider } from '../data-providers/DexScreenerProvider.js';

export class TokenVisualizationManager {
	constructor(scene = null, camera = null, tagsManager = null, dataProvider = null) {
		this.scene = scene;
		this.camera = camera;
		this.tagsManager = tagsManager;
		this.isModalOpen = false;
		this.modalElement = null;
		this.showVisualizations = true;
		this.utils = new Utils();
		this.lastCameraMoving = false;
		this.lastCameraMovingTimestamp = null;
		
		// Initialize the data provider - use provided one or default to DexScreener
		this.dataProvider = dataProvider || new DexScreenerProvider();
		
		// Setup 3D visualizations if scene is provided
		if (this.scene && this.camera && this.tagsManager) {
			this.setupVisualizations();
		}
		
		// Create UI elements
		this.createTokenListUI();
		
		// Register for data updates
		this.dataProvider.registerUpdateCallback(this.onDataUpdate.bind(this));
		
		// Start auto-refresh
		this.dataProvider.startAutoRefresh(15000); // 15 seconds refresh
	}
	
	/**
	 * Set a different data provider
	 * @param {TokenDataProvider} provider The data provider to use
	 */
	setDataProvider(provider) {
		// Unregister from current provider
		if (this.dataProvider) {
			this.dataProvider.unregisterUpdateCallback(this.onDataUpdate.bind(this));
			this.dataProvider.stopAutoRefresh();
		}
		
		// Set new provider
		this.dataProvider = provider;
		
		// Register with new provider
		if (this.dataProvider) {
			this.dataProvider.registerUpdateCallback(this.onDataUpdate.bind(this));
			this.dataProvider.startAutoRefresh();
		}
	}
	
	/**
	 * Setup 3D visualizations (scoreboard, chart, and tag cluster)
	 */
	setupVisualizations() {
		// Create token scoreboard
		this.tokenScoreboard = new TokenScoreboard(this.scene, this.camera);
		
		// Create token chart
		this.tokenChart = new TokenChart3D(this.scene, this.camera);
		
		// Create tag cluster visualization (replaces token cube)
		this.tokenCluster = new TagCluster(this.scene, this.camera, this.tagsManager);
		
		// Create UI toggle button for visualizations
		this.createVisualizationToggle();
		
		// Make sure visualizations are visible and working (force visibility to true)
		this.showVisualizations = true;
		
		// Force update the visualizations to ensure they're properly positioned
		if (this.tokenScoreboard) {
			this.tokenScoreboard.isVisible = true;
			console.log("Setting token scoreboard to visible");
			this.tokenScoreboard.updateScreenPosition();
		}
		
		if (this.tokenChart) {
			this.tokenChart.isVisible = true;
			this.tokenChart.updateScreenPosition();
		}
		
		// Initialize the tag cluster with empty data
		if (this.tokenCluster) {
			this.tokenCluster.initialize([]);
		}
		
		// Generate sample data for visualizations
		this.initializeDefaultData();
	}
	
	/**
	 * Callback for when data is updated
	 * @param {Array} data Updated token data
	 */
	onDataUpdate(data) {
		// Update token cluster with all token data
		if (this.tokenCluster && data.length > 0) {
			this.tokenCluster.updateTokens(data);
		}
		
		// Update scoreboard with top tokens
		if (this.tokenScoreboard && data.length > 0) {
			this.tokenScoreboard.updateTokenData(data.slice(0, 30));
		}
		
		// Update token list if visible
		if (this.isModalOpen) {
			this.updateTokenListContent();
		}
	}
	
	/**
	 * Initialize default data for visualizations if no API data is available yet
	 */
	initializeDefaultData() {
		// Generate sample data for the chart if needed
		if (this.tokenChart) {
			// Let the chart generate its own sample data
			this.tokenChart.generateSampleData();
		}
		
		// Generate sample data for the scoreboard if needed
		if (this.tokenScoreboard) {
			// Sample tokens for the scoreboard
			const sampleTokens = [
				{
					baseToken: { symbol: 'DEMO' },
					priceUsd: '0.1234',
					priceChange: { h24: 5.67 }
				},
				{
					baseToken: { symbol: 'PEPE' },
					priceUsd: '0.00001234',
					priceChange: { h24: -2.34 }
				},
				{
					baseToken: { symbol: 'DOGE' },
					priceUsd: '0.12',
					priceChange: { h24: 1.23 }
				}
			];
			
			this.tokenScoreboard.updateTokenData(sampleTokens);
		}
	}
	
	/**
	 * Create UI toggle button for visualizations
	 */
	createVisualizationToggle() {
		const toggleButton = document.createElement('button');
		toggleButton.textContent = '🌌 Toggle Space Visuals';
		toggleButton.style.position = 'absolute';
		toggleButton.style.bottom = '140px';
		toggleButton.style.right = '20px';
		toggleButton.style.zIndex = '1000';
		
		toggleButton.onclick = () => {
			this.toggleVisualizations();
		};
		
		document.body.appendChild(toggleButton);
		
		// Add demo token button
		const demoButton = document.createElement('button');
		demoButton.textContent = '🚀 Demo Token';
		demoButton.style.position = 'absolute';
		demoButton.style.bottom = '180px';
		demoButton.style.right = '20px';
		demoButton.style.zIndex = '1000';
		
		demoButton.onclick = async () => {
			await this.showDemoToken();
		};
		
		document.body.appendChild(demoButton);
		
		// Add token refresh button
		const refreshButton = document.createElement('button');
		refreshButton.textContent = '🔄 Refresh Tokens';
		refreshButton.style.position = 'absolute';
		refreshButton.style.bottom = '220px';
		refreshButton.style.right = '20px';
		refreshButton.style.zIndex = '1000';
		
		refreshButton.onclick = async () => {
			// Refresh token data and update cluster
			if (this.dataProvider) {
				const tokenData = await this.dataProvider.refreshData();
				if (this.tokenCluster && tokenData.length > 0) {
					this.tokenCluster.updateTokens(tokenData);
					this.utils.showTemporaryMessage(`Updated token cluster with ${tokenData.length} tokens!`);
				}
			}
		};
		
		document.body.appendChild(refreshButton);
	}
	
	/**
	 * Toggle visibility of 3D visualizations
	 */
	toggleVisualizations() {
		this.showVisualizations = !this.showVisualizations;
		
		if (this.tokenScoreboard) {
			this.tokenScoreboard.toggleVisibility();
		}
		
		if (this.tokenChart) {
			this.tokenChart.toggleVisibility();
		}
		
		// Update tag cluster visibility through tag manager
		if (this.tokenCluster && this.tokenCluster.tagManager) {
			this.tokenCluster.tagManager.tags.forEach(tag => {
				if (tag.mesh) {
					tag.mesh.visible = this.showVisualizations;
				}
			});
		}
	}
	
	/**
	 * Create token list UI elements
	 */
	createTokenListUI() {
		// Create button to show token list
		const listButton = document.createElement('button');
		listButton.textContent = '📋 Token List';
		listButton.style.position = 'absolute';
		listButton.style.top = '20px';
		listButton.style.right = '20px';
		listButton.style.zIndex = '1000';
		
		// Add click handler
		listButton.addEventListener('click', () => {
			this.showTokenList();
		});
		
		document.body.appendChild(listButton);
		
		// Create modal for token list (initially hidden)
		this.modalElement = document.createElement('div');
		this.modalElement.style.display = 'none';
		this.modalElement.style.position = 'fixed';
		this.modalElement.style.zIndex = '1001';
		this.modalElement.style.left = '50%';
		this.modalElement.style.top = '50%';
		this.modalElement.style.transform = 'translate(-50%, -50%)';
		this.modalElement.style.width = '80%';
		this.modalElement.style.maxWidth = '800px';
		this.modalElement.style.maxHeight = '80%';
		this.modalElement.style.backgroundColor = 'rgba(10, 20, 30, 0.95)';
		this.modalElement.style.color = 'white';
		this.modalElement.style.borderRadius = '8px';
		this.modalElement.style.padding = '20px';
		this.modalElement.style.boxShadow = '0 0 20px rgba(0, 200, 255, 0.5)';
		this.modalElement.style.border = '1px solid rgba(0, 200, 255, 0.3)';
		this.modalElement.style.backdropFilter = 'blur(5px)';
		this.modalElement.style.overflowY = 'auto';
		
		// Create close button
		const closeButton = document.createElement('button');
		closeButton.textContent = '✖';
		closeButton.style.position = 'absolute';
		closeButton.style.top = '10px';
		closeButton.style.right = '10px';
		closeButton.style.background = 'none';
		closeButton.style.border = 'none';
		closeButton.style.color = 'white';
		closeButton.style.fontSize = '20px';
		closeButton.style.cursor = 'pointer';
		
		closeButton.addEventListener('click', () => {
			this.closeTokenList();
		});
		
		// Create header
		const header = document.createElement('h2');
		header.textContent = 'Live Token Data';
		header.style.marginTop = '0';
		header.style.color = '#00ccff';
		
		// Create refresh button
		const refreshButton = document.createElement('button');
		refreshButton.textContent = '🔄 Refresh Data';
		refreshButton.style.margin = '10px 0';
		refreshButton.style.padding = '5px 10px';
		refreshButton.style.backgroundColor = '#005577';
		refreshButton.style.color = 'white';
		refreshButton.style.border = 'none';
		refreshButton.style.borderRadius = '4px';
		refreshButton.style.cursor = 'pointer';
		
		refreshButton.addEventListener('click', async () => {
			refreshButton.disabled = true;
			refreshButton.textContent = '⏳ Refreshing...';
			
			await this.dataProvider.refreshData();
			
			refreshButton.disabled = false;
			refreshButton.textContent = '🔄 Refresh Data';
		});
		
		// Create token list container
		const tokenListContainer = document.createElement('div');
		tokenListContainer.id = 'token-list-container';
		tokenListContainer.style.marginTop = '20px';
		
		// Add elements to modal
		this.modalElement.appendChild(closeButton);
		this.modalElement.appendChild(header);
		this.modalElement.appendChild(refreshButton);
		this.modalElement.appendChild(tokenListContainer);
		
		document.body.appendChild(this.modalElement);
	}
	
	/**
	 * Show token list modal
	 */
	async showTokenList() {
		// Show modal
		this.modalElement.style.display = 'block';
		this.isModalOpen = true;
		
		// If we don't have any data yet, fetch it
		if (this.dataProvider.getAllTokenData().length === 0) {
			await this.dataProvider.refreshData();
		}
		
		// Update token list content
		this.updateTokenListContent();
	}
	
	/**
	 * Updates the token list content with current token data
	 */
	updateTokenListContent() {
		// Get token data
		const tokenData = this.dataProvider.getAllTokenData();
		
		// Get the token list container
		const container = document.getElementById('token-list-container');
		if (!container) return;
		
		// Clear existing content
		container.innerHTML = '';
		
		if (tokenData.length === 0) {
			container.innerHTML = '<p>No token data available. Click refresh to fetch data.</p>';
			return;
		}
		
		// Create table for token data
		const table = document.createElement('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		
		// Add table header
		const thead = document.createElement('thead');
		thead.innerHTML = `
			<tr>
				<th style="text-align: left; padding: 8px; border-bottom: 1px solid #444;">Token</th>
				<th style="text-align: right; padding: 8px; border-bottom: 1px solid #444;">Price</th>
				<th style="text-align: right; padding: 8px; border-bottom: 1px solid #444;">24h Change</th>
				<th style="text-align: right; padding: 8px; border-bottom: 1px solid #444;">Market Cap</th>
				<th style="text-align: right; padding: 8px; border-bottom: 1px solid #444;">Actions</th>
			</tr>
		`;
		table.appendChild(thead);
		
		// Add table body
		const tbody = document.createElement('tbody');
		
		// Add rows for each token
		tokenData.forEach((token, index) => {
			// Get token data
			const symbol = token.baseToken?.symbol || token.symbol || 'UNKNOWN';
			const price = parseFloat(token.priceUsd) || 0;
			const priceChange = parseFloat(token.priceChange?.h24 || 0);
			const marketCap = token.marketCap ? this.dataProvider.formatMarketCap(parseFloat(token.marketCap)) : 'N/A';
			
			// Format price
			const formattedPrice = price < 0.01 ? price.toExponential(2) : price.toFixed(2);
			
			// Create row
			const tr = document.createElement('tr');
			tr.style.borderBottom = '1px solid #333';
			
			// Add token symbol and icon
			const logoUrl = token.imageUrl || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
			
			tr.innerHTML = `
				<td style="padding: 8px;">
					<div style="display: flex; align-items: center;">
						<img 
							src="${logoUrl}" 
							onerror="this.src='https://placehold.co/32x32/282828/717171?text=${symbol.charAt(0)}'; this.onerror=null;" 
							style="width: 24px; height: 24px; margin-right: 8px; border-radius: 50%;"
						>
						<span>${symbol}</span>
					</div>
				</td>
				<td style="padding: 8px; text-align: right;">$${formattedPrice}</td>
				<td style="padding: 8px; text-align: right; color: ${priceChange >= 0 ? '#4CAF50' : '#F44336'};">
					${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%
				</td>
				<td style="padding: 8px; text-align: right;">${marketCap}</td>
				<td style="padding: 8px; text-align: right;">
					<button class="chart-btn" data-index="${index}" style="background: #4a5568; border: none; padding: 4px 8px; border-radius: 4px; color: white; cursor: pointer;">
						Chart
					</button>
					<button class="add-btn" data-index="${index}" style="background: #38a169; border: none; padding: 4px 8px; border-radius: 4px; color: white; cursor: pointer; margin-left: 4px;">
						Add
					</button>
				</td>
			`;
			
			tbody.appendChild(tr);
		});
		
		table.appendChild(tbody);
		container.appendChild(table);
		
		// Add event listeners for chart buttons
		const chartButtons = container.querySelectorAll('.chart-btn');
		chartButtons.forEach(button => {
			button.addEventListener('click', async () => {
				const index = parseInt(button.getAttribute('data-index'));
				const token = tokenData[index];
				if (token) {
					this.fetchAndUpdateTokenChart(token);
				}
			});
		});
		
		// Add event listeners for add buttons
		const addButtons = container.querySelectorAll('.add-btn');
		addButtons.forEach(button => {
			button.addEventListener('click', () => {
				const index = parseInt(button.getAttribute('data-index'));
				const token = tokenData[index];
				if (token) {
					// Create event with token data
					const event = new CustomEvent('add-token-to-cube', {
						detail: {
							text: token.baseToken?.symbol || token.symbol || 'TOKEN',
							url: token.url || `https://dexscreener.com/${token.chainId || 'eth'}/${token.pairAddress || token.tokenAddress}`,
							size: this.dataProvider.calculateTokenSize(token),
							tokenData: token
						}
					});
					
					// Dispatch event
					document.dispatchEvent(event);
					
					// Show message
					this.utils.showTemporaryMessage(`Added ${token.baseToken?.symbol || token.symbol} to the cube!`);
				}
			});
		});
	}
	
	/**
	 * Close token list modal
	 */
	closeTokenList() {
		this.modalElement.style.display = 'none';
		this.isModalOpen = false;
	}
	
	/**
	 * Fetch and update token chart data
	 * @param {Object} token Token to show chart for
	 */
	async fetchAndUpdateTokenChart(token) {
		if (!this.tokenChart || !token) return;
		
		try {
			// Show loading message
			this.utils.showTemporaryMessage(`Loading chart for ${token.baseToken?.symbol || token.symbol}...`);
			
			// Fetch price history
			const priceHistory = await this.dataProvider.getTokenPriceHistory(token);
			
			// Update chart with price history
			if (priceHistory && priceHistory.length > 0) {
				this.tokenChart.updateWithPriceHistory(priceHistory, token.baseToken?.symbol || token.symbol);
				this.utils.showTemporaryMessage(`Loaded price chart for ${token.baseToken?.symbol || token.symbol}`);
			} else {
				this.utils.showTemporaryMessage(`No price data available for ${token.baseToken?.symbol || token.symbol}`);
			}
		} catch (error) {
			console.error('Error fetching price history:', error);
			this.utils.showTemporaryMessage('Error loading price data');
		}
	}
	
	/**
	 * Update visualizations
	 * @param {number} deltaTime Time since last update
	 * @param {boolean} isCameraMoving Whether the camera is currently moving
	 */
	update(deltaTime, isCameraMoving) {
		// Only update visualizations if they're visible
		if (!this.showVisualizations) return;
		
		// Update token scoreboard
		if (this.tokenScoreboard) {
			// Only call updateScreenPosition when camera movement starts or stops
			if (isCameraMoving !== this.lastCameraMoving || (isCameraMoving && this.lastCameraMovingTimestamp && (Date.now() - this.lastCameraMovingTimestamp) > 5000)) {
				console.log("Camera movement state changed:", isCameraMoving ? "moving" : "stopped", this.lastCameraMovingTimestamp, Date.now());
				this.lastCameraMovingTimestamp = Date.now();
				this.tokenScoreboard.updateScreenPosition();
			}
			this.tokenScoreboard.update(deltaTime);
		}
		
		// Update token chart
		if (this.tokenChart) {
			// Only call updateScreenPosition when camera movement starts or stops
			if (isCameraMoving !== this.lastCameraMoving) {
				this.tokenChart.updateScreenPosition();
			}
			this.tokenChart.update(deltaTime);
		}
		
		// Update token cluster
		if (this.tokenCluster) {
			this.tokenCluster.update(deltaTime);
		}
		
		// Store camera movement state for next comparison
		this.lastCameraMoving = isCameraMoving;
	}
	
	/**
	 * Handle interaction with visualizations
	 * @param {THREE.Raycaster} raycaster Raycaster for interaction
	 */
	handleInteraction(raycaster) {
		// Check interaction with scoreboard
		if (this.tokenScoreboard && this.tokenScoreboard.isVisible) {
			this.tokenScoreboard.handleInteraction(raycaster);
		}
		
		// Check interaction with chart
		if (this.tokenChart && this.tokenChart.isVisible) {
			this.tokenChart.handleInteraction(raycaster);
		}
		
		// Check interaction with token cluster
		if (this.tokenCluster && this.tokenCluster.tagManager && this.showVisualizations) {
			// Check interaction with tag manager
			if (typeof this.tokenCluster.tagManager.handleInteraction === 'function') {
				this.tokenCluster.tagManager.handleInteraction(raycaster);
			}
		}
	}
	
	/**
	 * Show demo token for testing
	 */
	async showDemoToken() {
		// Create demo token with custom data
		const demoToken = {
			baseToken: {
				symbol: 'PEPE',
				name: 'Pepe'
			},
			chainId: 'eth',
			tokenAddress: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
			priceUsd: '0.00000123',
			priceChange: {
				h24: 12.34
			},
			volume: {
				h24: '123456789'
			},
			marketCap: '98765432',
			dataSource: 'dexscreener',
			tokenData: {
				symbol: 'PEPE'
			}
		};
		
		// Add to token cluster
		const event = new CustomEvent('add-token-to-cube', {
			detail: {
				text: demoToken.baseToken.symbol,
				url: `https://dexscreener.com/${demoToken.chainId}/${demoToken.tokenAddress}`,
				size: this.dataProvider.calculateTokenSize(demoToken),
				tokenData: demoToken
			}
		});
		
		document.dispatchEvent(event);
		
		this.utils.showTemporaryMessage('Added demo token to the cube!');
	}
} 