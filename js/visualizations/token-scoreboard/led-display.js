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
		const totalWidth = width * 0.98;
		const totalHeight = height * 0.95;
		const baseSpacing = (totalWidth / dotCols) * 1.1;
		let dotRows = Math.max(1, Math.floor((height * 1.1) / baseSpacing));
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
		const startY = -totalHeight / 2 + this.dotSpacing / 2 - 0.25;
		this.dots = Array(this.dotRows).fill().map(() => Array(this.dotCols).fill(null));
		for (let row = 0; row < this.dotRows; row++) {
			for (let col = 0; col < this.dotCols; col++) {
				const dot = new THREE.Mesh(dotGeometry, this.dotMaterials.off);
				dot.position.x = startX + col * this.dotSpacing * 0.9;
				dot.position.y = startY + row * this.dotSpacing * 0.9;
				dot.position.z = -0.3;
				dot.rotation.y = Math.PI;
				dot.scale.set(this.dotSize, this.dotSize, 1);
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
		// Draw token symbol
		let currentCol = 2;
		currentCol = this.drawText('$' + token.symbol, row, currentCol, 'cyan');
		
		// Add separator - increase the gap between elements
		currentCol += CHAR_TOTAL_WIDTH;
		
		// Format price using utility function
		const priceText = formatPrice(token.price);
		
		// Draw price in yellow - increase vertical spacing between symbol and price
		const VERTICAL_SPACING = CHAR_HEIGHT + 1; // one blank row between lines
		currentCol = this.drawText('$' + priceText, row + VERTICAL_SPACING, 2, 'yellow');
		
		// Get change color and format change text using utility functions
		const changeColor = getChangeColor(token.change);
		const changeText = formatChange(token.change);
		
		// Calculate the right-aligned position
		const changeTextWidth = changeText.length * CHAR_TOTAL_WIDTH;
		const RIGHT_MARGIN = 0;//CHAR_TOTAL_WIDTH * 3; // keep a 3-character margin from edge
		const rightAlignedCol = this.dotCols - changeTextWidth - RIGHT_MARGIN;
		
		this.drawText(changeText, row + VERTICAL_SPACING, rightAlignedCol, changeColor);
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