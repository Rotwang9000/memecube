/**
 * Unit tests for TokenCube module
 */

import { TokenCube } from '../token-cube.js';
import * as THREE from 'three';

// Mock THREE.js objects
jest.mock('three', () => {
	const mockGeometry = {
		dispose: jest.fn()
	};
	
	const mockMaterial = {
		dispose: jest.fn()
	};
	
	const mockMesh = {
		position: {
			set: jest.fn(),
			copy: jest.fn(),
			clone: jest.fn(() => ({ x: 0, y: 0, z: 0 }))
		},
		scale: {
			set: jest.fn()
		},
		geometry: mockGeometry,
		add: jest.fn()
	};
	
	const mockVector3 = jest.fn().mockImplementation(() => ({
		x: 0, y: 0, z: 0,
		normalize: jest.fn().mockReturnThis(),
		multiplyScalar: jest.fn().mockReturnThis(),
		copy: jest.fn(),
		clone: jest.fn().mockReturnThis()
	}));
	
	return {
		Group: jest.fn().mockImplementation(() => ({
			add: jest.fn(),
			remove: jest.fn(),
			visible: true
		})),
		Vector3: mockVector3,
		BoxGeometry: jest.fn(),
		SphereGeometry: jest.fn().mockReturnValue(mockGeometry),
		LineBasicMaterial: jest.fn().mockReturnValue(mockMaterial),
		MeshStandardMaterial: jest.fn().mockReturnValue(mockMaterial),
		LineSegments: jest.fn().mockReturnValue(mockMesh),
		WireframeGeometry: jest.fn(),
		Mesh: jest.fn().mockReturnValue(mockMesh),
		MathUtils: {
			randFloatSpread: jest.fn().mockReturnValue(5)
		},
		Color: jest.fn()
	};
});

