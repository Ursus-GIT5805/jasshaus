import { DATA, Hand } from "./hand.js";
import { get_card_ele, number_name, trick_to_ele } from "./tichu.js";
import {
	Game,
	Card,
	parse_trick,
	Trick,
	Cardset,
	parse_all_tricks,
	contains_bomb,
} from "../pkg/tichu_game.js";
import { ClientData, ClientID, PlayerID } from "./wshandler.js";
import { CirclePlayer } from "./players.js";

declare global {
	interface JQuery {
		display(v: boolean): JQuery;
	}
}

$.fn.display = function (v: boolean) {
	return this.css("display", ["none", "block"][+v]);
};

export class UI {
	game: Game;
	hand: Hand<Card>;

	wish_trick: undefined | Trick = undefined;

	player_names = new Map<PlayerID, string>();
	player_id: PlayerID = 0;
	players = new CirclePlayer();

	constructor(game: Game) {
		this.game = game;
		this.hand = new Hand<Card>($("#cards"), get_card_ele, () => false);
		this.hand.indicate_new = true;
		this.hand.allow_reshuffling = true;
	}

	// ---

	oninit(client_id: ClientID, player_id: PlayerID, num_players: number) {
		this.player_id = player_id;
		this.players.oninit(client_id, player_id, num_players);
	}

	onclient(data: ClientData, client_id: ClientID, player_id: PlayerID) {
		this.player_names.set(player_id, data.name);
		this.players.onclient(data, client_id, player_id);
	}

	onclientleave(client_id: ClientID) {
		this.players.onclientleave(client_id);
	}

	onchatmessage(msg: string, client_id: ClientID) {
		this.players.onchatmessage(msg, client_id);
	}

	// ---

	setupInformation() {
		this.setupPoints();
		this.setupPlayerinfo();

		for (let i = 0; i < this.game.players.length; ++i) {
			let ele = $('<div class="PlayerInfo"></div>');

			let cards = $(`<div>Cards: <span text="num_cards${i}">0</span></div>`);
			let pass_info = $(`<div id="passInfo${i}"></div>`);

			ele.append(cards).append(pass_info);

			this.players.addEle(ele, i);
		}

		let end = this.game.setting.end_condition;
		$("#goal").text(`Tichu ${end.Points}`);
		$("#wishIndicator").display(false);
	}

	setupPlayerinfo() {
		let container = $("#playerInfo");

		for (let plr = 0; plr < this.game.players.length; ++plr) {
			let ele = $("<div>")
				.append($(`<span text="short_player${plr}">`))
				.append($(`<span> (Cards: <span text="num_cards${plr}">0</span>)</span> `))
				.append($(`<span id="infoPlayer">`));

			container.append(ele);
		}

		this.showInfos(false);
	}

	setupPoints() {
		for (let tid = 0; tid < this.game.teams.length; ++tid) {
			let plrs = Array.from(this.game.get_players_of_team(tid));
			let ele = $("<div>");

			for (const [i, pid] of plrs.entries()) {
				ele.append($(`<span text="short_player${pid}" text=>???</span>`));
				if (i + 1 < plrs.length) ele.append($("<span> + </span>"));
			}

			ele.append($("<span>: </span>"));
			ele.append($("<span>0</span>").attr("text", "points_team" + tid));

			$("#teampoints").append(ele);
		}
	}

	setupPlayPass(onplay: (trick: Trick, wish: undefined | number) => void, onpass: () => void) {
		$("#play").click(() => {
			let cards = this.hand.get_selected();
			let cardset = Cardset.from_list(cards);
			let tricks = parse_all_tricks(cardset);

			console.log(tricks);
			if (tricks.length == 0) return;

			let wish = false;
			for (let card of cards) {
				if (card.color == 4 && card.number == 0) wish = true;
			}

			let callback = (trick: Trick) => {
				if (wish) {
					this.wish_trick = trick;
					this.startWishing();
				} else {
					onplay(trick, undefined);
				}
			};

			if (tricks.length === 1) {
				callback(tricks[0]);
			} else {
				this.openTrickwindow(callback, tricks);
			}
		});

		this.setupWish((num) => {
			if (this.wish_trick === undefined) return;
			onplay(this.wish_trick, num);
			this.wish_trick = undefined;
		});

		$("#pass").click(onpass);
	}

