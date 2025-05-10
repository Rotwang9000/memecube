/**
 * Sponsored Token UI
 * Provides interface for users to sponsor tokens
 */

import { SponsoredTokenService } from '../services/SponsoredTokenService.js';
import { SolanaWalletService } from '../services/SolanaWalletService.js';
import { Utils } from '../utils/utils.js';

export class SponsoredTokenUI {
	constructor(dataProvider) {
		this.sponsorService = new SponsoredTokenService();
		this.walletService = new SolanaWalletService();
		this.dataProvider = dataProvider;
		this.utils = new Utils();
		this.modalElement = null;
		this.isModalOpen = false;
		this.userAddress = null; // Set when user connects wallet
		
		// Create UI elements
		this.createSponsorUI();
		
		// Create sponsorship status indicator
		this.createStatusButton();
		
		// Add wallet connection listeners
		this.setupWalletListeners();
	}
	
	/**
	 * Set up wallet connection listeners
	 */
	setupWalletListeners() {
		// Add connection listener
		this.walletService.addConnectionListener((address) => {
			this.userAddress = address;
			this.updateWalletUI();
			this.showUserSponsorships();
			this.utils.showTemporaryMessage('Wallet connected successfully!');
		});
		
		// Add disconnection listener
		this.walletService.addDisconnectionListener(() => {
			this.userAddress = null;
			this.updateWalletUI();
			this.utils.showTemporaryMessage('Wallet disconnected');
		});
	}
	
	/**
	 * Update wallet UI elements
	 */
	updateWalletUI() {
		const walletStatus = document.getElementById('wallet-status');
		const connectButton = document.getElementById('connect-wallet-btn');
		const sponsorButton = document.getElementById('sponsor-token-btn');
		
		if (!walletStatus || !connectButton) return;
		
		if (this.userAddress) {
			// Connected state
			walletStatus.innerHTML = `<strong>Wallet Status:</strong> Connected (${this.userAddress.substring(0, 6)}...)`;
			connectButton.textContent = 'Disconnect Wallet';
			
			// Enable sponsor button if token selected
			if (sponsorButton && this.selectedToken) {
				sponsorButton.disabled = false;
				sponsorButton.style.opacity = '1';
			}
		} else {
			// Disconnected state
			walletStatus.innerHTML = '<strong>Wallet Status:</strong> Not Connected';
			connectButton.textContent = 'Connect Wallet';
			
			// Disable sponsor button
			if (sponsorButton) {
				sponsorButton.disabled = true;
				sponsorButton.style.opacity = '0.5';
			}
		}
	}
	
