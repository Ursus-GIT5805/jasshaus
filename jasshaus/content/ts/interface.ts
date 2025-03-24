import { Hand } from "./hand.js";
import { MISERE_IMG, PASS_IMG, get_card_ele, get_pt_img_path, get_pt_name, show_to_ele } from "./jass.js";
import { get_num_playtypes, get_playtype_id, must_bid, parse_show } from "../pkg/jasshaus_game.js";
import { Playtype, playtype_from_id, Card, Cardset, Game,  Show } from "../pkg/jasshaus_game.js";
import { CirclePlayer } from "./players.js";
import { objEquals } from "./utility.js";
import { PlayerID } from "./wshandler.js";
import { Carpet } from "./carpet.js";

const announceWindow = $('#announceWindow');
const roundSummary = $("#roundSummary");

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

function playtype_button(pt: Playtype, mult: number): JQuery<HTMLElement> {
	let id = get_playtype_id(pt);

	let name = get_pt_name(pt);
	let src = get_pt_img_path(pt) || "";

	let text = "";
	if(name) text = name;
	if(mult != 1) text += ` (${mult})`;

	let imgsrc = `pt${id}`;

	let ele = $('<div>')
		.append( $('<img>').attr('src', src).attr("imgsrc", imgsrc) )
		.append( $("<a>").text(text).attr("text", imgsrc) );

	return ele;
}

export class UI {
	player_id: PlayerID = 0;

	game: Game;
	players: CirclePlayer = new CirclePlayer();
	player_names = new Map<PlayerID, string>;

	lock_updates: boolean = false;

	hand: Hand<Card>;
	carpet = new Carpet<Card>(0, 0, get_card_ele);
	newcards: undefined | Cardset = undefined;

	shown = new Set<string>();

	constructor(
		onplay: (card: Card) => boolean,
		game: Game
	) {
		this.game = game;

		this.hand = new Hand<Card>(
			$("#cards"),
			get_card_ele,
			onplay,
		);
		this.hand.indicate_new = false;


		this.carpet.setDropAction((card) => {
			if(onplay(card)) this.hand.erase(card);
		});
	}

	// ===== Setups =====

	setupInterface(player_id: PlayerID, game: Game) {
		this.game = game;
		let num_players = this.game.players.length;

		this.carpet = new Carpet<Card>(num_players, player_id, get_card_ele);
		this.carpet.radiusY = 50;
		this.carpet.autoclean = num_players;

		this.setupGamedetails();
		this.setupSummary();
	}


	setupAnnounce(
		announceCallback: (pt: Playtype, misere: boolean) => void,
		passCallback: () => void,
	) {
		let pts = announceWindow.find("#announcePT").html("");
		let cpts = announceWindow.find("#announcePTCol").html("");

		// Display Playtypes
		for(let id = 0 ; id < get_num_playtypes() ; id++) {
			let setting = this.game.setting.playtype[id];
			if(!setting.allow) continue;

			let pt = playtype_from_id(id);
			if(pt === undefined) continue;

			let mult = setting.multiplier;

			let but = playtype_button(pt, mult);
			but.click(() => announceCallback(pt, announceWindow.hasClass("Misere")));

			// Append it
			if(pt.hasOwnProperty("Color")) cpts.append(but);
			else pts.append(but);
		}

		/// Display
		let passmisere = announceWindow.find("#passmisere").html("");

		if(this.game.setting.allow_misere) {
			let click = () => announceWindow.toggleClass("Misere");

			let but = $("<div>")
				.click(click)
				.append( $("<img>").attr("src", MISERE_IMG) )
				.append( $("<a>").text("Misère") );

			passmisere.append(but);
		}

		// Display Pass Button
		if(this.game.setting.allow_pass) {
			let but = $("<div>")
				.click(passCallback)
				.attr("id", "passButton")
				.append( $("<img>").attr("src", PASS_IMG) )
				.append( $("<a>").text("Schieben") );

			passmisere.append(but);
		}
	}

	setupSummary() {
		$("#closeSummary").click(() => {
			$("#roundWindow").css("display", "none");

			if(!this.game.should_end()) this.updateRound();
			this.updatePoints();
			this.updateRoundDetails();
			this.updateHand();

			if(this.game.should_end()) this.openEndwindow();
			else {
				this.updateCurrent( this.game.current_player );
				this.updateOnturn();
			}
		});
	}

