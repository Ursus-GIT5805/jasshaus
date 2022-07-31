// All info and UI handler for players
class Playerhandler {
    constructor() {        
        this.numconnected = 0; // The number of real players connected
        this.muted = [false, false, false, false];
        this.curplr = 0; // The player who is currently on turn
    }

    // Update all names in html
    setName(name, plr){
        let i = (4-id+plr) % 4;

        document.getElementById("sumName" + plr).innerHTML = name;
        document.getElementById("tName" + plr).innerHTML = name.substring(0, 3);
        document.getElementById("endName" + plr).innerHTML = name.substring(0, 3);
        document.getElementById("player" + i).innerHTML = name;
        if(i != 0) document.getElementById("choose" + i).innerHTML = name;
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

    onMSG(data, plr, textCol="#FFFFFF"){
        let msg = "";
        if(typeof data != 'string'){
            for(let i = 0 ; i < data.length ; ++i) msg += String.fromCharCode(data[i]);
        } else {
            msg = data;
        }

        // Filter the message from possible html tags
        msg = filterString( msg, ['<', '>'], 128 ); 

        // Display it in the speech bubble
        let i = (4-id+plr) % 4;
        let ele = document.getElementById("msg" + i);
        ele.innerHTML = msg;
        ele.style.display = "block";

        // Let the message disappear after 5 seconds
        setTimeout(function(){
            ele.style.display = "none";
        }, 5000);

        // Display the message in the chat
        let box = document.createElement("div");
        let dir = [ "↓", "→", "↑", "←"][i];
        let chat = document.getElementById("chatHistory");
        box.style.display = "table-header-group";
        box.innerHTML = document.getElementById("player" + i).innerHTML  + "[" + dir + "]: " + msg;
        box.style.color = textCol;
        chat.appendChild( box );
        chat.scrollTop = chat.scrollHeight; // Scroll chat to bottom
    }

    // Displays the star at the given player, so the user knows whose turn it is
    setStar(plr){
        document.getElementById("star" + this.curplr).style.visibility = "hidden";
        this.curplr = (4-id+plr) % 4;
        document.getElementById("star" + this.curplr).style.visibility = "visible";
    }
}