describe('TokenCube', () => {
	let tokenCube;
	let mockScene;
	let mockCamera;
	
	// Sample token data for testing
	const mockTokenData = [
		{
			baseToken: { 
				symbol: 'TKN1',
				name: 'Token One'
			},
			chainId: 'ethereum',
			marketCap: 10000000
		},
		{
			baseToken: { 
				symbol: 'TKN2',
				name: 'Token Two'
			},
			chainId: 'solana',
			marketCap: 100000000
		}
	];
	
	beforeEach(() => {
		// Create mocks for scene and camera
		mockScene = {
			add: jest.fn()
		};
		
		mockCamera = {};
		
		// Create TokenCube instance
		tokenCube = new TokenCube(mockScene, mockCamera);
		
		// Mock Date.now for consistent testing
		jest.spyOn(Date, 'now').mockImplementation(() => 1000);
	});
	
	afterEach(() => {
		jest.restoreAllMocks();
	});
	
	test('creates cube wireframe on initialization', () => {
		expect(tokenCube.wireframe).toBeDefined();
		expect(tokenCube.cubeGroup).toBeDefined();
		expect(mockScene.add).toHaveBeenCalled();
	});
	
	test('calculates token size based on market cap', () => {
		const smallSize = tokenCube.calculateTokenSize(100000); // $100K
		const mediumSize = tokenCube.calculateTokenSize(10000000); // $10M
		const largeSize = tokenCube.calculateTokenSize(1000000000); // $1B
		
		// Larger market caps should result in larger sizes
		expect(largeSize).toBeGreaterThan(mediumSize);
		expect(mediumSize).toBeGreaterThan(smallSize);
		
		// Sizes should be within defined range
		expect(smallSize).toBeGreaterThanOrEqual(tokenCube.minTokenSize);
		expect(largeSize).toBeLessThanOrEqual(tokenCube.maxTokenSize);
	});
	
	test('adds tokens correctly', () => {
		const token = tokenCube.addToken(mockTokenData[0]);
		
		expect(token).toBeDefined();
		expect(token.symbol).toBe('TKN1');
		expect(token.animating).toBe(true);
		expect(token.entering).toBe(true);
		expect(token.exiting).toBe(false);
		
		// Check if token is stored in arrays and maps
		expect(tokenCube.tokens.length).toBe(1);
		expect(tokenCube.animatingTokens.length).toBe(1);
		expect(tokenCube.tokenMeshes['TKN1']).toBeDefined();
	});
	
	test('updates tokens correctly', () => {
		// First add a token
		const token = tokenCube.addToken(mockTokenData[0]);
		
		// Update the token with new data
		const updatedData = {
			...mockTokenData[0],
			marketCap: 20000000 // Double the market cap
		};
		
		// Set a last position change time to ensure position update
		token.lastPositionChange = 0;
		
		// Update the token
		tokenCube.updateToken(token, updatedData);
		
		// Token should be marked for animation
		expect(token.animating).toBe(true);
		expect(token.targetSize).toBeDefined();
		expect(token.initialSize).toBe(token.size);
		expect(token.marketCap).toBe(20000000);
	});
	
	test('removes tokens correctly', () => {
		// Mock setTimeout to execute immediately
		jest.useFakeTimers();
		
		// Add a token then remove it
		const token = tokenCube.addToken(mockTokenData[0]);
		tokenCube.removeToken(token);
		
		// Token should be marked for exit animation
		expect(token.exiting).toBe(true);
		expect(token.entering).toBe(false);
		expect(token.animating).toBe(true);
		
		// Fast forward time to trigger removal
		jest.runAllTimers();
		
		// Token should be removed from arrays
		expect(tokenCube.tokens.length).toBe(0);
		expect(tokenCube.animatingTokens.length).toBe(0);
		expect(tokenCube.tokenMeshes['TKN1']).toBeUndefined();
	});
	
	test('updates token cube with new data', () => {
		// Add spy methods to track method calls
		const addSpy = jest.spyOn(tokenCube, 'addToken');
		const removeSpy = jest.spyOn(tokenCube, 'removeToken');
		const updateSpy = jest.spyOn(tokenCube, 'updateToken');
		
		// Update with new data
		tokenCube.updateTokens(mockTokenData);
		
		// Should have added both tokens
		expect(addSpy).toHaveBeenCalledTimes(2);
		expect(tokenCube.tokens.length).toBe(2);
		
		// Update with modified data (one removed, one updated, one new)
		const newTokenData = [
			// TKN1 is removed
			{
				baseToken: { 
					symbol: 'TKN2',
					name: 'Token Two Updated'
				},
				chainId: 'solana',
				marketCap: 200000000 // Increased market cap
			},
			{
				baseToken: { 
					symbol: 'TKN3',
					name: 'Token Three'
				},
				chainId: 'bsc',
				marketCap: 5000000
			}
		];
		
		// Reset the spies
		addSpy.mockClear();
		removeSpy.mockClear();
		updateSpy.mockClear();
		
		// Update with new data
		tokenCube.updateTokens(newTokenData);
		
		// Should have called each method appropriately
		expect(addSpy).toHaveBeenCalledTimes(1); // Added TKN3
		expect(removeSpy).toHaveBeenCalledTimes(1); // Removed TKN1
		expect(updateSpy).toHaveBeenCalledTimes(1); // Updated TKN2
	});
	
	test('updates animations correctly', () => {
		// Add a token
		const token = tokenCube.addToken(mockTokenData[0]);
		
		// Simulate animation in progress
		token.initialPosition = new THREE.Vector3(0, 0, 0);
		token.targetPosition = new THREE.Vector3(1, 1, 1);
		token.positionAnimationStart = 500; // 500ms ago
		
		// Update animation with 100ms delta time
		tokenCube.update(0.1);
		
		// Animation should still be in progress (500ms elapsed out of 2000ms)
		expect(tokenCube.animatingTokens.length).toBe(1);
		
		// Simulate animation complete
		jest.spyOn(Date, 'now').mockImplementation(() => 3000); // 2500ms later
		
		// Update animation again
		tokenCube.update(0.1);
		
		// Animation should be complete
		expect(tokenCube.animatingTokens.length).toBe(0);
		expect(token.animating).toBe(false);
	});
	
	test('applies easing to animations', () => {
		// Test the easing function
		expect(tokenCube.easeAnimation(0)).toBe(0);
		expect(tokenCube.easeAnimation(1)).toBe(1);
		
		// Middle values should be eased (not linear)
		const mid = tokenCube.easeAnimation(0.5);
		expect(mid).toBeGreaterThan(0.5); // Ease out should be > linear at midpoint
	});
}); 