	setupBiding(callback: (bid: number) => void) {
		$("#bidButton").click(() => {
			let val = Number($("#bidInput").val());
			if(isNaN(val)) return;

			let team = this.game.players[this.player_id].team_id;
			if(val < this.game.teams[team].target) return;
			if(I32_MAX < val) return;

			callback(val);

			$("#bidWindow").css("display", "none");
		});
	}

	/// Setup the button to show
	setupShowButton(callback: (show: Show) => void) {
		let infoMessage = (msg: string) => this.players.setMessage(msg, this.player_id, 2000);

		let showButton = $("#showButton");

		showButton.click(() => {
			if(this.hand.selecting) {
				let cards = this.hand.get_selected();
				let show = parse_show(cards);

				if(!show) {
					if(cards.length > 0) infoMessage("Dies ist kein Weis!");
				} else {
					let cardset = Cardset.from_list( this.hand.getCards() );

					let has_show = true;
					let strshow = JSON.stringify(show);
					try { cardset.has_show(show); }
					catch(e) { has_show = false; }

					if(this.shown.has(strshow)) infoMessage("Schon gewiesen!");
					else if( !has_show ) infoMessage("Du kannst noch mehr weisen ;)");
					else {
						this.indicateShow(show);
						callback(show);
					}
				}
			}

			if(this.hand.selectMode()) {
				this.hand.setLegality(() => true);
				showButton.text("Fertig");
			} else {
				let cardset = Cardset.from_list( this.hand.getCards() );
				this.hand.setLegality((card: Card) => this.game.is_legal_card(cardset, card));
				showButton.text("Weisen");
			}
		});
	}

	setupGamedetails() {
		let num_teams = this.game.teams.length;
		let setting = this.game.setting;

		let end = setting.end_condition;
		if('Points' in end) $("#gameTitle").text("Punkte " + end.Points);
		if('Rounds' in end) {
			$("#gameTitle")
				.append( $("<span>").text("Runde ") )
				.append( $("<span>").attr('text', 'game_rounds') )
				.append( $("<span>").text("/" + end.Rounds) );
		}

		// Create an entry for each team
		$("#gameTeams").html("");
		for(let team = 0 ; team < num_teams ; team++) {
			let plrs = this.game.get_players_of_team(team);

			let ele = $("<div>");

			for(const [i, pid] of plrs.entries()) {
				ele.append( $(`<span text="short_player${pid}">???</span>`) )
				if(i+1 < plrs.length) ele.append( $("<span>").text(" + ") );
			}

			ele.append( $('<span>').text(": ") );
			ele.append( $('<span>0</span>').attr("text", `points_team${team}`) );

			let gainpoints = $(`<span> (<span text="gainpoints_team${team}"></span>)</span>`);
			ele.append(gainpoints);

			if( must_bid(setting) ) {
				let bid = $(`<span> [<span text="target_team${team}"></span>]</span>`);
				ele.append( bid );
			}

			$("#gameTeams").append(ele);
		}
	}

	// ===== Updates =====

	/// Indicate the show on the Turnindicator (these are the shows
	/// you, the player, show.)
	indicateShow(show: Show) {
		let ele = show_to_ele(show);
		let showstr = JSON.stringify(show);

		$("#showqueue").append(ele);
		this.shown.add(showstr);
	}

	setShowMessage(shows: Show[], plr: PlayerID) {
		let rows = $("<div>")
			.css("display", "flex")
			.css("flex-direction", "column");

		// Display each show on a new row
		for(let show of shows) rows.append( show_to_ele(show) );

		// Display with longer delay
		this.players.setMessage(rows, plr, 15000);
	}

	gameMessage(msg: string | undefined, plr: PlayerID) {
		if(msg === undefined) return;

		this.players.setMessage(msg, plr);
	}

	startAnnounce(can_pass: boolean) {
		announceWindow.removeClass("Misere");
		announceWindow.find("#passButton").vis(can_pass);
		announceWindow.css('display', 'block');
	}
	closeAnnounceWindow() {
		announceWindow.css('display', 'none');
	}


	openSummary() {
		$("#roundWindow").css('display', 'block');
	}

