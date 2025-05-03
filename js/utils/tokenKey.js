/**
 * Token key utility functions
 * 
 * Provides consistent and stable token identification across the application
 * to prevent unnecessary removal and re-addition of tokens.
 */

/**
 * Generate a consistent key for a token that remains stable across refreshes
 * 
 * Priority:
 * 1. Use token contract address (most stable identifier)
 * 2. Fall back to pair address if token address is unavailable
 * 3. Last resort - use symbol
 * 
 * @param {Object} token - Token data object
 * @returns {string|null} Unique consistent key for the token or null if insufficient data
 */
export function getTokenKey(token) {
	if (!token) return null;
	
	// Extract chainId, handling different data structures
	let chainId = token.chainId;
	if (!chainId && token.baseToken && token.baseToken.chainId) {
		chainId = token.baseToken.chainId;
	}
	// If we still don't have chainId, default to Ethereum
	if (!chainId) chainId = 'eth';
	
	// Prefer the token address (more stable) and only fall back to pairAddress
	// if a token address is not available. This avoids churn when the API omits
	// pair data on some refreshes.
	let tokenAddress = token.tokenAddress;
	if (!tokenAddress && token.baseToken && token.baseToken.address) {
		tokenAddress = token.baseToken.address;
	}
	if (tokenAddress) {
		return `${chainId}-token-${tokenAddress}`;
	}
	
	// Fallback to pairAddress as a last resort
	if (token.pairAddress) {
		return `${chainId}-pair-${token.pairAddress}`;
	}
	
	// Last resort fallbacks for extremely unusual cases
	if (token.baseToken?.symbol) {
		return `${chainId}-symbol-${token.baseToken.symbol}`;
	} else if (token.symbol) {
		return `${chainId}-symbol-${token.symbol}`;
	}
	
	// Only use timestamp as absolute last resort
	return `${chainId}-unknown-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
} 