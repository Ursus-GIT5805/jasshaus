function saveAndExit(){
    let bools = [];
    for(let i = 0 ; i < 255 ; ++i){ // 255 is an arbitrary chosen number
        let ele = document.getElementById("bool" + i);
        if(ele === null) break;
        bools.push( ele.checked );
    }
    saveBools(bools);

    let vals = [];
    for(let i = 0 ; i < 255 ; ++i){ // 255 is an arbitrary chosen number
        let ele = document.getElementById("range" + i);
        if(ele === null) break;
        vals.push( ele.value );
    }
    saveValues(vals);

    let name = document.getElementById("name").value;
    name = filterString(name, ['\t', ' ', '\n', '<', '>', '"', '\'', '(', ')'], 16);

    localStorage.setItem("JasshausDataName", name);

    goTo('index.html');
}

// Draws 2 example cards with the given settings
function drawExample(){
    const ctx = document.getElementById("cardsettingcanvas").getContext('2d');

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
    let lang = ["fr", "de"][ +!document.getElementById("bool2").checked ];
    img.src = "img/" + lang + "/08.png"; // Example card
}

// Updates the name-field (remove bad characters etc.)
function checkName(){
    let name = document.getElementById("name").value;
    name = filterString(name, ['\t', ' ', '\n', '<', '>', '"', '\'', '(', ')'], 16);
    document.getElementById("name").value = name;
}

function cardLang( fr ){
    document.getElementById("boolGE").checked = !fr;
    document.getElementById("bool2").checked = fr;
    drawExample();
}

window.onload = function(e){
    // Load all saved settings and display them
    for(let i = 0 ; i < 255 ; ++i){
        let ele = document.getElementById("bool" + i);
        if(ele === null) break;
        ele.checked = getStorageBool(i);
    }

    for(let i = 0 ; i < 255 ; ++i){
        let ele = document.getElementById("range" + i);
        if(ele === null) break;
        ele.checked = getStorageVal(i);
    }
    document.getElementById("name").value = getStorage( "JasshausDataName", "" );
    document.getElementById("bool2").checked = !document.getElementById("boolGE").checked;

    drawExample();
}