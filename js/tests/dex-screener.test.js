/**
 * Unit tests for DexScreener module
 */

import { DexScreenerManager } from '../dex-screener.js';

describe('DexScreenerManager', () => {
	let dexScreenerManager;
	let fetchMock;
	let originalFetch;
	
	// Mock token profile data
	const mockTokenProfiles = [
		{
			url: 'https://example.com/token1',
			chainId: 'ethereum',
			tokenAddress: '0x1234567890abcdef',
			icon: 'https://example.com/icon1.png'
		},
		{
			url: 'https://example.com/token2',
			chainId: 'solana',
			tokenAddress: 'SOL123456789',
			icon: 'https://example.com/icon2.png'
		}
	];
	
	// Mock token pairs data
	const mockPairsData1 = [
		{
			pairAddress: 'pair1',
			baseToken: { address: '0x1234567890abcdef', symbol: 'TKN1' },
			quoteToken: { address: '0xUSDC', symbol: 'USDC' },
			priceUsd: '1.23',
			marketCap: 10000000,
			liquidity: { usd: 5000000 },
			volume: { h24: 1000000 },
			priceChange: { h24: 5.2 }
		}
	];
	
	const mockPairsData2 = [
		{
			pairAddress: 'pair2',
			baseToken: { address: 'SOL123456789', symbol: 'TKN2' },
			quoteToken: { address: 'USDC', symbol: 'USDC' },
			priceUsd: '2.34',
			marketCap: 20000000,
			liquidity: { usd: 8000000 },
			volume: { h24: 3000000 },
			priceChange: { h24: -2.1 }
		}
	];
	
	beforeEach(() => {
		// Save original fetch
		originalFetch = global.fetch;
		
		// Create a mock fetch function
		fetchMock = jest.fn((url) => {
			if (url === 'https://api.dexscreener.com/token-profiles/latest/v1') {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockTokenProfiles)
				});
			} else if (url === 'https://api.dexscreener.com/token-pairs/v1/ethereum/0x1234567890abcdef') {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockPairsData1)
				});
			} else if (url === 'https://api.dexscreener.com/token-pairs/v1/solana/SOL123456789') {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockPairsData2)
				});
			}
			
			return Promise.resolve({
				ok: false,
				status: 404
			});
		});
		
		// Replace global fetch with mock
		global.fetch = fetchMock;
		
		// Initialize DexScreenerManager
		dexScreenerManager = new DexScreenerManager();
		
		// Mock DOM elements
		document.body.innerHTML = '';
		const contentDiv = document.createElement('div');
		contentDiv.id = 'token-list-content';
		document.body.appendChild(contentDiv);
		
		const modalDiv = document.createElement('div');
		modalDiv.id = 'token-list-modal';
		modalDiv.style.display = 'none';
		document.body.appendChild(modalDiv);
		
		const overlayDiv = document.createElement('div');
		overlayDiv.id = 'token-list-overlay';
		overlayDiv.style.display = 'none';
		document.body.appendChild(overlayDiv);
	});
	
	afterEach(() => {
		// Restore original fetch
		global.fetch = originalFetch;
		
		// Clean up DOM
		document.body.innerHTML = '';
	});
	
	test('fetches token profiles correctly', async () => {
		const profiles = await dexScreenerManager.fetchLatestTokenProfiles();
		
		expect(fetchMock).toHaveBeenCalledWith('https://api.dexscreener.com/token-profiles/latest/v1');
		expect(profiles).toEqual(mockTokenProfiles);
		expect(profiles.length).toBe(2);
	});
	
	test('fetches token market data correctly', async () => {
		const profiles = await dexScreenerManager.fetchLatestTokenProfiles();
		const tokenData = await dexScreenerManager.fetchTokenMarketData(profiles);
		
		expect(fetchMock).toHaveBeenCalledWith('https://api.dexscreener.com/token-pairs/v1/ethereum/0x1234567890abcdef');
		expect(fetchMock).toHaveBeenCalledWith('https://api.dexscreener.com/token-pairs/v1/solana/SOL123456789');
		
		expect(tokenData.length).toBe(2);
		expect(tokenData[0].marketData).toBeDefined();
		expect(tokenData[0].marketData.marketCap).toBe(20000000); // Sorted by market cap desc
		expect(tokenData[1].marketData.marketCap).toBe(10000000);
	});
	
	test('calculates token size based on market cap', async () => {
		const profiles = await dexScreenerManager.fetchLatestTokenProfiles();
		const tokenData = await dexScreenerManager.fetchTokenMarketData(profiles);
		
		// Get the two tokens after sorting
		const largerToken = tokenData[0]; // Market cap 20M
		const smallerToken = tokenData[1]; // Market cap 10M
		
		const largerSize = dexScreenerManager.calculateTokenSize(largerToken);
		const smallerSize = dexScreenerManager.calculateTokenSize(smallerToken);
		
		// The larger market cap should result in a larger size
		expect(largerSize).toBeGreaterThan(smallerSize);
		
		// Both sizes should be within the min/max range (0.8-2.0)
		expect(largerSize).toBeGreaterThanOrEqual(0.8);
		expect(largerSize).toBeLessThanOrEqual(2.0);
		expect(smallerSize).toBeGreaterThanOrEqual(0.8);
		expect(smallerSize).toBeLessThanOrEqual(2.0);
	});
	
	test('creates token list UI elements', () => {
		dexScreenerManager.createTokenListUI();
		
		// Check that the modal, overlay and button were created
		expect(document.body.querySelector('#token-list-modal')).toBeTruthy();
		expect(document.body.querySelector('#token-list-overlay')).toBeTruthy();
		expect(document.body.querySelector('button')).toBeTruthy();
	});
	
	test('formats market cap values correctly', () => {
		expect(dexScreenerManager.formatMarketCap(null)).toBe('—');
		expect(dexScreenerManager.formatMarketCap(0)).toBe('—');
		expect(dexScreenerManager.formatMarketCap(1234)).toBe('$1234.00');
		expect(dexScreenerManager.formatMarketCap(12345)).toBe('$12.35K');
		expect(dexScreenerManager.formatMarketCap(1234567)).toBe('$1.23M');
		expect(dexScreenerManager.formatMarketCap(1234567890)).toBe('$1.23B');
	});
	
	test('getTokenByIndex returns correct token', async () => {
		const profiles = await dexScreenerManager.fetchLatestTokenProfiles();
		await dexScreenerManager.fetchTokenMarketData(profiles);
		
		const token0 = dexScreenerManager.getTokenByIndex(0);
		const token1 = dexScreenerManager.getTokenByIndex(1);
		const tokenInvalid = dexScreenerManager.getTokenByIndex(99);
		
		expect(token0).toBeDefined();
		expect(token1).toBeDefined();
		expect(tokenInvalid).toBeNull();
		
		// Due to sorting by market cap, the second mock token should be first
		expect(token0.tokenAddress).toBe('SOL123456789');
		expect(token1.tokenAddress).toBe('0x1234567890abcdef');
	});
}); 