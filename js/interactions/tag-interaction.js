import * as THREE from 'three';

/**
 * Handles interactions and predictive collision avoidance for tags
 */
export class TagInteraction {
	constructor(camera, tags, scene) {
		this.camera = camera;
		this.tags = tags;
		this.scene = scene;
		
		// Raycaster for click detection
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		
		// Physics parameters
		this.predictionTime = 0.2; // Increased from 0.1 to predict collisions further ahead
		this.avoidanceSpeed = 0.08; // Increased from 0.05 for more responsive avoidance
		this.verticalBias = 0.9; // Strong preference for vertical movement (0-1)
		this.maxVelocity = 0.06; // Increased from 0.05 for quicker response
		this.velocityDecay = 0.85; // Slightly faster decay (was 0.9)
		this.cohesionRadius = 1.5; // Increased from 1.0 to ensure better cohesion
		this.cohesionStrength = 0.15; // New parameter for stronger cohesion forces
		
		// Store tag data
		this.tagVelocities = new Map();
		this.tagTargetPositions = new Map();
		this.tagResizingAnimations = new Map();
		
		// Animation timing
		this.clock = new THREE.Clock();
		this.lastTime = 0;
		this.clock.start();
		
		// Set up click event listener
		window.addEventListener('click', this.handleClick.bind(this));
		
		// Track the main cluster for cohesion
		this.mainCluster = [];
		this.lastClusterUpdate = 0;
	}
	
	/**
	 * Initialize a new tag's physics properties
	 */
	initializeTag(tag) {
		if (!this.tagVelocities.has(tag.id)) {
			this.tagVelocities.set(tag.id, new THREE.Vector3(0, 0, 0));
			this.tagTargetPositions.set(tag.id, tag.mesh.position.clone());
		}
		
		// Calculate direction towards the cluster
		const clusterCenter = this.calculateClusterCenter();
		const dirToCluster = clusterCenter.clone().sub(tag.mesh.position).normalize();
		
		// Set initial velocity towards center
		const initialSpeed = 0.03;
		this.tagVelocities.set(tag.id, dirToCluster.multiplyScalar(initialSpeed));
		
		// Set initial material to be metallic
		this.updateTagMaterial(tag);
	}
	
	/**
	 * Calculate the center of the existing tag cluster
	 */
	calculateClusterCenter() {
		if (this.tags.length <= 1) {
			return new THREE.Vector3(0, 0, 0);
		}
		
		let sumPosition = new THREE.Vector3();
		let count = 0;
		
		// Only consider non-animating tags (established tags)
		for (const tag of this.tags) {
			if (tag.mesh && !tag.isAnimating) {
				sumPosition.add(tag.mesh.position);
				count++;
			}
		}
		
		if (count > 0) {
			return sumPosition.divideScalar(count);
		}
		
		return new THREE.Vector3(0, 0, 0);
	}
	
	/**
	 * Make the tag material more metallic and bright
	 */
	updateTagMaterial(tag) {
		if (tag.mesh && tag.mesh.material) {
			// Clone the material if it hasn't been modified yet
			if (!tag.mesh.material._isCustomized) {
				tag.mesh.material = tag.mesh.material.clone();
				tag.mesh.material._isCustomized = true;
			}
			
			// Make it metallic and shiny
			tag.mesh.material.metalness = 0.8;
			tag.mesh.material.roughness = 0.2;
			tag.mesh.material.envMapIntensity = 1.2;
			
			// Increase brightness
			if (tag.mesh.material.color) {
				const color = tag.mesh.material.color.clone();
				
				// Brighten the color but preserve hue
				const hsl = {};
				color.getHSL(hsl);
				hsl.l = Math.min(1.0, hsl.l * 1.3); // Increase lightness by 30%
				color.setHSL(hsl.h, hsl.s, hsl.l);
				
				tag.mesh.material.color = color;
				tag.mesh.material.emissive = color.clone().multiplyScalar(0.2);
			}
		}
	}
	
