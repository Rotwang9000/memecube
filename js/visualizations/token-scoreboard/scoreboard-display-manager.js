import { formatPrice, formatChange, getChangeColor, formatCompactNumber } from './utils.js';

export class ScoreboardDisplayManager {
	constructor(tokenScoreboard) {
		this.ts = tokenScoreboard; // Reference to the main TokenScoreboard instance
		this.displayData = [];
		this.scrollPosition = 0;
		this.maxTokensToShow = 30; // Consider making this configurable or dynamic
		this.scrollSpeed = 0.7;
		// Add tracking for clickable token positions
		this.clickableTokenPositions = [];
	}

	updateTokenData(tokens) {
		if (!tokens || tokens.length === 0) {
			console.log("ScoreboardDisplayManager: No token data, using sample.");
			tokens = [
				{ baseToken: { symbol: 'SMPL1' }, priceUsd: '100', priceChange: { h24: 1.0 } },
				{ baseToken: { symbol: 'SMPL2' }, priceUsd: '200', priceChange: { h24: -2.5 } },
			];
		}
        
		// Save current scroll position
		const currentScrollPosition = this.scrollPosition;
		const oldTokenLength = this.displayData ? this.displayData.length : 0;

		this.displayData = tokens.slice(0, this.maxTokensToShow).map(token => ({
			symbol: token.baseToken?.symbol || (token.tokenAddress ? token.tokenAddress.substring(0, 6) : 'UNKN'),
			price: token.priceUsd ?? "0",
			change: typeof token.priceChange?.h24 === 'number' ? token.priceChange.h24 : 0,
			// Keep the original token object for detail view if needed by _drawDetailToken directly
			originalToken: token 
		}));
		
		// Only reset scroll position if the token list is completely different or empty
		if (oldTokenLength === 0 || this.displayData.length === 0) {
			this.scrollPosition = 0;
		} else {
			// Adjust scroll position if needed based on new list length
			const newMaxScroll = this.displayData.length * 12;
			if (currentScrollPosition >= newMaxScroll) {
				// If we're past the end of the new list, adjust to a reasonable position
				this.scrollPosition = Math.max(0, newMaxScroll - 24); // Position near the end
			} else {
				// Keep the current scroll position
				this.scrollPosition = currentScrollPosition;
			}
		}
		
		console.log("ScoreboardDisplayManager: Updated display data, preserved scroll position");
	}

	// Called by TokenScoreboard after it sets its detailToken
	showTokenDetail() {
		if (this.ts.ledDisplay && this.ts.detailToken) {
			this.ts.ledDisplay.clear();
			this._drawDetailToken(this.ts.detailToken); 
		}
	}

	// Called by TokenScoreboard after it clears its detailToken
	exitTokenDetail() {
		if (this.ts.ledDisplay) {
			this.ts.ledDisplay.clear();
			// Optionally, immediately draw scrolling list or let update handle it
		}
	}

