import { ShapePath } from 'three';

/**
 * Text geometry implementation based on:
 *   typeface.js (https://github.com/components-ai/typeface.js)
 *   three-bmfont-text (http://github.com/Jam3/three-bmfont-text)
 */

class Font {

	constructor( data ) {

		this.isFont = true;

		this.type = 'Font';

		this.data = data;

	}

	generateShapes( text, size = 100 ) {

		const shapes = [];
		const paths = createPaths( text, size, this.data );

		for ( let p = 0, pl = paths.length; p < pl; p ++ ) {

			shapes.push( ...paths[ p ].toShapes() );

		}

		return shapes;

	}

}

function createPaths( text, size, data ) {

	const chars = Array.from( text );
	const scale = size / data.resolution;
	const line_height = ( data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness ) * scale;

	const paths = [];

	let offsetX = 0, offsetY = 0;

	for ( let i = 0; i < chars.length; i ++ ) {

		const char = chars[ i ];

		if ( char === '\n' ) {

			offsetX = 0;
			offsetY -= line_height;

		} else {

			const ret = createPath( char, scale, offsetX, offsetY, data );
			if (ret) {
				offsetX += ret.offsetX;
				paths.push( ret.path );
			}

		}

	}

	return paths;

}

function createPath( char, scale, offsetX, offsetY, data ) {

	const glyph = data.glyphs[char] || data.glyphs[char.codePointAt(0)] || data.glyphs[ '?' ];

	if ( ! glyph ) {

		console.error( 'THREE.Font: character "' + char + '"(' + char.codePointAt(0) + ') does not exists in font family ' + data.familyName + '.', data );

		return;

	}

	const path = new ShapePath();

	let x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

	if ( glyph.o ) {

		const outline = glyph._cachedOutline || ( glyph._cachedOutline = glyph.o.split( ' ' ) );

		for ( let i = 0, l = outline.length; i < l; ) {

			const action = outline[ i ++ ];

			switch ( action ) {

				case 'm': // moveTo

					x = parseInt( outline[ i ++ ] ) * scale + offsetX;
					y = parseInt( outline[ i ++ ] ) * scale + offsetY;

					path.moveTo( x, y );

					break;

				case 'l': // lineTo

					x = parseInt( outline[ i ++ ] ) * scale + offsetX;
					y = parseInt( outline[ i ++ ] ) * scale + offsetY;

					path.lineTo( x, y );

					break;

				case 'q': // quadraticCurveTo

					cpx = parseInt( outline[ i ++ ] ) * scale + offsetX;
					cpy = parseInt( outline[ i ++ ] ) * scale + offsetY;
					cpx1 = parseInt( outline[ i ++ ] ) * scale + offsetX;
					cpy1 = parseInt( outline[ i ++ ] ) * scale + offsetY;

					path.quadraticCurveTo( cpx1, cpy1, cpx, cpy );

					break;

				case 'b': // bezierCurveTo

					cpx = parseInt( outline[ i ++ ] ) * scale + offsetX;
					cpy = parseInt( outline[ i ++ ] ) * scale + offsetY;
					cpx1 = parseInt( outline[ i ++ ] ) * scale + offsetX;
					cpy1 = parseInt( outline[ i ++ ] ) * scale + offsetY;
					cpx2 = parseInt( outline[ i ++ ] ) * scale + offsetX;
					cpy2 = parseInt( outline[ i ++ ] ) * scale + offsetY;

					path.bezierCurveTo( cpx1, cpy1, cpx2, cpy2, cpx, cpy );

					break;

			}

		}

	}

	return { offsetX: glyph.ha * scale, path: path };

}

export { Font }; 