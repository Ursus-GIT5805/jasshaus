import { ClientData, ClientID, PlayerID } from "./wshandler.js";

/// Handles the players in a "circle" around the screen
export class CirclePlayer {
	curplr: undefined | PlayerID = undefined;
	players = new Map<ClientID, PlayerID>();
	click_callback?: (plr: PlayerID) => void;

	setMessage(msg: string | JQuery<HTMLElement>, plr_id: PlayerID, delay: number = 6000) {
		if (typeof msg === "string") msg = $("<span>").text(msg);

		let div = $('<div class="PlayerMSG">').append(msg);

		div.click(() => div.remove());
		if (delay > 0) setTimeout(() => div.remove(), delay);

		let parent = $(`#wrapper_player${plr_id}`);

		if (parent.length == 0) $("body").append(div);
		else parent.append(div);
	}

	setCurrent(plr: undefined | PlayerID) {
		if (this.curplr !== undefined) $(`#player${this.curplr}`).removeClass("Current");
		if (plr !== undefined) $(`#player${plr}`).addClass("Current");
		this.curplr = plr;
	}

	toggleClass(st: string, plr: PlayerID, state?: boolean) {
		$(`#player${plr}`).toggleClass(st, state);
	}

	addEle(ele: JQuery<HTMLElement>, plr: PlayerID) {
		$(`#wrapper_player${plr}`).append(ele);
	}

	// ---

	oninit(client_id: ClientID, player_id: PlayerID, num_players: number) {
		$("body")
			.append($("<div>").attr("id", "pright"))
			.append($("<div>").attr("id", "pup"))
			.append($("<div>").attr("id", "pleft"));

		let shift = player_id;
		for (let i = 1; i < num_players; ++i) {
			let id = (shift + i) % num_players;

			let container = $('<div class="PlayerContainer">').attr("id", `wrapper_player${id}`);

			let name = $("<div>")
				.attr("id", `player${id}`)
				.attr("text", `player${id}`)
				.addClass("Player")
				.click(() => this.click_callback?.(id));

			let indicators = $('<div class="IndicatorRow">');

			container.append(name).append(indicators);

			if (i < num_players / 3) $("#pright").append(container);
			else if (i < (num_players / 3) * 2) $("#pup").append(container);
			else if (i < num_players) $("#pleft").append(container);
		}

		this.players.set(client_id, player_id);
	}

	onclient(data: ClientData, client_id: ClientID, player_id: PlayerID) {
		this.players.set(client_id, player_id);

		$(`#player${player_id}`).text(data.name);

		let choices = ["Hi", "Greetings", "Hello there", "Hello"];
		let index = Math.floor(Math.random() * choices.length);
		let greet = choices[index];

		this.setMessage(greet, player_id);
	}
	onclientleave(client_id: ClientID) {
		let plr = this.players.get(client_id);
		if (plr === undefined) return;

		this.players.delete(client_id);
		$(`#player${plr}`).text("");
	}

	onchatmessage(msg: string, client_id: ClientID) {
		let plr = this.players.get(client_id);
		2;
		if (plr !== undefined) this.setMessage(msg, plr);
	}
}
