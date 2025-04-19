/**
 * DexScreener UI Manager
 * Handles UI and visualization for DexScreener data
 */

import { TokenScoreboard } from '../visualizations/token-scoreboard.js';
import { TokenChart3D } from '../visualizations/token-chart-3d.js';
import { TagCluster } from '../interactions/tag-cluster/tag-cluster.js';
import { Utils } from '../utils/utils.js';
import { DexScreenerProcessor } from '../data-processors/DexScreenerProcessor.js';

export class DexScreenerManager {
	constructor(scene = null, camera = null, tagsManager = null) {
		this.scene = scene;
		this.camera = camera;
		this.tagsManager = tagsManager;
		this.isModalOpen = false;
		this.modalElement = null;
		this.showVisualizations = true;
		this.utils = new Utils();
		this.lastCameraMoving = false;
		this.lastCameraMovingTimestamp = null;
		
		// Initialize the data processor
		this.dataProcessor = new DexScreenerProcessor();
		
		// Setup 3D visualizations if scene is provided
		if (this.scene && this.camera && this.tagsManager) {
			this.setupVisualizations();
		}
		
		// Create UI elements
		this.createTokenListUI();
		
		// Register for data updates
		this.dataProcessor.registerProcessingCallback(this.onDataUpdate.bind(this));
		
		// Start auto-refresh
		this.dataProcessor.startAutoRefresh(6000); // 6 seconds refresh
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
		this.tokenCube = new TagCluster(this.scene, this.camera, this.tagsManager);
		
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
		
		if (this.tokenCube) {
			this.tokenCube.cubeGroup.visible = true;
		}
		
		// Generate sample data for visualizations
		this.initializeDefaultData();
	}
	
