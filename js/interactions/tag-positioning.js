import * as THREE from 'three';

/**
 * Handles positioning of tags in 3D space
 */
export class TagPositioning {
	constructor() {
		this.occupiedSpaces = {};
		this.cubeSize = 1.0;
	}
	
	/**
	 * Find the best position for a new tag in the 3D space
	 */
	findBestPositionForNewTag(textGeometry, size, tags) {
		// Create a temporary bounding box to determine the tag's dimensions
		textGeometry.computeBoundingBox();
		const tempBBox = textGeometry.boundingBox.clone();
		const tagWidth = tempBBox.max.x - tempBBox.min.x;
		const tagHeight = tempBBox.max.y - tempBBox.min.y;
		const tagDepth = tempBBox.max.z - tempBBox.min.z;
		
		// Calculate how many cube spaces this tag will occupy
		const cubeSizeX = Math.ceil(tagWidth / this.cubeSize);
		const cubeSizeY = Math.ceil(tagHeight / this.cubeSize);
		const cubeSizeZ = Math.ceil(tagDepth / this.cubeSize);
		
		if (tags.length === 0) {
			// First tag - position in the center
			return {
				position: new THREE.Vector3(0, 0, 0),
				rotation: new THREE.Euler(0, 0, 0),
				direction: new THREE.Vector3(1, 0, 0), // Growing along X axis
				penetrationDepth: 1.0,
				stickOutFactor: 0.0,
				cubeDimensions: {x: cubeSizeX, y: cubeSizeY, z: cubeSizeZ}
			};
		}
		
		// With a 75% chance, just use the dynamic position approach
		if (Math.random() < 0.75) {
			return this.createFarthestPosition(cubeSizeX, cubeSizeY, cubeSizeZ);
		}
		
		// For subsequent tags, find an unoccupied space (but with fewer attempts)
		const possiblePositions = [];
		
		// Try fewer random positions and rotations
		const maxAttempts = 50; // Reduced from 200
		
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			// Try different positions around existing tags
			const existingTag = tags[Math.floor(Math.random() * tags.length)];
			
			// Skip if the tag doesn't have a bounding box yet
			if (!existingTag.bbox) continue;
			
			// Get a random position on the surface of the existing tag's bounding box
			const existingBox = existingTag.bbox;
			
			// Choose a random face of the bounding box
			const face = Math.floor(Math.random() * 6);
			const faceOffset = this.cubeSize * (Math.random() > 0.5 ? 1 : -1); // Offset by a cube size
			
			// Calculate position based on the selected face
			let newPosition;
			let direction;
			
			// Pick a random position on the selected face
			const center = new THREE.Vector3();
			existingBox.getCenter(center);
			
			const extentX = (existingBox.max.x - existingBox.min.x) / 2;
			const extentY = (existingBox.max.y - existingBox.min.y) / 2;
			const extentZ = (existingBox.max.z - existingBox.min.z) / 2;
			
			const randX = (Math.random() * 2 - 1) * extentX;
			const randY = (Math.random() * 2 - 1) * extentY;
			const randZ = (Math.random() * 2 - 1) * extentZ;
			
			// Calculate position and direction based on which face was selected
			const facePosition = this.calculateFacePosition(
				face, existingBox, center, faceOffset, randX, randY, randZ
			);
			newPosition = facePosition.position;
			direction = facePosition.direction;
			
			// Try different rotations
			const possibleRotations = this.getPossibleRotations();
			const rotation = possibleRotations[Math.floor(Math.random() * possibleRotations.length)];
			
			// Calculate the cube dimensions after rotation
			const rotatedCubeDimensions = this.getRotatedCubeDimensions(
				rotation, cubeSizeX, cubeSizeY, cubeSizeZ
			);
			
			// Calculate potential collisions with existing tags
			const transformedBBox = this.calculateTransformedBoundingBox(
				tempBBox, rotation, newPosition
			);
			
			// Find tags that would be hit by this new tag
			const collidingTags = this.findCollidingTags(transformedBBox, tags);
			
			// We want to always have some collisions for more dynamics
			possiblePositions.push({
				position: newPosition,
				rotation: rotation,
				direction: direction,
				penetrationDepth: 0.6 + Math.random() * 0.4, // Higher penetration depth (60-100%)
				stickOutFactor: 0.2 + Math.random() * 0.5, // 20-70% stick out factor
				collidingTags: collidingTags,
				cubeDimensions: rotatedCubeDimensions,
				cubePosition: {x: Math.round(newPosition.x / this.cubeSize), 
							   y: Math.round(newPosition.y / this.cubeSize), 
							   z: Math.round(newPosition.z / this.cubeSize)}
			});
			
			// If we have a position with 1-3 collisions (not too many, not zero), prefer that one
			// This creates good dynamics without being too chaotic
			if (collidingTags.length >= 1 && collidingTags.length <= 3) {
				break;
			}
		}
		
