/**
 * DEPRECATED - This file is being phased out in favor of the new modular architecture.
 * Please use the following files instead:
 * - js/data-processors/DataProcessor.js - Base data processor class
 * - js/data-processors/DexScreenerProcessor.js - DexScreener implementation
 * - js/ui/DexScreenerManager.js - UI manager for DexScreener
 * 
 * DexScreener API integration
 * Fetches and displays latest tokens from DexScreener API
 */

import { TokenScoreboard } from './token-scoreboard.js';
import { TokenChart3D } from './token-chart-3d.js';
import { TokenCube } from './token-cube.js';
import { Utils } from './utils.js';

export class DexScreenerManager {
	constructor(scene = null, camera = null) {
		this.apiEndpointProfiles = 'https://api.dexscreener.com/token-profiles/latest/v1';
		this.apiEndpointSearch = 'https://api.dexscreener.com/latest/dex/search';
		this.apiEndpointPairs = 'https://api.dexscreener.com/token-pairs/v1';
		this.apiEndpointTokens = 'https://api.dexscreener.com/tokens/v1';
		this.tokenProfiles = [];
		this.tokenData = [];
		this.maxTokensToDisplay = 50;
		this.isModalOpen = false;
		this.modalElement = null;
		this.scene = scene;
		this.camera = camera;
		this.tokenScoreboard = null;
		this.tokenChart = null;
		this.tokenCube = null;
		this.utils = new Utils();
		
		// Flag to toggle 3D visualizations
		this.showVisualizations = true;
		
		// Track which tokens have already had market data fetched
		this.fetchedTokenAddresses = new Set();
		
		// Setup 3D visualizations if scene is provided
		if (this.scene && this.camera) {
			this.setupVisualizations();
		}
		
		// Auto-refresh token data every 6 seconds (for token cube updates)
		this.autoRefreshInterval = null;
		this.startAutoRefresh();
	}
	
