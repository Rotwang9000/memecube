/**
 * Unit tests for the TagPhysics system
 */

import * as THREE from 'three';
import { TagPhysics } from './tag-physics.js';

/**
 * Run tests for the TagPhysics system
 */
export function runTagPhysicsTests() {
	console.log('%c--- Running TagPhysics Tests ---', 'font-weight: bold; color: #0066cc;');
	
	// Create a scene for testing
	const scene = new THREE.Scene();
	
	// Run all tests
	testInitialization(scene);
	testTagAddition(scene);
	testCollisionDetection(scene);
	testForceApplication(scene);
	testCentralAttraction(scene);
	testTagResize(scene);
	
	console.log('%c--- TagPhysics Tests Complete ---', 'font-weight: bold; color: #00cc66;');
}

/**
 * Test the initialization of the physics system
 */
function testInitialization(scene) {
	console.log('Test: Initialization');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Check properties
		if (!physics.parameters || !physics.tagData || !physics.center) {
			throw new Error('Physics system missing required properties');
		}
		
		// Check parameters
		const requiredParams = [
			'repulsionStrength', 'attractionStrength', 'velocityDamping',
			'minDistance', 'maxSpeed', 'centralAttraction'
		];
		
		for (const param of requiredParams) {
			if (physics.parameters[param] === undefined) {
				throw new Error(`Missing required parameter: ${param}`);
			}
		}
		
		console.log('✓ Initialization successful');
	} catch (error) {
		console.error('✗ Initialization failed:', error.message);
	}
}

/**
 * Test adding tags to the physics system
 */
function testTagAddition(scene) {
	console.log('Test: Tag Addition');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Create mock tag
		const mockTag = createMockTag('tag1');
		
		// Initialize tag in physics system
		physics.initializeTag(mockTag, false);
		
		// Check if tag data was stored
		if (!physics.tagData.has(mockTag.id)) {
			throw new Error('Tag data not stored in physics system');
		}
		
		const tagData = physics.tagData.get(mockTag.id);
		
		// Check tag data properties
		if (!tagData.velocity || !tagData.bbox || tagData.isSettled === undefined) {
			throw new Error('Tag data missing required properties');
		}
		
		// Test adding a new flying tag
		const newMockTag = createMockTag('tag2');
		physics.addNewTag(newMockTag, [mockTag]);
		
		// Check if new tag data was stored
		if (!physics.tagData.has(newMockTag.id)) {
			throw new Error('New tag data not stored in physics system');
		}
		
		const newTagData = physics.tagData.get(newMockTag.id);
		
		// Check if it's marked as new
		if (!newTagData.isNew) {
			throw new Error('New tag not marked as "isNew"');
		}
		
		// Check for entry position
		if (!newTagData.entryPosition) {
			throw new Error('New tag missing entry position');
		}
		
		console.log('✓ Tag addition successful');
	} catch (error) {
		console.error('✗ Tag addition failed:', error.message);
	}
}

/**
 * Test collision detection between tags
 */
