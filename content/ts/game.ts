import { Card, Cardset, Game, Event as GameEvent, Playtype, Show, setting_molotow } from "../pkg/jasshaus_game.js"
import { ClientData, ClientID, PlayerID, Wshandler } from "./wshandler.js";
import { UI } from "./interface.js"
import { get_pt_name } from "./jass.js";
import { ClientSetting } from "./clientsetting.js";
import { CommHandler } from "./chat.js";
import { VoteHandler } from "./voting.js";

declare global {
	interface JQuery { vis(v: boolean): JQuery; }
}

$.fn.vis = function(v: boolean) {
	return this.css("visibility", ["hidden", "visible"][+v]);
}

export class Main {
	wshandler: Wshandler;

	game: Game = new Game( setting_molotow() );

	comm: CommHandler;
	vote: VoteHandler;

	setting: ClientSetting;
	ui: UI;

	player_id: PlayerID = 0;

	client_to_plr = new Map<PlayerID, ClientID>();
	said_marriage: boolean = false;

	constructor(addr: string, setting: ClientSetting) {
		this.setting = setting;

		this.wshandler = new Wshandler(addr, setting);
		this.comm = new CommHandler(setting);
		this.vote = new VoteHandler( $("body"), (idx) => this.wshandler.vote(idx) );

		// Join Events
		this.wshandler.oninit = (c, p, n) => this.oninit(c, p, n);
		this.wshandler.onclient = (d, cid, pid) => this.onclient(d, cid, pid);
		this.wshandler.onclientleave = (cid) => this.onclientleave(cid);
		this.wshandler.onevent = (d) => this.onevent(d);

		// RTC events
		this.wshandler.rtc_onstart = (cid) => this.comm.rtc_onstart(cid);
		this.wshandler.rtc_onoffer = (cid, offer) => this.comm.rtc_onoffer(cid, offer);
		this.wshandler.rtc_onanswer = (cid, answer) => this.comm.rtc_onanswer(cid, answer);
		this.wshandler.rtc_onicecandidate = (cid, ice) => this.comm.rtc_onicecandidate(cid, ice);

		// Vote events
		this.wshandler.onvote = (v, cid) => this.vote.onvote(v, cid);
		this.wshandler.onnewvote = (ty) => this.vote.onnewvote(ty);
		this.wshandler.onvotequit = () => this.vote.onvotequit();

		this.wshandler.onchatmessage = (msg, client_id) => {
			let client = this.comm.get(client_id);
			if(client?.muted) return;

			this.onchatmessage(msg, client_id);
		};

		this.ui = new UI(
			(card: Card) => {
				if(this.ui.is_window_open()) return false;
				this.ev_send({"PlayCard": card});
				return true;
			},
			this.game
		);
	}

	setupUI() {
		this.ui.setupInterface(this.player_id, this.game);
		this.ui.setupAnnounce(
			(pt: Playtype, misere: boolean) => this.ev_send({ "Announce": [pt, misere] }),
			() => this.ev_send("Pass"),
		);
		this.ui.setupBiding((bid) => this.ev_send({ "Bid": bid }));
		this.ui.setupShowButton((show) => this.ev_send({ "PlayShow" : show }));
	}

	ev_send(data: any) {
		this.wshandler.send({
			"Event": data,
		});
	}

	// ---

	oninit(client_id: ClientID, player_id: PlayerID, num_players: number) {
		this.player_id = player_id;
		this.ui.player_id = player_id;

		this.comm.oninit(client_id, player_id);
		this.ui.players.oninit(client_id, player_id, num_players);
		this.client_to_plr.set(client_id, player_id);
		this.ui.updateName(this.player_id, this.setting.name);
	}

	onclient(data: ClientData, client_id: ClientID, player_id: PlayerID) {
		this.client_to_plr.set(client_id, player_id);

		this.vote.onclient();
		this.comm.onclient(data, client_id, player_id);
		this.ui.players.onclient(data, client_id, player_id);
		this.ui.updateName(player_id, data.name);
	}

	onclientleave(client_id: ClientID) {
		let player_id = this.client_to_plr.get(client_id);

		this.client_to_plr.delete(client_id);
		this.vote.onclientleave(client_id);
		this.comm.onclientleave(client_id);
		this.ui.players.onclientleave(client_id);
		if(player_id !== undefined) this.ui.updateName(player_id, "");
	}

	onchatmessage(msg: string, client_id: ClientID) {
		this.comm.onchatmessage(msg, client_id);
		this.ui.players.onchatmessage(msg, client_id);
	}

	// ---

