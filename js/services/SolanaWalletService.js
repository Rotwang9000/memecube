/**
 * Solana Wallet Service
 * Manages connections to Solana wallets (primarily Phantom)
 */

export class SolanaWalletService {
	constructor() {
		this.wallet = null;
		this.publicKey = null;
		this.isConnected = false;
		this.connectionListeners = [];
		this.disconnectionListeners = [];
	}

	/**
	 * Get the Phantom wallet from the window object
	 * @returns {Object|null} Phantom wallet or null if not available
	 */
	getPhantomWallet() {
		if (typeof window === 'undefined') return null;
		
		// Check if Phantom is installed
		if ('phantom' in window) {
			// Direct connection via new Phantom deeplink
			return window.phantom?.solana;
		}
		
		// Check for older Phantom via solana provider
		if (window.solana?.isPhantom) {
			return window.solana;
		}
		
		return null;
	}
	
	/**
	 * Check if Phantom wallet is installed
	 * @returns {boolean} True if Phantom is available
	 */
	isPhantomInstalled() {
		return this.getPhantomWallet() !== null;
	}
	
	/**
	 * Connect to the Phantom wallet
	 * @returns {Promise<string>} Connected wallet address
	 */
	async connect() {
		try {
			const phantom = this.getPhantomWallet();
			
			if (!phantom) {
				throw new Error('Phantom wallet is not installed');
			}
			
			// Request wallet connection
			const { publicKey } = await phantom.connect();
			
			if (!publicKey) {
				throw new Error('Failed to connect to wallet');
			}
			
			// Store the connection details
			this.wallet = phantom;
			this.publicKey = publicKey;
			this.isConnected = true;
			
			// Get the wallet address as string
			const address = publicKey.toString();
			
			// Notify connection listeners
			this.notifyConnectionListeners(address);
			
			return address;
		} catch (error) {
			console.error('Wallet connection error:', error);
			
			// Handle user rejection separately
			if (error.code === 4001) {
				throw new Error('Connection request was rejected by the user');
			}
			
			throw error;
		}
	}
	
	/**
	 * Disconnect from the wallet
	 */
	async disconnect() {
		try {
			if (this.wallet && this.isConnected) {
				// Some wallets have a disconnect method
				if (typeof this.wallet.disconnect === 'function') {
					await this.wallet.disconnect();
				}
			}
		} catch (error) {
			console.error('Error disconnecting wallet:', error);
		} finally {
			// Reset state regardless of disconnect success
			this.publicKey = null;
			this.isConnected = false;
			
			// Notify disconnection listeners
			this.notifyDisconnectionListeners();
		}
	}
	
	/**
	 * Get the connected wallet address
	 * @returns {string|null} Wallet address or null if not connected
	 */
	getWalletAddress() {
		return this.publicKey ? this.publicKey.toString() : null;
	}
	
	/**
	 * Add a connection listener
	 * @param {Function} listener Function to call when wallet connects
	 */
	addConnectionListener(listener) {
		if (typeof listener === 'function') {
			this.connectionListeners.push(listener);
		}
	}
	
	/**
	 * Remove a connection listener
	 * @param {Function} listener Listener to remove
	 */
	removeConnectionListener(listener) {
		const index = this.connectionListeners.indexOf(listener);
		if (index !== -1) {
			this.connectionListeners.splice(index, 1);
		}
	}
	
	/**
	 * Add a disconnection listener
	 * @param {Function} listener Function to call when wallet disconnects
	 */
	addDisconnectionListener(listener) {
		if (typeof listener === 'function') {
			this.disconnectionListeners.push(listener);
		}
	}
	
	/**
	 * Remove a disconnection listener
	 * @param {Function} listener Listener to remove
	 */
	removeDisconnectionListener(listener) {
		const index = this.disconnectionListeners.indexOf(listener);
		if (index !== -1) {
			this.disconnectionListeners.splice(index, 1);
		}
	}
	
	/**
	 * Notify all connection listeners
	 * @param {string} address Connected wallet address
	 */
	notifyConnectionListeners(address) {
		for (const listener of this.connectionListeners) {
			try {
				listener(address);
			} catch (error) {
				console.error('Error in connection listener:', error);
			}
		}
	}
	
	/**
	 * Notify all disconnection listeners
	 */
	notifyDisconnectionListeners() {
		for (const listener of this.disconnectionListeners) {
			try {
				listener();
			} catch (error) {
				console.error('Error in disconnection listener:', error);
			}
		}
	}
	
	/**
	 * Simulate a payment transaction (for development until real payments are implemented)
	 * @param {number} amount Amount in SOL to send
	 * @param {string} recipient Recipient address
	 * @returns {Promise<Object>} Transaction details
	 */
	async simulatePayment(amount, recipient = "TokenRegistry11111111111111111111111111111") {
		if (!this.isConnected || !this.publicKey) {
			throw new Error('Wallet not connected');
		}
		
		// For now, just simulate a successful transaction
		const transactionId = Array.from({length: 64}, () => 
			"0123456789abcdef"[Math.floor(Math.random() * 16)]
		).join('');
		
		// Return a simulated transaction result
		return {
			success: true,
			transactionId,
			amount,
			sender: this.publicKey.toString(),
			recipient,
			timestamp: Date.now()
		};
	}
} 