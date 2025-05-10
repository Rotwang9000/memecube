/**
 * Sponsored Token Service
 * Manages token sponsorships and their timers
 */

export class SponsoredTokenService {
	constructor() {
		// Map to store sponsored tokens: tokenId => [sponsorshipInfo, ...]
		this.sponsoredTokens = new Map();
		
		// Sponsorship parameters
		this.basePaymentAmount = 0.1; // 0.1 SOL per sponsorship
		this.baseSponsorshipDuration = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
		this.baseVisualMultiplier = 1.5; // Size multiplier for sponsored tokens
		
		// Golden color for sponsored tokens
		this.sponsoredTokenColor = 0xFFD700; // Gold color
		
		// Start the timer to update sponsorships
		this.startSponsorshipTimer();
		
		// Try to load sponsorships from localStorage
		this.loadSponsorshipsFromStorage();
	}
	
	/**
	 * Generate a unique token identifier
	 * @param {string} chainId The chain ID
	 * @param {string} tokenAddress The token address
	 * @returns {string} Unique token identifier
	 */
	createTokenId(chainId, tokenAddress) {
		return `${chainId}-${tokenAddress}`;
	}
	
	/**
	 * Add or extend a token sponsorship
	 * @param {Object} token The token to sponsor
	 * @param {string} userAddress Sponsor's wallet address
	 * @param {number} paymentAmount Amount paid in SOL
	 * @param {boolean} extendTime Whether to extend time instead of increasing size
	 * @returns {Object} Updated sponsorship information
	 */
	sponsorToken(token, userAddress, paymentAmount, extendTime = false) {
		if (!token || !token.chainId || !token.tokenAddress) {
			throw new Error('Invalid token data for sponsorship');
		}
		
		if (!userAddress) {
			throw new Error('User address is required for sponsorship');
		}
		
		// Calculate number of sponsorship units (1 unit = 0.1 SOL)
		const sponsorshipUnits = Math.floor(paymentAmount / this.basePaymentAmount);
		if (sponsorshipUnits <= 0) {
			throw new Error(`Minimum payment of ${this.basePaymentAmount} SOL required`);
		}
		
		// Generate token identifier
		const tokenId = this.createTokenId(token.chainId, token.tokenAddress);
		
		// Get current sponsorships for this token
		let tokenSponsorships = this.sponsoredTokens.get(tokenId) || [];
		
		// Check if this user is already sponsoring the token
		const now = Date.now();
		const existingSponsorshipIndex = tokenSponsorships.findIndex(
			s => s.userAddress === userAddress && s.expiresAt > now
		);
		
		if (existingSponsorshipIndex >= 0) {
			// Update existing sponsorship
			const existingSponsorship = tokenSponsorships[existingSponsorshipIndex];
			
			if (extendTime) {
				// Extend the duration
				existingSponsorship.expiresAt += sponsorshipUnits * this.baseSponsorshipDuration;
			} else {
				// Increase the size multiplier
				existingSponsorship.sizeMultiplier += sponsorshipUnits * (this.baseVisualMultiplier - 1);
			}
			
			// Update the amount paid
			existingSponsorship.amountPaid += paymentAmount;
			existingSponsorship.lastUpdated = now;
			
			// Update in the array
			tokenSponsorships[existingSponsorshipIndex] = existingSponsorship;
		} else {
			// Create new sponsorship
			const newSponsorship = {
				userAddress,
				tokenData: token,
				amountPaid: paymentAmount,
				sizeMultiplier: this.baseVisualMultiplier,
				startedAt: now,
				expiresAt: now + (this.baseSponsorshipDuration * sponsorshipUnits),
				lastUpdated: now
			};
			
			// Add to the array
			tokenSponsorships.push(newSponsorship);
		}
		
		// Update the map
		this.sponsoredTokens.set(tokenId, tokenSponsorships);
		
		// Save to localStorage
		this.saveSponsorshipsToStorage();
		
		// Return the current sponsorships for this token
		return tokenSponsorships;
	}
	
	/**
	 * Check if a token is sponsored
	 * @param {string} chainId The chain ID
	 * @param {string} tokenAddress The token address
	 * @returns {boolean} True if token is sponsored
	 */
	isTokenSponsored(chainId, tokenAddress) {
		const tokenId = this.createTokenId(chainId, tokenAddress);
		const sponsorships = this.sponsoredTokens.get(tokenId) || [];
		
		// Check if there are any active sponsorships
		const now = Date.now();
		return sponsorships.some(sponsorship => sponsorship.expiresAt > now);
	}
	
	/**
	 * Get all active sponsorships for a token
	 * @param {string} chainId The chain ID
	 * @param {string} tokenAddress The token address
	 * @returns {Array} Array of active sponsorships
	 */
	getTokenSponsorships(chainId, tokenAddress) {
		const tokenId = this.createTokenId(chainId, tokenAddress);
		const sponsorships = this.sponsoredTokens.get(tokenId) || [];
		
		// Filter to active sponsorships only
		const now = Date.now();
		return sponsorships.filter(sponsorship => sponsorship.expiresAt > now);
	}
	
