// All variables and functions for all the popup windows

// Announce window ---
var annMisere = false;

function startAnnounce(){
    hand.allUsable = true;
    hand.drawAll();

    if( round.passed ) document.getElementById("passButton").style.visibility = "hidden";
    else document.getElementById("passButton").style.visibility = "visible";
    if(self.annMisere) toggleMisere();

    document.getElementById("announceWindow").style.display = "block";
}

function announce(pt){
    document.getElementById("announceWindow").style.display = "none";
    send(2, [pt + (annMisere << 6)] );
}

function toggleMisere(){
    annMisere = !annMisere;
    document.getElementById("announceWindow").style.filter = ["invert(0)", "invert(100%)"][+annMisere];
}

// Show window ---
var showing = false;
var windowShow = new Show(4,4,4); // Currently displayed show (if show is invalid, then the window is closed)
var toShow = [];

// Displays a show in the show-window
// isShowing (bool) - when false it means, the player must decide to show. If true, the show is visible for everyone.
function openShow(show, plr, isShowing){
    showing = isShowing;
    windowShow = show;

    let ele = document.getElementById("showCards");
    ele.innerHTML = ""; // Clear current cards

    // Append all the cards to show in the window
    let lang = ["de", "fr"][+getStorageBool(2)];
    if(show.row == 1){
        for(let i = 0 ; i < 4 ; ++i){
            let img = document.createElement('img');
            img.src = "img/" + lang + "/" + (show.col+i) + show.num + ".png";
            img.classList.add("ShowCard");
            img.style.maxWidth = "25%";
            ele.appendChild(img);
        }
    } else {
        for(let i = 0 ; i < show.row ; ++i){
            let img = document.createElement('img');
            img.src = "img/" + lang + "/" + show.col + (show.num+i) + ".png";
            img.classList.add("ShowCard");
            img.style.maxWidth = (100.0 / show.row) + "%";
            ele.appendChild(img);
        }
    }

    document.getElementById("showConfirm").innerHTML = ["Weisen", "Weiter"][+showing];
    document.getElementById("showCancel").style.display = ["block", "none"][+showing];
    document.getElementById("showTitle").innerHTML = "Weisen?";
    if(isShowing){ // Display the players name instead
        let i = (4-id+plr) % 4;
        document.getElementById("showTitle").innerHTML = document.getElementById("player" + i).innerHTML;
        document.getElementById("showTitle").innerHTML += " (" + ["Sie", "Rechts", "Partner", "Links"][i] + ")";
    }
    
    document.getElementById("showWindow").onmouseenter();
    document.getElementById("showWindow").style.display = "block";
}

document.getElementById("showWindow").onmouseenter = function(e){
    this.style.opacity = "100%";
    this.style.boxShadow = "4px 4px 20px #000000";
}

document.getElementById("showWindow").onmouseleave = function(e){
    this.style.opacity = "25%";
    this.style.boxShadow = "2px 2px 10px #FFFFFF";
}

// Opens a show-window when there is a show available (and if the showWindow is closed)
function checkShow(){
    if(toShow.length == 0 || windowShow.col != 4) return;
    let data = toShow.pop();
    openShow( data[0], data[1], data[2] );
}

function showConfirm(){
    document.getElementById("showWindow").style.display = "none";
    if(!showing) send( 1, [(windowShow.col << 4) + windowShow.num, windowShow.row] );
    windowShow.col = 4;
    checkShow();
}

function showCancel(){
    windowShow.col = 4;
    document.getElementById("showWindow").style.display = "none";    
    checkShow();
}

// Round summary ---
var endRound = false;