	_drawDetailToken(token) { // Expects the full token object
		const d = this.ts.ledDisplay;
		if (!d || !token) return;

		// Determine optimal display area - always use top half of the display
		// in normal mode, but in tall mode show more information
		const isTallMode = this.ts.sizeMode === 'tall';
		
		// Fixed compact spacing - avoid spreading content
		const rowSpacing = 6; // Use constant spacing regardless of display size

		// First clear the entire display to avoid artifacts
		d.clear();

		const symbol = (token.baseToken?.symbol || token.symbol || token.name || 'UNKN');
		let row = 2;
		let colStart = (d.dotCols > symbol.length * 4 + 4) ? Math.floor((d.dotCols - symbol.length * 4) / 2) : 2;
		d.drawText(symbol, row, colStart, 'cyan');

		row += rowSpacing;
		const priceTxt = formatPrice(token.priceUsd || token.priceNative || 0);
		d.drawText('P:$' + priceTxt, row, 2, 'yellow');

		row += rowSpacing;
		const mcText = token.marketCap ? formatCompactNumber(token.marketCap) : 'N/A';
		const fdvText = token.fdv ? formatCompactNumber(token.fdv) : 'N/A';
		d.drawText('MC:' + mcText + ' FDV:' + fdvText, row, 2, 'white');

		row += rowSpacing;
		const pc = token.priceChange || {};
		const change5m = pc.m5 ?? null;
		const change1h = pc.h1 ?? null;
		const change24h = pc.h24 ?? null;

		d.drawText('5m', row, 0, 'white');
		d.drawText(':', row, 25, 'yellow');
		d.drawText('1h', row, 30, 'white');
		d.drawText(':', row, 55, 'yellow');
		d.drawText('24h', row, 60, 'white');
		
		row += rowSpacing;
		d.drawText(change5m !== null ? formatChange(change5m, true) : 'N/A', row, 0, change5m !== null ? getChangeColor(change5m) : 'white');
		d.drawText(':', row, 25, 'yellow');
		d.drawText(change1h !== null ? formatChange(change1h, true) : 'N/A', row, 30, change1h !== null ? getChangeColor(change1h) : 'white');
		d.drawText(':', row, 55, 'yellow');
		d.drawText(change24h !== null ? formatChange(change24h, true) : 'N/A', row, 60, change24h !== null ? getChangeColor(change24h) : 'white');

		// In tall mode, show more information
		if (isTallMode || d.dotRows >= 36) {
			row += rowSpacing;
			
			// Show buy/sell transaction data if available
			if (token.txns?.h24) {
				const txns = token.txns.h24;
				const buyTxns = formatCompactNumber(txns.buys ?? 0);
				const sellTxns = formatCompactNumber(txns.sells ?? 0);
				d.drawText('B:', row, 0, 'green');
				d.drawText(buyTxns.toString(), row, 12, 'white');
				d.drawText('S:', row, 40, 'red');
				d.drawText(sellTxns.toString(), row, 52, 'white');
				const ratio = parseFloat(sellTxns) > 0 ? (parseFloat(buyTxns) / parseFloat(sellTxns)).toFixed(2) : '';
				d.drawText(ratio.toString(), row, 80, (parseFloat(ratio) > 1 && ratio !== '') ? 'green' : 'red');
				if(ratio !== '') d.drawText('%', row, 92, 'white');
			} else {
				d.drawText('TXS: NO DATA', row, 2, 'white');
			}
			
			row += rowSpacing;
			d.drawText('LIQ: $' + (token.liquidity?.usd ? formatCompactNumber(token.liquidity.usd) : 'N/A'), row, 5, 'cyan');
			
			row += rowSpacing;
			d.drawText('VOL: $' + (token.volume?.h24 ? formatCompactNumber(token.volume.h24) : 'N/A'), row, 5, 'yellow');
			
			row += rowSpacing;
			const chainMap = { 1: 'ETH', 56: 'BSC', 137: 'POLY', 42161: 'ARB', 10: 'OP', 8453: 'BASE' };
			const chainName = chainMap[token.chainId] || `${token.chainId || 'N/A'}`;
			d.drawText(chainName, row, 2, 'green');
			
			// Add token address at the bottom in tall mode
			row += rowSpacing;
			if (token.tokenAddress) {
				//split the address into 3 lines of 10 characters each
				const addrLines = token.tokenAddress.match(/.{1,15}/g);
				for (let i = 0; i < addrLines.length; i++) {
					d.drawText(addrLines[i], row + (i * 5), i, 'yellow');
				}
			}

		}
		
		// Draw a subtle separator line
		const separatorRow = Math.min(d.dotRows / 2 + 2, d.dotRows - 10);
		if (separatorRow > 0 && separatorRow < d.dotRows) {
			for (let i = 5; i < d.dotCols - 5; i += 4) {
				d.setDotColor(separatorRow, i, 'off');
			}
		}
	}

