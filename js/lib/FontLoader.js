import { Cache } from 'three';
import { FileLoader } from 'three';
import { LoadingManager } from 'three';
import { Font } from './Font.js';

class FontLoader extends LoadingManager {

	constructor( manager ) {

		super( manager );

	}

	load( url, onLoad, onProgress, onError ) {

		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.load( url, text => {

			let json;

			try {

				json = JSON.parse( text );

			} catch ( e ) {

				console.warn( 'THREE.FontLoader: typeface.js no longer supports "' + url + '" format.' );
				return;

			}

			const font = this.parse( json );

			if ( onLoad ) onLoad( font );

		}, onProgress, onError );

	}

	loadAsync( url, onProgress ) {

		return new Promise( ( resolve, reject ) => {

			this.load( url, resolve, onProgress, reject );

		} );

	}

	parse( json ) {

		return new Font( json );

	}

}

export { FontLoader }; 