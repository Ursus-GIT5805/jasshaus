class Player {
	constructor() {
		this.name = "";
		this.muted = false;
	}
}

// All info and UI handler for players
class Playerhandler {
    constructor(n) {
		this.players = [];
		for(let i = 0 ; i < n ; ++i) this.players.push(new Player());
	}

	createPlayers(id) {
		let n = this.players.length;

		for(let i = 1 ; i < n ; ++i) {
			let r = (id + i) % n;
			let ele = $('<div text="player'+r+'" id="player'+r+'" class="Player"></div>');

			if(i < n / 3) $("#pright").append(ele);
			else if(i < n / 3*2) $("#pup").append(ele);
			else if(i < n) $("#pleft").append(ele);
		}
	}

	updateNames() {
		for(let i = 0 ; i < this.players.length ; i++) {
			this.setName(this.players[i].name, i);
		}
	}

    // Update all names in html
    setName(name, plr){
		this.players[plr].name = name;

		let shortname = name.substr(0,3);
		if(name.length == 0) shortname = "???";

		$('*[text="player' + plr + '"]').text(name);
		$('*[text="short_player' + plr + '"]').text(shortname);
    }

	setMessage(msg, plr, delay=6000) {
		let div = $('<a>').text(msg);
		this.setEleMessage( div, plr, delay );
	}

	setEleMessage(ele, plr, delay=6000) {
		let div = $('<div class="PlayerMSG">').append(ele);
		div.click(() => div.remove());
		if(delay > 0) setTimeout(() => div.remove(), delay);

		if(plr == ownid) $("body").append( div.css("bottom", "30%").addClass("CenterX") );
		else $("#player" + plr).append( div );
	}

	getName(plr) {
		return this.players[plr].name;
	}

	/// Indicates the currently active player
    setCurrent(plr){
		if(this.curplr != null) $("#player" + this.curplr).css("border-style", "none");
		if(plr != null) $("#player" + plr).css("border-style", "solid");
		this.curplr = plr;
    }
}