	openEndwindow() {
		this.hand.clear();
		this.updateCurrent(undefined);

		let teams = this.game.rank_teams();
		let container = $("#endTeams");

		container.html("");

		for(let i = 0 ; i < teams.length ; ++i) {
			let team_id = teams[i];
			let points = this.game.teams[team_id].points;

			let place = i+1;
			let plr_ids = Array.from( this.game.get_players_of_team(team_id) );

			// Update the title
			if(plr_ids.includes(this.player_id)) $("#endResult").text("Du bist " + place + ". Platz!");

			let name = plr_ids.map((pid) => this.player_names.get(pid) || "???").join(", ");
			let title = place + ". " + name + " (" + points + ")";

			let ele = $("<h" + place + ">").text(title);
			container.append(ele);
		}

		$("#endWindow").css("display", "flex");
	}

	openBidWindow(value: number = 0) {
		let bidWindow = $("#bidWindow");

		let input = bidWindow.find("#bidInput");
		input.val(value);

		bidWindow.css("display", "block");
	}

	// Update methods (only updates the UI)

	updateSummary() {
		roundSummary.html("");

		for(let team_id = 0 ; team_id < this.game.teams.length ; ++team_id) {
			let team = this.game.teams[team_id];

			let bef = team.points;

			let plr_id = Array.from(this.game.get_players_of_team(team_id));
			let plrs = plr_id.map((id) => this.player_names.get(id)?.substring(0, 3) || "???");

			let ele = $(`
<div class="SummaryTeam">
<div class="SummaryStats">
<div style="font-size: 2em;" id="names"></div>
<div><a style="float: left;">Beginn</a> <a style="float: right;">${bef}</a></div>
<div id="mods"></div>
<div>----------</div>
<div style="font-size: 1.5em;">
<a style="float: left;">Endstand</a> <a style="float: right;" id="result"></a></div>
</div>
</div>
`);
			ele.find("#names").text( plrs.join(" & ") );

			let ele_gain = (title: string, points: number | string) => {
				let title_a = $("<a>").css("float", "left").text(title);
				let plus = ["", "+"][ +(typeof points === 'number' && points > 0) ];
				let points_a = $("<a>").css("float", "right").text(plus + points);

				return $('<div>')
					.append(title_a)
					.append(points_a);
			};

			let evaltype = this.game.setting.point_eval;

			let mods = ele.find("#mods");
			let result = ele.find("#result");

			if(evaltype === "Add") {
				if(team.won_points > 0) mods.append( ele_gain("Stich", team.won_points) );
				if(team.show_points > 0) mods.append( ele_gain("Weis", team.show_points) );
				if(team.marriage_points > 0) mods.append( ele_gain("Stöck", team.marriage_points) );
				let after = team.points + team.won_points + team.show_points + team.marriage_points;
				result.text(after);
			} else if("Difference" in evaltype) {
				let data = evaltype.Difference;
				let p = team.won_points;
				let after = team.points;

				if(!data.include_shows) {
					after += team.show_points;
					if(team.show_points > 0) mods.append( ele_gain("Weis", team.show_points) );
				} else { p += team.show_points; }

				if(!data.include_marriage) {
					after += team.marriage_points;
					if(team.marriage_points > 0) mods.append( ele_gain("Stöck", team.marriage_points) );
				} else { p += team.marriage_points; }

				let diff = Math.abs( p - team.target );
				after += diff;

				let text = "|" + p + "-" + team.target + "|";
				text += " = " + diff;
				mods.append( ele_gain("Differenz", text) );

				let extra_win = diff == 0 && (team.won.len() != 0 || !data.needs_win);
				if(extra_win) {
					mods.append( ele_gain("Extrapunkte", data.zero_diff_points) );
					after += data.zero_diff_points;
				}
				result.text(after);
			}

			let cardlist = $("<div>").addClass("SummaryCards");

			// TODO remove these magic numbers
			for(let color = 0 ; color < 4 ; color++) {
				let div = $("<div>");
				for(let num = 0 ; num < 9 ; num++){
					let card = { "color": color, "number": num } as Card;
					let ele = get_card_ele(card);

					if(!team.won.contains(card)) ele.css("filter", "brightness(50%)");
					div.append(ele);
				}
				cardlist.append(div);
			}
			ele.append(cardlist);

			roundSummary.append(ele);
		}
	}

