/**
 * Tag System Tests
 * 
 * This file contains tests for the tag cluster system
 * Run this in the browser by loading tests/tag-system.html
 */

// Mock THREE.js objects for testing
class MockScene {
	constructor() {
		this.children = [];
		this.add = (obj) => this.children.push(obj);
		this.remove = (obj) => {
			const index = this.children.indexOf(obj);
			if (index !== -1) this.children.splice(index, 1);
		};
	}
}

class MockCamera {
	constructor() {
		this.position = { x: 0, y: 0, z: 10 };
		this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
	}
}

// Import the tag system (this is a browser-based test)
import { TagsManager } from '../js/interactions/tag-cluster/tags.js';

// Test cases
const tests = {
	// Test tag creation
	async testTagCreation() {
		console.log('Running test: Tag Creation');
		
		// Create mock scene and camera
		const scene = new MockScene();
		const camera = new MockCamera();
		
		// Create tags manager
		const tagsManager = new TagsManager(scene, camera);
		
		// Wait for font to load (with timeout)
		let fontLoaded = false;
		setTimeout(() => { fontLoaded = true; }, 5000); // 5 second timeout
		
		while (!tagsManager.tagManager.fontLoaded && !fontLoaded) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		
		// Add a test tag
		const tag = await tagsManager.addTag('TEST', 'https://example.com', 1.0);
		
		// Verify tag was created properly
		console.assert(tag !== null, 'Tag should be created');
		console.assert(tag.name === '$TEST', 'Tag should have $ prefix');
		console.assert(tag.url === 'https://example.com', 'Tag should have correct URL');
		console.assert(tag.mesh !== undefined, 'Tag should have a mesh');
		console.assert(tag.mesh.scale.x === 1.0, 'Tag should have correct scale');
		
		// Verify tag is in tags array
		console.assert(tagsManager.tags.includes(tag), 'Tag should be in tags array');
		
		console.log('Tag creation test completed');
		return true;
	},
	
	// Test tag aging
	async testTagAging() {
		console.log('Running test: Tag Aging');
		
		// Create mock scene and camera
		const scene = new MockScene();
		const camera = new MockCamera();
		
		// Create tags manager
		const tagsManager = new TagsManager(scene, camera);
		
		// Wait for font to load (with timeout)
		let fontLoaded = false;
		setTimeout(() => { fontLoaded = true; }, 5000); // 5 second timeout
		
		while (!tagsManager.tagManager.fontLoaded && !fontLoaded) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		
		// Add test tags with staggered creation times
		const tag1 = await tagsManager.addTag('OLD', 'https://example.com/old', 1.0);
		tag1.creationTime = Date.now() - 3600000; // 1 hour old
		
		const tag2 = await tagsManager.addTag('NEW', 'https://example.com/new', 1.0);
		tag2.creationTime = Date.now(); // Just created
		
		// Initialize the tag age system
		tagsManager.initializeTagAgeSystem();
		
		// Sort by age
		tagsManager.sortTagsByAge();
		
		// Verify tags are sorted correctly (oldest first)
		console.assert(tagsManager.tags[0] === tag1, 'Oldest tag should be first');
		console.assert(tagsManager.tags[1] === tag2, 'Newest tag should be second');
		
		// Calculate size for different age positions
		const oldestSize = tagsManager.calculateSizeByAge(1.0, 0);
		const newestSize = tagsManager.calculateSizeByAge(1.0, 1);
		
		// Verify older tags are smaller
		console.assert(oldestSize < newestSize, 'Older tags should be smaller');
		
		console.log('Tag aging test completed');
		return true;
	},
	
	// Test random tag generation
	testRandomTag() {
		console.log('Running test: Random Tag Generation');
		
		// Create mock scene and camera
		const scene = new MockScene();
		const camera = new MockCamera();
		
		// Create tags manager
		const tagsManager = new TagsManager(scene, camera);
		
		// Generate a random tag
		const randomTag = tagsManager.generateRandomTag();
		
		// Verify random tag has expected properties
		console.assert(typeof randomTag.text === 'string', 'Random tag should have text');
		console.assert(randomTag.text.length > 0, 'Random tag text should not be empty');
		console.assert(typeof randomTag.url === 'string', 'Random tag should have URL');
		console.assert(randomTag.url.includes(randomTag.text.toLowerCase()), 'URL should include tag text');
		console.assert(typeof randomTag.size === 'number', 'Random tag should have size');
		console.assert(randomTag.size >= 0.5 && randomTag.size <= 1.5, 'Size should be in expected range');
		
		console.log('Random tag generation test completed');
		return true;
	}
};

// Run all tests
async function runTests() {
	console.log('Starting tag system tests...');
	
	for (const [name, testFn] of Object.entries(tests)) {
		try {
			const result = await testFn();
			console.log(`Test '${name}': ${result ? 'PASSED' : 'FAILED'}`);
		} catch (error) {
			console.error(`Test '${name}' failed with error:`, error);
		}
	}
	
	console.log('All tests completed');
}

// Execute tests when the page loads
window.addEventListener('DOMContentLoaded', runTests); 