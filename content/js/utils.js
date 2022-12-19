// Removes all bad characters from a string
function filterString( str, bad, len=Infinity ){
    let out = "";
    let l = Math.min(len, str.length);
    for(let i = 0 ; i < l ; ++i) if( !bad.includes(str[i]) ) out += str[i]
    return out;
}

function goTo( page ){
    window.history.pushState({}, '', window.location.href);
    location.replace( WEB_URL + page );
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

// Dev-mode is actived, when the website got accessed via filesystem or http
const DEV_MODE = window.location.protocol == "file:" || window.location.protocol == "http";

let WEB_URL = "https://" + window.location.hostname + "/";
let WSS_URL = "wss://" + window.location.hostname;

if(DEV_MODE){    
    if(window.location.protocol == "http:"){
        WEB_URL = "http://" + window.location.hostname + "/";
        WSS_URL = "ws://" + window.location.hostname;
    } else {
        WEB_URL = "file://" + window.location.pathname.substr( 0, window.location.pathname.lastIndexOf("/jasshaus/content/")+17 ) + "/";
        WSS_URL = "ws://127.0.0.1:7999";
    }
}
