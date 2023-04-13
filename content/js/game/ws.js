var connected = false;
var socket = null;

/*
 * All the functions as following
 * f + (header_byte in decimal number)
 * see headers_doc.txt for the purpose of a header
*/

async function f0(dat){
    var card = parseCard( dat[0] );
    round.playCard( card, (dat[0] >>> 6) > 0 );
}

async function f1(dat){
    let shw = new Show(dat[0] >> 4, dat[0] % 16, dat[1] % 16);
    let plr = (dat[1] >>> 4) % 4;
    toShow.push( [shw, plr, true] );
    round.sp[ plr % 2 ] += shw.getPoints(); // Add points
    round.updatePoints( plr % 2 ); // Update points
}

async function f2(dat){
    if( dat[0] % 16 == 10 ) return;

    hand.allUsable = false;
    round.playtype = dat[0] % 16;
    round.ruletype = [0,1,2,3,4,5,0,1,0,1][ round.playtype ];
    round.misere = Boolean((dat[0] >>> 6) % 2);
    round.passed = Boolean((dat[0] >>> 7));

    // Set the player, who will start play
    round.beginplayer = ((dat[0] >>> 4) % 4);
    if(round.passed && 1 < round.playtype && round.playtype < 6) round.beginplayer = (round.beginplayer+2) % 4;

    round.curplr = round.beginplayer;
    updateCurrentplayer();

    // Display an announce message
    let ann = ["", "Misère: "][+round.misere] + getPlaytypeName( dat[0] % 16, getStorageBool(2) ) + "!";
    players.onMSG( ann, ((dat[0] >>> 4) % 4), "#FFFF00" );

    // Update everything onscreen
    round.updateRoundDetails();
    hand.drawAll();
}

async function f3(dat){
    if(dat[0] >>> 2 == 0 && players.muted[ dat[0] % 4 ]) return;
    let col = ["#FFFFFF", "#FFFF00", "#DDDDDD", "#FF0000"][ (dat[0] >>> 2) % 4 ];

    players.onMSG( numArrayToString(dat.slice(1)), dat[0] % 4, col );
}

async function f4(dat){
    var name = "";
    for(let i = 1 ; i < dat.length ; ++i) name += String.fromCharCode(dat[i]);
    players.setName( name, dat[0] % 4 );
    players.numconnected += 1;
    document.getElementById("plrNum").innerHTML = players.numconnected;

    if( Boolean(1 & (dat[0] >>> 2)) ){ // This player is using the microphone
        players.addSymbol( "img/mic.svg", dat[0] % 4 );
        document.getElementById("volumectrl" + ((4 - id + dat[0]) % 4)).style.display = "block";
    }
}

async function f5(dat){
    let ele = document.getElementById("plrRev");
    ele.innerHTML = dat[0];
}

async function f6(dat){
    let h = dat[0];
    let plr = h >>> 2;
    h = h % 4;  

    let json = JSON.parse( numArrayToString( dat ).substr(1) );
    if(h == 0) await onOffer( json, plr );
    if(h == 1) await onAnswer( json, plr );
    if(h == 2) await onIceCanditate( json, plr );    
}

async function f7(dat){
    let plr = dat[0];
    players.addSymbol( "img/mic.svg", plr ); // Add a symbol so the user knows he is using the mic
    document.getElementById("volumectrl" + ((4 - id + plr) % 4)).style.display = "block";
    if( useMic ) await sendOffer(plr);
}

async function f8(dat){
    let order = [];
    let symbols = [];
    let names = [];
    for(let i = 0 ; i < 4 ; ++i){
        let ind = (4 - id + i) % 4;
        order.push( (dat[0] >> (i*2)) % 4 );
        names.push( document.getElementById("player" + ind).innerHTML );
        symbols.push( document.getElementById("symbols" + ind).innerHTML );
    }

    id = order[id];
    pc = [ pc[ order[0] ], pc[ order[1] ], pc[ order[2] ], pc[ order[3] ] ];
    players.muted = [ players.muted[ order[0] ], players.muted[ order[1] ], players.muted[ order[2] ], players.muted[ order[3] ]]

    for(let i = 0 ; i < 4 ; ++i){
        let ind = (4 - id + i) % 4;
        players.setName( names[ind], order[ind] );
        document.getElementById("symbols" + order[ind]).innerHTML = symbols[ind];
    }
}

async function f9(dat){
    round.curplr = dat[0];
    updateCurrentplayer();
}

async function f10(dat){
    round.passed = Boolean( dat[0] >> 2 );
    players.setStar( dat[0] % 4 )

    if(round.passed) document.getElementById("roundPass").style.visibility = "visible";

    if( dat[0] % 4 == id ) startAnnounce();
    else {
        hand.allUsable = false;
        hand.drawAll();
    }
}

async function f11(dat){
    id = dat[0]; 
    loadSettings();
    initRTC();
}

async function f12(dat){
    hand.cards = parseCards( dat );
    hand.drawAll();

    if(round.turn < 2 && hand.cards.length == 9){
        var shows = hand.getShows();
        for(let i = 0 ; i < shows.length ; ++i) toShow.push( [shows[i], id, false] );
    }
}