	/**
	 * Handle click events on tags
	 */
	handleClick(event) {
		// Calculate mouse position in normalized device coordinates (-1 to +1)
		this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
		
		// Update the raycaster
		this.raycaster.setFromCamera(this.mouse, this.camera);
		
		// Get all tag meshes
		const meshes = this.tags.map(tag => tag.mesh);
		
		// Calculate intersections
		const intersects = this.raycaster.intersectObjects(meshes);
		
		// If we clicked on a tag
		if (intersects.length > 0) {
			const clickedMesh = intersects[0].object;
			
			// Find the tag data for this mesh
			const clickedTag = this.tags.find(tag => tag.mesh === clickedMesh);
			
			if (clickedTag) {
				this.handleTagClick(clickedTag, clickedMesh);
			}
		}
	}
	
	/**
	 * Handle click on a specific tag
	 */
	handleTagClick(tag, mesh) {
		// Open the URL in a new tab/window
		window.open(tag.url, '_blank');
		
		// Visual feedback - pulse effect
		const originalScale = mesh.scale.clone();
		
		// Scale up quickly
		mesh.scale.multiplyScalar(1.2);
		
		// Then return to original scale
		setTimeout(() => {
			mesh.scale.copy(originalScale);
		}, 200);
	}
	
	/**
	 * Resize a tag based on its market cap value
	 */
	resizeTagByMarketCap(tag, marketCap, minMarketCap, maxMarketCap) {
		if (!tag.mesh) return;
		
		// Calculate size factor based on market cap (logarithmic scale)
		const minSize = 0.5;
		const maxSize = 2.0;
		
		// Use logarithmic scale for better visualization
		const logMin = Math.log(Math.max(1, minMarketCap));
		const logMax = Math.log(Math.max(2, maxMarketCap));
		const logValue = Math.log(Math.max(1, marketCap));
		
		// Normalize between 0 and 1
		let normalizedValue = (logValue - logMin) / (logMax - logMin);
		
		// Safety check
		normalizedValue = Math.max(0, Math.min(1, normalizedValue));
		
		// Calculate size with some non-linearity
		const targetSize = minSize + (maxSize - minSize) * normalizedValue;
		
		// Create animation for smooth resizing
		const originalSize = tag.mesh.scale.x;
		
		this.tagResizingAnimations.set(tag.id, {
			startSize: originalSize,
			targetSize: targetSize,
			progress: 0,
			duration: 1.0 // seconds
		});
		
		// Store original bbox before resizing
		if (tag.bbox) {
			tag.previousBbox = tag.bbox.clone();
		}
		
		// Update bbox for collision detection after resizing
		this.updateTagBoundingBox(tag);
		
		// Pre-emptively notify surrounding tags to move out of the way if growing
		if (targetSize > originalSize) {
			this.preemptResizeCollisionAvoidance(tag, targetSize);
		}
	}
	