	_drawScrollingTokenList() {
		const d = this.ts.ledDisplay;
		if (!d) return;
		if (!this.displayData || this.displayData.length === 0) {
			d.drawText('LOADING TOKEN DATA...', 2, 2, 'cyan');
			return;
		}

		// Reset clickable positions as we're redrawing
		this.resetClickablePositions();

		// Increment the scroll position by scrollSpeed with enhanced smoothness
		this.scrollPosition += this.scrollSpeed;
		
		// Calculate max scroll position based on token count to prevent sudden jumps
		const maxScrollPosition = (this.displayData.length * 12) + 10; // Add a small gap before restarting
		
		// Reset scroll position when we reach the end of the list with a smooth transition
		if (this.scrollPosition >= maxScrollPosition) {
			this.scrollPosition = 0;
		}

		// Calculate how many tokens can be displayed based on height
		// Each token takes up approximately 12 rows
		const TOKEN_HEIGHT = 12;
		const visibleHeight = d.dotRows - 4; // Account for top/bottom margins
		
		// Calculate maximum visible tokens based on display height
		// In tall mode, we want to show more tokens to fill the height
		let maxVisible;
		if (this.ts.sizeMode === 'tall') {
			// For tall mode, calculate to use most of the available height
			maxVisible = Math.floor(visibleHeight / TOKEN_HEIGHT);
			// Ensure we show at least 2 tokens, and adjust based on actual display size
			maxVisible = Math.max(2, maxVisible);
			// Add extra padding for very tall displays
			if (d.dotRows > 60) {
				maxVisible += 2;
			}
		} else {
			// For normal mode, use the previous logic
			maxVisible = d.dotRows >= 30 ? 5 : (d.dotRows >= 20 ? 3 : 2);
		}
		
		// Add buffer tokens for smooth scrolling
		const totalTokensToRender = maxVisible + 2;
		
		const startIdx = Math.floor(this.scrollPosition / TOKEN_HEIGHT);
		let visibleTokens = 0;

		// Log display info occasionally for debugging
		if (Math.random() < 0.01) {
			console.log(`Display stats - Mode: ${this.ts.sizeMode}, Height: ${d.dotRows}, Max Visible: ${maxVisible}`);
		}

		for (let i = 0; i < totalTokensToRender; i++) {
			// Ensure we handle the case where displayData might have changed since last frame
			if (startIdx + i >= this.displayData.length) {
				continue; // Skip if index is out of bounds
			}
			
			const idx = (startIdx + i) % this.displayData.length;
			const tokenData = this.displayData[idx]; // This contains originalToken
			if (!tokenData || !tokenData.originalToken) continue;

			const token = tokenData.originalToken; // Use the full original token for drawing

			// Calculate precise fractional scroll position for smoother animation
			const rowOffsetFraction = (this.scrollPosition % TOKEN_HEIGHT) / TOKEN_HEIGHT;
			const rowStart = Math.floor(i * TOKEN_HEIGHT - rowOffsetFraction * TOKEN_HEIGHT) + 2;

			if (rowStart < -TOKEN_HEIGHT || rowStart >= d.dotRows) continue;

			// Extract all needed data for the LED display
			const symbol = token.baseToken?.symbol || 'UNKN';
			const price = formatPrice(token.priceUsd || 0);
			const change24h = token.priceChange?.h24 !== undefined ? token.priceChange.h24 : 0;
			const change1h = token.priceChange?.h1 !== undefined ? token.priceChange.h1 : 0;
			const change5m = token.priceChange?.m5 !== undefined ? token.priceChange.m5 : 0;
			
			// Create enhanced token data for the LED display
			const enhancedToken = {
				symbol: symbol,
				price: token.priceUsd || 0,
				change: change24h,    // Keep the original change (24h) for backward compatibility
				change24h: change24h, // Explicitly add 24h change
				change1h: change1h,   // Add 1h change
				change5m: change5m    // Add 5m change
			};
			
			// Pass the enhanced token to drawTokenInfo
			d.drawTokenInfo(enhancedToken, rowStart);
			
			// Register this token as clickable - the entire first row is clickable
			// Only register if fully on screen
			if (rowStart >= 0 && rowStart < d.dotRows) {
				try {
					// Make the symbol and price row clickable
					this.addClickableToken(
						token, 
						rowStart,                               // rowStart
						rowStart + 5,                           // rowEnd (5 is character height)
						0,                                       // colStart (entire row)
						d.dotCols * 2                               // colEnd (entire row)
					);
				} catch (err) {
					console.warn(`Error adding clickable token position for ${symbol}:`, err);
				}
			}
			
			visibleTokens++;
		}

		if (visibleTokens === 0 && this.displayData.length > 0) { // Check if displayData has items
			d.drawText('NO TOKENS VISIBLE', 2, 10, 'orange');
		} else if (this.displayData.length === 0) {
			d.drawText('NO TOKEN DATA', 2, 10, 'red');
		}
	}

