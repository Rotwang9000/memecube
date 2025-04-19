/**
 * Mock Tag System for Testing
 * 
 * This file provides mock implementations of the tag system components
 * for testing without requiring the actual Three.js dependencies.
 */

// Mock THREE basic components
export class MockTHREE {
	static Vector3 = class {
		constructor(x = 0, y = 0, z = 0) {
			this.x = x;
			this.y = y;
			this.z = z;
		}
		
		clone() {
			return new MockTHREE.Vector3(this.x, this.y, this.z);
		}
		
		set(x, y, z) {
			this.x = x;
			this.y = y;
			this.z = z;
			return this;
		}
		
		copy(v) {
			this.x = v.x;
			this.y = v.y;
			this.z = v.z;
			return this;
		}
	};
	
	static Color = class {
		constructor(hex = 0xffffff) {
			this.hex = hex;
		}
		
		setRGB(r, g, b) {
			// Simple mock implementation
			return this;
		}
	};
	
	static Mesh = class {
		constructor(geometry, material) {
			this.geometry = geometry;
			this.material = material;
			this.position = new MockTHREE.Vector3();
			this.scale = new MockTHREE.Vector3(1, 1, 1);
			this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
		}
		
		updateMatrixWorld() {
			// Mock implementation
		}
	};
	
	static MeshStandardMaterial = class {
		constructor(options = {}) {
			this.color = options.color || new MockTHREE.Color();
			this.emissive = new MockTHREE.Color();
			this.emissiveIntensity = 0.1;
			this.metalness = options.metalness || 0.5;
			this.roughness = options.roughness || 0.5;
		}
	};
	
	static Group = class {
		constructor() {
			this.children = [];
		}
	};
	
	static Box3 = class {
		constructor() {
			this.min = new MockTHREE.Vector3();
			this.max = new MockTHREE.Vector3();
		}
		
		setFromObject() {
			// Mock implementation
			return this;
		}
		
		getCenter(target) {
			target.set(0, 0, 0);
			return target;
		}
	};
	
	static Raycaster = class {
		constructor() {
			// Mock implementation
		}
		
		setFromCamera() {
			// Mock implementation
		}
		
		intersectObjects() {
			return []; // Return empty array by default
		}
	};
}

// Mock FontLoader that immediately succeeds
export class MockFontLoader {
	constructor() {}
	
	load(url, onLoad) {
		// Immediately call onLoad with a mock font
		setTimeout(() => {
			onLoad({
				name: "MockFont",
				isFont: true,
				// Add any other properties needed
			});
		}, 10);
	}
}

// Mock TextGeometry
export class MockTextGeometry {
	constructor(text, parameters) {
		this.text = text;
		this.parameters = parameters;
		this.boundingBox = new MockTHREE.Box3();
	}
	
	computeBoundingBox() {
		// Mock implementation
	}
	
	translate() {
		// Mock implementation
	}
}

// Mock TagPhysics
export class MockTagPhysics {
	constructor(scene) {
		this.scene = scene;
		this.tags = new Map();
	}
	
	addNewTag(tag, existingTags) {
		// Simple mock implementation
		this.tags.set(tag.id, { position: new MockTHREE.Vector3(), velocity: new MockTHREE.Vector3() });
		return true;
	}
	
	removeTag(tagId) {
		this.tags.delete(tagId);
		return true;
	}
	
	handleTagResize(tag, newSize) {
		if (tag && tag.mesh) {
			tag.mesh.scale.set(newSize, newSize, newSize);
		}
		return true;
	}
	
	update() {
		// Mock update function
		return true;
	}
}

// Mock TagManager
export class MockTagManager {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		this.physics = new MockTagPhysics(scene);
		this.tags = [];
		this.tagsByName = new Map();
		this.fontLoaded = true;
		this.tagStyle = {
			font: { isFont: true, name: "MockFont" }
		};
	}
	
	createTag(name, url, options = {}) {
		const displayName = name.startsWith('$') ? name : `$${name}`;
		const id = `tag_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
		
		// Create a mock mesh
		const geometry = new MockTextGeometry(displayName, {});
		const material = new MockTHREE.MeshStandardMaterial();
		const mesh = new MockTHREE.Mesh(geometry, material);
		
		// Set scale
		const scale = options.scale || 1.0;
		mesh.scale.set(scale, scale, scale);
		
		// Create tag object
		const tag = {
			id,
			name: displayName,
			originalName: name,
			url: url || '#',
			mesh,
			createdAt: Date.now(),
			options
		};
		
		// Add to collections
		this.tags.push(tag);
		this.tagsByName.set(displayName, tag);
		
		return tag;
	}
	
	removeTag(tagId) {
		const tagIndex = this.tags.findIndex(t => t.id === tagId);
		if (tagIndex === -1) return;
		
		const tag = this.tags[tagIndex];
		this.tags.splice(tagIndex, 1);
		this.tagsByName.delete(tag.name);
	}
	
	resizeTag(tagId, newSize) {
		const tag = this.tags.find(t => t.id === tagId);
		if (tag && tag.mesh) {
			tag.mesh.scale.set(newSize, newSize, newSize);
		}
	}
	
	findIntersectedTag() {
		return null; // Mock implementation
	}
	
	pulseTag(tag) {
		// Mock implementation
	}
	
	update() {
		// Mock update function
	}
}

// Mock TagsManager
export class MockTagsManager {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		this.tagManager = new MockTagManager(scene, camera);
		this.tags = this.tagManager.tags;
		this.lastAgeUpdateTime = Date.now();
	}
	
	async addTag(text, url, size = null) {
		// Determine final size
		let finalSize = size !== null ? size : 1.0;
		
		// Create the tag
		const tag = this.tagManager.createTag(text, url, {
			scale: finalSize,
			size: 0.5
		});
		
		// Update references
		this.tags = this.tagManager.tags;
		
		// Add age tracking
		if (tag) {
			tag.creationTime = Date.now();
			this.sortTagsByAge();
		}
		
		return tag;
	}
	
	sortTagsByAge() {
		this.tags.sort((a, b) => a.creationTime - b.creationTime);
	}
	
	initializeTagAgeSystem() {
		const currentTime = Date.now();
		
		this.tags.forEach((tag, index) => {
			if (!tag.creationTime) {
				tag.creationTime = currentTime - (this.tags.length - index) * 5000;
			}
		});
		
		this.sortTagsByAge();
	}
	
	generateRandomTag() {
		const prefixes = ['MOON', 'DOGE', 'SHIB', 'APE', 'FLOKI', 'PEPE'];
		const suffixes = ['COIN', 'TOKEN', 'MOON', 'ROCKET', 'INU', 'SWAP'];
		
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		const text = Math.random() > 0.5 ? `${prefix}${suffix}` : prefix;
		const url = `https://example.com/${text.toLowerCase()}`;
		const size = 0.5 + Math.random() * 0.8;
		
		return { text, url, size };
	}
	
	calculateSizeByAge(originalSize, agePosition) {
		// Older tags should be smaller
		// For the oldest tag (agePosition = 0), size is reduced to 40%
		// For the newest tag (agePosition = 1), size stays at 100%
		const minSizeFactor = 0.4;
		const sizeFactor = minSizeFactor + (1 - minSizeFactor) * agePosition;
		
		// Calculate new size but don't go below minimum
		return Math.max(0.2, originalSize * sizeFactor);
	}
	
	update(deltaTime) {
		this.tagManager.update();
		this.tags = this.tagManager.tags;
	}
} 