	/**
	 * Get all currently sponsored tokens
	 * @returns {Array} Array of sponsored token information
	 */
	getAllSponsoredTokens() {
		const result = [];
		const now = Date.now();
		
		// Loop through all tokens
		for (const [tokenId, sponsorships] of this.sponsoredTokens.entries()) {
			// Get active sponsorships
			const activeSponsorships = sponsorships.filter(s => s.expiresAt > now);
			
			// Skip if no active sponsorships
			if (activeSponsorships.length === 0) continue;
			
			// Get token data from first sponsorship
			const tokenData = activeSponsorships[0].tokenData;
			
			// Calculate combined size multiplier
			const combinedSizeMultiplier = activeSponsorships.reduce(
				(total, s) => total + (s.sizeMultiplier - 1), 
				1 // Start with base size of 1
			);
			
			// Add to results
			result.push({
				tokenId,
				tokenData,
				color: this.sponsoredTokenColor,
				sizeMultiplier: combinedSizeMultiplier,
				activeSponsorships
			});
		}
		
		return result;
	}
	
	/**
	 * Get the visual information for a token if it's sponsored
	 * @param {string} chainId The chain ID
	 * @param {string} tokenAddress The token address
	 * @returns {Object|null} Visual information or null if not sponsored
	 */
	getSponsoredTokenVisuals(chainId, tokenAddress) {
		if (!this.isTokenSponsored(chainId, tokenAddress)) {
			return null;
		}
		
		const sponsorships = this.getTokenSponsorships(chainId, tokenAddress);
		
		// Calculate combined size multiplier from all active sponsorships
		const combinedSizeMultiplier = sponsorships.reduce(
			(total, s) => total + (s.sizeMultiplier - 1), 
			1 // Start with base size of 1
		);
		
		return {
			isSponsored: true,
			color: this.sponsoredTokenColor,
			sizeMultiplier: combinedSizeMultiplier
		};
	}
	
	/**
	 * Start timer to regularly check and update sponsorships
	 */
	startSponsorshipTimer() {
		// Check sponsorships every minute
		setInterval(() => {
			this.cleanExpiredSponsorships();
		}, 60 * 1000); // 1 minute
	}
	
	/**
	 * Clean up expired sponsorships
	 */
	cleanExpiredSponsorships() {
		const now = Date.now();
		let changed = false;
		
		// Loop through all tokens
		for (const [tokenId, sponsorships] of this.sponsoredTokens.entries()) {
			// Filter to active sponsorships only
			const activeSponsorships = sponsorships.filter(s => s.expiresAt > now);
			
			// If some sponsorships expired, update the map
			if (activeSponsorships.length !== sponsorships.length) {
				changed = true;
				
				if (activeSponsorships.length === 0) {
					// Remove the token if no active sponsorships
					this.sponsoredTokens.delete(tokenId);
				} else {
					// Update with active sponsorships only
					this.sponsoredTokens.set(tokenId, activeSponsorships);
				}
			}
		}
		
		// Save to localStorage if changed
		if (changed) {
			this.saveSponsorshipsToStorage();
		}
	}
	
	/**
	 * Get all sponsorships for a specific user
	 * @param {string} userAddress User's wallet address
	 * @returns {Array} Array of user's sponsorships
	 */
	getUserSponsorships(userAddress) {
		const result = [];
		const now = Date.now();
		
		// Loop through all tokens
		for (const [tokenId, sponsorships] of this.sponsoredTokens.entries()) {
			// Filter to this user's active sponsorships
			const userSponsorships = sponsorships.filter(
				s => s.userAddress === userAddress && s.expiresAt > now
			);
			
			// Add each sponsorship to results
			for (const sponsorship of userSponsorships) {
				result.push({
					tokenId,
					...sponsorship,
					timeRemaining: sponsorship.expiresAt - now
				});
			}
		}
		
		return result;
	}
	
	/**
	 * Save sponsorships to localStorage
	 */
	saveSponsorshipsToStorage() {
		try {
			// Convert Map to array for storage
			const sponsorshipsArray = Array.from(this.sponsoredTokens.entries());
			
			// Save to localStorage
			localStorage.setItem('sponsoredTokens', JSON.stringify({
				timestamp: Date.now(),
				sponsorships: sponsorshipsArray
			}));
			
			console.log('Saved sponsorships to localStorage');
		} catch (error) {
			console.error('Error saving sponsorships to localStorage:', error);
		}
	}
	
	/**
	 * Load sponsorships from localStorage
	 */
	loadSponsorshipsFromStorage() {
		try {
			const stored = localStorage.getItem('sponsoredTokens');
			if (!stored) return;
			
			const data = JSON.parse(stored);
			
			// Check if data is expired (older than 7 days)
			const now = Date.now();
			const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
			
			if (now - data.timestamp > maxAge) {
				console.log('Sponsorships data in localStorage is too old, discarding');
				localStorage.removeItem('sponsoredTokens');
				return;
			}
			
			// Recreate the Map
			this.sponsoredTokens = new Map(data.sponsorships);
			
			// Clean up expired sponsorships immediately
			this.cleanExpiredSponsorships();
			
			console.log(`Loaded ${this.sponsoredTokens.size} sponsored tokens from localStorage`);
		} catch (error) {
			console.error('Error loading sponsorships from localStorage:', error);
		}
	}
} 