	async _refreshDetailTokenData() {
		const ts = this.ts;
		if (!ts.dataProvider || !ts.detailToken) return;
		
		const now = Date.now();
		// Use internal state for refresh timing if preferred, or rely on TokenScoreboard's
		if (now - (ts.lastDetailRefresh || 0) < (ts.detailRefreshInterval || 5000) || ts.isRefreshingDetail) return;
		
		ts.isRefreshingDetail = true;
		try {
			console.log("ScoreboardDisplayManager: Refreshing detail token data");
			await ts.dataProvider.refreshData();
			const tokens = await ts.dataProvider.getCurrentPageTokens();
			if (!tokens || tokens.length === 0) {
				console.log("ScoreboardDisplayManager: No tokens returned from provider for refresh.");
				ts.isRefreshingDetail = false;
				return;
			}

			// Find the updated token by matching different properties safely
			let updated = null;
			
			// First try match by tokenAddress and chainId if both exist
			if (ts.detailToken.tokenAddress && ts.detailToken.chainId) {
				updated = tokens.find(t => 
					t.tokenAddress && 
					t.chainId && 
					t.tokenAddress.toLowerCase() === ts.detailToken.tokenAddress.toLowerCase() &&
					t.chainId == ts.detailToken.chainId
				);
			}
			
			// If not found, try match by tokenAddress only
			if (!updated && ts.detailToken.tokenAddress) {
				updated = tokens.find(t => 
					t.tokenAddress && 
					t.tokenAddress.toLowerCase() === ts.detailToken.tokenAddress.toLowerCase()
				);
			}
			
			// If still not found, try match by baseToken symbol
			if (!updated) {
				const detailSymbol = (ts.detailToken.baseToken?.symbol || ts.detailToken.symbol || '').toUpperCase();
				if (detailSymbol) {
					updated = tokens.find(t => {
						const sym = (t.baseToken?.symbol || t.symbol || '').toUpperCase();
						return sym === detailSymbol;
					});
				}
			}

			if (updated) {
				ts.detailToken = { // Update the token on the main TokenScoreboard instance
					...updated, 
					...ts.detailToken,
					priceUsd: updated.priceUsd || ts.detailToken.priceUsd,
					priceChange: updated.priceChange || ts.detailToken.priceChange,
					marketCap: updated.marketCap || ts.detailToken.marketCap,
					fdv: updated.fdv || ts.detailToken.fdv,
					volume: updated.volume || ts.detailToken.volume,
					liquidity: updated.liquidity || ts.detailToken.liquidity,
					txns: updated.txns || ts.detailToken.txns
				};
				// After updating detailToken, this manager will redraw it in its update() or showTokenDetail()
				// this.showTokenDetail(); // No, let update() handle redraw based on ts.detailToken
			} else {
				console.log("ScoreboardDisplayManager: Could not find matching token for update.");
				if (ts.detailToken.tokenAddress && ts.dataProvider.getTokenDetails) {
					try {
						const tokenDetails = await ts.dataProvider.getTokenDetails(ts.detailToken.tokenAddress, ts.detailToken.chainId);
						if (tokenDetails) {
							ts.detailToken = { ...ts.detailToken, ...tokenDetails };
							// this.showTokenDetail();
						}
					} catch (err) {
						console.warn("ScoreboardDisplayManager: Failed to get token details directly:", err);
					}
				}
			}
			
			if (ts.socialButtonManager && ts.detailToken) {
				ts.socialButtonManager.updateButtonColors(ts.detailToken);
			}
			ts.lastDetailRefresh = Date.now(); // Update on TokenScoreboard
		} catch (err) {
			console.error('ScoreboardDisplayManager: Detail refresh error', err);
		} finally {
			ts.isRefreshingDetail = false;
		}
	}