	setupButtons() {
		// $("#sort").click(() => {
		// this.hand.sort((card) => {
		// return card.number + 100*(+(card.color == 4));
		// });
		// });
		// $("#sort").display(true);
	}

	setupTichuAnnounce(ontichu: () => void, ongtdecision: (gt: boolean) => void) {
		$("#announceTichu").click(ontichu);
		$("#announceGTichu").click(() => {
			ongtdecision(true);
		});
		$("#cancelGTichu").click(() => {
			ongtdecision(false);
		});
	}

	setupExchangeWindow(exchangeCallback: (cards: Card[]) => void) {
		let num = this.game.players.length - 1;

		let container = $("#exchangeHolder");
		for (let i = 0; i < num; ++i) {
			let ele = $("<div>").attr("id", `exchange${i}`);

			ele[0].ondragover = (e) => e.preventDefault();

			ele[0].ondrop = (e) => {
				let cardstr = e.dataTransfer?.getData("card");
				let par_id = e.dataTransfer?.getData("parent");
				let id = e.dataTransfer?.getData("id");

				if (cardstr === undefined || par_id == undefined || id === undefined) return;
				let card = $(`#${id}`);
				let parent = $(`#${par_id}`);

				ele.children().each((_, child) => {
					$(child).appendTo(parent);
				});

				card.appendTo(ele);
			};

			container.append(ele);
		}

		let but = $("#exchange");
		but.click(() => {
			let cards = container.children().map((_, child) => {
				let ele = child.children[0];
				let data = $(ele).data(DATA) as Card;
				return data;
			});

			let list = Array.from(cards);

			but.addClass("Disabled");
			exchangeCallback(list);
		});
	}

	setupWish(callback: (num: number | undefined) => void) {
		let container = $("#wishButtons");

		let call = (num: number | undefined) => {
			callback(num);
			$("#wishWindow").display(false);
		};

		for (let num = 1; num < 14; ++num) {
			let but = $('<div class="Button">')
				.text(number_name(num))
				.click(() => call(num));

			container.append(but);
		}

		let no_wish = $('<div class="Button">')
			.text("No wish")
			.click(() => call(undefined));
		container.append(no_wish);
	}

	// ---

	displayInfo(text: string | undefined) {
		if (text === undefined) {
			$("#infoWindow").display(false);
		} else {
			$("#infoWindow").display(true).text(text);
		}
	}

	openTrickwindow(callback: (trick: Trick) => void, tricks: Trick[]) {
		if (tricks.length === 0) return;
		let container = $("#tricklist");

		for (let trick of tricks) {
			let ele = $("<div>")
				.append(trick_to_ele(trick))
				.click(() => {
					callback(trick);
					$("#trickWindow").display(false);
				});

			container.append(ele);
		}

		$("#trickWindow").display(true);
	}

	openEndwindow() {
		this.hand.clear();
		this.players.setCurrent(undefined);

		let teams = this.game.rank_teams();
		let container = $("#endTeams");

		container.html("");

		for (let i = 0; i < teams.length; ++i) {
			let team_id = teams[i];
			let points = this.game.teams[team_id].points;

			let place = i + 1;
			let plr_ids = Array.from(this.game.get_players_of_team(team_id));

			// Update the title
			if (plr_ids.includes(this.player_id)) $("#endResult").text(`You are on place ${place}!`);

			let name = plr_ids.map((pid) => this.player_names.get(pid) || "???").join(", ");
			let title = `${place}. ${name} (${points})`;

			let ele = $(`<h${place}>`).text(title);
			container.append(ele);
		}

		$("#endWindow").css("display", "flex");
	}

	hideButtons() {
		$("#buttonRow")
			.children()
			.each((_, ele) => {
				$(ele).display(false);
			});
	}

	startExchange() {
		this.hand.selectMode(false);
		this.hand.setSelected(() => false);
		$("#exchange").removeClass("Disabled");
		$("#exchangeWindow").display(true);
		$("#exchangeHolder")
			.children()
			.each((_, ele) => {
				$(ele).html("");
			});
	}

	stopExchange() {
		this.hand.selectMode(true);
		$("#exchangeWindow").display(false);
	}

	startWishing() {
		$("#wishWindow").display(true);
	}

	// ---

	set_cards(cardset: Cardset | Card[]) {
		this.hand.clear();
		this.add_cards(cardset);
	}