	/**
	 * Pre-emptively move surrounding tags to make room for a growing tag
	 */
	preemptResizeCollisionAvoidance(tag, newSize) {
		if (!tag.mesh || !tag.bbox) return;
		
		// Calculate how much the tag will grow
		const currentSize = tag.mesh.scale.x;
		const growthFactor = newSize / currentSize;
		
		// Skip if not growing significantly
		if (growthFactor < 1.1) return;
		
		// Create a projected bounding box for the tag after resizing
		const projectedBBox = tag.bbox.clone();
		const center = new THREE.Vector3();
		tag.bbox.getCenter(center);
		
		// Calculate expansion vector from center
		const expandX = (tag.bbox.max.x - tag.bbox.min.x) * (growthFactor - 1) / 2;
		const expandY = (tag.bbox.max.y - tag.bbox.min.y) * (growthFactor - 1) / 2;
		const expandZ = (tag.bbox.max.z - tag.bbox.min.z) * (growthFactor - 1) / 2;
		
		// Expand the bounding box
		projectedBBox.expandByVector(new THREE.Vector3(expandX, expandY, expandZ));
		
		// Find tags that will intersect with the expanded box
		for (const otherTag of this.tags) {
			if (otherTag === tag || !otherTag.bbox || otherTag.isAnimating) continue;
			
			// Check for intersection with projected box
			if (projectedBBox.intersectsBox(otherTag.bbox)) {
				// Calculate direction to push
				const otherCenter = new THREE.Vector3();
				otherTag.bbox.getCenter(otherCenter);
				
				const pushDir = otherCenter.clone().sub(center).normalize();
				
				// Calculate minimum displacement needed
				const intersection = new THREE.Box3();
				intersection.copy(projectedBBox).intersect(otherTag.bbox);
				
				// Calculate overlap dimensions
				const overlapX = intersection.max.x - intersection.min.x;
				const overlapY = intersection.max.y - intersection.min.y;
				const overlapZ = intersection.max.z - intersection.min.z;
				
				// Choose the smallest overlap direction, with preference for vertical
				let displacement;
				if (this.verticalBias > Math.random() || overlapY <= overlapX && overlapY <= overlapZ) {
					// Vertical displacement (y-axis)
					const yDir = Math.sign(otherCenter.y - center.y) || (Math.random() > 0.5 ? 1 : -1);
					displacement = new THREE.Vector3(0, yDir * (overlapY + 0.05), 0);
				} else if (overlapX <= overlapZ) {
					// Horizontal displacement (x-axis)
					const xDir = Math.sign(otherCenter.x - center.x) || (Math.random() > 0.5 ? 1 : -1);
					displacement = new THREE.Vector3(xDir * (overlapX + 0.05), 0, 0);
				} else {
					// Depth displacement (z-axis)
					const zDir = Math.sign(otherCenter.z - center.z) || (Math.random() > 0.5 ? 1 : -1);
					displacement = new THREE.Vector3(0, 0, zDir * (overlapZ + 0.05));
				}
				
				// Apply impulse to velocity
				const vel = this.tagVelocities.get(otherTag.id) || new THREE.Vector3();
				vel.add(displacement.multiplyScalar(0.3)); // Reduced impulse for smoother movement
				this.tagVelocities.set(otherTag.id, vel);
			}
		}
	}
	
	/**
	 * Update the tag's bounding box after position or scale changes
	 */
	updateTagBoundingBox(tag) {
		if (!tag.mesh || !tag.mesh.geometry) return;
		
		// Force geometry bounding box update
		tag.mesh.geometry.computeBoundingBox();
		
		// Get the geometry's bounding box
		const geometryBBox = tag.mesh.geometry.boundingBox.clone();
		
		// Transform by the mesh's matrix to get world space bbox
		const matrix = tag.mesh.matrixWorld.clone();
		
		// Create a new bounding box
		tag.bbox = new THREE.Box3().copy(geometryBBox).applyMatrix4(matrix);
	}
	
	/**
	 * Update all tag animations and physics
	 */
	update() {
		const time = this.clock.getElapsedTime();
		const deltaTime = Math.min(0.05, time - this.lastTime); // Cap delta to avoid large jumps
		this.lastTime = time;
		
		// First, update all bounding boxes
		for (const tag of this.tags) {
			if (!tag.mesh) continue;
			this.updateTagBoundingBox(tag);
			
			// Initialize new tags
			if (!this.tagVelocities.has(tag.id)) {
				this.initializeTag(tag);
			}
		}
		
		// Process tag resize animations
		this.processResizeAnimations(deltaTime);
		
		// Resolve any current collisions
		this.resolveCurrentCollisions(deltaTime);
		
		// Predict and avoid future collisions
		this.predictAndAvoidCollisions(deltaTime);
		
		// Update the main cluster identification periodically (every 0.5 seconds)
		if (time - this.lastClusterUpdate > 0.5) {
			this.updateMainCluster();
			this.lastClusterUpdate = time;
		}
		
		// Ensure the tag cluster stays cohesive
		this.ensureCohesion(deltaTime);
		
		// Update positions based on velocities
		this.updatePositions(deltaTime);
	}
	
