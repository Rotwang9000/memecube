/**
 * Unit tests for TagPhysics
 * 
 * Tests the core physics functionality to ensure proper tag positioning,
 * collision handling, and dynamics.
 */

import * as THREE from '../lib/three.module.js';
import { TagPhysics } from './tag-physics.js';

/**
 * Create a mock tag object for testing
 */
function createMockTag(id, x = 0, y = 0, z = 0) {
	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.MeshBasicMaterial({ color: 0xffffff })
	);
	mesh.position.set(x, y, z);
	
	return {
		id,
		mesh,
		visualImportance: 1.0
	};
}

/**
 * Create a scene for testing
 */
function createMockScene() {
	return {
		add: function() {},
		remove: function() {}
	};
}

/**
 * Run all tests
 */
function runTagPhysicsTests() {
	console.log('Running TagPhysics tests...');
	
	const scene = createMockScene();
	
	testInitialization(scene);
	testTagLifecycle(scene);
	testForceApplication(scene);
	testCentralAttraction(scene);
	testTagResizing(scene);
}

/**
 * Test physics system initialization
 */
function testInitialization(scene) {
	console.log('Test: Initialization');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Check if face directions created
		if (!physics.faceDirections || physics.faceDirections.length !== 6) {
			throw new Error('Face directions not initialized correctly');
		}
		
		// Check if cube center initialized
		if (!physics.cubeCentre || !(physics.cubeCentre instanceof THREE.Vector3)) {
			throw new Error('Cube center not initialized correctly');
		}
		
		console.log('✓ Initialization successful');
	} catch (error) {
		console.error('✗ Initialization failed:', error.message);
	}
}

/**
 * Test tag lifecycle (add, update, remove)
 */
function testTagLifecycle(scene) {
	console.log('Test: Tag Lifecycle');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Create test tag
		const tag = createMockTag('test1', 0, 0, 0);
		
		// Add tag
		physics.initializeTag(tag);
		
		// Check if tag data created
		if (!physics.tagData.has(tag.id)) {
			throw new Error('Tag data not created on initialization');
		}
		
		// Test addNewTag
		const newTag = createMockTag('test2', 0, 0, 0);
		physics.addNewTag(newTag, [tag]);
		
		// Verify tag was added
		if (!physics.tagData.has(newTag.id)) {
			throw new Error('New tag not added correctly');
		}
		
		// Verify tag marked as new
		const newTagData = physics.tagData.get(newTag.id);
		if (!newTagData.isNew) {
			throw new Error('New tag not marked as new');
		}
		
		// Remove tag
		const removed = physics.removeTag(tag.id);
		
		// Verify removal
		if (physics.tagData.has(tag.id) || !removed) {
			throw new Error('Tag removal failed');
		}
		
		console.log('✓ Tag lifecycle successful');
	} catch (error) {
		console.error('✗ Tag lifecycle failed:', error.message);
	}
}

/**
 * Test force application between colliding tags
 */
function testForceApplication(scene) {
	console.log('Test: Force Application');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Create two overlapping tags
		const tag1 = createMockTag('tag1', 0, 0, 0);
		const tag2 = createMockTag('tag2', 0.1, 0, 0); // Overlapping with tag1
		
		// Initialize tags
		physics.initializeTag(tag1);
		physics.initializeTag(tag2);
		
		// Update bounding boxes
		physics.updateBoundingBoxes([tag1, tag2]);
		
		// Get tag data
		const data1 = physics.tagData.get(tag1.id);
		const data2 = physics.tagData.get(tag2.id);
		
		// Record initial velocities
		const initialVel1 = data1.velocity.clone();
		const initialVel2 = data2.velocity.clone();
		
		// Apply repulsion forces
		physics.applyRepulsionForces([tag1, tag2], 0.016); // ~60fps
		
		// Check if velocities changed
		if (initialVel1.equals(data1.velocity) || initialVel2.equals(data2.velocity)) {
			throw new Error('Repulsion forces not applied correctly');
		}
		
		// Check if forces are in opposite directions
		const dot = data1.velocity.dot(data2.velocity);
		if (dot >= 0) {
			throw new Error('Repulsion forces should push tags in opposite directions');
		}
		
		console.log('✓ Force application successful');
	} catch (error) {
		console.error('✗ Force application failed:', error.message);
	}
}

/**
 * Test central attraction keeping the structure together
 */
function testCentralAttraction(scene) {
	console.log('Test: Central Attraction');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Create test tags at different locations
		const tags = [
			createMockTag('central', 0, 0, 0),
			createMockTag('right', 5, 0, 0),
			createMockTag('up', 0, 5, 0),
			createMockTag('far', 0, 0, 5)
		];
		
		// Initialize tags
		tags.forEach(tag => physics.initializeTag(tag));
		
		// Update cube structure
		physics.updateCubeStructure(tags);
		
		// Apply cohesion forces
		physics.applyCohesionForces(tags, 0.1);
		
		// Check if outlying tags have velocity toward center
		const rightData = physics.tagData.get('right');
		const rightToCenter = new THREE.Vector3(-1, 0, 0);
		const rightAlign = rightData.velocity.clone().normalize().dot(rightToCenter);
		
		if (rightAlign < 0.5) {
			throw new Error('Right tag not attracted toward center correctly');
		}
		
		// Check cube size calculation
		if (physics.cubeSize <= 1.0) {
			throw new Error('Cube size not calculated correctly based on tag positions');
		}
		
		console.log('✓ Central attraction successful');
	} catch (error) {
		console.error('✗ Central attraction failed:', error.message);
	}
}

/**
 * Test tag resizing effects
 */
function testTagResizing(scene) {
	console.log('Test: Tag Resizing');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Create test tag
		const tag = createMockTag('resize_test', 1, 1, 1);
		tag.mesh.scale.set(1, 1, 1);
		
		// Initialize tag
		physics.initializeTag(tag);
		
		// Get initial mass
		const initialMass = physics.tagData.get(tag.id).mass;
		
		// Resize tag to be larger
		physics.handleTagResize(tag, 2.0);
		
		// Check if resize transition started
		const data = physics.tagData.get(tag.id);
		
		if (data.size.target !== 2.0) {
			throw new Error('Resize transition not set up correctly');
		}
		
		if (data.size.transitionProgress >= 1.0) {
			throw new Error('Resize transition progress should start at 0');
		}
		
		// Fast-forward resize animation
		data.size.transitionProgress = 1.0;
		tag.mesh.scale.set(2.0, 2.0, 2.0);
		physics.updateTagSize(tag, data, 0.1);
		
		// Update cube structure with the new tag size
		physics.updateBoundingBoxes([tag]);
		
		// Calculate new mass
		const newMass = physics.calculateMass(tag);
		
		// Mass should increase with size (roughly by scale^3)
		if (newMass <= initialMass) {
			throw new Error('Mass should increase with tag size');
		}
		
		console.log('✓ Tag resizing successful');
	} catch (error) {
		console.error('✗ Tag resizing failed:', error.message);
	}
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
	window.addEventListener('DOMContentLoaded', () => {
		// Only run tests if specifically requested
		if (window.location.search.includes('run_tests=true')) {
			runTagPhysicsTests();
		}
	});
} 