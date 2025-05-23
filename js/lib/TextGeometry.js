import {
	ExtrudeGeometry
} from 'three';

class TextGeometry extends ExtrudeGeometry {

	constructor( text, parameters = {} ) {

		const font = parameters.font;

		if ( font === undefined ) {

			super(); // generate empty geometry

			this.type = 'TextGeometry';

			return;

		}

		const shapes = font.generateShapes( text, parameters.size );

		// translate parameters to ExtrudeGeometry API

		parameters.depth = parameters.height !== undefined ? parameters.height : 50;

		// defaults

		if ( parameters.bevelThickness === undefined ) parameters.bevelThickness = 10;
		if ( parameters.bevelSize === undefined ) parameters.bevelSize = 8;
		if ( parameters.bevelEnabled === undefined ) parameters.bevelEnabled = false;

		super( shapes, parameters );

		this.type = 'TextGeometry';

	}

}

export { TextGeometry }; 