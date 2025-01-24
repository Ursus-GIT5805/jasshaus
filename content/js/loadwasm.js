// Load WASM module
import init, * as exports from "../pkg/jasshaus_game.js";

// Load all definitions
Object.entries(exports).forEach(([name, exported]) => window[name] = exported);
await init();

// Run after Module function
if(typeof afterModule === 'function') afterModule();