function updateSummary( cards, hands ){
    for(let i = 0 ; i < 2 ; ++i){
        document.getElementById("prePoints" + i).innerHTML = (round.points[i] - round.gp[i] - round.sp[i]);
        document.getElementById("shwPoints" + i).innerHTML = round.sp[i];
        document.getElementById("gotPoints" + i).innerHTML = ["", "(Match) "][+(round.gp[i] == 257)] + round.gp[i];
        document.getElementById("finPoints" + i).innerHTML = round.points[i];

        let ele = document.getElementById("gotPoints" + i);
        ele.innerHTML = round.gp[i];
        ele.style.color = ["#FFFFFF", "#FFFF00"][+(round.gp[i] == 257)];
        ele.style.fontWeight = ["normal", "bolder"][+(round.gp[i] == 257)];
    }

    let hasCard = function( bytes, col, num ){
        let i = col*9 + num;
        return Boolean( 1 & bytes[ 4 - Math.floor(i/8) ] >>> i%8 );
    };

    // Draw all the cards the teams have won
    let lang = ["de", "fr"][+getStorageBool(2)];
    const ctx = [];
    for(let t = 0 ; t < 2 ; ++t) ctx.push( document.getElementById("cardst" + t).getContext('2d') )

    for(let i = 0 ; i < 4 ; ++i){
        for(let j = 0 ; j < 9 ; ++j){
            ctx[0].drawImage(cardIMG[i][j], 0, 0, 161, 247, j*161, i*247, 161, 247);
            ctx[1].drawImage(cardIMG[i][j], 0, 0, 161, 247, j*161, i*247, 161, 247);
            for(let t = 0 ; t < 2 ; ++t){
                ctx[t].fillStyle = "rgba(0,0,0,0.5)";
                if( !hasCard(cards[t], i, j) ) ctx[t].fillRect(j*161, i*247, 161, 247);
            }
        }
    }

    // ---

    for(let i = 0 ; i < 4 ; ++i){
        document.getElementById("hand" + i).innerHTML = "";

        for(let j = 0 ; j < hands[i].length ; ++j){
            let img = document.createElement('img');
            img.src = "img/" + lang + "/" + hands[i][j].col + hands[i][j].num + ".png";
            img.style.height = "100%";
            document.getElementById("hand" + i).appendChild( img );
        }
    }
}

function closeSummary(){
    document.getElementById("roundSummary").style.display = "none";

    round.reset();
    document.getElementById("roundSymbols").style.filter = "invert(0)";
    round.updateRoundDetails();
    round.updatePoints(0);
    round.updatePoints(1);

    endRound = false;
    if(endGame) document.getElementById("endWindow").style.display = "block";
    else send(8, ''); //Ask for the next player who must announce
}

// Endresult window ---

var endGame = false;
var sentAgree = false;

function updateEndresult(victory){
    sentAgree = false;
    document.getElementById("plrRev").innerHTML = 0;
    document.getElementById("endResult").innerHTML = ["Niederlage", "Sieg"][+victory];
    document.getElementById("endWindow").style.backgroundColor = ["black", "white"][+victory];
    document.getElementById("endWindow").style.color = ["white", "black"][+victory];

    let ele = [], cur = [];
    for(let i = 0 ; i < 2 ; ++i){
        ele.push( document.getElementById("gameWin" + i) );
        cur.push( parseInt(ele[i].innerHTML) );
    }

    let winner = (id + !victory) % 2;
    ele[ winner ].innerHTML = ++cur[ winner ];

    for(let i = 0 ; i < 2 ; ++i){
        let better = cur[i] > cur[(i+1) % 2];

        ele[i].style.color = ["#BEC2CB", "#D4AF37"][+better];
        ele[i].style.fontWeight = ["normal", "bolder"][+better];
    }
}

function sendAgree(){
    if(!sentAgree) send(5, "");
    sentAgree = true;
}

// Info window ---

function openInfo(title, info, onConfirm){
    document.getElementById("infoTitle").innerHTML = title;
    document.getElementById("infoText").innerHTML = info;
    document.getElementById("infoButton").onclick = function(){
        onConfirm();
        document.getElementById("infoWindow").style.display = "none";
    };

    document.getElementById("infoWindow").style.display = "block";
}

// Chat window ---

// Opens/Closes the chat
function toggleChat(){
    let ele = document.getElementById("chatWindow");

    if( ele.style.display == "block") ele.style.display = "none";
    else ele.style.display = "block";
}

// Setting window --

function toggleSettings(){
    let ele = document.getElementById("settingWindow");

    if( ele.style.display == "block" ) {
        ele.style.display = "none";
        saveSettings();
        applySettings();
    } else ele.style.display = "block";
}

// Team window --- (for choosing teams)

let chosen = false;

function chooseT( index ){
    if( chosen ) return;
    let plr = (id + index) % 4;

    for(let i = 0 ; i < 4 ; ++i){
        document.getElementById("choose" + i).style.backgroundColor = ["#AA0000", "#00DD00"][+(index == i)];
    }

    send(9, [plr]);
    chosen = true;
} 