	/**
	 * Set up 3D visualizations (scoreboard, chart, and cube)
	 */
	setupVisualizations() {
		// Create token scoreboard
		this.tokenScoreboard = new TokenScoreboard(this.scene, this.camera);
		
		// Create token chart
		this.tokenChart = new TokenChart3D(this.scene, this.camera);
		
		// Create token cube visualization
		this.tokenCube = new TokenCube(this.scene, this.camera);
		
		// Create UI toggle button for visualizations
		this.createVisualizationToggle();
		
		// Make sure visualizations are visible and working (force visibility to true)
		this.showVisualizations = true;
		
		// Force update the visualizations to ensure they're properly positioned
		if (this.tokenScoreboard) {
			this.tokenScoreboard.isVisible = true;
			this.tokenScoreboard.updateScreenPosition();
		}
		
		if (this.tokenChart) {
			this.tokenChart.isVisible = true;
			this.tokenChart.updateScreenPosition();
		}
		
		if (this.tokenCube) {
			this.tokenCube.cubeGroup.visible = true;
		}
		
		// Generate sample data for the chart and scoreboard if they're empty
		this.initializeDefaultData();
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
			const tokenData = await this.refreshAllTokenData();
			if (this.tokenCube && tokenData.length > 0) {
				this.tokenCube.updateTokens(tokenData);
				this.utils.showTemporaryMessage(`Updated token cube with ${tokenData.length} tokens!`);
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
	 * Start auto-refresh of token data
	 */
	startAutoRefresh() {
		// Clear any existing interval
		if (this.autoRefreshInterval) {
			clearInterval(this.autoRefreshInterval);
		}
		
		// Set up new interval (6 seconds for token profiles + selective market data updates)
		this.autoRefreshInterval = setInterval(async () => {
			// Get new token profiles every 6 seconds
			const profiles = await this.fetchLatestTokenProfiles();
			
			// Select which tokens to fetch market data for:
			// 1. Any new tokens we haven't seen before
			// 2. A few random tokens from our existing collection
			const tokensToUpdate = await this.selectTokensForMarketDataUpdate(profiles);
			
			// Fetch market data only for the selected tokens
			const updatedTokens = await this.fetchMarketDataForSelectedTokens(tokensToUpdate);
			
			// Update existing token data with the new market data
			this.updateTokenDataWithNewMarketData(updatedTokens);
			
			// Sort and update visualizations
			this.sortAndLimitTokenData();
			
			// Update token cube with all token data (including ones with previously fetched market data)
			if (this.tokenCube && this.tokenData.length > 0) {
				this.tokenCube.updateTokens(this.tokenData);
			}
			
			// Update scoreboard with top tokens
			if (this.tokenScoreboard && this.tokenData.length > 0) {
				this.tokenScoreboard.updateTokenData(this.tokenData.slice(0, 5));
			}
		}, 6000); // 6 seconds refresh
	}
	
	/**
	 * Select tokens for market data update
	 * @param {Array} profiles New token profiles
	 * @returns {Array} Array of tokens to update
	 */
	async selectTokensForMarketDataUpdate(profiles) {
		const tokensToUpdate = [];
		
		// 1. Filter for new tokens we haven't fetched market data for yet
		for (const token of profiles) {
			const tokenKey = `${token.chainId}-${token.tokenAddress}`;
			if (!this.fetchedTokenAddresses.has(tokenKey)) {
				tokensToUpdate.push(token);
				this.fetchedTokenAddresses.add(tokenKey);
			}
		}
		
		// 2. Add a few random tokens from our existing collection for refresh
		// Choose 2 random tokens from existing data to update
		if (this.tokenData.length > 0) {
			const randomCount = Math.min(2, this.tokenData.length);
			const indexes = new Set();
			
			// Select random unique indexes
			while (indexes.size < randomCount) {
				const randomIndex = Math.floor(Math.random() * this.tokenData.length);
				indexes.add(randomIndex);
			}
			
			// Add the randomly selected tokens to the update list
			for (const index of indexes) {
				tokensToUpdate.push(this.tokenData[index]);
			}
		}
		
		return tokensToUpdate;
	}
	
	/**
	 * Fetch market data only for selected tokens
	 * @param {Array} tokens Array of tokens to fetch market data for
	 * @returns {Promise<Array>} Array of tokens with updated market data
	 */
	async fetchMarketDataForSelectedTokens(tokens) {
		try {
			if (!tokens || tokens.length === 0) return [];
			
			const tokenDataPromises = tokens.map(async (token) => {
				// Fetch pairs data to get market cap
				const pairsUrl = `${this.apiEndpointPairs}/${token.chainId}/${token.tokenAddress}`;
				const response = await fetch(pairsUrl);
				
				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}
				
				const pairsData = await response.json();
				
				// Find the pair with the highest liquidity/volume
				let bestPair = null;
				let highestLiquidity = 0;
				
				if (Array.isArray(pairsData) && pairsData.length > 0) {
					bestPair = pairsData.reduce((best, current) => {
						const liquidity = current.liquidity?.usd || 0;
						if (liquidity > highestLiquidity) {
							highestLiquidity = liquidity;
							return current;
						}
						return best;
					}, pairsData[0]);
				}
				
				// Create a timestamp for this update
				const updateTimestamp = Date.now();
				
				return {
					...token,
					...bestPair, // Include all pair data 
					marketData: bestPair ? {
						marketCap: bestPair.marketCap || 0,
						priceUsd: bestPair.priceUsd || "0",
						liquidity: bestPair.liquidity?.usd || 0,
						volume24h: bestPair.volume?.h24 || 0,
						priceChange24h: bestPair.priceChange?.h24 || 0,
						dexId: bestPair.dexId || "unknown",
						lastUpdated: updateTimestamp
					} : null
				};
			});
			
			// Process all selected tokens in parallel
			return await Promise.all(tokenDataPromises);
		} catch (error) {
			console.error('Error fetching market data for selected tokens:', error);
			return [];
		}
	}
	
	/**
	 * Update existing token data with newly fetched market data
	 * @param {Array} updatedTokens Array of tokens with fresh market data
	 */
	updateTokenDataWithNewMarketData(updatedTokens) {
		for (const updatedToken of updatedTokens) {
			// Skip tokens without market data
			if (!updatedToken.marketData) continue;
			
			// Check if this token is already in our collection
			const existingIndex = this.tokenData.findIndex(t => 
				t.chainId === updatedToken.chainId && 
				t.tokenAddress === updatedToken.tokenAddress
			);
			
			if (existingIndex >= 0) {
				// Update the existing token
				this.tokenData[existingIndex] = {
					...this.tokenData[existingIndex],
					...updatedToken
				};
			} else {
				// Add the new token
				this.tokenData.push(updatedToken);
			}
		}
	}
	
	/**
	 * Sort tokens by market cap and limit to max display count
	 */
	sortAndLimitTokenData() {
		// Sort by market cap (descending)
		this.tokenData.sort((a, b) => {
			const marketCapA = a.marketData?.marketCap || 0;
			const marketCapB = b.marketData?.marketCap || 0;
			return marketCapB - marketCapA;
		});
		
		// Limit to max tokens
		this.tokenData = this.tokenData.slice(0, this.maxTokensToDisplay);
	}
	
	/**
	 * Refresh all token data
	 */
	async refreshAllTokenData() {
		try {
			const profiles = await this.fetchLatestTokenProfiles();
			
			// For a full refresh, just fetch all token data
			const tokensToUpdate = profiles.slice(0, this.maxTokensToDisplay);
			const tokenData = await this.fetchMarketDataForSelectedTokens(tokensToUpdate);
			
			// Replace all token data
			this.tokenData = tokenData;
			
			// Sort by market cap
			this.sortAndLimitTokenData();
			
			// Update visualizations if they exist
			if (this.tokenScoreboard && tokenData.length > 0) {
				this.tokenScoreboard.updateTokenData(tokenData.slice(0, 5));
			}
			
			// Update chart for the top token if available
			if (this.tokenChart && tokenData.length > 0) {
				await this.fetchAndUpdateTokenChart(tokenData[0]);
			}
			
			// Update token cube visualization
			if (this.tokenCube && tokenData.length > 0) {
				this.tokenCube.updateTokens(tokenData);
			}
			
			return tokenData;
		} catch (error) {
			console.error('Error refreshing token data:', error);
			return [];
		}
	}

	/**
	 * Fetch latest token profiles from DexScreener
	 * @returns {Promise<Array>} Array of token profiles
	 */
	async fetchLatestTokenProfiles() {
		try {
			const response = await fetch(this.apiEndpointProfiles);
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			this.tokenProfiles = await response.json();
			return this.tokenProfiles;
		} catch (error) {
			console.error('Error fetching token profiles:', error);
			return [];
		}
	}

	/**
	 * Fetch token market data (used for initial load or full refresh)
	 * @param {Array} tokens Array of token profiles
	 * @returns {Promise<Array>} Array of enriched token data with market data
	 */
	async fetchTokenMarketData(tokens) {
		// This is now just a wrapper around the selective fetcher for backwards compatibility
		const tokenData = await this.fetchMarketDataForSelectedTokens(tokens);
		
		// Add all fetched tokens to our tracking set
		for (const token of tokens) {
			const tokenKey = `${token.chainId}-${token.tokenAddress}`;
			this.fetchedTokenAddresses.add(tokenKey);
		}
		
		// Sort and limit
		this.tokenData = tokenData;
		this.sortAndLimitTokenData();
		
		return this.tokenData;
	}
	
	/**
	 * Fetch price history data for a token
	 * Since DexScreener API doesn't directly provide price history,
	 * we'll simulate it using the available data and some randomization
	 * 
	 * @param {Object} token - Token data object
	 * @returns {Promise<Object>} - Price history data
	 */
	async fetchTokenPriceHistory(token) {
		try {
			if (!token || !token.baseToken) {
				throw new Error('Invalid token data');
			}
			
			// In a real implementation, you would call an API endpoint
			// Since DexScreener doesn't have price history in their public API,
			// we'll simulate it based on current price and 24h change
			
			const currentPrice = parseFloat(token.priceUsd) || 1.0;
			const priceChange24h = parseFloat(token.priceChange?.h24) || 0;
			
			// Calculate approximate price 24h ago
			const priceFactor = 1 + (priceChange24h / 100);
			const price24hAgo = currentPrice / priceFactor;
			
			// Generate 24 hourly data points
			const dataPoints = [];
			let simulatedPrice = price24hAgo;
			
			for (let i = 0; i < 24; i++) {
				// Create a somewhat realistic price movement pattern
				// More randomness in the middle, trending toward current price
				let progressFactor = i / 23;  // 0 to 1
				
				// Add randomness that decreases as we get closer to current time
				const volatility = 0.02 * (1 - Math.pow(progressFactor, 2));
				const randomFactor = 1 + (Math.random() - 0.5) * volatility;
				
				// Move toward current price with some randomness
				simulatedPrice = price24hAgo + (currentPrice - price24hAgo) * progressFactor * randomFactor;
				
				// Random volume
				const volume = token.liquidity?.usd 
					? (token.liquidity.usd / 24) * (0.5 + Math.random())
					: 10000 * (0.5 + Math.random());
				
				// Calculate change from previous point
				const change = i > 0 
					? simulatedPrice - dataPoints[i-1].price
					: 0;
				
				dataPoints.push({
					price: simulatedPrice,
					volume: volume,
					change: change,
					timestamp: Date.now() - (24 - i) * 3600000 // Hourly timestamps
				});
			}
			
			return {
				tokenSymbol: token.baseToken.symbol,
				pairAddress: token.pairAddress,
				chainId: token.chainId,
				dexId: token.dexId,
				priceData: dataPoints
			};
		} catch (error) {
			console.error('Error fetching token price history:', error);
			return {
				tokenSymbol: token.baseToken?.symbol || "Unknown",
				priceData: []
			};
		}
	}
	
	/**
	 * Fetch and update the 3D chart with token data
	 * @param {Object} token - Token data object
	 */
	async fetchAndUpdateTokenChart(token) {
		if (!this.tokenChart || !token) return;
		
		const priceHistory = await this.fetchTokenPriceHistory(token);
		this.tokenChart.updateChartData(priceHistory);
	}

	/**
	 * Calculate relative token size based on market cap
	 * @param {Object} token Token data with market cap
	 * @returns {number} Size factor between 0.8 and 2.0
	 */
	calculateTokenSize(token) {
		if (!token.marketData || !token.marketData.marketCap) {
			return 0.8; // Default small size
		}
		
		// Find max/min market caps in our data set
		const maxMarketCap = Math.max(...this.tokenData.map(t => t.marketData?.marketCap || 0));
		const minMarketCap = Math.min(...this.tokenData.filter(t => t.marketData?.marketCap > 0).map(t => t.marketData?.marketCap || 0));
		
		// Calculate normalized size (0-1 range)
		let normalizedSize;
		if (maxMarketCap === minMarketCap) {
			normalizedSize = 0.5;
		} else {
			normalizedSize = (token.marketData.marketCap - minMarketCap) / (maxMarketCap - minMarketCap);
		}
		
		// Apply logarithmic scale to prevent extremes and map to size range (0.8-2.0)
		const logFactor = Math.log(normalizedSize * 9 + 1) / Math.log(10); // Log scaling
		const size = 0.8 + logFactor * 1.2;
		
		return Math.min(Math.max(size, 0.8), 2.0); // Clamp between 0.8 and 2.0
	}

	/**
	 * Create UI for displaying tokens in a modal window
	 */
	createTokenListUI() {
		// Create modal if it doesn't exist
		if (!this.modalElement) {
			this.modalElement = document.createElement('div');
			this.modalElement.id = 'token-list-modal';
			this.modalElement.style.display = 'none';
			this.modalElement.style.position = 'fixed';
			this.modalElement.style.top = '50%';
			this.modalElement.style.left = '50%';
			this.modalElement.style.transform = 'translate(-50%, -50%)';
			this.modalElement.style.maxWidth = '800px';
			this.modalElement.style.width = '80%';
			this.modalElement.style.maxHeight = '80vh';
			this.modalElement.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
			this.modalElement.style.border = '1px solid rgba(0, 255, 255, 0.3)';
			this.modalElement.style.borderRadius = '8px';
			this.modalElement.style.padding = '20px';
			this.modalElement.style.zIndex = '1001';
			this.modalElement.style.overflowY = 'auto';
			this.modalElement.style.color = 'white';
			
			// Create header
			const header = document.createElement('div');
			header.style.display = 'flex';
			header.style.justifyContent = 'space-between';
			header.style.alignItems = 'center';
			header.style.marginBottom = '20px';
			
			const title = document.createElement('h2');
			title.textContent = 'Latest Tokens by Market Cap';
			title.style.color = '#0ff';
			
			const closeButton = document.createElement('button');
			closeButton.textContent = '×';
			closeButton.style.backgroundColor = 'transparent';
			closeButton.style.border = 'none';
			closeButton.style.color = 'white';
			closeButton.style.fontSize = '24px';
			closeButton.style.cursor = 'pointer';
			closeButton.onclick = () => this.closeTokenList();
			
			header.appendChild(title);
			header.appendChild(closeButton);
			this.modalElement.appendChild(header);
			
			// Create content area
			const content = document.createElement('div');
			content.id = 'token-list-content';
			this.modalElement.appendChild(content);
			
			// Create overlay background
			const overlay = document.createElement('div');
			overlay.id = 'token-list-overlay';
			overlay.style.position = 'fixed';
			overlay.style.top = '0';
			overlay.style.left = '0';
			overlay.style.width = '100%';
			overlay.style.height = '100%';
			overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
			overlay.style.zIndex = '1000';
			overlay.style.display = 'none';
			overlay.onclick = () => this.closeTokenList();
			
			// Add to DOM
			document.body.appendChild(this.modalElement);
			document.body.appendChild(overlay);
			
			// Create button to open token list
			const openButton = document.createElement('button');
			openButton.textContent = '🔍 Latest Tokens';
			openButton.style.position = 'absolute';
			openButton.style.bottom = '320px';
			openButton.style.right = '20px';
			openButton.style.zIndex = '999';
			openButton.onclick = () => this.showTokenList();
			document.body.appendChild(openButton);
		}
	}

	/**
	 * Display the token list modal
	 */
	async showTokenList() {
		// Show loading
		document.getElementById('token-list-content').innerHTML = '<p style="text-align: center;">Loading latest tokens...</p>';
		
		document.getElementById('token-list-modal').style.display = 'block';
		document.getElementById('token-list-overlay').style.display = 'block';
		this.isModalOpen = true;
		
		// Fetch data if needed
		if (this.tokenData.length === 0) {
			const profiles = await this.fetchLatestTokenProfiles();
			await this.fetchTokenMarketData(profiles);
		}
		
		// Populate content
		this.updateTokenListContent();
	}

	/**
	 * Update the token list content with token data
	 */
	updateTokenListContent() {
		const content = document.getElementById('token-list-content');
		content.innerHTML = '';
		
		if (this.tokenData.length === 0) {
			content.innerHTML = '<p style="text-align: center;">No tokens found.</p>';
			return;
		}
		
		// Create table
		const table = document.createElement('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		
		// Create header row
		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');
		
		['Rank', 'Icon', 'Token', 'Chain', 'Price (USD)', 'Market Cap', 'Actions'].forEach(header => {
			const th = document.createElement('th');
			th.textContent = header;
			th.style.textAlign = 'left';
			th.style.padding = '8px';
			th.style.borderBottom = '1px solid rgba(0, 255, 255, 0.3)';
			headerRow.appendChild(th);
		});
		
		thead.appendChild(headerRow);
		table.appendChild(thead);
		
		// Create body rows
		const tbody = document.createElement('tbody');
		
		this.tokenData.forEach((token, index) => {
			const row = document.createElement('tr');
			
			// Rank
			const rankCell = document.createElement('td');
			rankCell.textContent = index + 1;
			rankCell.style.padding = '8px';
			
			// Icon
			const iconCell = document.createElement('td');
			if (token.icon) {
				const icon = document.createElement('img');
				icon.src = token.icon;
				icon.style.width = '24px';
				icon.style.height = '24px';
				icon.style.borderRadius = '50%';
				iconCell.appendChild(icon);
			} else {
				iconCell.textContent = '—';
			}
			iconCell.style.padding = '8px';
			
			// Token name
			const nameCell = document.createElement('td');
			nameCell.textContent = token.baseToken?.symbol || token.tokenAddress.substring(0, 8) + '...';
			nameCell.style.padding = '8px';
			
			// Chain
			const chainCell = document.createElement('td');
			chainCell.textContent = token.chainId;
			chainCell.style.padding = '8px';
			
			// Price
			const priceCell = document.createElement('td');
			priceCell.textContent = token.priceUsd ? `$${parseFloat(token.priceUsd).toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 8
			})}` : '—';
			priceCell.style.padding = '8px';
			
			// Market Cap
			const mcapCell = document.createElement('td');
			mcapCell.textContent = token.marketCap ? this.formatMarketCap(token.marketCap) : '—';
			mcapCell.style.padding = '8px';
			
			// Actions
			const actionsCell = document.createElement('td');
			
			// View button
			const viewButton = document.createElement('button');
			viewButton.textContent = 'View';
			viewButton.style.fontSize = '12px';
			viewButton.style.padding = '4px 8px';
			viewButton.onclick = () => {
				window.open(token.url, '_blank');
			};
			
			// Add to cube button
			const addButton = document.createElement('button');
			addButton.textContent = 'Add to Cube';
			addButton.style.fontSize = '12px';
			addButton.style.padding = '4px 8px';
			addButton.style.marginLeft = '8px';
			addButton.onclick = () => {
				const event = new CustomEvent('add-token-to-cube', {
					detail: {
						text: token.baseToken?.symbol || token.tokenAddress.substring(0, 8),
						url: token.url,
						size: this.calculateTokenSize(token)
					}
				});
				document.dispatchEvent(event);
			};
			
			// Chart button
			const chartButton = document.createElement('button');
			chartButton.textContent = 'View Chart';
			chartButton.style.fontSize = '12px';
			chartButton.style.padding = '4px 8px';
			chartButton.style.marginLeft = '8px';
			chartButton.onclick = async () => {
				if (this.tokenChart) {
					await this.fetchAndUpdateTokenChart(token);
					this.closeTokenList();
					
					// Ensure visualizations are visible
					if (!this.showVisualizations) {
						this.toggleVisualizations();
					}
				}
			};
			
			actionsCell.appendChild(viewButton);
			actionsCell.appendChild(addButton);
			actionsCell.appendChild(chartButton);
			actionsCell.style.padding = '8px';
			
			// Add cells to row
			row.appendChild(rankCell);
			row.appendChild(iconCell);
			row.appendChild(nameCell);
			row.appendChild(chainCell);
			row.appendChild(priceCell);
			row.appendChild(mcapCell);
			row.appendChild(actionsCell);
			
			// Zebra striping
			if (index % 2 === 1) {
				row.style.backgroundColor = 'rgba(0, 30, 60, 0.3)';
			}
			
			tbody.appendChild(row);
		});
		
		table.appendChild(tbody);
		content.appendChild(table);
	}

	/**
	 * Close the token list modal
	 */
	closeTokenList() {
		document.getElementById('token-list-modal').style.display = 'none';
		document.getElementById('token-list-overlay').style.display = 'none';
		this.isModalOpen = false;
	}

	/**
	 * Format market cap value for display
	 * @param {number} marketCap Market cap value
	 * @returns {string} Formatted market cap
	 */
	formatMarketCap(marketCap) {
		if (!marketCap) return '—';
		
		if (marketCap >= 1e9) {
			return `$${(marketCap / 1e9).toFixed(2)}B`;
		} else if (marketCap >= 1e6) {
			return `$${(marketCap / 1e6).toFixed(2)}M`;
		} else if (marketCap >= 1e3) {
			return `$${(marketCap / 1e3).toFixed(2)}K`;
		} else {
			return `$${marketCap.toFixed(2)}`;
		}
	}

	/**
	 * Get token object by its index
	 * @param {number} index Token index in sorted array
	 * @returns {Object|null} Token data or null if not found
	 */
	getTokenByIndex(index) {
		if (index >= 0 && index < this.tokenData.length) {
			return this.tokenData[index];
		}
		return null;
	}
	
	/**
	 * Update loop called from main animation loop
	 * @param {number} deltaTime - Time since last frame in seconds
	 */
	update(deltaTime) {
		// Update token scoreboard if available
		if (this.tokenScoreboard && this.showVisualizations) {
			this.tokenScoreboard.update(deltaTime);
		}
		
		// Update token chart if available
		if (this.tokenChart && this.showVisualizations) {
			this.tokenChart.update(deltaTime);
		}
		
		// Update token cube animation
		if (this.tokenCube && this.showVisualizations) {
			this.tokenCube.update(deltaTime);
		}
	}

	/**
	 * Handle user interaction with visualizations
	 * @param {THREE.Raycaster} raycaster - Raycaster for detecting interactions
	 * @returns {boolean} Whether an interaction was handled
	 */
	handleInteraction(raycaster) {
		if (!this.showVisualizations) return false;
		
		// Check scoreboard interaction
		if (this.tokenScoreboard && this.tokenScoreboard.handleInteraction(raycaster)) {
			return true;
		}
		
		// Check chart interaction
		if (this.tokenChart && this.tokenChart.handleInteraction(raycaster)) {
			return true;
		}
		
		return false;
	}

	/**
	 * Display a demo token in the visualizations
	 */
	async showDemoToken() {
		// Show loading message
		this.utils.showTemporaryMessage('Loading demo token...');
		
		try {
			// Ensure visualizations are visible
			if (!this.showVisualizations) {
				this.toggleVisualizations();
			}
			
			// If we don't have token data yet, fetch it
			if (this.tokenData.length === 0) {
				await this.refreshAllTokenData();
			}
			
			// Choose a token with good data (preferably one with a price and market cap)
			let demoToken = null;
			
			// Try to find a token with good data
			for (const token of this.tokenData) {
				if (token.priceUsd && token.marketCap && token.baseToken?.symbol) {
					demoToken = token;
					break;
				}
			}
			
			// If no good token found, just use the first one
			if (!demoToken && this.tokenData.length > 0) {
				demoToken = this.tokenData[0];
			}
			
			// If we still don't have a token, show a message
			if (!demoToken) {
				this.utils.showTemporaryMessage('No token data available. Showing sample data.');
				return;
			}
			
			// Update the scoreboard
			if (this.tokenScoreboard) {
				// Create an array of tokens for the scoreboard
				const displayTokens = this.tokenData.slice(0, 5);
				this.tokenScoreboard.updateTokenData(displayTokens);
			}
			
			// Update the chart
			if (this.tokenChart) {
				await this.fetchAndUpdateTokenChart(demoToken);
			}
			
			// Add token to cube
			const event = new CustomEvent('add-token-to-cube', {
				detail: {
					text: demoToken.baseToken?.symbol || demoToken.tokenAddress.substring(0, 8),
					url: demoToken.url || '#',
					size: this.calculateTokenSize(demoToken)
				}
			});
			document.dispatchEvent(event);
			
			// Show success message
			this.utils.showTemporaryMessage(`Displaying ${demoToken.baseToken?.symbol || 'token'} data`);
		} catch (error) {
			console.error('Error showing demo token:', error);
			this.utils.showTemporaryMessage('Error loading demo token');
		}
	}

	/**
	 * Initialize data fetch for demo purposes
	 * Immediately fetches data without waiting for user action
	 */
	async initializeForDemo() {
		try {
			// Show temporary message
			this.utils.showTemporaryMessage('Initializing token data...');
			
			// Fetch data
			await this.refreshAllTokenData();
			
			// Make sure visualizations are visible
			if (!this.showVisualizations) {
				this.toggleVisualizations();
			}
			
			return this.tokenData;
		} catch (error) {
			console.error('Error initializing demo:', error);
			return [];
		}
	}
} 