// Public ---
const DOMAIN = "yourdomain.ch"; // change this !!!

const BASE_URL = "https://" + DOMAIN + "/";
const WSS_URL = "wss://" + DOMAIN;

// Dev ---
const DEV_BASE_URL = "file:///path/to/content/"; // change this !!!
const DEV_WS_URL = "ws://127.0.0.1:7999";

// Removes all bad characters from a string
function filterString( str, bad, len=Infinity ){
    let out = "";
    let l = Math.min(len, str.length);
    for(let i = 0 ; i < l ; ++i) if( !bad.includes(str[i]) ) out += str[i]
    return out;
}

function goTo( page ){
    location.replace( [BASE_URL, DEV_BASE_URL][+DEV_MODE] + page );
}

// Parses a character to the char-code
function toNum(char){
    return char.charCodeAt();
}

// Replaces an index of an string with a given char/string
function replaceAt(str, index, char){
    return str.slice(0, index) + char + str.slice( index + 1 );
}

// Only used for debuging
function log(msg){
    if(DEV_MODE) console.log(msg);
}

// Get the name (string) from a playtype
function getPlaytypeName( pt, fr ){
    return [
        "Obenabe",
        "Undeufe",
        "Trumpf " + ["Schilten", "Schaufeln"][+fr],
        "Trumpf " + ["Eicheln", "Kreuz"][+fr],
        "Trumpf " + ["Rosen", "Herz"][+fr],
        "Trumpf " + ["Schellen", "Ecken"][+fr],
        "Slalom Obenabe",
        "Slalom Undeufe",
        "Guschti",
        "Mary"
    ][pt];
}

const DEV_MODE = true;