function testCollisionDetection(scene) {
	console.log('Test: Collision Detection');
	
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
		
		// Check if boxes intersect
		const intersects = data1.bbox.intersectsBox(data2.bbox);
		if (!intersects) {
			throw new Error('Collision detection failed to detect overlapping tags');
		}
		
		// Test areBoxesClose function
		const areClose = physics.areBoxesClose(data1.bbox, data2.bbox, 0.5);
		if (!areClose) {
			throw new Error('areBoxesClose failed to detect nearby tags');
		}
		
		// Create non-overlapping tags
		const tag3 = createMockTag('tag3', 5, 5, 5); // Far from others
		physics.initializeTag(tag3);
		physics.updateBoundingBoxes([tag1, tag2, tag3]);
		const data3 = physics.tagData.get(tag3.id);
		
		// Check that distant boxes don't intersect
		const distantIntersects = data1.bbox.intersectsBox(data3.bbox);
		if (distantIntersects) {
			throw new Error('Collision detection incorrectly reporting intersection for distant tags');
		}
		
		console.log('✓ Collision detection successful');
	} catch (error) {
		console.error('✗ Collision detection failed:', error.message);
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
 * Test central attraction forces
 */
function testCentralAttraction(scene) {
	console.log('Test: Central Attraction');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Set a known center point
		physics.center.set(0, 0, 0);
		
		// Create tags at different distances from center
		const tag1 = createMockTag('tag1', 3, 0, 0);
		const tag2 = createMockTag('tag2', 6, 0, 0);
		
		// Initialize tags
		physics.initializeTag(tag1);
		physics.initializeTag(tag2);
		
		// Get tag data
		const data1 = physics.tagData.get(tag1.id);
		const data2 = physics.tagData.get(tag2.id);
		
		// Record initial velocities
		const initialVel1 = data1.velocity.clone();
		const initialVel2 = data2.velocity.clone();
		
		// Apply central forces
		physics.applyCentralForces([tag1, tag2], 0.016); // ~60fps
		
		// Check if velocities changed toward center
		if (initialVel1.equals(data1.velocity) || initialVel2.equals(data2.velocity)) {
			throw new Error('Central forces not applied');
		}
		
		// Verify farther tag gets stronger attraction
		const vel1Change = data1.velocity.clone().sub(initialVel1).length();
		const vel2Change = data2.velocity.clone().sub(initialVel2).length();
		
		if (vel2Change <= vel1Change) {
			throw new Error('Farther tag should receive stronger central attraction');
		}
		
		// Verify direction is toward center
		const toCenter1 = new THREE.Vector3().subVectors(physics.center, tag1.mesh.position).normalize();
		const toCenter2 = new THREE.Vector3().subVectors(physics.center, tag2.mesh.position).normalize();
		
		const dir1 = data1.velocity.clone().normalize();
		const dir2 = data2.velocity.clone().normalize();
		
		const dot1 = dir1.dot(toCenter1);
		const dot2 = dir2.dot(toCenter2);
		
		if (dot1 <= 0 || dot2 <= 0) {
			throw new Error('Central attraction should pull towards center');
		}
		
		console.log('✓ Central attraction successful');
	} catch (error) {
		console.error('✗ Central attraction failed:', error.message);
	}
}

/**
 * Test tag resizing
 */
function testTagResize(scene) {
	console.log('Test: Tag Resize');
	
	try {
		// Create physics system
		const physics = new TagPhysics(scene);
		
		// Create a tag
		const tag = createMockTag('tag1', 0, 0, 0);
		tag.mesh.scale.set(1, 1, 1);
		
		// Initialize tag
		physics.initializeTag(tag);
		
		// Get tag data
		const data = physics.tagData.get(tag.id);
		const initialMass = data.mass;
		data.isSettled = true; // Mark as settled
		
		// Resize the tag
		const newSize = 2.0;
		physics.handleTagResize(tag, newSize);
		
		// Check if mass was updated
		if (data.mass === initialMass) {
			throw new Error('Tag mass not updated after resize');
		}
		
		// Check if tag was marked as unsettled
		if (data.isSettled) {
			throw new Error('Tag should be marked as unsettled after resize');
		}
		
		// Check if velocity was adjusted
		if (data.velocity.lengthSq() === 0) {
			throw new Error('Tag should have non-zero velocity after resize');
		}
		
		console.log('✓ Tag resize successful');
	} catch (error) {
		console.error('✗ Tag resize failed:', error.message);
	}
}

/**
 * Create a mock tag object for testing
 */
function createMockTag(id, x = 0, y = 0, z = 0) {
	// Create geometry
	const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
	geometry.computeBoundingBox();
	
	// Create mesh
	const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
	const mesh = new THREE.Mesh(geometry, material);
	
	// Set position
	mesh.position.set(x, y, z);
	
	// Update matrices
	mesh.updateMatrix();
	mesh.updateMatrixWorld();
	
	// Create tag object
	return {
		id: id,
		mesh: mesh,
		name: `Test Tag ${id}`,
		url: `https://example.com/${id}`
	};
}

// Auto-run tests if directly loaded (for testing in console)
if (typeof window !== 'undefined' && window.autoRunTests) {
	runTagPhysicsTests();
} 