	update(deltaTime) {
		if (!this.ts.ledDisplay || this.ts.isAnimatingMode) return;

		// Attempt to refresh detail token data if in detail mode
		if (this.ts.detailMode && this.ts.detailToken) {
			this._refreshDetailTokenData(); // Call its own refresh method
		}

		this.ts.ledDisplay.clear();

		if (this.ts.detailMode && this.ts.detailToken) {
			this._drawDetailToken(this.ts.detailToken); 
			
			const now = Date.now();
			const elapsedSinceRefresh = now - (this.ts.lastDetailRefresh || 0); 
			const isRefreshDue = elapsedSinceRefresh >= (this.ts.detailRefreshInterval || 5000);
			if (this.ts.isRefreshingDetail || isRefreshDue) {
				const time = Date.now();
				const animationFrame = Math.floor((time % 1000) / 250);
				const refreshChar = ['⟳', '⟲', '⟳', '⟲'][animationFrame]; 
				this.ts.ledDisplay.drawText(refreshChar, 2, this.ts.ledDisplay.dotCols - 6, 'cyan');
			}
		} else {
			this._drawScrollingTokenList();
		}
	}

	// Find if a click intersects with a token
	findTokenAtPosition(rowPosition, colPosition) {
		try {
			if (!this.clickableTokenPositions || !Array.isArray(this.clickableTokenPositions)) {
				console.log("No clickable token positions available");
				return null;
			}
			
			for (const tokenPos of this.clickableTokenPositions) {
				// Ensure the tokenPos object has all required properties
				if (!tokenPos || !tokenPos.token) continue;
				
				if (rowPosition >= tokenPos.rowStart && 
					rowPosition <= tokenPos.rowEnd && 
					colPosition >= tokenPos.colStart && 
					colPosition <= tokenPos.colEnd) {
					
					// Validate token exists before returning
					if (tokenPos.token) {
						console.log(`Found token at position [${rowPosition},${colPosition}]: ${tokenPos.token.baseToken?.symbol || 'Unknown'}`);
						return tokenPos.token;
					}
				}
			}
			
			// No matching token found
			return null;
		} catch (err) {
			console.error("Error in findTokenAtPosition:", err);
			return null;
		}
	}

	// Reset clickable positions when we redraw
	resetClickablePositions() {
		this.clickableTokenPositions = [];
	}

	// Add a clickable token position
	addClickableToken(token, rowStart, rowEnd, colStart, colEnd) {
		if (!token) {
			console.warn("Attempted to add null token to clickable positions");
			return;
		}
		
		if (!this.clickableTokenPositions) {
			this.clickableTokenPositions = [];
		}
		
		// Validate parameters
		if (rowStart === undefined || rowEnd === undefined || 
			colStart === undefined || colEnd === undefined) {
			console.warn("Invalid parameters for clickable token position");
			return;
		}
		
		// Add token to clickable positions with significantly expanded area to cover the entire token display area
		this.clickableTokenPositions.push({
			token,
			rowStart: Math.max(0, rowStart - 3), // Extend upwards to catch clicks above the text
			rowEnd: rowEnd + 5, // Extend downwards significantly beyond the text
			colStart: 0, 
			colEnd: this.ts.ledDisplay.dotCols // Cover the full width of the display
		});
	}
} 