	/**
	 * Create the UI for sponsoring tokens
	 */
	createSponsorUI() {
		// Create sponsor button
		const openSponsorButton = document.createElement('button');
		openSponsorButton.textContent = '✨ Sponsor Tokens';
		openSponsorButton.style.position = 'absolute';
		openSponsorButton.style.top = '70px';
		openSponsorButton.style.right = '20px';
		openSponsorButton.style.zIndex = '1000';
		openSponsorButton.style.backgroundColor = '#FFD700';
		openSponsorButton.style.color = '#333';
		openSponsorButton.style.border = 'none';
		openSponsorButton.style.borderRadius = '4px';
		openSponsorButton.style.padding = '8px 16px';
		openSponsorButton.style.cursor = 'pointer';
		openSponsorButton.style.fontWeight = 'bold';
		
		// Add click handler
		openSponsorButton.addEventListener('click', () => {
			this.showSponsorModal();
		});
		
		document.body.appendChild(openSponsorButton);
		
		// Create modal for sponsoring tokens (initially hidden)
		this.modalElement = document.createElement('div');
		this.modalElement.style.display = 'none';
		this.modalElement.style.position = 'fixed';
		this.modalElement.style.zIndex = '1001';
		this.modalElement.style.left = '50%';
		this.modalElement.style.top = '50%';
		this.modalElement.style.transform = 'translate(-50%, -50%)';
		this.modalElement.style.width = '80%';
		this.modalElement.style.maxWidth = '600px';
		this.modalElement.style.maxHeight = '80%';
		this.modalElement.style.backgroundColor = 'rgba(10, 20, 30, 0.95)';
		this.modalElement.style.color = 'white';
		this.modalElement.style.borderRadius = '8px';
		this.modalElement.style.padding = '20px';
		this.modalElement.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
		this.modalElement.style.border = '1px solid rgba(255, 215, 0, 0.3)';
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
			this.closeSponsorModal();
		});
		
		// Create header
		const header = document.createElement('h2');
		header.textContent = 'Sponsor a Token';
		header.style.marginTop = '0';
		header.style.color = '#FFD700';
		
		// Create description
		const description = document.createElement('p');
		description.innerHTML = `
			Make your favourite tokens stand out with gold colour and larger size!<br>
			Each 0.1 SOL sponsorship lasts for 6 hours.<br>
			Multiple sponsorships stack: sponsor more to make tokens bigger or last longer.
		`;
		
		// Create token search section
		const searchSection = document.createElement('div');
		searchSection.style.marginTop = '20px';
		
		const searchLabel = document.createElement('label');
		searchLabel.textContent = 'Search for a token:';
		searchLabel.style.display = 'block';
		searchLabel.style.marginBottom = '5px';
		
		const searchInput = document.createElement('input');
		searchInput.type = 'text';
		searchInput.placeholder = 'Enter token name or symbol';
		searchInput.style.width = '100%';
		searchInput.style.padding = '8px';
		searchInput.style.marginBottom = '10px';
		searchInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
		searchInput.style.border = '1px solid rgba(255, 255, 255, 0.2)';
		searchInput.style.borderRadius = '4px';
		searchInput.style.color = 'white';
		
		const searchResults = document.createElement('div');
		searchResults.id = 'token-search-results';
		searchResults.style.maxHeight = '200px';
		searchResults.style.overflowY = 'auto';
		searchResults.style.marginBottom = '20px';
		searchResults.style.border = '1px solid rgba(255, 255, 255, 0.2)';
		searchResults.style.borderRadius = '4px';
		searchResults.style.padding = '10px';
		searchResults.style.display = 'none';
		
		searchSection.appendChild(searchLabel);
		searchSection.appendChild(searchInput);
		searchSection.appendChild(searchResults);
		
		// Create sponsorship form
		const formSection = document.createElement('div');
		formSection.style.marginTop = '20px';
		
		const tokenLabel = document.createElement('div');
		tokenLabel.innerHTML = '<strong>Selected Token:</strong> <span id="selected-token">None</span>';
		tokenLabel.style.marginBottom = '15px';
		
		const amountLabel = document.createElement('label');
		amountLabel.textContent = 'Sponsorship Amount (SOL):';
		amountLabel.style.display = 'block';
		amountLabel.style.marginBottom = '5px';
		
		const amountInput = document.createElement('input');
		amountInput.type = 'number';
		amountInput.min = '0.1';
		amountInput.step = '0.1';
		amountInput.value = '0.1';
		amountInput.style.width = '100%';
		amountInput.style.padding = '8px';
		amountInput.style.marginBottom = '15px';
		amountInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
		amountInput.style.border = '1px solid rgba(255, 255, 255, 0.2)';
		amountInput.style.borderRadius = '4px';
		amountInput.style.color = 'white';
		
		const optionLabel = document.createElement('label');
		optionLabel.textContent = 'Sponsorship Option:';
		optionLabel.style.display = 'block';
		optionLabel.style.marginBottom = '5px';
		
		const optionsContainer = document.createElement('div');
		optionsContainer.style.display = 'flex';
		optionsContainer.style.marginBottom = '15px';
		
		const sizeRadio = document.createElement('input');
		sizeRadio.type = 'radio';
		sizeRadio.name = 'sponsor-option';
		sizeRadio.id = 'option-size';
		sizeRadio.value = 'size';
		sizeRadio.checked = true;
		
		const sizeLabel = document.createElement('label');
		sizeLabel.htmlFor = 'option-size';
		sizeLabel.textContent = 'Increase Size';
		sizeLabel.style.marginRight = '20px';
		sizeLabel.style.marginLeft = '5px';
		
		const timeRadio = document.createElement('input');
		timeRadio.type = 'radio';
		timeRadio.name = 'sponsor-option';
		timeRadio.id = 'option-time';
		timeRadio.value = 'time';
		
		const timeLabel = document.createElement('label');
		timeLabel.htmlFor = 'option-time';
		timeLabel.textContent = 'Extend Duration';
		timeLabel.style.marginLeft = '5px';
		
		optionsContainer.appendChild(sizeRadio);
		optionsContainer.appendChild(sizeLabel);
		optionsContainer.appendChild(timeRadio);
		optionsContainer.appendChild(timeLabel);
		
		// Wallet connect section
		const walletSection = document.createElement('div');
		walletSection.style.marginTop = '20px';
		walletSection.style.marginBottom = '20px';
		
		const walletStatus = document.createElement('div');
		walletStatus.id = 'wallet-status';
		walletStatus.innerHTML = '<strong>Wallet Status:</strong> Not Connected';
		walletStatus.style.marginBottom = '10px';
		
		const connectButton = document.createElement('button');
		connectButton.id = 'connect-wallet-btn';
		connectButton.textContent = 'Connect Wallet';
		connectButton.style.padding = '8px 16px';
		connectButton.style.backgroundColor = '#4a5568';
		connectButton.style.color = 'white';
		connectButton.style.border = 'none';
		connectButton.style.borderRadius = '4px';
		connectButton.style.cursor = 'pointer';
		connectButton.style.marginRight = '10px';
		
		const sponsorButton = document.createElement('button');
		sponsorButton.id = 'sponsor-token-btn';
		sponsorButton.textContent = 'Sponsor Token';
		sponsorButton.style.padding = '8px 16px';
		sponsorButton.style.backgroundColor = '#FFD700';
		sponsorButton.style.color = '#333';
		sponsorButton.style.border = 'none';
		sponsorButton.style.borderRadius = '4px';
		sponsorButton.style.cursor = 'pointer';
		sponsorButton.style.fontWeight = 'bold';
		sponsorButton.disabled = true;
		sponsorButton.style.opacity = '0.5';
		
		walletSection.appendChild(walletStatus);
		walletSection.appendChild(connectButton);
		walletSection.appendChild(sponsorButton);
		
		// Add current sponsorships section
		const sponsorshipsSection = document.createElement('div');
		sponsorshipsSection.id = 'user-sponsorships';
		sponsorshipsSection.style.marginTop = '20px';
		sponsorshipsSection.style.display = 'none';
		
		const sponsorshipsHeader = document.createElement('h3');
		sponsorshipsHeader.textContent = 'Your Active Sponsorships';
		sponsorshipsHeader.style.color = '#FFD700';
		
		const sponsorshipsList = document.createElement('div');
		sponsorshipsList.id = 'sponsorships-list';
		
		sponsorshipsSection.appendChild(sponsorshipsHeader);
		sponsorshipsSection.appendChild(sponsorshipsList);
		
		formSection.appendChild(tokenLabel);
		formSection.appendChild(amountLabel);
		formSection.appendChild(amountInput);
		formSection.appendChild(optionLabel);
		formSection.appendChild(optionsContainer);
		
		// Add elements to modal
		this.modalElement.appendChild(closeButton);
		this.modalElement.appendChild(header);
		this.modalElement.appendChild(description);
		this.modalElement.appendChild(searchSection);
		this.modalElement.appendChild(formSection);
		this.modalElement.appendChild(walletSection);
		this.modalElement.appendChild(sponsorshipsSection);
		
		document.body.appendChild(this.modalElement);
		
		// Add event listeners
		this.addEventListeners(searchInput, searchResults, connectButton, sponsorButton);
	}
	
	/**
	 * Create status button to show currently sponsored tokens
	 */
	createStatusButton() {
		const statusButton = document.createElement('button');
		statusButton.textContent = '🏆 Sponsored';
		statusButton.style.position = 'absolute';
		statusButton.style.top = '120px';
		statusButton.style.right = '20px';
		statusButton.style.zIndex = '1000';
		statusButton.style.backgroundColor = '#FFD700';
		statusButton.style.color = '#333';
		statusButton.style.border = 'none';
		statusButton.style.borderRadius = '4px';
		statusButton.style.padding = '8px 16px';
		statusButton.style.cursor = 'pointer';
		
		// Add click handler
		statusButton.addEventListener('click', () => {
			this.showSponsoredTokensList();
		});
		
		document.body.appendChild(statusButton);
	}
	
	/**
	 * Add event listeners to form elements
	 */
	addEventListeners(searchInput, searchResults, connectButton, sponsorButton) {
		// Search input
		let searchTimeout;
		searchInput.addEventListener('input', (e) => {
			clearTimeout(searchTimeout);
			const query = e.target.value.trim();
			
			// Only search if query is at least 2 characters
			if (query.length < 2) {
				searchResults.style.display = 'none';
				return;
			}
			
			// Debounce search
			searchTimeout = setTimeout(() => {
				this.searchTokens(query, searchResults);
			}, 300);
		});
		
		// Connect wallet
		connectButton.addEventListener('click', () => {
			this.connectWallet();
		});
		
		// Sponsor button
		sponsorButton.addEventListener('click', () => {
			this.sponsorSelectedToken();
		});
	}
	
	/**
	 * Search for tokens matching the query
	 * @param {string} query Search query
	 * @param {HTMLElement} resultsElement Element to display results in
	 */
	async searchTokens(query, resultsElement) {
		resultsElement.innerHTML = '<p>Searching...</p>';
		resultsElement.style.display = 'block';
		
		try {
			// Search for tokens
			const tokens = await this.dataProvider.getCurrentPageTokens();
			
			// Filter tokens by query
			const matchingTokens = tokens.filter(token => {
				const symbol = token.baseToken?.symbol || token.symbol || '';
				const name = token.baseToken?.name || token.name || '';
				return symbol.toLowerCase().includes(query.toLowerCase()) || 
					name.toLowerCase().includes(query.toLowerCase());
			}).slice(0, 10); // Limit to 10 results
			
			// Display results
			resultsElement.innerHTML = '';
			
			if (matchingTokens.length === 0) {
				resultsElement.innerHTML = '<p>No tokens found. Try a different search.</p>';
				return;
			}
			
			// Create result items
			matchingTokens.forEach(token => {
				const symbol = token.baseToken?.symbol || token.symbol || 'UNKNOWN';
				const name = token.baseToken?.name || token.name || symbol;
				const logoUrl = token.imageUrl || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
				
				const resultItem = document.createElement('div');
				resultItem.classList.add('token-result-item');
				resultItem.style.display = 'flex';
				resultItem.style.alignItems = 'center';
				resultItem.style.padding = '8px';
				resultItem.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
				resultItem.style.cursor = 'pointer';
				
				resultItem.innerHTML = `
					<img 
						src="${logoUrl}" 
						onerror="this.src='https://placehold.co/32x32/282828/717171?text=${symbol.charAt(0)}'; this.onerror=null;" 
						style="width: 24px; height: 24px; margin-right: 8px; border-radius: 50%;"
					>
					<div>
						<div><strong>${symbol}</strong></div>
						<div style="font-size: 0.8em; opacity: 0.7;">${name}</div>
					</div>
				`;
				
				// Add click handler
				resultItem.addEventListener('click', () => {
					this.selectToken(token);
					resultsElement.style.display = 'none';
				});
				
				resultsElement.appendChild(resultItem);
			});
		} catch (error) {
			console.error('Error searching tokens:', error);
			resultsElement.innerHTML = '<p>Error searching tokens. Please try again.</p>';
		}
	}
	
	/**
	 * Select a token for sponsorship
	 * @param {Object} token The selected token
	 */
	selectToken(token) {
		// Store the selected token
		this.selectedToken = token;
		
		// Update the UI
		const symbolElement = document.getElementById('selected-token');
		if (symbolElement) {
			const symbol = token.baseToken?.symbol || token.symbol || 'UNKNOWN';
			symbolElement.textContent = symbol;
		}
		
		// Update sponsor button state
		const sponsorButton = document.getElementById('sponsor-token-btn');
		if (sponsorButton && this.userAddress) {
			sponsorButton.disabled = false;
			sponsorButton.style.opacity = '1';
		}
	}
	
	/**
	 * Connect to wallet (now with real wallet connection)
	 */
	async connectWallet() {
		try {
			if (this.walletService.isConnected) {
				// If already connected, disconnect
				this.utils.showTemporaryMessage('Disconnecting wallet...');
				await this.walletService.disconnect();
				return;
			}
			
			// Check if Phantom is installed
			if (!this.walletService.isPhantomInstalled()) {
				this.utils.showTemporaryMessage('Phantom wallet not found. Please install it first.');
				
				// Open Phantom website
				window.open('https://phantom.app/', '_blank');
				return;
			}
			
			this.utils.showTemporaryMessage('Connecting to wallet...');
			
			// Connect to wallet
			await this.walletService.connect();
			
		} catch (error) {
			console.error('Error connecting wallet:', error);
			this.utils.showTemporaryMessage(`Error: ${error.message}`);
		}
	}
	
	/**
	 * Show user's current sponsorships
	 */
	showUserSponsorships() {
		if (!this.userAddress) return;
		
		const sponsorshipsSection = document.getElementById('user-sponsorships');
		const sponsorshipsList = document.getElementById('sponsorships-list');
		
		if (!sponsorshipsSection || !sponsorshipsList) return;
		
		// Get user's sponsorships
		const userSponsorships = this.sponsorService.getUserSponsorships(this.userAddress);
		
		// Show section if user has sponsorships
		if (userSponsorships.length > 0) {
			sponsorshipsSection.style.display = 'block';
			sponsorshipsList.innerHTML = '';
			
			// Format each sponsorship
			userSponsorships.forEach(sponsorship => {
				const token = sponsorship.tokenData;
				const symbol = token.baseToken?.symbol || token.symbol || 'UNKNOWN';
				const timeRemaining = this.formatTimeRemaining(sponsorship.timeRemaining);
				const sizeMultiplier = sponsorship.sizeMultiplier.toFixed(1) + 'x';
				
				const sponsorshipItem = document.createElement('div');
				sponsorshipItem.style.padding = '10px';
				sponsorshipItem.style.marginBottom = '10px';
				sponsorshipItem.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
				sponsorshipItem.style.borderRadius = '4px';
				sponsorshipItem.style.border = '1px solid rgba(255, 215, 0, 0.3)';
				
				sponsorshipItem.innerHTML = `
					<div><strong>${symbol}</strong></div>
					<div>Size Boost: ${sizeMultiplier}</div>
					<div>Time Remaining: ${timeRemaining}</div>
				`;
				
				sponsorshipsList.appendChild(sponsorshipItem);
			});
		} else {
			sponsorshipsSection.style.display = 'none';
		}
	}
	
	/**
	 * Format time remaining for display
	 * @param {number} milliseconds Time remaining in milliseconds
	 * @returns {string} Formatted time string
	 */
	formatTimeRemaining(milliseconds) {
		const hours = Math.floor(milliseconds / (1000 * 60 * 60));
		const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
		
		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else {
			return `${minutes}m`;
		}
	}
	
	/**
	 * Sponsor the selected token with real payment processing
	 */
	async sponsorSelectedToken() {
		if (!this.selectedToken || !this.userAddress) {
			this.utils.showTemporaryMessage('Please select a token and connect your wallet first.');
			return;
		}
		
		try {
			// Get sponsorship details
			const amountInput = document.querySelector('input[type="number"]');
			const amount = parseFloat(amountInput?.value || '0.1');
			
			if (isNaN(amount) || amount < 0.1) {
				this.utils.showTemporaryMessage('Minimum sponsorship amount is 0.1 SOL.');
				return;
			}
			
			// Check if this is for time extension or size increase
			const extendTime = document.getElementById('option-time')?.checked || false;
			
			// Process payment (currently simulated)
			this.utils.showTemporaryMessage(`Processing ${amount} SOL payment...`);
			
			// Use wallet service to process payment
			const paymentResult = await this.walletService.simulatePayment(amount);
			
			if (!paymentResult || !paymentResult.success) {
				throw new Error('Payment failed');
			}
			
			// Add sponsorship
			const result = this.sponsorService.sponsorToken(
				this.selectedToken,
				this.userAddress,
				amount,
				extendTime
			);
			
			// Show success message
			const symbol = this.selectedToken.baseToken?.symbol || this.selectedToken.symbol;
			
			if (extendTime) {
				this.utils.showTemporaryMessage(`Extended sponsorship time for ${symbol} by ${(amount / 0.1) * 6} hours!`);
			} else {
				this.utils.showTemporaryMessage(`Increased size boost for ${symbol}!`);
			}
			
			// Update user's sponsorships
			this.showUserSponsorships();
			
			// Reset form
			amountInput.value = '0.1';
			document.getElementById('option-size').checked = true;
			
			// Dispatch event to update token visuals
			document.dispatchEvent(new CustomEvent('token-sponsorship-updated', {
				detail: {
					tokenId: this.sponsorService.createTokenId(
						this.selectedToken.chainId,
						this.selectedToken.tokenAddress
					),
					sponsorships: result
				}
			}));
		} catch (error) {
			console.error('Error sponsoring token:', error);
			this.utils.showTemporaryMessage(`Error: ${error.message}`);
		}
	}
	
	/**
	 * Show the sponsored tokens list
	 */
	showSponsoredTokensList() {
		// Get all sponsored tokens
		const sponsoredTokens = this.sponsorService.getAllSponsoredTokens();
		
		// Create modal for displaying sponsored tokens
		const modal = document.createElement('div');
		modal.style.position = 'fixed';
		modal.style.zIndex = '1001';
		modal.style.left = '50%';
		modal.style.top = '50%';
		modal.style.transform = 'translate(-50%, -50%)';
		modal.style.width = '80%';
		modal.style.maxWidth = '600px';
		modal.style.backgroundColor = 'rgba(10, 20, 30, 0.95)';
		modal.style.color = 'white';
		modal.style.borderRadius = '8px';
		modal.style.padding = '20px';
		modal.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
		modal.style.border = '1px solid rgba(255, 215, 0, 0.3)';
		modal.style.backdropFilter = 'blur(5px)';
		modal.style.overflowY = 'auto';
		modal.style.maxHeight = '80%';
		
		// Create header
		const header = document.createElement('h2');
		header.textContent = 'Currently Sponsored Tokens';
		header.style.marginTop = '0';
		header.style.color = '#FFD700';
		
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
			document.body.removeChild(modal);
		});
		
		// Create token list
		const tokenList = document.createElement('div');
		
		if (sponsoredTokens.length === 0) {
			tokenList.innerHTML = '<p>No tokens are currently sponsored.</p>';
		} else {
			sponsoredTokens.forEach(sponsoredToken => {
				const token = sponsoredToken.tokenData;
				const symbol = token.baseToken?.symbol || token.symbol || 'UNKNOWN';
				const sizeMultiplier = sponsoredToken.sizeMultiplier.toFixed(1) + 'x';
				const sponsorCount = sponsoredToken.activeSponsorships.length;
				
				const tokenItem = document.createElement('div');
				tokenItem.style.padding = '10px';
				tokenItem.style.marginBottom = '10px';
				tokenItem.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
				tokenItem.style.borderRadius = '4px';
				tokenItem.style.border = '1px solid rgba(255, 215, 0, 0.3)';
				tokenItem.style.display = 'flex';
				tokenItem.style.alignItems = 'center';
				
				// Gold star icon
				const starIcon = document.createElement('div');
				starIcon.textContent = '⭐';
				starIcon.style.fontSize = '24px';
				starIcon.style.marginRight = '15px';
				
				// Token info
				const tokenInfo = document.createElement('div');
				tokenInfo.innerHTML = `
					<div><strong>${symbol}</strong></div>
					<div>Size Boost: ${sizeMultiplier}</div>
					<div>Sponsored by ${sponsorCount} user${sponsorCount !== 1 ? 's' : ''}</div>
				`;
				
				tokenItem.appendChild(starIcon);
				tokenItem.appendChild(tokenInfo);
				tokenList.appendChild(tokenItem);
			});
		}
		
		// Add elements to modal
		modal.appendChild(closeButton);
		modal.appendChild(header);
		modal.appendChild(tokenList);
		
		// Add modal to page
		document.body.appendChild(modal);
	}
	
	/**
	 * Show the sponsorship modal
	 */
	showSponsorModal() {
		this.modalElement.style.display = 'block';
		this.isModalOpen = true;
	}
	
	/**
	 * Close the sponsorship modal
	 */
	closeSponsorModal() {
		this.modalElement.style.display = 'none';
		this.isModalOpen = false;
	}
}