// Define module mappings for the application
const importMap = {
	imports: {
		"three": "../lib/three.module.js",
		"three/addons/": "../lib/",
		"three/addons/controls/OrbitControls.js": "../lib/OrbitControls.js"
	}
};

// Create a script element with the import map
const script = document.createElement('script');
script.type = 'importmap';
script.textContent = JSON.stringify(importMap);

// Add it to the document head
document.head.appendChild(script); 