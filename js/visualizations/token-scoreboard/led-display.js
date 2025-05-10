import * as THREE from 'three';
import { formatPrice, formatChange, getChangeColor } from './utils.js';

// ────────────────────────────────────────────────────────────────────────────────
// Bitmap-font dimensions (5×3 glyphs)                                           
// These are shared across the class to remove magic numbers from drawing logic.
// ────────────────────────────────────────────────────────────────────────────────
const CHAR_WIDTH           = 3; // columns in each glyph bitmap
const CHAR_SPACING         = 1; // blank columns between glyphs
const CHAR_TOTAL_WIDTH     = CHAR_WIDTH + CHAR_SPACING; // effective width per glyph
const CHAR_HEIGHT          = 5; // rows in each glyph bitmap
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Handles LED display functionality for the scoreboard
 */
export class LEDDisplay {
	/**
	 * Calculate optimal dotRows and dotSpacing for given width, height, and dotCols.
	 * @param {number} width - Display width
	 * @param {number} height - Display height
	 * @param {number} dotCols - Number of columns (fixed)
	 * @returns {{dotRows: number, dotSpacing: number}}
	 */
	static calculateDotLayout(width, height, dotCols) {
		const totalWidth = width * 1.05;
		const totalHeight = height * 0.9;
		const baseSpacing = (totalWidth / dotCols) * 1.1;
		let dotRows = Math.max(1, Math.floor((height * 1.15) / baseSpacing));
		let dotSpacing = Math.min(totalWidth / dotCols, totalHeight / dotRows) * 1.3;
		if (!isFinite(dotSpacing) || dotSpacing <= 0) dotSpacing = 1;
		if (!isFinite(dotRows) || dotRows < 1) dotRows = 1;
		return { dotRows, dotSpacing };
	}

	constructor(parentGroup, width, height) {
		this.parentGroup = parentGroup;
		this.width = width;
		this.height = height;
		this.dotCols = 95;
		const layout = LEDDisplay.calculateDotLayout(this.width, this.height, this.dotCols);
		this.dotRows = layout.dotRows;
		this.dotSpacing = layout.dotSpacing;
		this.dots = Array(this.dotRows).fill().map(() => Array(this.dotCols).fill(null));
		this.dotMaterials = {};
		this.ledGroup = null;
		this.colors = {
			red: new THREE.Color(0xff0000),
			green: new THREE.Color(0x00ff00),
			blue: new THREE.Color(0x0000ff),
			yellow: new THREE.Color(0xffff00),
			cyan: new THREE.Color(0x00ffff),
			magenta: new THREE.Color(0xff00ff),
			white: new THREE.Color(0xffffff),
			off: new THREE.Color(0x202020)
		};
		this.createLEDDisplay();
	}

	/**
	 * Create LED dot matrix display
	 */
	createLEDDisplay() {
		this.ledGroup = new THREE.Group();
		this.parentGroup.add(this.ledGroup);
		console.log(`Creating LED display with width=${this.width}, height=${this.height}, rows=${this.dotRows}, cols=${this.dotCols}`);
		const dotGeometry = new THREE.CircleGeometry(0.12, 16);
		this.dotMaterials = {};
		Object.entries(this.colors).forEach(([name, color]) => {
			const enhancedColor = color.clone().multiplyScalar(name === 'off' ? 1 : 1);
			this.dotMaterials[name] = new THREE.MeshBasicMaterial({
				color: enhancedColor,
				transparent: false,
				opacity: name === 'off' ? 0.05 : 1.0,
				blending: THREE.AdditiveBlending,
				side: THREE.DoubleSide
			});
		});
		const totalWidth = this.width * 0.98;
		const totalHeight = this.height * 0.95;
		if (totalHeight < 0.1) {
			console.log("Height too small for LED display, creating minimal display");
			this.dotRows = 1;
			this.dots = Array(this.dotRows).fill().map(() => Array(this.dotCols).fill(null));
			return;
		}
		// Always recalculate layout for consistency
		const layout = LEDDisplay.calculateDotLayout(this.width, this.height, this.dotCols);
		this.dotRows = layout.dotRows;
		this.dotSpacing = layout.dotSpacing;
		this.dotSize = this.dotSpacing * 2;
		const startX = -totalWidth / 2 + this.dotSpacing / 2 - 1.2;
		const startY = -totalHeight / 1.88;
		this.dots = Array(this.dotRows).fill().map(() => Array(this.dotCols).fill(null));
		for (let row = 0; row < this.dotRows; row++) {
			for (let col = 0; col < this.dotCols; col++) {
				const dot = new THREE.Mesh(dotGeometry, this.dotMaterials.off);
				dot.position.x = startX + col * this.dotSpacing * 0.9;
				dot.position.y = startY + row * this.dotSpacing * 0.88;
				dot.position.z = 0;
				dot.rotation.y = Math.PI;
				dot.scale.set(this.dotSize, this.dotSize, 1);
				
				// Store row and column information for interaction
				dot.userData = {
					row: row,
					col: col,
					isLED: true  // Mark this as an LED dot for easy identification
				};
				
				this.dots[row][col] = dot;
				this.ledGroup.add(dot);
			}
		}
		this.ledGroup.position.set(0, 0, 0);
	}