	/**
	 * Callback for when data is updated
	 * @param {Array} data Updated token data
	 */
	onDataUpdate(data) {
		// Update token cube with all token data
		if (this.tokenCube && data.length > 0) {
			this.tokenCube.updateTokens(data);
		}
		
		// Update scoreboard with top tokens
		if (this.tokenScoreboard && data.length > 0) {
			this.tokenScoreboard.updateTokenData(data.slice(0, 5));
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
		
		// Add token cube toggle button
		const cubeButton = document.createElement('button');
		cubeButton.textContent = '🔄 Token Cube';
		cubeButton.style.position = 'absolute';
		cubeButton.style.bottom = '220px';
		cubeButton.style.right = '20px';
		cubeButton.style.zIndex = '1000';
		
		cubeButton.onclick = async () => {
			// Refresh token data and update cube
			if (this.dataProcessor) {
				const tokenData = await this.dataProcessor.refreshAllTokenData();
				if (this.tokenCube && tokenData.length > 0) {
					this.tokenCube.updateTokens(tokenData);
					this.utils.showTemporaryMessage(`Updated token cube with ${tokenData.length} tokens!`);
				}
			}
		};
		
		document.body.appendChild(cubeButton);
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
		
		// Toggle token cube visibility (just hide the group)
		if (this.tokenCube) {
			this.tokenCube.cubeGroup.visible = this.showVisualizations;
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
			
			await this.dataProcessor.refreshAllTokenData();
			
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
		if (this.dataProcessor.data.length === 0) {
			await this.dataProcessor.refreshAllTokenData();
		}
		
		// Update token list content
		this.updateTokenListContent();
	}
	
	/**
	 * Update token list content in the modal
	 */
	updateTokenListContent() {
		if (!this.isModalOpen) return;
		
		const container = document.getElementById('token-list-container');
		if (!container) return;
		
		// Clear existing content
		container.innerHTML = '';
		
		// Get token data
		const tokens = this.dataProcessor.getAllData();
		
		if (tokens.length === 0) {
			container.innerHTML = '<p>No token data available. Click refresh to fetch data.</p>';
			return;
		}
		
		// Create table
		const table = document.createElement('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		
		// Create table header
		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');
		
		const headers = ['Rank', 'Token', 'Price', 'Change (24h)', 'Volume (24h)', 'Market Cap', 'Actions'];
		
		headers.forEach(headerText => {
			const th = document.createElement('th');
			th.textContent = headerText;
			th.style.textAlign = 'left';
			th.style.padding = '8px';
			th.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
			headerRow.appendChild(th);
		});
		
		thead.appendChild(headerRow);
		table.appendChild(thead);
		
		// Create table body
		const tbody = document.createElement('tbody');
		
		tokens.forEach((token, index) => {
			const row = document.createElement('tr');
			row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
			
			// Hover effect
			row.style.transition = 'background-color 0.2s';
			row.addEventListener('mouseover', () => {
				row.style.backgroundColor = 'rgba(0, 100, 150, 0.3)';
			});
			row.addEventListener('mouseout', () => {
				row.style.backgroundColor = 'transparent';
			});
			
			// Rank cell
			const rankCell = document.createElement('td');
			rankCell.textContent = (index + 1).toString();
			rankCell.style.padding = '8px';
			
			// Token cell
			const tokenCell = document.createElement('td');
			tokenCell.style.padding = '8px';
			
			const tokenSymbol = token.baseToken?.symbol || 'Unknown';
			const tokenChain = token.chainId || 'Unknown';
			
			tokenCell.innerHTML = `
				<strong>${tokenSymbol}</strong>
				<div style="font-size: 0.8em; opacity: 0.7;">${tokenChain}</div>
			`;
			
			// Price cell
			const priceCell = document.createElement('td');
			priceCell.style.padding = '8px';
			
			const price = parseFloat(token.priceUsd);
			priceCell.textContent = price ? `$${price.toFixed(price < 0.01 ? 8 : 4)}` : 'N/A';
			
			// Change cell
			const changeCell = document.createElement('td');
			changeCell.style.padding = '8px';
			
			const priceChange = parseFloat(token.priceChange?.h24 || 0);
			changeCell.textContent = `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
			changeCell.style.color = priceChange > 0 ? '#00ff00' : (priceChange < 0 ? '#ff5555' : 'white');
			
			// Volume cell
			const volumeCell = document.createElement('td');
			volumeCell.style.padding = '8px';
			
			const volume = parseFloat(token.volume?.h24 || 0);
			volumeCell.textContent = volume ? `$${(volume >= 1e6 ? (volume / 1e6).toFixed(2) + 'M' : volume.toFixed(2))}` : 'N/A';
			
			// Market cap cell
			const mcapCell = document.createElement('td');
			mcapCell.style.padding = '8px';
			
			const mcap = parseFloat(token.marketCap || 0);
			mcapCell.textContent = mcap ? this.dataProcessor.formatMarketCap(mcap) : 'N/A';
			
			// Actions cell
			const actionsCell = document.createElement('td');
			actionsCell.style.padding = '8px';
			
			// Add "View Chart" button
			const chartButton = document.createElement('button');
			chartButton.textContent = '📈 Chart';
			chartButton.style.marginRight = '5px';
			chartButton.style.padding = '5px 8px';
			chartButton.style.backgroundColor = '#005577';
			chartButton.style.color = 'white';
			chartButton.style.border = 'none';
			chartButton.style.borderRadius = '4px';
			chartButton.style.cursor = 'pointer';
			chartButton.style.fontSize = '0.8em';
			
			chartButton.addEventListener('click', async () => {
				await this.fetchAndUpdateTokenChart(token);
			});
			
			// Add "Add to Cube" button
			const cubeButton = document.createElement('button');
			cubeButton.textContent = '🧊 Cube';
			cubeButton.style.padding = '5px 8px';
			cubeButton.style.backgroundColor = '#006644';
			cubeButton.style.color = 'white';
			cubeButton.style.border = 'none';
			cubeButton.style.borderRadius = '4px';
			cubeButton.style.cursor = 'pointer';
			cubeButton.style.fontSize = '0.8em';
			
			cubeButton.addEventListener('click', () => {
				const symbol = token.baseToken?.symbol || 'TOKEN';
				const url = token.url || '#';
				const size = this.dataProcessor.calculateTokenSize(token);
				
				// Dispatch event to add token to cube
				document.dispatchEvent(new CustomEvent('add-token-to-cube', {
					detail: { text: symbol, url, size }
				}));
				
				// Provide visual feedback
				cubeButton.textContent = '✓ Added';
				cubeButton.style.backgroundColor = '#008800';
				setTimeout(() => {
					cubeButton.textContent = '🧊 Cube';
					cubeButton.style.backgroundColor = '#006644';
				}, 2000);
			});
			
			actionsCell.appendChild(chartButton);
			actionsCell.appendChild(cubeButton);
			
			// Add cells to row
			row.appendChild(rankCell);
			row.appendChild(tokenCell);
			row.appendChild(priceCell);
			row.appendChild(changeCell);
			row.appendChild(volumeCell);
			row.appendChild(mcapCell);
			row.appendChild(actionsCell);
			
			// Add row to table
			tbody.appendChild(row);
		});
		
		table.appendChild(tbody);
		container.appendChild(table);
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
		if (!this.tokenChart) return;
		
		// Get price history for token
		const priceHistory = await this.dataProcessor.fetchTokenPriceHistory(token);
		
		// Update chart with token data
		if (priceHistory && priceHistory.length > 0) {
			this.tokenChart.updateChartData(priceHistory, token.baseToken?.symbol || 'TOKEN');
			this.utils.showTemporaryMessage(`Updated chart with ${token.baseToken?.symbol || 'TOKEN'} data!`);
		} else {
			this.utils.showTemporaryMessage('No chart data available for this token');
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
		
		// Update token cube
		if (this.tokenCube) {
			this.tokenCube.update(deltaTime);
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
		
		// Check interaction with token cube
		if (this.tokenCube && this.tokenCube.cubeGroup.visible) {
			this.tokenCube.handleInteraction(raycaster);
		}
	}
	
	/**
	 * Show a demo token in visualizations
	 */
	async showDemoToken() {
		if (!this.tokenChart) return;
		
		// Show a featured demo token
		const demoToken = {
			baseToken: { symbol: 'PEPE' },
			chainId: 'ethereum',
			tokenAddress: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
			priceUsd: '0.00000094',
			priceChange: { h24: 3.5 },
			volume: { h24: '4500000' },
			liquidity: { usd: '8700000' },
			dexId: 'uniswap',
			pairAddress: '0xea9d346d773eee9c1e81ad3d0fbb81b14b0a5c13'
		};
		
		// Update the token chart with sample data or real data if available
		const priceHistory = await this.dataProcessor.fetchTokenPriceHistory(demoToken);
		
		if (priceHistory && priceHistory.length > 0) {
			this.tokenChart.updateChartData(priceHistory, demoToken.baseToken.symbol);
		} else {
			// Generate sample price data if real data isn't available
			const samplePriceData = [];
			const price = parseFloat(demoToken.priceUsd);
			const now = Date.now();
			const hourMs = 3600 * 1000;
			
			for (let i = 0; i < 48; i++) {
				// Create slightly randomized price data going back 48 hours
				const randomFactor = 1 + (Math.random() * 0.2 - 0.1);
				samplePriceData.push({
					time: now - (48 - i) * hourMs,
					price: price * (0.8 + i * 0.01) * randomFactor
				});
			}
			
			this.tokenChart.updateChartData(samplePriceData, demoToken.baseToken.symbol);
		}
		
		// Update token scoreboard with demo token
		if (this.tokenScoreboard) {
			const demoTokens = [demoToken];
			// Add some more sample tokens to the scoreboard
			demoTokens.push({
				baseToken: { symbol: 'DOGE' },
				priceUsd: '0.12',
				priceChange: { h24: 1.5 }
			});
			demoTokens.push({
				baseToken: { symbol: 'SHIB' },
				priceUsd: '0.000019',
				priceChange: { h24: -0.8 }
			});
			
			this.tokenScoreboard.updateTokenData(demoTokens);
		}
		
		// Update token cube with demo token
		if (this.tokenCube) {
			// Dispatch event to add token to cube
			document.dispatchEvent(new CustomEvent('add-token-to-cube', {
				detail: { 
					text: demoToken.baseToken.symbol, 
					url: `https://dexscreener.com/ethereum/${demoToken.tokenAddress}`,
					size: 1.5 
				}
			}));
		}
		
		this.utils.showTemporaryMessage('Demo token data loaded!');
	}
} 