	/**
	 * Process all active resize animations
	 */
	processResizeAnimations(deltaTime) {
		for (const [tagId, animation] of this.tagResizingAnimations.entries()) {
			const tag = this.tags.find(t => t.id === tagId);
			if (!tag || !tag.mesh) {
				this.tagResizingAnimations.delete(tagId);
				continue;
			}
			
			// Update progress
			animation.progress += deltaTime / animation.duration;
			
			if (animation.progress >= 1.0) {
				// Animation complete
				tag.mesh.scale.set(
					animation.targetSize,
					animation.targetSize,
					animation.targetSize
				);
				this.tagResizingAnimations.delete(tagId);
			} else {
				// Calculate eased value (cubic ease out)
				const t = animation.progress;
				const easeValue = 1 - Math.pow(1 - t, 3);
				
				// Interpolate size
				const currentSize = animation.startSize + 
					(animation.targetSize - animation.startSize) * easeValue;
				
				// Apply new size
				tag.mesh.scale.set(currentSize, currentSize, currentSize);
			}
			
			// Update bounding box after resize
			this.updateTagBoundingBox(tag);
			
			// Check for collisions during resize
			if (animation.targetSize > animation.startSize) {
				this.resolveCurrentCollisions(deltaTime);
			}
		}
	}
	
	/**
	 * Resolve current collisions (tags already overlapping)
	 */
	resolveCurrentCollisions(deltaTime) {
		// Build a list of all collision pairs to process in order
		const collisionPairs = [];
		
		for (const tagA of this.tags) {
			if (!tagA.mesh || !tagA.bbox || tagA.isAnimating) continue;
			
			for (const tagB of this.tags) {
				if (tagB === tagA || !tagB.mesh || !tagB.bbox || tagB.isAnimating) continue;
				
				// Check if tags are currently intersecting
				if (tagA.bbox.intersectsBox(tagB.bbox)) {
					// Calculate centers
					const centerA = new THREE.Vector3();
					const centerB = new THREE.Vector3();
					tagA.bbox.getCenter(centerA);
					tagB.bbox.getCenter(centerB);
					
					// Calculate the intersection box
					const intersection = new THREE.Box3();
					intersection.copy(tagA.bbox).intersect(tagB.bbox);
					
					// Calculate overlap volume to prioritize worst overlaps
					const overlapVolume = 
						(intersection.max.x - intersection.min.x) *
						(intersection.max.y - intersection.min.y) *
						(intersection.max.z - intersection.min.z);
					
					// Calculate overlap dimensions
					const overlapX = intersection.max.x - intersection.min.x;
					const overlapY = intersection.max.y - intersection.min.y;
					const overlapZ = intersection.max.z - intersection.min.z;
					
					// Add to collision list
					collisionPairs.push({
						tagA,
						tagB,
						centerA,
						centerB,
						overlapVolume,
						overlapX,
						overlapY,
						overlapZ
					});
				}
			}
		}
		
		// Sort collision pairs by overlap volume (largest first)
		collisionPairs.sort((a, b) => b.overlapVolume - a.overlapVolume);
		
		// Process collisions in order of severity
		for (const collision of collisionPairs) {
			const { tagA, tagB, centerA, centerB, overlapX, overlapY, overlapZ } = collision;
			
			// Choose which tag to move based on size and whether it's part of the main cluster
			const tagAInMainCluster = this.mainCluster.includes(tagA.id);
			const tagBInMainCluster = this.mainCluster.includes(tagB.id);
			
			// Prefer moving the tag that's not in the main cluster
			// If both are in or both are out, move the smaller one
			let tagToMove;
			
			if (tagAInMainCluster && !tagBInMainCluster) {
				tagToMove = tagB;
			} else if (!tagAInMainCluster && tagBInMainCluster) {
				tagToMove = tagA;
			} else {
				// Both are in the same group, move the smaller one
				tagToMove = (tagA.mesh.scale.x <= tagB.mesh.scale.x) ? tagA : tagB;
			}
			
			// Prefer vertical separation with high probability
			let separationVector;
			let separationDistance;
			
			if (Math.random() < this.verticalBias || 
				(overlapY <= overlapX && overlapY <= overlapZ)) {
				// Vertical separation
				const direction = Math.sign(centerB.y - centerA.y);
				separationVector = new THREE.Vector3(0, direction || (Math.random() > 0.5 ? 1 : -1), 0);
				separationDistance = overlapY + 0.05; // Small extra margin
			} else if (overlapX <= overlapZ) {
				// Horizontal separation
				const direction = Math.sign(centerB.x - centerA.x);
				separationVector = new THREE.Vector3(direction || (Math.random() > 0.5 ? 1 : -1), 0, 0);
				separationDistance = overlapX + 0.05; // Small extra margin
			} else {
				// Depth separation
				const direction = Math.sign(centerB.z - centerA.z);
				separationVector = new THREE.Vector3(0, 0, direction || (Math.random() > 0.5 ? 1 : -1));
				separationDistance = overlapZ + 0.05; // Small extra margin
			}
			
			// Move the tag immediately to resolve the collision
			tagToMove.mesh.position.add(
				separationVector.multiplyScalar(separationDistance)
			);
			
			// Update the bounding box
			this.updateTagBoundingBox(tagToMove);
			
			// Apply separation to velocity for momentum
			const vel = this.tagVelocities.get(tagToMove.id) || new THREE.Vector3();
			vel.add(separationVector.clone().multiplyScalar(this.avoidanceSpeed * 2));
			this.tagVelocities.set(tagToMove.id, vel);
		}
	}
	
