// Define module mappings for the application
const importMap = {
	imports: {
		"three": "/js/lib/three.module.js",
		"three/addons/": "/js/lib/",
		"three/addons/controls/OrbitControls.js": "/js/lib/OrbitControls.js",
		"three/addons/controls/FlyControls.js": "/js/lib/FlyControls.js",
		"three/addons/loaders/FontLoader.js": "/js/lib/FontLoader.js",
		"three/addons/geometries/TextGeometry.js": "/js/lib/TextGeometry.js",
		"gsap": "/js/lib/gsap-wrapper.js"
	}
};

// Create a script element with the import map
const script = document.createElement('script');
script.type = 'importmap';
script.textContent = JSON.stringify(importMap);

// Add it to the document head
document.head.appendChild(script); 