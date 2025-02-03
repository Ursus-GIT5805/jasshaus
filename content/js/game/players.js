/// A struct handling n players in a "circle" around the screen
class PlayerHandler {
	constructor() {
		this.curplr = null;
	}

	setMessage(msg, plr_id, delay=6000) {
		let div = $('<div class="PlayerMSG">').append(msg);
		div.click(() => div.remove());
		if(delay > 0) setTimeout(() => div.remove(), delay);

		let parent = $("#player" + plr_id);
		if(parent.length == 0) $("body").append( div );
		else parent.append(div);
	}

	setTextMessage(text, plr_id, delay=6000) {
		let div = $('<a>').text( text );
		this.setMessage( div, plr_id, delay );
	}

	updateCurrent(plr=null) {
		if(this.curplr != null) $("#player" + this.curplr).css("border-style", "none");
		if(plr != null) $("#player" + plr).css("border-style", "solid");
		this.curplr = plr;
	}

	onchatmessage(msg, plr) {
		this.setTextMessage(msg, plr);
	}

	oninit(shift, num_players) {
		$("body")
			.append( $("<div>").attr("id", "pright") )
			.append( $("<div>").attr("id", "pup") )
			.append( $("<div>").attr("id", "pleft") );

		for(let i = 1 ; i < num_players ; ++i) {
			let r = (shift + i) % num_players;
			let id = "player" + r;
			let ele = $('<div>')
				.attr("id", id)
				.attr("text", id)
				.addClass("Player");

			if(i < num_players / 3) $("#pright").append(ele);
			else if(i < num_players / 3*2) $("#pup").append(ele);
			else if(i < num_players) $("#pleft").append(ele);
		}
	}

	onplayergreet(plr_id) {
		let choices = ["Grüezi", "Guten Tag", "Heyho", "Hallo"];
		let index = Math.floor(Math.random() * choices.length);
		let greet = choices[index];

		this.setTextMessage(greet, plr_id);
	}
}