	/**
	 * Identify the main cluster of connected tags
	 */
	updateMainCluster() {
		// Skip if too few tags
		if (this.tags.length < 3) {
			this.mainCluster = this.tags.map(tag => tag.id);
			return;
		}
		
		// Build a graph of connected tags
		const connections = new Map();
		
		// Initialize connections map
		for (const tag of this.tags) {
			if (tag.mesh && !tag.isAnimating) {
				connections.set(tag.id, []);
			}
		}
		
		// Find connections between tags
		for (const tagA of this.tags) {
			if (!tagA.mesh || !tagA.bbox || tagA.isAnimating) continue;
			
			const centerA = new THREE.Vector3();
			tagA.bbox.getCenter(centerA);
			
			for (const tagB of this.tags) {
				if (tagB === tagA || !tagB.mesh || !tagB.bbox || tagB.isAnimating) continue;
				
				const centerB = new THREE.Vector3();
				tagB.bbox.getCenter(centerB);
				
				const distance = centerA.distanceTo(centerB);
				
				// Calculate sizes
				const sizeA = (tagA.bbox.max.x - tagA.bbox.min.x + 
							   tagA.bbox.max.y - tagA.bbox.min.y + 
							   tagA.bbox.max.z - tagA.bbox.min.z) / 3;
				
				const sizeB = (tagB.bbox.max.x - tagB.bbox.min.x + 
							   tagB.bbox.max.y - tagB.bbox.min.y + 
							   tagB.bbox.max.z - tagB.bbox.min.z) / 3;
				
				// Tags are connected if they're close enough
				if (distance < (sizeA + sizeB) * 2.0) { // Increased from 1.5 for better cohesion
					connections.get(tagA.id).push(tagB.id);
					connections.get(tagB.id).push(tagA.id);
				}
			}
		}
		
		// Find all clusters using breadth-first search
		const clusters = [];
		const visited = new Set();
		
		for (const tag of this.tags) {
			if (!tag.mesh || tag.isAnimating || visited.has(tag.id)) continue;
			
			// Start a new cluster
			const cluster = [];
			const queue = [tag.id];
			
			while (queue.length > 0) {
				const current = queue.shift();
				
				if (!visited.has(current)) {
					visited.add(current);
					cluster.push(current);
					
					// Add connected tags to queue
					const connectedTags = connections.get(current) || [];
					for (const connectedId of connectedTags) {
						if (!visited.has(connectedId)) {
							queue.push(connectedId);
						}
					}
				}
			}
			
			if (cluster.length > 0) {
				clusters.push(cluster);
			}
		}
		
		// Find the largest cluster
		if (clusters.length > 0) {
			clusters.sort((a, b) => b.length - a.length);
			this.mainCluster = clusters[0];
		} else {
			this.mainCluster = [];
		}
	}
	
