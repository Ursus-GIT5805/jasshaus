var id = 0; // Your ID in the game
var darkval = getStorageVal(0) / 255.0;
var mouseDown = false;
var players = new Playerhandler();
var cardIMG = []; // Images of all cards
var hand = new Hand();
var round = new Round();
const canvas = document.getElementById("cards");

// Setup window event functions
window.onload = function(e){
    loadCards();

    window.onresize();
    hand.onResize();
    round.onResize();

    startWS();

    hand.clickonly = document.getElementById("bool1").checked = getStorageBool(1);
    document.getElementById("boolGE").checked = !getStorageBool(2);
    document.getElementById("bool2").checked = getStorageBool(2);
    document.getElementById("range0").value = getStorageVal(0);

    if(getStorageBool(0)) players.muted = [true, true, true, true];
    players.muted[id] = false; // Don't mute yourself

    for(let i = 1 ; i < 4 ; ++i){
        const ind = i;
        document.getElementById("mute" + ind).checked = false;
        document.getElementById("volume" + ind).value = 64.0;
        document.getElementById("volumectrl" + ind).style.display = "none";
        
        document.getElementById("mute" + ind).onchange = function(e){
            let i = (id + ind) % 4;
            players.muted[i] = document.getElementById("mute" + ind).checked;
        }
        document.getElementById("volume" + ind).onchange = function(e){
            log( document.getElementById("volume" + ind).value / 64.0 );
            document.getElementById("audio" + ((id+ind) % 4)).volume = document.getElementById("volume" + ind).value / 64.0;
        }
    }

    loadCards();
}

function loadCards(){
    let fr = getStorageBool(2);
    let lang = ["de", "fr"][+fr];
    let cl = 0;

    cardIMG = [];
    // Load all card images
    for(let c = 0 ; c < 4 ; ++c){
        var l = [];
        for(let n = 0 ; n < 9 ; ++n){
            let img = new Image;
            img.onload = function(){ if(++cl == 36) hand.drawAll(); } // Draw all cards when all images are loaded
            img.src = "img/" + lang + "/" + c + n + ".png";
            l.push(img);
        }
        cardIMG.push(l);
    }

    document.getElementById("PT2").src = "img/trumpf" + ["shield", "spade"][+fr] + ".png";
    document.getElementById("PT3").src = "img/trumpf" + ["acorn", "clubs"][+fr] + ".png";
    document.getElementById("PT4").src = "img/trumpf" + ["rose", "heart"][+fr] + ".png";
    document.getElementById("PT5").src = "img/trumpf" + ["bell", "diamond"][+fr] + ".png";

    for(let i = 2 ; i < 6 ; ++i){
        document.getElementById("PTT" + i).innerHTML = getPlaytypeName( i, fr ).replace("Trumpf ", '');
    }
}

canvas.onmousedown = function(e){
    if(e.button != 0) return; //only left click allowed
    mouseDown = true;
    hand.onMousedown( e.clientX, e.clientY );
}

canvas.onmousemove = function(e){
    hand.onMousemove( e.clientX, e.clientY, mouseDown );
}

canvas.onmouseup = function(e){
    if(e.button != 0) return; //only left mousebutton allowed
    mouseDown = false;
    hand.onMouseup( e.clientX, e.clientY );
}

canvas.ontouchstart = function(e){
    if(e.touches.length > 1) return;
    hand.onMousedown( e.touches[0].clientX, e.touches[0].clientY );
}

canvas.ontouchmove = function(e){
    if(e.touches.length > 1) return;
    hand.onMousemove( e.touches[0].clientX, e.touches[0].clientY, true );
}

canvas.ontouchend = function(e){
    hand.onMouseup();
}

window.onresize = function(e){
    let BASE_W = 1280;
    let BASE_H = 720;
    let prop = Math.min( document.body.clientWidth/BASE_W, document.body.clientHeight/BASE_H );
    document.documentElement.style.fontSize = prop*100 + "%";

    hand.onResize();
    round.onResize();
}

window.onkeydown = function(e){
    if(document.getElementById("chatWindow").style.display != "block"){
        if(e.which == 84) toggleChat(); // on 't', open chat
        return;
    }

    if(!e.ctrlKey) document.getElementById("chatInput").focus();

    if(e.which == 13){ // Enter: Send message
        let msg = document.getElementById("chatInput").value;
        document.getElementById("chatInput").value = ""; // Clear field

        if(msg == "") return;

        send( 3, msg );
    } else if(e.which == 27){ // Escape: close chat
        toggleChat();
    }
}

function updateCurrentplayer(){
    players.setStar( round.curplr );
    hand.onTurn = round.curplr == id;

    if( hand.onTurn ){
        if(round.turn < 2) checkShow();
        hand.updateLegal( round.ruletype, round.bestcarddata, round.turncolor );
    }
    hand.drawAll();
}

// Loads and sends the username and important settings to the server
function loadSettings(){
    var name = getStorage("JasshausDataName", ""); //remove all whitespaces

    if(name.length > 16) name = name.substr(0,16);

    while(name == ""){
        name = prompt("Gib einen Spitznamen ein! (Max. 16 Buchstaben)", "");
        if(name == null) name = "Unnamed"; // User must have disabled "prompt()"
        localStorage.setItem( "JasshausDataName", name );
    }

    send( 4, name );
}
