import { FontLoader } from 'three/addons/loaders/FontLoader.js';

/**
 * Handles loading fonts for tag creation
 */
export class TagFontLoader {
	constructor() {
		this.font = null;
		this.currentFontName = '';
		
		// List of available fonts in the /fonts/ directory
		this.fontFiles = [
			'fonts/shmup.json',
			'fonts/heysei.json',
			'fonts/freshman.json'
		];
	}
	
	/**
	 * Load a random font from the available options
	 * @returns {Promise} - A promise that resolves with the loaded font
	 */
	async loadRandomFont() {
		try {
			const fontLoader = new FontLoader();
			
			// Select a random font file
			const randomFontFile = this.fontFiles[Math.floor(Math.random() * this.fontFiles.length)];
			
			// Store the font name for later use
			this.currentFontName = randomFontFile.split('/').pop().split('.')[0];
			
			// Load the selected font
			this.font = await new Promise((resolve, reject) => {
				fontLoader.load(
					randomFontFile,
					resolve,
					undefined,
					reject
				);
			});
			
			console.log('Font loaded successfully:', this.currentFontName);
			return this.font;
		} catch (error) {
			console.error('Error loading font:', error);
			throw error;
		}
	}
	
	/**
	 * Get the currently loaded font
	 * @returns {Object} - The loaded font
	 */
	getFont() {
		return this.font;
	}
	
	/**
	 * Get the current font name
	 * @returns {string} - The name of the currently loaded font
	 */
	getFontName() {
		return this.currentFontName;
	}
} 