function saveSettings(){
    let bools = [];
    for(let i = 0 ; i < 8 ; ++i){
        let ele = document.getElementById("checkbox" + i);
        if(ele === null){
            bools.push(false);
            continue;
        }
        bools.push( ele.checked );
    }
    saveBools(bools);

    let vals = [];
    for(let i = 0 ; i < 1 ; ++i){
        let ele = document.getElementById("range" + i);
        if(ele === null){
            vals.push(0);
            continue;
        }
        vals.push( ele.value );
    }
    saveValues(vals);

    if(document.getElementById("name") != null){
        let name = document.getElementById("name").value.substr(0,16);
        localStorage.setItem("JasshausDataName", name);
    }
}

// Draws 2 example cards with the given settings
function settingDrawDarkval(){
    const ctx = document.getElementById("settingDarkvalcanvas").getContext('2d');

    // Draw the cards
    let cw = 161;
    let ch = 247;
    let img = new Image();
    img.onload = function(e){
        for(let i = 0 ; i < 2 ; ++i) ctx.drawImage(img, 0, 0, 161, 247, i*cw, 0, cw, ch);
        let darkval = document.getElementById("range0").value;
        ctx.fillStyle = "rgba(0,0,0," + (darkval / 255.0) + ")";
        ctx.fillRect(cw, 0, cw, ch);
    }
    let lang = ["fr", "de"][ +!document.getElementById("checkbox2").checked ];
    img.src = "img/" + lang + "/08.png"; // Example card
}

// Updates the name-field (remove bad characters etc.)
function checkName(){
    let name = document.getElementById("name").value.substr(0, 16);
    document.getElementById("name").value = name;
}

function cardLang( fr ){
    document.getElementById("checkboxGE").checked = !fr;
    document.getElementById("checkbox2").checked = fr;
    settingDrawDarkval();
}

function addTooltip( parent, tooltip ){
        if( tooltip == "" ) return;

        let div = document.createElement('div');
        div.classList.add("SettingTooltip");
        div.innerHTML =
        "<img src='img/tooltip.svg' class='SettingTooltipimg'>" +
        "<span class='SettingTooltipbox'>" + tooltip + "</span>";

        parent.appendChild(div);
}

function createInput( parent_ID, inputType, inputID, label, tooltip="", callback=function(e){} ){
    let div = document.createElement('div');

    let inp = document.createElement('input');
    inp.id = inputType + inputID;
    inp.type = inputType;
    inp.onchange = callback;

    div.appendChild( document.createTextNode( label + " " ) );
    div.appendChild( inp );
    addTooltip( div, tooltip );

    document.getElementById(parent_ID).appendChild(div);
}

function createRange(min, max, std, id, callback=function(e){}){
    let range = document.createElement('input');
    range.type = "range";
    range.min = min;
    range.max = max;
    range.value = std;
    range.id = id;
    range.onchange = callback;
    return range;
}

function insertDarkvalSetting( parent_ID, noTooltips=false ){
    let par = document.getElementById(parent_ID);

    par.appendChild( document.createTextNode("Kartendunkelheit ") );
    if(!noTooltips) addTooltip( par, "Karten werden düster dargestellt, wenn es nicht legal ist, sie zu spielen." );
    par.appendChild( document.createElement('br') );
    par.appendChild( createRange(0, 255, 128, "range0", function(e){ settingDrawDarkval(); }) );
    par.appendChild( document.createElement('br') );

    let canvas = document.createElement( 'canvas' );
    canvas.width = 332; canvas.height = 247;
    canvas.id = "settingDarkvalcanvas";
    par.appendChild( canvas );
    par.appendChild( document.createElement('br') );
}

function insertSettings( parent_ID, noTooltips=false ){
    const BOOL = "checkbox";
    let ele = document.getElementById(parent_ID);
    let addSpace = function(){ ele.appendChild( document.createElement('br') ); };

    createInput(parent_ID, BOOL, "GE", "Deutsche Jasskarten", "", function(e){ cardLang(false); });
    createInput(parent_ID, BOOL, 2, "Französische Jasskarten", "", function(e){ cardLang(true); });
    addSpace();
    if(noTooltips){
        createInput(parent_ID, BOOL, 1, "Karten klicken"  );
        createInput(parent_ID, BOOL, 3, "Karten-Animationen deaktivieren" );
    } else {
        createInput(parent_ID, BOOL, 1, "Karten klicken", "Wenn angekreuzt, müssen Karten nur geklickt (anstatt gezogen) werden, um sie auszuspielen." );
        createInput(parent_ID, BOOL, 3, "Karten-Animationen deaktivieren", "Deaktiviert die Animation, wenn Karten gespielt werden." );
    }
    addSpace();
    insertDarkvalSetting(parent_ID, noTooltips);
}

function updateSettingsFromStorage(){
    for(let i = 0 ; i < 255 ; ++i){
        let ele = document.getElementById("checkbox" + i);
        if(ele === null) continue;
        ele.checked = getStorageBool(i);
    }
    for(let i = 0 ; i < 255 ; ++i){
        let ele = document.getElementById("range" + i);
        if(ele === null) continue;
        ele.checked = getStorageVal(i);
    }
}