		// If we found possible positions, choose the best one
		if (possiblePositions.length > 0) {
			possiblePositions.sort((a, b) => {
				// Sort by number of collisions - prefer 1-3 collisions for good dynamics
				const collisionsA = a.collidingTags ? a.collidingTags.length : 0;
				const collisionsB = b.collidingTags ? b.collidingTags.length : 0;
				
				// Ideal range is 1-3 collisions
				const scoreA = collisionsA === 0 ? 10 : (collisionsA > 3 ? collisionsA : -collisionsA);
				const scoreB = collisionsB === 0 ? 10 : (collisionsB > 3 ? collisionsB : -collisionsB);
				
				return scoreA - scoreB;
			});
			
			const bestPosition = possiblePositions[0];
			
			// Only reserve space if there are no collisions (rare case)
			if (bestPosition.collidingTags.length === 0) {
				this.reserveCubicSpace(
					bestPosition.cubePosition.x,
					bestPosition.cubePosition.y,
					bestPosition.cubePosition.z,
					bestPosition.cubeDimensions
				);
			}
			
			return bestPosition;
		}
		
		// If no position found, create a dynamic one
		return this.createFarthestPosition(cubeSizeX, cubeSizeY, cubeSizeZ);
	}
	
	/**
	 * Calculate position and direction based on which face was selected
	 */
	calculateFacePosition(face, existingBox, center, faceOffset, randX, randY, randZ) {
		let position;
		let direction;
		
		switch (face) {
			case 0: // +X face
				position = new THREE.Vector3(
					existingBox.max.x + faceOffset,
					center.y + randY,
					center.z + randZ
				);
				direction = new THREE.Vector3(1, 0, 0);
				break;
			case 1: // -X face
				position = new THREE.Vector3(
					existingBox.min.x - faceOffset,
					center.y + randY,
					center.z + randZ
				);
				direction = new THREE.Vector3(-1, 0, 0);
				break;
			case 2: // +Y face
				position = new THREE.Vector3(
					center.x + randX,
					existingBox.max.y + faceOffset,
					center.z + randZ
				);
				direction = new THREE.Vector3(0, 1, 0);
				break;
			case 3: // -Y face
				position = new THREE.Vector3(
					center.x + randX,
					existingBox.min.y - faceOffset,
					center.z + randZ
				);
				direction = new THREE.Vector3(0, -1, 0);
				break;
			case 4: // +Z face
				position = new THREE.Vector3(
					center.x + randX,
					center.y + randY,
					existingBox.max.z + faceOffset
				);
				direction = new THREE.Vector3(0, 0, 1);
				break;
			case 5: // -Z face
				position = new THREE.Vector3(
					center.x + randX,
					center.y + randY,
					existingBox.min.z - faceOffset
				);
				direction = new THREE.Vector3(0, 0, -1);
				break;
		}
		
		return { position, direction };
	}
	
	/**
	 * Get a list of possible rotations to try
	 */
	getPossibleRotations() {
		return [
			new THREE.Euler(0, 0, 0),
			new THREE.Euler(0, Math.PI/2, 0),
			new THREE.Euler(0, Math.PI, 0),
			new THREE.Euler(0, -Math.PI/2, 0),
			new THREE.Euler(Math.PI/2, 0, 0),
			new THREE.Euler(-Math.PI/2, 0, 0)
		];
	}
	
	/**
	 * Calculate cube dimensions after rotation
	 */
	getRotatedCubeDimensions(rotation, cubeSizeX, cubeSizeY, cubeSizeZ) {
		let dimensions = {x: cubeSizeX, y: cubeSizeY, z: cubeSizeZ};
		
		// Adjust dimensions based on rotation
		if (rotation.y === Math.PI/2 || rotation.y === -Math.PI/2) {
			dimensions = {x: cubeSizeZ, y: cubeSizeY, z: cubeSizeX};
		} else if (rotation.x === Math.PI/2 || rotation.x === -Math.PI/2) {
			dimensions = {x: cubeSizeX, y: cubeSizeZ, z: cubeSizeY};
		}
		
		return dimensions;
	}
	
	/**
	 * Check if a cubic space is available
	 */
	checkSpaceAvailability(cubeX, cubeY, cubeZ, dimensions) {
		for (let x = cubeX; x < cubeX + dimensions.x; x++) {
			for (let y = cubeY; y < cubeY + dimensions.y; y++) {
				for (let z = cubeZ; z < cubeZ + dimensions.z; z++) {
					const cubeKey = `${x},${y},${z}`;
					if (this.occupiedSpaces[cubeKey]) {
						return false;
					}
				}
			}
		}
		return true;
	}
	
	/**
	 * Reserve cubic space for a tag
	 */
	reserveCubicSpace(cubeX, cubeY, cubeZ, dimensions) {
		for (let x = cubeX; x < cubeX + dimensions.x; x++) {
			for (let y = cubeY; y < cubeY + dimensions.y; y++) {
				for (let z = cubeZ; z < cubeZ + dimensions.z; z++) {
					const cubeKey = `${x},${y},${z}`;
					this.occupiedSpaces[cubeKey] = true;
				}
			}
		}
	}
	
	/**
	 * Calculate transformed bounding box for collision detection
	 */
	calculateTransformedBoundingBox(bbox, rotation, position) {
		const corners = [
			new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
			new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
			new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
			new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
			new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
			new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
			new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
			new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
		];
		
		// Create transformation matrix
		const matrix = new THREE.Matrix4();
		matrix.makeRotationFromEuler(rotation);
		matrix.setPosition(position);
		
		// Transform corners
		corners.forEach(corner => corner.applyMatrix4(matrix));
		
		// Create bounding box from transformed corners
		return new THREE.Box3().setFromPoints(corners);
	}
	
	/**
	 * Find tags that would collide with the new tag
	 */
	findCollidingTags(bbox, tags) {
		const collidingTags = [];
		
		for (const tag of tags) {
			if (!tag.bbox) continue;
			
			// Check for intersection
			if (bbox.intersectsBox(tag.bbox)) {
				// Calculate the center-to-center vector
				const tagCenter = new THREE.Vector3();
				tag.bbox.getCenter(tagCenter);
				
				const newTagCenter = new THREE.Vector3();
				bbox.getCenter(newTagCenter);
				
				// Vector pointing from existing tag to new tag
				const centerToCenter = newTagCenter.clone().sub(tagCenter);
				
				// Normalize to get direction
				const pushDir = centerToCenter.clone().normalize();
				
				// Calculate overlap volume to determine severity
				const intersection = new THREE.Box3();
				intersection.copy(bbox).intersect(tag.bbox);
				
				const overlapVolume = 
					(intersection.max.x - intersection.min.x) *
					(intersection.max.y - intersection.min.y) *
					(intersection.max.z - intersection.min.z);
				
				const tagVolume =
					(tag.bbox.max.x - tag.bbox.min.x) *
					(tag.bbox.max.y - tag.bbox.min.y) *
					(tag.bbox.max.z - tag.bbox.min.z);
				
				// Calculate overlap as percentage of tag volume
				const overlapPercentage = overlapVolume / tagVolume;
				
				collidingTags.push({
					tag: tag,
					direction: pushDir,
					overlapPercentage: overlapPercentage
				});
			}
		}
		
		return collidingTags;
	}
	
	/**
	 * Create a dynamic position that will cause existing tags to be pushed aside
	 */
	createFarthestPosition(cubeSizeX, cubeSizeY, cubeSizeZ) {
		// If there are no tags in occupiedSpaces, create a position near origin
		if (Object.keys(this.occupiedSpaces).length === 0) {
			return {
				position: new THREE.Vector3(0, 0, 0),
				rotation: new THREE.Euler(0, 0, 0),
				direction: new THREE.Vector3(1, 0, 0),
				penetrationDepth: 1.0,
				stickOutFactor: 0.0,
				cubeDimensions: {x: cubeSizeX, y: cubeSizeY, z: cubeSizeZ}
			};
		}
		
		// Find the center of the existing structure to aim towards
		let sumX = 0, sumY = 0, sumZ = 0;
		const keys = Object.keys(this.occupiedSpaces);
		keys.forEach(key => {
			const [kx, ky, kz] = key.split(',').map(Number);
			sumX += kx;
			sumY += ky;
			sumZ += kz;
		});
		
		const centerX = sumX / keys.length;
		const centerY = sumY / keys.length;
		const centerZ = sumZ / keys.length;
		
		// Calculate radius of existing structure
		let maxDistSq = 0;
		keys.forEach(key => {
			const [kx, ky, kz] = key.split(',').map(Number);
			const dx = kx - centerX;
			const dy = ky - centerY;
			const dz = kz - centerZ;
			const distSq = dx*dx + dy*dy + dz*dz;
			maxDistSq = Math.max(maxDistSq, distSq);
		});
		
		const structureRadius = Math.sqrt(maxDistSq) * this.cubeSize;
		
		// Random direction from center
		const phi = Math.random() * Math.PI * 2; // random angle around y-axis
		const theta = Math.random() * Math.PI; // random angle from y-axis
		
		const dirX = Math.sin(theta) * Math.cos(phi);
		const dirY = Math.cos(theta);
		const dirZ = Math.sin(theta) * Math.sin(phi);
		
		// Create direction vector pointing toward center
		const direction = new THREE.Vector3(-dirX, -dirY, -dirZ).normalize();
		
		// Calculate start position - further outside the structure with randomness
		const distance = structureRadius + 5 + Math.random() * 5; // Increased from 2+random*3
		const position = new THREE.Vector3(
			centerX * this.cubeSize + dirX * distance,
			centerY * this.cubeSize + dirY * distance,
			centerZ * this.cubeSize + dirZ * distance
		);
		
		// Random rotation for variety
		const rotation = new THREE.Euler(
			Math.random() * Math.PI * 2,
			Math.random() * Math.PI * 2,
			Math.random() * Math.PI * 2
		);
		
		// Intentionally do NOT reserve space in the grid - we want collisions
		// for dynamic pushing of existing tags
		
		return {
			position: position,
			rotation: rotation,
			direction: direction,
			// Higher penetration depth for more dramatic collisions
			penetrationDepth: 1.5, // Increased from 1.0
			stickOutFactor: 0.2 + Math.random() * 0.5, // 20-70% stick out for variety
			cubeDimensions: {x: cubeSizeX, y: cubeSizeY, z: cubeSizeZ},
			// Force collisions by making it seem like there are many colliding tags
			forceCollisions: true
		};
	}
} 