	/**
	 * Predict future collisions and adjust velocities to avoid them
	 */
	predictAndAvoidCollisions(deltaTime) {
		// Build a list of all potential collision pairs to check
		const potentialCollisions = [];
		
		for (const tagA of this.tags) {
			if (!tagA.mesh || !tagA.bbox || tagA.isAnimating) continue;
			
			// Get current velocity
			const velA = this.tagVelocities.get(tagA.id) || new THREE.Vector3();
			
			// Only check if the tag is moving significantly
			if (velA.length() < 0.001) continue;
			
			// Predict future position
			const futurePos = tagA.mesh.position.clone().add(
				velA.clone().multiplyScalar(this.predictionTime)
			);
			
			// Create future bounding box
			const futureBBox = tagA.bbox.clone();
			const movement = futurePos.clone().sub(tagA.mesh.position);
			futureBBox.min.add(movement);
			futureBBox.max.add(movement);
			
			// Check against other tags
			for (const tagB of this.tags) {
				if (tagB === tagA || !tagB.mesh || !tagB.bbox || tagB.isAnimating) continue;
				
				// Get other tag's velocity
				const velB = this.tagVelocities.get(tagB.id) || new THREE.Vector3();
				
				// Predict other tag's future position
				const futurePosB = tagB.mesh.position.clone().add(
					velB.clone().multiplyScalar(this.predictionTime)
				);
				
				// Create future bounding box for tagB
				const futureBBoxB = tagB.bbox.clone();
				const movementB = futurePosB.clone().sub(tagB.mesh.position);
				futureBBoxB.min.add(movementB);
				futureBBoxB.max.add(movementB);
				
				// Check if future boxes will intersect
				if (futureBBox.intersectsBox(futureBBoxB)) {
					// Calculate future centers
					const centerA = new THREE.Vector3();
					const centerB = new THREE.Vector3();
					futureBBox.getCenter(centerA);
					futureBBoxB.getCenter(centerB);
					
					// Calculate future intersection volume to prioritize worst collisions
					const intersection = new THREE.Box3();
					intersection.copy(futureBBox).intersect(futureBBoxB);
					
					const overlapX = intersection.max.x - intersection.min.x;
					const overlapY = intersection.max.y - intersection.min.y;
					const overlapZ = intersection.max.z - intersection.min.z;
					
					const overlapVolume = overlapX * overlapY * overlapZ;
					
					// Add to potential collisions list
					potentialCollisions.push({
						tagA,
						tagB,
						futureBBoxA: futureBBox,
						futureBBoxB: futureBBoxB,
						centerA,
						centerB,
						overlapVolume,
						overlapX,
						overlapY,
						overlapZ,
						velA,
						velB
					});
				}
			}
		}
		
		// Sort by overlap volume (worst first)
		potentialCollisions.sort((a, b) => b.overlapVolume - a.overlapVolume);
		
		// Process potential collisions
		for (const collision of potentialCollisions) {
			const { tagA, tagB, centerA, centerB, overlapX, overlapY, overlapZ, velA, velB } = collision;
			
			// Choose which tag to adjust velocity
			const tagAInMainCluster = this.mainCluster.includes(tagA.id);
			const tagBInMainCluster = this.mainCluster.includes(tagB.id);
			
			// Determine which tag should move to avoid collision
			let tagToMove;
			
			// Prefer moving the tag that's not in the main cluster
			if (tagAInMainCluster && !tagBInMainCluster) {
				tagToMove = tagB;
			} else if (!tagAInMainCluster && tagBInMainCluster) {
				tagToMove = tagA;
			} else {
				// Both are in the same cluster state, move the smaller one
				tagToMove = (tagA.mesh.scale.x <= tagB.mesh.scale.x) ? tagA : tagB;
			}
			
			// Get the velocity of the tag to adjust
			const vel = tagToMove === tagA ? velA : velB;
			
			// Strongly prefer vertical movement for readability
			let avoidanceVector;
			
			if (Math.random() < this.verticalBias || 
				(overlapY <= overlapX && overlapY <= overlapZ)) {
				// Vertical avoidance (up/down) - always prefer this
				const direction = Math.sign(centerB.y - centerA.y);
				avoidanceVector = new THREE.Vector3(0, direction || (Math.random() > 0.5 ? 1 : -1), 0);
			} else if (overlapX <= overlapZ) {
				// Horizontal avoidance (left/right)
				const direction = Math.sign(centerB.x - centerA.x);
				avoidanceVector = new THREE.Vector3(direction || (Math.random() > 0.5 ? 1 : -1), 0, 0);
			} else {
				// Depth avoidance (front/back)
				const direction = Math.sign(centerB.z - centerA.z);
				avoidanceVector = new THREE.Vector3(0, 0, direction || (Math.random() > 0.5 ? 1 : -1));
			}
			
			// Apply stronger avoidance impulse to velocity for faster reaction
			const avoidanceImpulse = avoidanceVector.multiplyScalar(
				this.avoidanceSpeed * deltaTime * 15 // Increased from 10
			);
			vel.add(avoidanceImpulse);
			
			// Update velocity for the tag we chose to move
			this.tagVelocities.set(tagToMove.id, vel);
		}
	}
	
