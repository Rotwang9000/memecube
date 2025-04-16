import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Utils } from './utils.js';

/**
 * Handles the creation and display of individual tags
 */
export class TagCreator {
	constructor() {
		this.utils = new Utils();
		this.tagCounter = 0; // Counter for generating unique IDs
	}
	
	/**
	 * Create a 3D text mesh for a tag
	 */
	createTagMesh(text, font, size, fontName) {
		// Ensure text starts with '$' and is uppercase
		if (!text.startsWith('$')) {
			text = '$' + text;
		}
		text = text.toUpperCase();
		
		// Get font-specific parameters based on the font name
		const isShmup = fontName === 'shmup';
		const isHeysei = fontName === 'heysei';
		const isFreshman = fontName === 'freshman';
		
		// Adjust parameters based on font
		let heightFactor = 0.8; // Default deep extrusion
		let bevelEnabled = false;
		let bevelThickness = 0;
		let bevelSize = 0;
		let curveSegments = 1;
		
		// Font-specific adjustments
		if (isShmup) {
			heightFactor = 0.7;
			curveSegments = 2;
		} else if (isHeysei) {
			heightFactor = 0.5;
			curveSegments = 3;
		} else if (isFreshman) {
			heightFactor = 0.6;
			curveSegments = 2;
		}
		
		// Create blocky text geometry with font-specific adjustments
		const textGeometry = new TextGeometry(text, {
			font: font,
			size: size,
			height: size * heightFactor,
			curveSegments: curveSegments,
			bevelEnabled: bevelEnabled,
			bevelThickness: bevelThickness,
			bevelSize: bevelSize,
			bevelOffset: 0,
			bevelSegments: 0
		});
		
		// Make the text more cubic by first centering it
		textGeometry.computeBoundingBox();
		const textBbox = textGeometry.boundingBox.clone();
		const textWidth = textBbox.max.x - textBbox.min.x;
		const textHeight = textBbox.max.y - textBbox.min.y;
		const textDepth = textBbox.max.z - textBbox.min.z;
		
		// Center the geometry
		textGeometry.translate(
			-textWidth / 2,
			-textHeight / 2,
			-textDepth / 2
		);
		
		// Create a custom material to enhance the blocky, cube-like appearance
		const material = new THREE.MeshStandardMaterial({
			color: this.utils.getRandomVibrantColor(),
			metalness: 0.8, // Increased from 0.1 for more metallic appearance
			roughness: 0.2, // Decreased from 0.6 for more shiny appearance
			flatShading: true,
			emissive: 0x111111, // Slight emission for brightness
			emissiveIntensity: 0.2,
			envMapIntensity: 1.5 // Enhance environment reflections
		});
		
		// Font-specific material adjustments
		if (fontName === 'shmup') {
			// Arcade/pixelated style for shmup font
			material.metalness = 0.85;
			material.roughness = 0.15;
		} else if (fontName === 'heysei') {
			// Sleek, modern style for heysei font
			material.metalness = 0.9;
			material.roughness = 0.1;
		} else if (fontName === 'freshman') {
			// Classic blocky style for freshman font
			material.metalness = 0.75;
			material.roughness = 0.3;
		}
		
		// Create outline material for cube-like edges with more contrast
		const outlineMaterial = new THREE.MeshBasicMaterial({
			color: 0x000000,
			side: THREE.BackSide
		});
		
		// Create mesh for the text
		const textMesh = new THREE.Mesh(textGeometry, material);
		
		// Create outline mesh to enhance the cube-carved look
		const outlineGeometry = textGeometry.clone();
		outlineGeometry.scale(1.03, 1.03, 1.03); // Slightly larger for outline effect
		const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
		
		// Group the text and outline together
		const textGroup = new THREE.Group();
		textGroup.add(textMesh);
		textGroup.add(outlineMesh);
		
		// Add extra rotation to enhance the cube-like appearance
		// This helps create an isometric cube look
		const extraRotation = new THREE.Euler(
			THREE.MathUtils.degToRad(7), // Slight tilt up for isometric look
			THREE.MathUtils.degToRad(5), // Slight rotation for better depth
			0
		);
		textGroup.rotation.x += extraRotation.x;
		textGroup.rotation.y += extraRotation.y;
		
		return { 
			group: textGroup, 
			geometry: textGeometry 
		};
	}
	
	/**
	 * Create a complete tag data object
	 */
	createTagData(textMeshData, text, url, size, placement) {
		// Create a bounding box for collision detection
		const bbox = new THREE.Box3().setFromObject(textMeshData.group);
		
		// Apply rotation to the entire group
		textMeshData.group.rotation.copy(placement.rotation);
		
		// Generate a unique ID for this tag
		const tagId = `tag_${++this.tagCounter}`;
		
		// Store tag data
		return {
			id: tagId, // Unique identifier for physics system
			mesh: textMeshData.group,
			text: text,
			url: url,
			size: size,
			originalSize: size,
			position: new THREE.Vector3(), // Will be set during animation
			targetPosition: placement.position,
			rotation: textMeshData.group.rotation.clone(), // Store the final rotation
			bbox: bbox,
			isAnimating: true,
			isResizing: false,
			isMoving: false,
			animationProgress: 0,
			resizeProgress: 0,
			moveProgress: 0,
			targetSize: size,
			penetrationDepth: placement.penetrationDepth || 1.0,
			stickOutFactor: placement.stickOutFactor || 0.0,
			collidingTags: placement.collidingTags || [],
			hasProcessedCollisions: false
		};
	}
	
	/**
	 * Set up the initial position for a new tag's flight animation
	 */
	setInitialTagPosition(tagData, placement) {
		// Set initial position for the flight animation
		const flightDirection = placement.direction.clone();
		
		// Determine which end of the word will fly in first (randomize it)
		const reverseDirection = Math.random() > 0.5;
		
		// Calculate the text's primary axis based on rotation
		let primaryAxis = new THREE.Vector3(1, 0, 0); // Default to X axis
		
		// Transform the primary axis according to the tag's rotation
		const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(placement.rotation);
		primaryAxis.applyMatrix4(rotMatrix);
		primaryAxis.normalize();
		
		// Flip direction randomly for variety
		if (reverseDirection) {
			primaryAxis.multiplyScalar(-1);
		}
		
		// Set the starting position for the flight animation
		const startDistance = 50 + Math.random() * 20;
		const startPosition = placement.position.clone().add(
			primaryAxis.multiplyScalar(startDistance)
		);
		
		tagData.mesh.position.copy(startPosition);
		
		return tagData;
	}
	
	/**
	 * Generate a random tag for demo purposes
	 */
	generateRandomTag() {
		// Generate a random tag for demo mode
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const length = Math.floor(Math.random() * 8) + 1; // 1-8 characters
		
		let tag = '';
		for (let i = 0; i < length; i++) {
			tag += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
		}
		
		// Generate a mock URL
		const url = `https://${tag.toLowerCase()}.io`;
		
		// Random size (will be adjusted during positioning if necessary)
		const size = 0.5 + Math.random() * 1.0;
		
		return { text: tag, url, size };
	}
} 