	updateName(player_id: PlayerID, name?: string) {
		if(name !== undefined) this.player_names.set(player_id, name);

		let pname = this.player_names.get(player_id) || "";
		let shortname = pname.substring(0, 3) || "???";

		$(`*[text="player${player_id}"]`).text(pname);
 		$(`*[text="short_player${player_id}"]`).text(shortname);
	}

	updateNames() {
		for(let i = 0 ; i < this.game.players.length ; ++i) this.updateName(i);
	}

	updateHand(hand?: Cardset) {
		if(hand) this.newcards = hand;
		if(this.lock_updates) return;

		if(this.newcards) {
			let cards = this.newcards.as_vec();
			this.hand.setCards(cards);
			this.newcards = undefined;
		}
	}

	updatePoints() {
		if(this.lock_updates) return;

		this.game.teams.map((team, idx) => {
			let gain = team.won_points + team.show_points + team.marriage_points;

			$(`*[text="points_team${idx}"]`).text(team.points);
			$(`*[text="wonpoints_team${idx}"]`).text(team.won_points);
			$(`*[text="showpoints_team${idx}"]`).text(team.show_points);
			$(`*[text="gainpoints_team${idx}"]`).text(gain);

			let target = team.target;
			if(target == I32_MIN) target = 0;

			$(`*[text="target_team${idx}"]`).text(target);
		});
	}

	updateOnturn(on_turn?: boolean) {
		if(this.lock_updates) return;

		let is_on_turn = this.player_id == this.game.current_player && !this.game.should_end();
		if(on_turn !== undefined) is_on_turn = on_turn;

		if(is_on_turn) {
			if(!this.game.is_announced()) {
				this.hand.setLegality(() => true);
				this.startAnnounce( this.game.can_pass(this.player_id) );
				return;
			}

			if(this.game.is_biding()) {
				this.hand.setLegality(() => true);

				let team = this.game.players[this.player_id].team_id;
				let target = this.game.teams[team].target;

				if(target == I32_MIN) target = 0;

				this.openBidWindow(target);
				return;
			}

			let cardset = Cardset.from_list( this.hand.getCards() );
			this.hand.setLegality((card: Card) => this.game.is_legal_card(cardset, card));

			let can_show = this.game.get_turn() == 0 && this.game.setting.allow_shows;
			if(can_show) $("#showButton").css('display', 'block');
			else $("#showButton").css('display', 'none');

			$("#showqueue").html("");
			$("#turnindicator").css('display', 'block');
		} else {
			$("#turnindicator").css('display', 'none');
			$("#showButton").css('display', 'none');
			this.hand.setIllegal();
		}
	}

	updateRoundDetails(){
		if(this.lock_updates) return;

		let ruleset = this.game.ruleset;
		let announced = this.game.is_announced();
		let passes = this.game.passed;

		let pt_id = get_playtype_id( ruleset.playtype );
		let rt_id = get_playtype_id( ruleset.active );

		// display the main playtype
		let title = get_pt_name(ruleset.playtype, ruleset.misere) || "";

		$("#namePT").text(title).vis(announced).attr("text", `pt${pt_id}`);
		$("#roundPT").vis(announced);

		let src = get_pt_img_path(ruleset.playtype);
		if(src) $("#roundPT").attr("src", src).vis(announced).attr("imgsrc", `pt${pt_id}`);

		let hasRT = !objEquals(ruleset.playtype, ruleset.active)
		let rt = $("#roundRT").vis(hasRT && announced);

		// Handle Ruletype (if it differs the playtype)
		let RTsrc = get_pt_img_path(ruleset.active);
		if(RTsrc && hasRT) rt.attr("src", RTsrc).attr("imgsrc", `pt${rt_id}`);

		// Handle Misere/Pass
		$("#roundMisere").vis(ruleset.misere && announced);
		$("#roundDetails").toggleClass("Misere", ruleset.misere);
		$("#roundPass").vis(passes > 0);
	}

	updateRound() {
		if(this.lock_updates) return;

		$('*[text="game_rounds"]').text(this.game.round+1);
	}

	updateCurrent(player_id?: PlayerID) {
		if(this.lock_updates) return;
		this.players.setCurrent(player_id);
	}

	is_window_open(): boolean {
		let iter = $(".Window").map((_, ele) => {
			return $(ele).css("display") != "none";
		});

		for(let ele of iter) {
			if(ele) return true;
		}
		return false;
	}
}