	/**
	 * Ensure the tag cluster stays cohesive
	 */
	ensureCohesion(deltaTime) {
		// Skip if too few tags or no main cluster identified
		if (this.tags.length < 3 || this.mainCluster.length < 2) return;
		
		// Calculate the center of the main cluster
		let clusterCenter = new THREE.Vector3();
		let count = 0;
		
		for (const tagId of this.mainCluster) {
			const tag = this.tags.find(t => t.id === tagId);
			if (!tag || !tag.bbox) continue;
			
			const tagCenter = new THREE.Vector3();
			tag.bbox.getCenter(tagCenter);
			clusterCenter.add(tagCenter);
			count++;
		}
		
		if (count > 0) {
			clusterCenter.divideScalar(count);
		}
		
		// Find tags that aren't in the main cluster
		for (const tag of this.tags) {
			if (!tag.mesh || !tag.bbox || tag.isAnimating) continue;
			
			// Check if tag is disconnected from main cluster
			if (!this.mainCluster.includes(tag.id)) {
				const tagCenter = new THREE.Vector3();
				tag.bbox.getCenter(tagCenter);
				
				// Vector pointing toward cluster center
				const toCluster = clusterCenter.clone().sub(tagCenter).normalize();
				
				// Apply strong attraction force toward the main cluster
				const vel = this.tagVelocities.get(tag.id) || new THREE.Vector3();
				vel.add(toCluster.multiplyScalar(this.cohesionStrength * deltaTime * 10));
				this.tagVelocities.set(tag.id, vel);
			} 
			// For tags already in the main cluster, add a weak attraction to maintain cohesion
			else {
				const tagCenter = new THREE.Vector3();
				tag.bbox.getCenter(tagCenter);
				
				// Distance to cluster center
				const distToCenter = tagCenter.distanceTo(clusterCenter);
				
				// Only apply if too far from center
				if (distToCenter > this.cohesionRadius * 3) {
					// Calculate attraction strength based on distance
					const attractionStrength = Math.min(0.1, (distToCenter - this.cohesionRadius * 3) * 0.01);
					
					// Direction toward center
					const toCenter = clusterCenter.clone().sub(tagCenter).normalize();
					
					// Apply gentle attraction
					const vel = this.tagVelocities.get(tag.id) || new THREE.Vector3();
					vel.add(toCenter.multiplyScalar(attractionStrength));
					this.tagVelocities.set(tag.id, vel);
				}
			}
		}
	}
	
	/**
	 * Update tag positions based on velocities
	 */
	updatePositions(deltaTime) {
		for (const tag of this.tags) {
			if (!tag.mesh) continue;
			
			// Skip tags that are being animated by the tag animation system
			if (tag.isAnimating) continue;
			
			const velocity = this.tagVelocities.get(tag.id);
			if (!velocity) continue;
			
			// Apply velocity decay
			velocity.multiplyScalar(this.velocityDecay);
			
			// Stop very small movements
			if (velocity.length() < 0.001) {
				velocity.set(0, 0, 0);
				continue;
			}
			
			// Limit maximum velocity
			if (velocity.length() > this.maxVelocity) {
				velocity.normalize().multiplyScalar(this.maxVelocity);
			}
			
			// Apply velocity to position
			tag.mesh.position.add(velocity.clone().multiplyScalar(deltaTime));
			
			// Update bounding box after position change
			this.updateTagBoundingBox(tag);
		}
	}
	
	/**
	 * Update the tags reference if it changes
	 */
	updateTagsReference(newTags) {
		// Preserve velocities and targets for existing tags
		this.tags = newTags;
		
		// Initialize any new tags
		for (const tag of newTags) {
			if (!this.tagVelocities.has(tag.id)) {
				this.initializeTag(tag);
			}
		}
		
		// Recalculate the main cluster
		this.updateMainCluster();
	}
} 