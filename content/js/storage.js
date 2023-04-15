// Loads a string from the localstorage.
// If storageItem == null, "def" will be returned instead
function getStorage( key, def ){
    let stor = localStorage.getItem(key);
    if(stor === null) return def;
    return stor;
}

// Because that 8 bools can be stored in 1 character, this function returns the i-th bool
// from the bool-storage
function getStorageBool(i){
    let bool = getStorage("JasshausDataBools", String.fromCharCode(0));
    return Boolean( 1 & toNum( bool.charAt( Math.floor(i/8) ) ) >> (7 - i%8) );
}

function getStorageVal(i){
    let val = getStorage("JasshausDataValues", String.fromCharCode(128));
    return toNum( val[i] );
}

// Saves a list of bools to the localStorage
function saveBools(bool){
    let nums = [];

    for(let i = 0 ; i < Math.ceil(bool.length/8) ; ++i) nums.push(0);
    for(let p = 0 ; p < bool.length ; ++p){
        nums[ Math.floor(p/8) ] += (+bool[p]) << ( 7 - p%8 );
    }

    let str = "";
    for(let i = 0 ; i < nums.length ; ++i) str += String.fromCharCode(nums[i]);

    localStorage.setItem("JasshausDataBools", str);
}

// Saves a list of values to the localStorage
function saveValues(val){
    let str = "";
    for(let i = 0 ; i < val.length ; ++i) str += String.fromCharCode(val[i]);
    localStorage.setItem("JasshausDataValues", str);
}

// Save a single bool to the localStorage, without changing other stored booleans
function saveBool(bool, index){
    let boolStr = getStorage("JasshausDataBools", String.fromCharCode(0) );
    let num = toNum( boolStr.charAt( Math.floor(index / 8) ) );
    num &= ~(1 << (7 - index % 8));
    num |= (+bool) << (7 - index % 8);
    boolStr = replaceAt( boolStr, Math.floor(index / 8), String.fromCharCode( num ) );
    localStorage.setItem( "JasshausDataBools", boolStr );
}

// Save a single value to the localStorage, without changing other stored values
function saveValue(val, index){
    let valStr = getStorage("JasshausDataValues", String.fromCharCode(128) );
    valStr = replaceAt( valStr, index, String.fromCharCode( val ) );
    localStorage.setItem( "JasshausDataValues", valStr );
}
