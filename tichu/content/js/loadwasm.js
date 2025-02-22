// Check if browser supports WASM
if(typeof WebAssembly === 'undefined') {
	alert("Your browser does not support WebAssembly!");
	window.location.replace("index.html");
}

// Load WASM module
import init, * as exports from "../pkg/tichu_game.js";

console.log(exports);

// Load all definitions
Object.entries(exports).forEach(([name, exported]) => window[name] = exported);
await init();

// Run after Module function
if(typeof afterModule === 'function') afterModule();