	onevent(event: any) {
		let data = event as GameEvent;

		if(typeof(data) === 'string') {
			if(data === 'Pass') {
				this.ui.closeAnnounceWindow();
				this.ui.gameMessage("Ich Schiebe!", this.game.current_player);
				this.game.pass();

				this.ui.updateCurrent(this.game.current_player);
				this.ui.updateRoundDetails();
				this.ui.updateOnturn();
			}

			return;
		}

		if("PlayCard" in data) {
			let card = data.PlayCard;

			let curplr = this.game.current_player;
			let is_best = this.game.would_card_beat(card);

			let playedcards =  Cardset.from_list( this.game.get_playedcards() );
			playedcards.insert(card);

			this.game.play_card(card);

			this.ui.carpet.playCard(card, curplr, is_best);

			if( this.game.fresh_turn() ) {
				if(this.game.setting.allow_table_shows) {
					let shows = playedcards.get_shows();
					let sum = 0;
					for(let show of shows) sum += this.game.ruleset.get_show_value(show);
					if(sum != 0) this.ui.gameMessage(`Tischweis: ${sum}`, this.game.current_player);
				}
			}

			// Handle Marriage
			let plr = this.game.player_with_played_marriage();
			if(plr !== undefined && !this.said_marriage) {
				this.ui.gameMessage("Stöck", plr);
				this.said_marriage = true;
			}

			// Check if round ended
			if(this.game.should_end() || this.game.round_ended()) {
				this.ui.updateSummary();
				this.ui.updatePoints();
				this.ui.updateOnturn(false);
				this.ui.hand.setIllegal();

				this.ui.lock_updates = true;

				this.game.update_round_results();
				this.game.start_new_round([]);

				setTimeout(() => {
					this.ui.lock_updates = false;
					this.ui.carpet.clean()
					this.ui.openSummary();
				}, 2000);
			} else {
				this.ui.updateCurrent(this.game.current_player);
				this.ui.updatePoints();
				this.ui.updateOnturn();
			}
		} else if("Announce" in data) {
			let [pt, misere] = data.Announce;

			this.game.announce(pt, misere);

			this.ui.gameMessage(get_pt_name(pt, misere), this.game.current_player);

			this.said_marriage = false;
			this.ui.shown.clear();

			this.ui.closeAnnounceWindow();
			this.ui.updateRoundDetails();
			this.ui.updateCurrent(this.game.current_player);
			this.ui.updateOnturn();
		} else if("ShowPoints" in data) {
			let [points, plr_id] = data.ShowPoints;
			this.ui.players.setMessage(`${points}`, plr_id);
		} else if("ShowList" in data) {
			let showlist = data.ShowList;

			for(let pid = 0 ; pid < this.game.players.length ; ++pid) {
				let shows = showlist[pid];
				if(shows.length == 0) continue;

				for(let show of shows) this.game.play_show(show, pid);
				this.ui.setShowMessage(shows, pid);
			}

			this.ui.updatePoints();
		} else if("HasMarriage" in data) {
			let plr_id = data.HasMarriage;
			this.game.set_marriage(plr_id);
		} else if("GameState" in data) {
			let [state, handobj, shows]: [Game, object, Show[]] = data.GameState;
			let hand = Cardset.from_object(handobj);

			let game = Game.from_object(state);
			if(game) this.game = game;
			else alert("Could not recover game!");
			this.ui.game = this.game;

			this.setupUI();
			if(hand) this.ui.hand.setCards( hand.as_vec() );

			this.ui.updateHand(hand);
			this.ui.hand.setIllegal();

			this.ui.updatePoints();
			this.ui.updateNames();
			this.ui.updateOnturn();
			this.ui.updateRoundDetails();

			if(hand) this.game.players[ this.player_id ].hand = hand;
			this.ui.carpet.set_cards( this.game.get_playedcards(), this.game.get_beginplayer(), this.game.bestcard );

			if(this.game.get_turn() == 0) {
				for(let show of shows) this.ui.indicateShow(show);
			}
		} else if("GameSetting" in data) {
			let setting = data.GameSetting;
			this.game = new Game(setting);
			this.ui.game = this.game;

			this.setupUI();
			this.ui.updateNames();
		} else if("EverythingPlaytype" in data) {
			let pt = data.EverythingPlaytype;

			this.game.ruleset.active = pt;
			this.ui.updateRoundDetails();
		} else if("NewCards" in data) {
			let cards = Cardset.from_object( data.NewCards );

			this.ui.updateHand(cards);
			this.ui.updateOnturn();
		} else if("StartGame" in data) {
			let plr_id = data.StartGame as PlayerID;

			this.game = new Game( this.game.setting );
			this.ui.game = this.game;

			this.game.announce_player = plr_id;
			this.game.current_player = plr_id;

			// Close all windows
			$(".Window").css("display", "none");

			this.ui.carpet.clean();

			this.ui.updateHand();
			this.ui.updatePoints();
			this.ui.updateRoundDetails();
			this.ui.updateOnturn();
		} else if("Bid" in data) {
			this.game.bid(data.Bid);

			this.ui.updatePoints();
			this.ui.updateOnturn();
		} else {
			console.log(`Ignore event: ${data}`);
		}
	}
}
