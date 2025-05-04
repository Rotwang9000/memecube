const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3041;

const MIME_TYPES = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.otf': 'font/otf'
};

const server = http.createServer((req, res) => {
	console.log(`${req.method} ${req.url}`);
	
	// Handle favicon requests
	if (req.url === '/favicon.ico') {
		res.statusCode = 204; // No content
		res.end();
		return;
	}
	
	// Normalize URL path
	let filePath = '.' + req.url;
	if (filePath === './') {
		filePath = './index.html';
	}
	
	// Get file extension
	const extname = path.extname(filePath).toLowerCase();
	
	// Set default content type if extension doesn't match
	const contentType = MIME_TYPES[extname] || 'application/octet-stream';
	
	// Read file
	fs.readFile(filePath, (error, content) => {
		if (error) {
			if (error.code === 'ENOENT') {
				// File not found
				console.error(`File not found: ${filePath}`);
				fs.readFile('./index.html', (err, content) => {
					if (err) {
						// Can't even serve index.html
						res.writeHead(500);
						res.end('Error loading index.html');
					} else {
						// Serve index.html instead as fallback
						res.writeHead(200, { 'Content-Type': 'text/html' });
						res.end(content, 'utf-8');
					}
				});
			} else {
				// Server error
				console.error(`Server error: ${error.code}`);
				res.writeHead(500);
				res.end(`Server Error: ${error.code}`);
			}
		} else {
			// Success
			res.writeHead(200, { 'Content-Type': contentType });
			res.end(content, 'utf-8');
		}
	});
});

server.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}/`);
}); 