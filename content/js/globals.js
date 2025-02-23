function detectMobile() {
	let regexp = /android|iphone|kindle|ipad/i;
	return regexp.test(navigator.userAgent);
}

// Global functions

/// Return true if two objects are equal in their properties
function objEquals(a, b) {
	if(typeof a !== typeof b) return false;
	if(typeof a === 'object') {
		if( Object.keys(a).length !== Object.keys(b).length ) return false;
		for(let key in a) {
			if(!b.hasOwnProperty(key) || !objEquals(a[key], b[key])) return false;
		}
	} else {
		return a === b;
	}
	return true;
}

// Global variables

const DEV_MODE = window.location.protocol == "file:" || window.location.protocol == "http:";
const IS_MOBILE = detectMobile();