	add_cards(cardset: Cardset | Card[]) {
		let cards = undefined;

		if (!Array.isArray(cardset)) cards = cardset.as_vec();
		else cards = cardset;

		console.log(cards);

		for (let card of cards) this.hand.appendCard(card);
		this.hand.sort((card) => {
			return card.number + 100 * +(card.color == 4);
		});
	}

	update_gt_buttons() {
		let show = this.game.can_announce_gt(this.player_id);

		$("#announceGTichu").display(show);
		$("#cancelGTichu").display(show);
	}

	play_trick(trick: Trick) {
		let ele = trick_to_ele(trick);
		$("#carpet").html(ele[0]);
	}

	clean_carpet() {
		$("#carpet").html("");
	}

	// ---

	indicatePass(plr: PlayerID) {
		$(`#passInfo${plr}`).text("Passed");
		this.players.toggleClass("Passed", plr, true);
	}

	indicateWish(wish: number | undefined) {
		$("#wishIndicator").display(wish !== undefined);
		if (wish !== undefined) {
			let name = number_name(wish);
			$("#wishedNumber").text(name);
		}
	}

	clearPassInfo() {
		for (let i = 0; i < this.game.players.length; ++i) {
			$(`#passInfo${i}`).text("");
			this.players.toggleClass("Passed", i, false);
		}
	}

	indicateActive(plr: PlayerID, indicate = true) {
		this.players.toggleClass("Active", plr, indicate);
	}

	indicateFinished(plr: PlayerID, indicate = true) {
		this.players.toggleClass("Finished", plr, indicate);
	}

	indicateTichu(plr: PlayerID, indicate = true) {
		this.players.toggleClass("AnnouncedTichu", plr, indicate);
	}

	indicateGrandTichu(plr: PlayerID, indicate = true) {
		this.players.toggleClass("AnnouncedGrandTichu", plr, indicate);
	}

	clearPlayerStates() {
		for (let plr = 0; plr < this.game.players.length; ++plr) {
			this.players.toggleClass("Active", plr, false);
			this.players.toggleClass("Finished", plr, false);
		}
	}

	indicateGiveAwayPhase(active: boolean = true) {
		if (active) {
			let team_id = this.game.players[this.player_id].team_id;

			this.updatePhase("GiveAway");
			if (this.player_id == this.game.current_player) {
				this.hand.setIllegal();
				this.displayInfo("Choose an opponent to give the dragon.");

				for (let i = 0; i < this.game.players.length; ++i) {
					if (team_id != this.game.players[i].team_id) continue;
					this.players.toggleClass("Disabled", i, true);
				}
			}
		} else {
			for (let i = 0; i < this.game.players.length; ++i) {
				this.players.toggleClass("Disabled", i, false);
			}

			this.updatePhase("Playing");
			this.hand.setLegality(() => true);
			this.displayInfo(undefined);
			this.updateOnTurn();
			this.clean_carpet();
		}
	}

	// ---

	updateOnTurn() {
		let phase = this.game.phase;
		let is_onturn = this.game.current_player == this.player_id;

		if (phase === "Playing") {
			let cards = this.hand.getCards();
			let can_bomb = contains_bomb(cards);
			let can_pass = is_onturn && this.game.can_pass(this.player_id);

			$("#play").display(is_onturn || can_bomb);
			$("#pass").display(can_pass);
		} else if (phase === "GiveAway") {
			$("#play").display(false);
			$("#pass").display(false);
		}

		this.players.setCurrent(this.game.current_player);
	}

	updateTichubutton(show?: boolean) {
		if (show === undefined) {
			let display = this.game.can_announce(this.player_id);
			$("#announceTichu").display(display);
		} else {
			$("#announceTichu").display(show);
		}
	}

	updatePoints() {
		this.game.teams.map((team, idx) => $(`*[text="points_team${idx}"]`).text(team.points));
	}

	updateHandsize(plr?: PlayerID) {
		if (plr === undefined) {
			let num_players = this.game.players.length;
			for (let i = 0; i < num_players; ++i) {
				this.updateHandsize(i);
			}
		} else {
			let sz = this.game.players[plr].num_cards;
			$(`*[text="num_cards${plr}"]`).text(sz);
		}
	}

	showInfos(show: boolean = true) {
		let css = ["hidden", "visible"][+show];
		$("#playerInfo").css("visibility", css);
	}

	updatePhase(phase: string) {
		$("#gamePhase").text(phase);
	}
}
