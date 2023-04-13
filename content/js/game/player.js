// All info and UI handler for players
class Playerhandler {
    constructor() {        
        this.numconnected = 0; // The number of real players connected
        this.muted = [false, false, false, false];
        this.curplr = 0; // The player who is currently on turn
        this.lastmsg = ["", "", "", ""]
        this.msgrepeats = [1,1,1,1];

        for(let i = 0 ; i < 4 ; ++i){
            document.getElementById("msg" + i).onmousedown = function(e){
                this.style.display = "none";
            }
        }
    }

    // Update all names in html
    setName(name, plr){
        let i = (4-id+plr) % 4;
        let eleLong = ["player" + i, "choose" + i];
        let eleShort = ["sumName" + plr, "tName" + plr, "endName" + plr];

        for(let i = 0 ; i < eleLong.length ; ++i){
            document.getElementById(eleLong[i]).innerHTML = "";
            document.getElementById(eleLong[i]).appendChild( document.createTextNode(name) );
        }
        for(let i = 0 ; i < eleShort.length ; ++i){
            document.getElementById(eleShort[i]).innerHTML = "";
            document.getElementById(eleShort[i]).appendChild( document.createTextNode(name.substr(0,3)) );
        }
        document.getElementById("choose0").innerHTML = "";
        document.getElementById("choose0").appendChild( document.createTextNode("Zufällig") );
    }

    // Adds a symbol below a name  (e.g microphone)
    addSymbol(src, plr){
        let symbol = document.createElement("img");
        symbol.src = src;
        symbol.classList.add("Playersymbol");
        document.getElementById("symbols" + ((4-id+plr) % 4 )).appendChild(symbol);
    }

    removeSymbols(plr){
        document.getElementById("symbols" + ((4-id+plr) % 4 )).innerHTML = "";
    }

    onMSG(msg, plr, textCol="#FFFFFF"){
        if(msg != this.lastmsg[plr]) this.msgrepeats[plr] = 0;
        this.msgrepeats[plr] += 1;
        this.lastmsg[plr] = msg;

        let finalmsg = msg + ["", " (" + String(this.msgrepeats[plr]) + "x)"][+(this.msgrepeats[plr] > 1)];

        // Display it in the speech bubble
        let i = (4-id+plr) % 4;
        let ele = document.getElementById("msg" + i);
        ele.innerHTML = "";
        ele.appendChild( document.createTextNode(finalmsg) );
        ele.style.display = "block";

        // Let the message disappear after 5 seconds
        setTimeout(function(){
            if(ele.innerHTML != finalmsg) return;
            ele.style.display = "none";
        }, 5000);

        // Display the message in the chat
        let box = document.createElement("div");
        let dir = [ "↓", "→", "↑", "←"][i];
        let chat = document.getElementById("chatHistory");
        box.appendChild( document.createTextNode( document.getElementById("player" + i).innerHTML  + "[" + dir + "]: " + msg ) );
        box.style.color = textCol;
        chat.appendChild( box );
        chat.scrollTop = chat.scrollHeight; // Scroll chat to bottom
    }

    // Displays the star at the given player, so the user knows whose turn it is (-1 for no one)
    setStar(plr){
        document.getElementById("star" + this.curplr).style.visibility = "hidden";
        this.curplr = (4-id+plr) % 4;
        if(plr == -1) this.curplr = 0;
        document.getElementById("star" + this.curplr).style.visibility = "visible";
    }
}
