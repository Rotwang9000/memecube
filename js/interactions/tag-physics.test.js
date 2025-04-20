/**
 * Tag Physics Test Suite
 * Tests the physics system for the tag cluster
 */

import * as THREE from 'three';
import { TagPhysics } from './tag-physics.js';

/**
 * Run tests for the TagPhysics system
 */
export function runTagPhysicsTests() {
	console.log('Running TagPhysics tests...');
	let passing = 0;
	let failing = 0;
	
	// Create mock scene
	const mockScene = new THREE.Scene();
	
	// Test cases
	const tests = [
		// Basic initialization
		() => {
			console.log('\nTest: Basic Initialization');
			const physics = new TagPhysics(mockScene);
			const result = physics !== null && physics !== undefined;
			console.assert(result, 'Physics system should initialize');
			logTestResult(result);
			return result;
		},
		
		// Default options
		() => {
			console.log('\nTest: Default Options');
			const physics = new TagPhysics(mockScene);
			const hasOptions = physics.options !== null && physics.options !== undefined;
			console.assert(hasOptions, 'Physics should have default options');
			
			// Check specific options
			const hasTagSpacing = physics.options.tagSpacing !== undefined;
			console.assert(hasTagSpacing, 'Should have tagSpacing option');
			
			const hasDamping = physics.options.damping !== undefined;
			console.assert(hasDamping, 'Should have damping option');
			
			const result = hasOptions && hasTagSpacing && hasDamping;
			logTestResult(result);
			return result;
		},
		
		// Face usage tracking
		() => {
			console.log('\nTest: Face Usage Tracking');
			const physics = new TagPhysics(mockScene);
			
			// Should have face usage object
			const hasFaceUsage = physics.faceUsage !== null && physics.faceUsage !== undefined;
			console.assert(hasFaceUsage, 'Should have faceUsage object');
			
			// Should track usage for each face
			const hasFrontFace = physics.faceUsage.front !== undefined;
			console.assert(hasFrontFace, 'Should track front face usage');
			
			const hasBackFace = physics.faceUsage.back !== undefined;
			console.assert(hasBackFace, 'Should track back face usage');
			
			const hasTopFace = physics.faceUsage.top !== undefined;
			console.assert(hasTopFace, 'Should track top face usage');
			
			const hasBottomFace = physics.faceUsage.bottom !== undefined;
			console.assert(hasBottomFace, 'Should track bottom face usage');
			
			const hasLeftFace = physics.faceUsage.left !== undefined;
			console.assert(hasLeftFace, 'Should track left face usage');
			
			const hasRightFace = physics.faceUsage.right !== undefined;
			console.assert(hasRightFace, 'Should track right face usage');
			
			const result = hasFaceUsage && hasFrontFace && hasBackFace && 
				hasTopFace && hasBottomFace && hasLeftFace && hasRightFace;
			
			logTestResult(result);
			return result;
		},
		
		// Test selectTargetFace
		() => {
			console.log('\nTest: Select Target Face');
			const physics = new TagPhysics(mockScene);
			
			// All faces should start with 0 usage
			Object.values(physics.faceUsage).forEach(usage => {
				console.assert(usage === 0, 'Face usage should start at 0');
			});
			
			// First selection should be deterministic if all faces have 0 usage
			const face1 = physics.selectTargetFace();
			console.assert(face1 !== null && face1 !== undefined, 'Should select a face');
			
			// Increment usage for that face
			physics.faceUsage[face1]++;
			
			// Second selection should not be the face we just used
			const face2 = physics.selectTargetFace();
			console.assert(face2 !== face1, 'Should not select the same face twice');
			
			const result = face1 !== null && face2 !== null && face1 !== face2;
			logTestResult(result);
			return result;
		},
		
		// Test calculate tag mass
		() => {
			console.log('\nTest: Calculate Tag Mass');
			const physics = new TagPhysics(mockScene);
			
			// Create mock tag
			const mockGeometry = new THREE.BoxGeometry(1, 1, 1);
			const mockMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
			const mockMesh = new THREE.Mesh(mockGeometry, mockMaterial);
			
			// Set scale
			mockMesh.scale.set(2, 2, 2);
			
			const mockTag = { id: 'test_tag', mesh: mockMesh };
			
			// Calculate mass
			const mass = physics.calculateTagMass(mockTag);
			
			// Mass should be proportional to volume (scale^3)
			console.assert(mass === 8, `Mass should be 8 for scale 2, got ${mass}`);
			
			// Test with different scale
			mockMesh.scale.set(3, 3, 3);
			const mass2 = physics.calculateTagMass(mockTag);
			console.assert(mass2 === 27, `Mass should be 27 for scale 3, got ${mass2}`);
			
			const result = mass === 8 && mass2 === 27;
			logTestResult(result);
			return result;
		},
		
		// Test tag rotation
		() => {
			console.log('\nTest: Tag Rotation');
			const physics = new TagPhysics(mockScene);
			
			// Test rotation for each face
			const frontRotation = physics.getRotationForFace('front');
			const backRotation = physics.getRotationForFace('back');
			const leftRotation = physics.getRotationForFace('left');
			const rightRotation = physics.getRotationForFace('right');
			const topRotation = physics.getRotationForFace('top');
			const bottomRotation = physics.getRotationForFace('bottom');
			
			// Make sure each rotation is a quaternion
			const allQuaternions = 
				frontRotation instanceof THREE.Quaternion &&
				backRotation instanceof THREE.Quaternion &&
				leftRotation instanceof THREE.Quaternion &&
				rightRotation instanceof THREE.Quaternion &&
				topRotation instanceof THREE.Quaternion &&
				bottomRotation instanceof THREE.Quaternion;
			
			console.assert(allQuaternions, 'All rotations should be quaternions');
			
			// Make sure each face has a different rotation
			const frontBack = !quaternionsEqual(frontRotation, backRotation);
			const leftRight = !quaternionsEqual(leftRotation, rightRotation);
			const topBottom = !quaternionsEqual(topRotation, bottomRotation);
			
			console.assert(frontBack, 'Front and back should have different rotations');
			console.assert(leftRight, 'Left and right should have different rotations');
			console.assert(topBottom, 'Top and bottom should have different rotations');
			
			const result = allQuaternions && frontBack && leftRight && topBottom;
			logTestResult(result);
			return result;
		},
		
		// Test activation
		() => {
			console.log('\nTest: Tag Activation');
			const physics = new TagPhysics(mockScene);
			
			// Create physics data for a mock tag
			const tagId = 'test_tag_activation';
			physics.tags.set(tagId, {
				position: new THREE.Vector3(),
				velocity: new THREE.Vector3(),
				acceleration: new THREE.Vector3(),
				mass: 1,
				size: 1,
				activationTime: Date.now(),
				isActive: false,
				isEntering: false,
				face: 'front'
			});
			
			// Should not be in moving tags yet
			console.assert(!physics.movingTags.has(tagId), 'Tag should not be moving yet');
			
			// Activate
			physics.activateTag(tagId);
			
			// Should now be active and in moving tags
			const tagData = physics.tags.get(tagId);
			console.assert(tagData.isActive, 'Tag should be active');
			console.assert(physics.movingTags.has(tagId), 'Tag should be in moving tags');
			
			const result = tagData.isActive && physics.movingTags.has(tagId);
			logTestResult(result);
			return result;
		},
		
		// Test cleanup
		() => {
			console.log('\nTest: Cleanup');
			const physics = new TagPhysics(mockScene);
			
			// Add some test data
			physics.tags.set('test1', {});
			physics.tags.set('test2', {});
			physics.movingTags.add('test1');
			physics.collisionChain.set('test1', 'test2');
			
			// Set some face usage
			physics.faceUsage.front = 5;
			physics.faceUsage.back = 3;
			
			// Dispose
			physics.dispose();
			
			// Check if everything was cleared
			const tagsCleared = physics.tags.size === 0;
			console.assert(tagsCleared, 'Tags should be cleared');
			
			const movingTagsCleared = physics.movingTags.size === 0;
			console.assert(movingTagsCleared, 'Moving tags should be cleared');
			
			const collisionChainCleared = physics.collisionChain.size === 0;
			console.assert(collisionChainCleared, 'Collision chain should be cleared');
			
			const faceUsageReset = Object.values(physics.faceUsage).every(v => v === 0);
			console.assert(faceUsageReset, 'Face usage should be reset');
			
			const result = tagsCleared && movingTagsCleared && 
				collisionChainCleared && faceUsageReset;
			
			logTestResult(result);
			return result;
		}
	];
	
	// Run all tests
	tests.forEach(test => {
		try {
			const passed = test();
			if (passed) {
				passing++;
			} else {
				failing++;
			}
		} catch (error) {
			console.error('Test failed with error:', error);
			failing++;
		}
	});
	
	// Log summary
	console.log(`\n============ Test Results ============`);
	console.log(`Total: ${tests.length}, Passing: ${passing}, Failing: ${failing}`);
	
	// Return summary
	return {
		total: tests.length,
		passing,
		failing
	};
}

/**
 * Log test result with color coding
 * @param {boolean} passed - Whether the test passed
 */
function logTestResult(passed) {
	if (passed) {
		console.log('%c✓ PASS', 'color: green; font-weight: bold');
	} else {
		console.log('%c✗ FAIL', 'color: red; font-weight: bold');
	}
}

/**
 * Compare two quaternions for approximate equality
 * @param {THREE.Quaternion} q1 - First quaternion
 * @param {THREE.Quaternion} q2 - Second quaternion
 * @returns {boolean} - Whether the quaternions are approximately equal
 */
function quaternionsEqual(q1, q2) {
	const epsilon = 0.001;
	return (
		Math.abs(q1.x - q2.x) < epsilon &&
		Math.abs(q1.y - q2.y) < epsilon &&
		Math.abs(q1.z - q2.z) < epsilon &&
		Math.abs(q1.w - q2.w) < epsilon
	);
}

// Run tests if requested via URL param
if (window.location.search.includes('run_tests=true')) {
	// Wait for DOM to be ready
	document.addEventListener('DOMContentLoaded', () => {
		console.log('Automatically running tests...');
		runTagPhysicsTests();
	});
} 