	/**
	 * Set the color of an individual LED dot
	 * @param {number} row - Row index
	 * @param {number} col - Column index
	 * @param {string} colorName - Name of the color to set
	 */
	setDotColor(row, col, colorName) {
		// First check if dots array exists and indices are in valid range
		if (!this.dots) return;
		if (row < 0 || row >= this.dots.length) return;
		if (!this.dots[row]) return;
		if (col < 0 || col >= this.dots[row].length) return;
		
		// Make sure the dot element exists at the specified position
		const dot = this.dots[row][col];
		if (!dot) return;
		
		// Get material - default to 'off' if colorName doesn't exist
		const material = this.dotMaterials[colorName] || this.dotMaterials.off;
		if (!material) return; // Safety check in case materials aren't initialized yet
		
		// Add more intense effect for active dots by scaling them slightly
		if (colorName !== 'off') {
			dot.scale.set(this.dotSize * 1.2, this.dotSize * 1.2, 1);
		} else {
			dot.scale.set(this.dotSize * 0.8, this.dotSize * 0.8, 1);
		}
		
		dot.material = material;
	}
	
	/**
	 * Draw text on the LED display
	 * @param {string} text - Text to display
	 * @param {number} row - Starting row
	 * @param {number} col - Starting column
	 * @param {string} color - Color name for the text
	 */
	drawText(text, row, col, color) {
		// Simple 5x3 font for basic characters but with better spacing
		const font = {
			'0': [
				[1,1,1],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,1]
			],
			'1': [
				[0,1,0],
				[1,1,0],
				[0,1,0],
				[0,1,0],
				[1,1,1]
			],
			'2': [
				[1,1,1],
				[0,0,1],
				[1,1,1],
				[1,0,0],
				[1,1,1]
			],
			'3': [
				[1,1,1],
				[0,0,1],
				[0,1,1],
				[0,0,1],
				[1,1,1]
			],
			'4': [
				[1,0,1],
				[1,0,1],
				[1,1,1],
				[0,0,1],
				[0,0,1]
			],
			'5': [
				[1,1,1],
				[1,0,0],
				[1,1,1],
				[0,0,1],
				[1,1,1]
			],
			'6': [
				[1,1,1],
				[1,0,0],
				[1,1,1],
				[1,0,1],
				[1,1,1]
			],
			'7': [
				[1,1,1],
				[0,0,1],
				[0,1,0],
				[0,1,0],
				[0,1,0]
			],
			'8': [
				[1,1,1],
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,1,1]
			],
			'9': [
				[1,1,1],
				[1,0,1],
				[1,1,1],
				[0,0,1],
				[1,1,1]
			],
			'$': [
				[0,1,0],
				[1,1,1],
				[0,1,0],
				[1,1,1],
				[0,1,0]
			],
			'+': [
				[0,0,0],
				[0,1,0],
				[1,1,1],
				[0,1,0],
				[0,0,0]
			],
			'-': [
				[0,0,0],
				[0,0,0],
				[1,1,1],
				[0,0,0],
				[0,0,0]
			],
			'.': [
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,1,0]
			],
			' ': [
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,0,0]
			],
			'%': [
				[1,0,0],
				[0,0,1],
				[0,1,0],
				[1,0,0],
				[0,0,1]
			],
			'A': [
				[0,1,0],
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,0,1]
			],
			'B': [
				[1,1,0],
				[1,0,1],
				[1,1,0],
				[1,0,1],
				[1,1,0]
			],
			'C': [
				[0,1,1],
				[1,0,0],
				[1,0,0],
				[1,0,0],
				[0,1,1]
			],
			'D': [
				[1,1,0],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,0]
			],
			'E': [
				[1,1,1],
				[1,0,0],
				[1,1,0],
				[1,0,0],
				[1,1,1]
			],
			'F': [
				[1,1,1],
				[1,0,0],
				[1,1,0],
				[1,0,0],
				[1,0,0]
			],
			'G': [
				[0,1,1],
				[1,0,0],
				[1,0,1],
				[1,0,1],
				[0,1,1]
			],
			'H': [
				[1,0,1],
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,0,1]
			],
			'I': [
				[1,1,1],
				[0,1,0],
				[0,1,0],
				[0,1,0],
				[1,1,1]
			],
			'J': [
				[0,1,1],
				[0, 0, 1],
				[0, 0,1],
				[0,0,1],
				[1,1,1]
			],
			'K': [
				[1,0,1],
				[1,0,1],
				[1,1,0],
				[1,0,1],
				[1,0,1]
			],
			'L': [
				[1,0,0],
				[1,0,0],
				[1,0,0],
				[1,0,0],
				[1,1,1]
			],
			'M': [
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,0,1],
				[1,0,1]
			],
			'N': [
				[1,0,1],
				[1,1,1],
				[1,1,1],
				[1,0,1],
				[1,0,1]
			],
			'O': [
				[0,1,0],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[0,1,0]
			],
			'P': [
				[1,1,0],
				[1,0,1],
				[1,1,0],
				[1,0,0],
				[1,0,0]
			],
			'Q': [
				[1,1,1],
				[1,0,1],
				[1,1,1],
				[0,0,1],
				[0,0,1]
			],
			'R': [
				[1,1,0],
				[1,0,1],
				[1,1,0],
				[1,0,1],
				[1,0,1]
			],
			'S': [
				[0,1,1],
				[1,0,0],
				[0,1,0],
				[0,0,1],
				[1,1,0]
			],
			'T': [
				[1,1,1],
				[0,1,0],
				[0,1,0],
				[0,1,0],
				[0,1,0]
			],
			'U': [
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,1]
			],
			'V': [
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[0,1,0],
				[0,1,0]
			],
			'W': [
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,1],
				[1,0,1]
			],
			'X': [
				[1,0,1],
				[1,0,1],
				[0,1,0],
				[1,0,1],
				[1,0,1]
			],
			'Y': [
				[1,0,1],
				[1,0,1],
				[0,1,0],
				[0,1,0],
				[0,1,0]
			],
			'Z': [
				[1,1,1],
				[0,0,1],
				[0,1,0],
				[1,0,0],
				[1,1,1]
			],
			'/': [
				[0,0,1],
				[0,1,0],
				[1,0,0],
				[0,0,0],
				[0,0,0]
			],
			'·': [
				[0,0,0],
				[0,0,0],
				[0,1,0],
				[0,0,0],
				[0,0,0]
			],
			'@': [
				[1,1,1],
				[1,0,1],
				[1,1,1],
				[1,0,0],
				[1,1,1]
			],
			'#': [
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,1,1],
				[1,0,1]
			],
			'!': [
				[0,1,0],
				[0,1,0],
				[0,1,0],
				[0,0,0],
				[0,1,0]
			],
			'?': [
				[1,1,1],
				[0,0,1],
				[1,1,1],
				[0,0,0],
				[0,1,0]
			],
			'(': [
				[1,1,1],
				[1,0,0],
				[1,0,0],
				[1,0,0],
				[1,1,1]
			],
			')': [
				[1,1,1],
				[0,0,1],
				[0,0,1],
				[0,0,1],
				[1,1,1]
			],
			':': [
				[0,0,0],
				[0,1,0],
				[0,0,0],
				[0,1,0],
				[0,0,0]
			],
			';': [
				[0,0,0],
				[0,1,0],
				[0,0,0],
				[0,1,0],
				[1,0,0]
			],
			'_': [
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[1,1,1]
			]
		};
		
		let currentCol = col;
		
		// Clear a rectangular area around the text
		const textWidth = text.length * CHAR_TOTAL_WIDTH;
		const textHeight = CHAR_HEIGHT;
		
		for (let y = 0; y < textHeight; y++) {
			for (let x = 0; x < textWidth + 1; x++) {
				this.setDotColor(row + y, col + x, 'off');
			}
		}
		
		// For each character in the text
		for (let i = 0; i < text.length; i++) {
			const char = text[i].toUpperCase();
			if (!Object.prototype.hasOwnProperty.call(font, char)) {
				// Log only once per unknown glyph to avoid flooding
				if (!this._unknownGlyphs) this._unknownGlyphs = new Set();
				if (!this._unknownGlyphs.has(char)) {
					console.warn(`LEDDisplay: Missing glyph for character "${char}" – substituting space.`);
					this._unknownGlyphs.add(char);
				}
			}
			const charPattern = font[char] || font[' '];
			
			// Draw the character with extra space around it for better readability
			for (let y = 0; y < charPattern.length; y++) {
				for (let x = 0; x < charPattern[y].length; x++) {
					if (charPattern[y][x]) {
						this.setDotColor(row + y, currentCol + x, color);
					}
				}
			}
			
			// Move to next character position with extra space
			currentCol += CHAR_TOTAL_WIDTH;
		}
		
		// Return the ending column position
		return currentCol;
	}
	
	/**
	 * Draw a token's information on the display
	 * @param {Object} token - Token data object
	 * @param {number} row - Starting row on the display
	 */
	drawTokenInfo(token, row) {
		// Ensure row is visible and in bounds
		if (row < -CHAR_HEIGHT || row >= this.dotRows) {
			return; // Skip tokens that would be completely off-screen
		}
		
		// First clear the area where we'll draw to avoid overlapping text
		const totalRows = CHAR_HEIGHT * 2 + 2; // Space for two rows of text plus spacing
		const clearWidth = this.dotCols;
		
		for (let r = 0; r < totalRows; r++) {
			if (row + r >= 0 && row + r < this.dotRows) {
				for (let c = 0; c < clearWidth; c++) {
					this.setDotColor(row + r, c, 'off');
				}
			}
		}
		
		// Draw token symbol on the left
		const symbolText = '$' + token.symbol;
		this.drawText(symbolText, row, 2, 'cyan');
		
		// Format price using utility function
		const priceText = '$' + formatPrice(token.price);
		
		// Calculate position to right-align the price
		const rightPriceCol = this.dotCols - (priceText.length * CHAR_TOTAL_WIDTH) - 2;
		
		// Draw right-aligned price on the same line as symbol
		if (row >= -CHAR_HEIGHT && row < this.dotRows) {
			this.drawText(priceText, row, rightPriceCol, 'yellow');
		}
		
		// Determine if enough space for second line (more important in normal mode)
		const isTallDisplay = this.dotRows >= 50;
		
		// Move to next line for percentage changes
		const changeRow = row + CHAR_HEIGHT + 1;
		
		// Skip if change row would be completely off screen
		if (changeRow < -CHAR_HEIGHT || changeRow >= this.dotRows) {
			return;
		}
		
		// Extract changes from token data or use defaults
		const change5m = token.change5m !== undefined ? token.change5m : 0;
		const change1h = token.change1h !== undefined ? token.change1h : 0;
		const change24h = token.change !== undefined ? token.change : 0; // Original change is 24h

		// Format and color the change values - use compact format to save space
		const change5mText = formatChange(change5m, false, true);
		const change1hText = formatChange(change1h, false, true);
		const change24hText = formatChange(change24h, false, true);
		
		const color5m = getChangeColor(change5m);
		const color1h = getChangeColor(change1h);
		const color24h = getChangeColor(change24h);
		
		// Calculate positions with even spacing and no labels
		// Left position for 5m change
		const leftCol = 2;
		
		// Right position for 24h change
		const rightCol = this.dotCols - (change24hText.length * CHAR_TOTAL_WIDTH) - 2;
		
		// Middle position centered using predetermined position
		const middleCol = Math.floor(this.dotCols/2) - Math.floor(CHAR_TOTAL_WIDTH * 3);
		
		// Draw changes with no labels for a cleaner display
		this.drawText(change5mText, changeRow, leftCol, color5m);
		this.drawText(change1hText, changeRow, middleCol, color1h);
		this.drawText(change24hText, changeRow, rightCol, color24h);
		
		// Add visual separator in tall mode to improve readability
		if (isTallDisplay) {
			const separatorRow = changeRow + CHAR_HEIGHT + 1;
			if (separatorRow < this.dotRows && separatorRow >= 0) {
				// Draw a subtle separator line
				for (let i = 0; i < 5; i++) {
					this.setDotColor(separatorRow, this.dotCols/2 - 2 + i, 'off');
				}
			}
		}
	}
	
	/**
	 * Clean up the LED display and recreate it from scratch
	 * This is useful when changing size modes to prevent duplicate LEDs
	 */
	recreateDisplay() {
		console.log(`Recreating LED display from scratch with width=${this.width}, height=${this.height}`);
		if (this.ledGroup) {
			while (this.ledGroup.children.length > 0) {
				const child = this.ledGroup.children[0];
				if (child.geometry) child.geometry.dispose();
				if (child.material) child.material.dispose();
				this.ledGroup.remove(child);
			}
			if (this.ledGroup.parent) {
				this.ledGroup.parent.remove(this.ledGroup);
			}
		}
		// Use the unified layout calculation
		const layout = LEDDisplay.calculateDotLayout(this.width, this.height, this.dotCols);
		this.dotRows = layout.dotRows;
		this.dotSpacing = layout.dotSpacing;
		this.dots = Array(this.dotRows).fill().map(() => Array(this.dotCols).fill(null));
		this.createLEDDisplay();
		console.log(`LED display recreated with ${this.dotRows} rows and ${this.dotCols} columns`);
	}

	/**
	 * Update the LED display size based on current height
	 */
	updateDisplaySize(width, height) {
		this.width = width;
		this.height = height;
		const layout = LEDDisplay.calculateDotLayout(this.width, this.height, this.dotCols);
		const oldRowCount = this.dotRows;
		this.dotRows = layout.dotRows;
		this.dotSpacing = layout.dotSpacing;
		if (!this.dots || Math.abs(this.dotRows - oldRowCount) > (oldRowCount * 0.2)) {
			console.log(`Significant row count change detected: ${oldRowCount} -> ${this.dotRows}`);
			this.recreateDisplay();
			return;
		}
		const totalWidth = this.width * 0.98;
		const totalHeight = this.height * 0.95;
		const startX = -totalWidth / 2 + this.dotSpacing / 2 - 1.5;
		const startY = -totalHeight / 2 + this.dotSpacing / 2 - 0.2;
		for (let row = 0; row < Math.min(this.dotRows, this.dots.length); row++) {
			for (let col = 0; col < Math.min(this.dotCols, this.dots[row].length); col++) {
				const dot = this.dots[row][col];
				if (dot) {
					dot.position.x = startX + col * this.dotSpacing * 0.9;
					dot.position.y = startY + row * this.dotSpacing * 0.9;
				}
			}
		}
		this.ledGroup.position.set(0, 0, 0);
	}
	
	/**
	 * Clear the display
	 */
	clear() {
		if (!this.dots) return;
		
		// Add additional safety checks to prevent errors
		const rowCount = this.dots.length;
		for (let row = 0; row < Math.min(rowCount, this.dotRows); row++) {
			if (!this.dots[row]) continue;
			
			const colCount = this.dots[row].length;
			for (let col = 0; col < Math.min(colCount, this.dotCols); col++) {
				this.setDotColor(row, col, 'off');
			}
		}
	}
	
	/**
	 * Clean up resources
	 */
	dispose() {
		// First clear the dots array references
		if (this.dots) {
			for (let row = 0; row < this.dots.length; row++) {
				for (let col = 0; col < this.dots[row].length; col++) {
					const dot = this.dots[row][col];
					if (dot) {
						// Remove from parent
						if (dot.parent) {
							dot.parent.remove(dot);
						}
						// Dispose of geometry and material
						if (dot.geometry) dot.geometry.dispose();
						if (dot.material) dot.material.dispose();
						// Clear reference
						this.dots[row][col] = null;
					}
				}
			}
			this.dots = null;
		}
		
		// Dispose of all materials
		if (this.dotMaterials) {
			Object.values(this.dotMaterials).forEach(material => {
				if (material) material.dispose();
			});
			this.dotMaterials = null;
		}
		
		// Remove ledGroup and all its children
		if (this.ledGroup) {
			// First remove all children and dispose their resources
			while (this.ledGroup.children.length > 0) {
				const child = this.ledGroup.children[0];
				this.ledGroup.remove(child);
				if (child.geometry) child.geometry.dispose();
				if (child.material) child.material.dispose();
			}
			
			// Remove from parent
			if (this.ledGroup.parent) {
				this.ledGroup.parent.remove(this.ledGroup);
			}
			
			this.ledGroup = null;
		}
		
		console.log("LED display fully disposed");
	}
} 