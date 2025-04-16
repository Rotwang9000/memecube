import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';

// Control mode constants
const CONTROL_MODES = {
	ORBIT: 'orbit',
	FLY: 'fly'
};

export function initControls(camera, domElement) {
	// Create both types of controls
	const orbitControls = new OrbitControls(camera, domElement);
	const flyControls = new FlyControls(camera, domElement);
	
	// Default to orbit controls
	let activeControlMode = CONTROL_MODES.ORBIT;
	let activeControls = orbitControls;
	
	// Configure orbit controls
	orbitControls.enableDamping = true;
	orbitControls.dampingFactor = 0.1;
	orbitControls.rotateSpeed = 0.5;
	orbitControls.zoomSpeed = 0.7;
	orbitControls.panSpeed = 0.5;
	orbitControls.minDistance = 15;
	orbitControls.maxDistance = 80;
	
	// Configure fly controls
	flyControls.movementSpeed = 15; 
	flyControls.rollSpeed = 0.5;
	flyControls.dragToLook = true;
	flyControls.autoForward = false;
	// Disable fly controls initially
	flyControls.enabled = false;
	
	// Add mode toggle button
	const toggleButton = document.createElement('button');
	toggleButton.textContent = 'Switch to Fly Mode';
	toggleButton.style.position = 'absolute';
	toggleButton.style.bottom = '20px';
	toggleButton.style.right = '20px';
	toggleButton.style.zIndex = '1000';
	document.body.appendChild(toggleButton);
	
	// Mode toggle handler
	toggleButton.addEventListener('click', () => {
		if (activeControlMode === CONTROL_MODES.ORBIT) {
			// Switch to fly mode
			orbitControls.enabled = false;
			flyControls.enabled = true;
			activeControlMode = CONTROL_MODES.FLY;
			activeControls = flyControls;
			toggleButton.textContent = 'Switch to Orbit Mode';
			
			// Preserve current camera position and rotation
			flyControls.object.position.copy(camera.position);
			flyControls.object.rotation.copy(camera.rotation);
		} else {
			// Switch to orbit mode
			flyControls.enabled = false;
			orbitControls.enabled = true;
			activeControlMode = CONTROL_MODES.ORBIT;
			activeControls = orbitControls;
			toggleButton.textContent = 'Switch to Fly Mode';
			
			// Update orbit controls target if needed
			orbitControls.target.set(0, 0, 0);
			orbitControls.update();
		}
	});
	
	// Handle keyboard events for both controls
	const onKeyDown = (event) => {
		// Spacebar toggles between control modes
		if (event.code === 'Space') {
			toggleButton.click();
		}
	};
	
	window.addEventListener('keydown', onKeyDown);
	
	// Add help text for fly controls
	const helpText = document.createElement('div');
	helpText.style.position = 'absolute';
	helpText.style.bottom = '60px';
	helpText.style.right = '20px';
	helpText.style.zIndex = '1000';
	helpText.style.color = 'white';
	helpText.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
	helpText.style.padding = '10px';
	helpText.style.borderRadius = '5px';
	helpText.style.display = 'none'; // Hidden by default
	helpText.innerHTML = `
		<strong>Fly Controls:</strong><br>
		W/S - Forward/Backward<br>
		A/D - Left/Right<br>
		Q/E - Roll<br>
		R/F - Up/Down<br>
		Mouse - Look direction
	`;
	document.body.appendChild(helpText);
	
	// Show/hide help text when switching modes
	toggleButton.addEventListener('click', () => {
		helpText.style.display = activeControlMode === CONTROL_MODES.FLY ? 'block' : 'none';
	});
	
	// Create a wrapped update function
	const wrappedUpdate = () => {
		// Call the appropriate update method
		if (activeControlMode === CONTROL_MODES.ORBIT) {
			orbitControls.update();
		} else {
			flyControls.update(1.0 / 60.0); // Assume 60fps
		}
	};
	
	// Return an object with update method and cleanup
	return {
		update: wrappedUpdate,
		cleanup: () => {
			orbitControls.dispose();
			flyControls.dispose();
			window.removeEventListener('keydown', onKeyDown);
			document.body.removeChild(toggleButton);
			document.body.removeChild(helpText);
		},
		getActiveControls: () => activeControls,
		
		// Add methods to enable/disable controls temporarily
		// This is useful for camera animations
		disableControls: () => {
			if (activeControlMode === CONTROL_MODES.ORBIT) {
				orbitControls.enabled = false;
			} else {
				flyControls.enabled = false;
			}
		},
		
		enableControls: () => {
			if (activeControlMode === CONTROL_MODES.ORBIT) {
				orbitControls.enabled = true;
			} else {
				flyControls.enabled = true;
			}
		}
	};
} 