async function f13(dat){
    document.getElementById("startWindow").style.display = "none"; // The round has already started

    for(let i = 0 ; i < 2 ; ++i){
        let t = i*6;
        round.points[i] = (dat[0+t] << 8) + dat[1+t];
        round.gp[i] = (dat[2+t] << 8) + dat[3+t];
        round.sp[i] = (dat[4+t] << 8) + dat[5+t];
        round.updatePoints(i);
    }

    let pt = dat[12] % 16;
    if(pt != 15) f2( [ dat[12] ] );
    round.passed = dat[12] >>> 7;

    let numC = (dat[18] >>> 2) % 4;
    round.turn = dat[18] >>> 4;
    round.curplr = dat[18] % 4;
    round.beginplayer = (4-numC + round.curplr) % 4;
    round.curplr = round.beginplayer;

    f12( dat.slice(13, 18) );
    if( round.playtype != -1 ) updateCurrentplayer();

    if( pt == 6 || pt == 7 ) round.ruletype = (round.turn-1 +(pt == 7)) % 2;
    if( pt == 8 || pt == 9 ) round.ruletype = ((pt == 9)+(round.turn > 4)) % 2;
    round.updateRoundDetails();
    
    let gamestate = dat[19];

    for(let i = 0 ; i < numC ; ++i) f0( [ dat[20 + i] ] );
    if(round.turn != 1) toShow.length = 0;
    if(round.passed) document.getElementById("roundPass").style.visibility = "visible";

    if( round.playtype == -1 && gamestate == 1 ){
        let annplr = ((dat[12] >>> 4) + 2*+round.passed) % 4;
        if( annplr == id ) startAnnounce();
    }
}

async function f14(dat){
    let ev = dat[0];

    if(ev == 0){ // Round has ended
        for(let i = 0 ; i < 2 ; ++i) round.points[i] += (round.gp[i] + round.sp[i]);

        var hands = [];
        for(let i = 0 ; i < 4 ; ++i) hands.push( parseCards( dat.slice(11+i*5, 16+i*5) ) );

        var cards = [dat.slice(1, 6), dat.slice(6, 11)]
        updateSummary( cards, hands );

        hand.onTurn = false;
        hand.drawAll();

        endRound = true;
        if(round.cardQueue.length == 0) round.continueCardQueue();
    } else if(ev == 1 || ev == 2){ // Game has ended
        for(let i = 0 ; i < toShow.length ; ++i){ // You can't show anything when the game has ended
            if(toShow[i][2]) continue;
            toShow.splice(i, 1);
            --i;
        }

        updateEndresult( id % 2 == ev - 1 );
        players.setStar(0);
        endGame = true;
        if(!endRound) document.getElementById("endWindow").style.display = "block";
    } else if(ev == 3){ // New game has started
        document.getElementById("endWindow").style.display = "none";
        round.reset();
        round.points = [0, 0];
        round.updateRoundDetails();
        round.updatePoints(0);
        round.updatePoints(1);
    } else if(ev == 4){ // Start team choosing
        document.getElementById("startWindow").style.display = "none";
        document.getElementById("teamWindow").style.display = "block";
    } else if(ev == 5){ // Game starts
        document.getElementById("teamWindow").style.display = "none";
    }
}

async function f15(dat){
    round.gp[ dat[0] >> 1 ] += (dat[0]%2 << 8) + dat[1];
    round.updatePoints( (dat[0] >> 1) % 2 );
}

async function f16(dat){
    let plr = dat[0];
    players.setName("", plr);
    players.onMSG( "Tschüss!", plr, "#FFFF00" );
    players.removeSymbols( plr );
    players.numconnected -= 1;
    document.getElementById("volumectrl" + ((4 - id + plr) % 4)).style.display = "none";
    renewPeer( plr );
}

async function f17(dat){
    let tmp = [];

    for(let i = 0 ; i < dat.length ; ++i){
        if(dat[i] == 44){
            ICEusername = tmp.join("");
            tmp = [];
            continue;
        }

        tmp.push( String.fromCharCode(dat[i]) );
    }
    ICEpassword = tmp.join("");

    await setupMic();
}

// Websocket handling
function startWS(){
    socket = new WebSocket( WSS_URL );

    socket.onopen = async function(e){
        log("Websocket connected!"); 
        connected = true;
    }

    socket.onmessage = async function(e){
        var head = e.data[0].charCodeAt(); // The first byte contains the header
        log( "INPUT: HEAD " + head );

        for(let i = 1 ; i < e.data.length ; ++i) log( toNum(e.data[i]) );
        var dat = stringToNumArray(e.data.substr(1));

        await window["f" + head]( dat ); // Run the function related to the header
    }

    socket.onclose = function(e){
        if(DEV_MODE) return;
        connected = false;
        openInfo("Meldung", 
                "Die Verbindung zum Server wurde geschlossen! Die Seite wird nun verlassen.",
                function(){ goTo('index.html') });
    }

    socket.onerror = function(e){
        if(DEV_MODE) return;
        openInfo("Fehler", 
                "Die Verbindung zum Server konnte nicht hergestellt wieder! Die Seite wird nun verlassen.",
                function(){ goTo('index.html') });
    }
}

// Converts and sends the given parameters
// data - a list of numbers 0 <= x < 256, or a string
function send( head, data ){
    log( data );
    var dat = "";
    if(typeof data !== 'string'){
        for(let i = 0 ; i < data.length ; ++i) dat += String.fromCharCode( data[i] );
    } else {
        dat = data;
    }

    try {
        socket.send( String.fromCharCode(head) + dat );
    } catch(e){
        console.error("Error when sending data!", e);
    }
}
