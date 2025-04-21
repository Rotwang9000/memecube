/**
 * CoinGeckoProvider Unit Tests
 */

import { CoinGeckoProvider } from '../data-providers/CoinGeckoProvider.js';

describe('CoinGeckoProvider', () => {
	let provider;
	
	beforeEach(() => {
		// Create a new provider instance before each test
		provider = new CoinGeckoProvider();
		
		// Mock the fetch API
		global.fetch = jest.fn();
		
		// Create a mock response
		const mockResponse = {
			ok: true,
			json: jest.fn().mockResolvedValue([
				{
					id: 'bitcoin',
					symbol: 'btc',
					name: 'Bitcoin',
					current_price: 40000,
					market_cap: 750000000000,
					total_volume: 25000000000,
					image: 'https://example.com/btc.png',
					price_change_percentage_24h: 5.25,
					market_cap_rank: 1
				},
				{
					id: 'ethereum',
					symbol: 'eth',
					name: 'Ethereum',
					current_price: 2500,
					market_cap: 300000000000,
					total_volume: 15000000000,
					image: 'https://example.com/eth.png',
					price_change_percentage_24h: -2.1,
					market_cap_rank: 2
				}
			])
		};
		
		// Set up the mock to return the mock response
		global.fetch.mockResolvedValue(mockResponse);
	});
	
	afterEach(() => {
		// Clean up after each test
		jest.clearAllMocks();
	});
	
	test('initializes with correct defaults', () => {
		expect(provider.apiEndpoint).toBe('https://api.coingecko.com/api/v3');
		expect(provider.coinListEndpoint).toContain('/coins/markets');
		expect(provider.fetchInterval).toBe(60000);
		expect(provider.tokenData).toEqual([]);
	});
	
	test('refreshData fetches and processes token data', async () => {
		const data = await provider.refreshData();
		
		// Check the fetch was called with correct parameters
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/coins/markets?'));
		
		// Check the processed data
		expect(data.length).toBe(2);
		expect(data[0].baseToken.symbol).toBe('BTC');
		expect(data[0].baseToken.name).toBe('Bitcoin');
		expect(data[0].priceUsd).toBe('40000');
		expect(data[0].marketCap).toBe('750000000000');
		expect(data[0].dataSource).toBe('coingecko');
	});
	
	test('getTopTokens returns the top N tokens', async () => {
		// First refresh the data
		await provider.refreshData();
		
		// Get top 1 token
		const topToken = await provider.getTopTokens(1);
		expect(topToken.length).toBe(1);
		expect(topToken[0].baseToken.symbol).toBe('BTC');
		
		// Get all tokens (default limit of 10)
		const allTokens = await provider.getTopTokens();
		expect(allTokens.length).toBe(2);
	});
	
	test('calculateTokenSize returns correct size based on metrics', () => {
		const token1 = {
			baseToken: { symbol: 'BTC' },
			volume: { h24: '25000000000' },
			priceChange: { h24: '5.25' },
			rank: 1
		};
		
		const token2 = {
			baseToken: { symbol: 'SMALL' },
			volume: { h24: '1000000' },
			priceChange: { h24: '1.0' },
			rank: 100
		};
		
		const size1 = provider.calculateTokenSize(token1);
		const size2 = provider.calculateTokenSize(token2);
		
		// Top ranked token should have larger size
		expect(size1).toBeGreaterThan(size2);
		
		// Sizes should be within the expected range
		expect(size1).toBeGreaterThanOrEqual(0.5);
		expect(size1).toBeLessThanOrEqual(2.0);
		expect(size2).toBeGreaterThanOrEqual(0.5);
		expect(size2).toBeLessThanOrEqual(2.0);
	});
	
	test('formatMarketCap formats market cap correctly', () => {
		expect(provider.formatMarketCap(null)).toBe('N/A');
		expect(provider.formatMarketCap(0)).toBe('N/A');
		expect(provider.formatMarketCap(123.45)).toBe('$123.45');
		expect(provider.formatMarketCap(1234.56)).toBe('$1.23K');
		expect(provider.formatMarketCap(1234567.89)).toBe('$1.23M');
		expect(provider.formatMarketCap(1234567890.12)).toBe('$1.23B');
	});
	
	test('triggers callbacks when data is updated', async () => {
		// Create a mock callback
		const mockCallback = jest.fn();
		
		// Register the callback
		provider.registerUpdateCallback(mockCallback);
		
		// Refresh the data
		await provider.refreshData();
		
		// Check the callback was called with the processed data
		expect(mockCallback).toHaveBeenCalledTimes(1);
		expect(mockCallback).toHaveBeenCalledWith(provider.tokenData);
		
		// Unregister the callback
		provider.unregisterUpdateCallback(mockCallback);
		
		// Refresh the data again
		await provider.refreshData();
		
		// The callback should still have been called only once
		expect(mockCallback).toHaveBeenCalledTimes(1);
	});
}); 