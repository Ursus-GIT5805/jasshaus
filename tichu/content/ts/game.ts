import { Cardset, Event, Game, setting_classic, Trick } from "../pkg/tichu_game.js";
import { CommHandler, MessageType } from "./chat.js";
import { ClientSetting } from "./clientsetting.js";
import { UI } from "./interface.js";
import { get_card_ele, number_name } from "./tichu.js";
import { VoteHandler } from "./voting.js";
import { ClientData, ClientID, PlayerID, Wshandler } from "./wshandler.js";

export class Main {
	client_id: ClientID = 0;
	player_id: PlayerID = 0;

	game = Game.new(setting_classic());
	setting: ClientSetting;

	comm: CommHandler;
	wshandler: Wshandler;
	ui: UI;
	vote: VoteHandler;

	constructor(addr: string, setting: ClientSetting) {
		this.wshandler = new Wshandler(addr, setting);

		this.setting = setting;
		this.ui = new UI(this.game);
		this.comm = new CommHandler(setting);
		this.vote = new VoteHandler($("body"), (idx) => this.wshandler.vote(idx));

		this.wshandler.oninit = (c, p, n) => this.oninit(c, p, n);

		this.wshandler.onclient = (d, c, p) => this.onclient(d, c, p);
		this.wshandler.onclientleave = (c) => this.onclientleave(c);

		this.wshandler.onchatmessage = (msg, c) => this.onchatmessage(msg, c);

		this.wshandler.onevent = (ev) => this.onevent(ev);

		this.wshandler.rtc_onstart = (cid) => this.comm.rtc_onstart(cid);
		this.wshandler.rtc_onoffer = (cid, offer) => this.comm.rtc_onoffer(cid, offer);
		this.wshandler.rtc_onanswer = (cid, answer) => this.comm.rtc_onanswer(cid, answer);
		this.wshandler.rtc_onicecandidate = (cid, ice) => this.comm.rtc_onicecandidate(cid, ice);

		// Vote events
		this.wshandler.onvote = (v, cid) => this.vote.onvote(v, cid);
		this.wshandler.onnewvote = (ty) => this.vote.onnewvote(ty);
		this.wshandler.onvotequit = () => this.vote.onvotequit();
	}

	// ---

	oninit(client_id: ClientID, player_id: PlayerID, num_players: number) {
		this.client_id = client_id;
		this.player_id = player_id;
		this.ui.player_id = player_id;

		this.comm.oninit(client_id, player_id);
		this.ui.oninit(client_id, player_id, num_players);
		this.ui.player_names.set(player_id, this.setting.name);
	}

	onclient(data: ClientData, client_id: ClientID, player_id: PlayerID) {
		this.vote.onclient();
		this.ui.onclient(data, client_id, player_id);
		this.comm.onclient(data, client_id, player_id);
	}

	onclientleave(client_id: ClientID) {
		this.ui.onclientleave(client_id);
		this.comm.onclientleave(client_id);
		this.vote.onclientleave(client_id);
	}

	onchatmessage(msg: string, client_id: ClientID) {
		if (this.comm.get(client_id)?.muted) return; // Ignore on mute

		this.ui.onchatmessage(msg, client_id);
		this.comm.onchatmessage(msg, client_id);
	}

	// ---

	setupUI() {
		this.ui.setupInformation();
		this.ui.setupExchangeWindow((cards) => this.ev_send({ ExchangeCards: cards }));
		this.ui.setupPlayPass(
			(trick, wish) => {
				if (wish) {
					this.ev_send({ WishPlay: [trick, wish, this.player_id] });
				} else {
					this.ev_send({ Play: [trick, this.player_id] });
				}
			},
			() => this.ev_send({ Pass: this.player_id }),
		);
		this.ui.setupTichuAnnounce(
			() => this.ev_send({ Announce: ["Tichu", this.player_id] }),
			(gt) => this.ev_send({ DecideGrandTichu: [gt, this.player_id] }),
		);

		this.ui.setupButtons();
		this.ui.players.click_callback = (plr: number) => {
			if (this.game.phase !== "GiveAway") return;
			this.ev_send({ GiveAway: plr });
		};

		this.comm.displayClientNames();
	}

	// ---

	ev_send(data: any) {
		this.wshandler.send({ Event: data });
	}

	play_trick(trick: Trick, plr_id: PlayerID, wish?: number) {
		this.ui.players.toggleClass("Best", this.game.last_player, false);
		this.game.play_trick(trick, plr_id);

		if (trick !== "Dog") {
			this.ui.players.toggleClass("Best", plr_id, true);
		}

		if (wish !== undefined) {
			this.game.wish(wish);

			let name = number_name(wish);
			this.gameMessage(`I wish: ${name}`, plr_id);
		}
		this.ui.indicateWish(wish);

		if (plr_id == this.player_id) {
			let cardset = Cardset.from_trick(trick);
			let cards = cardset.as_vec();

			this.ui.updateTichubutton(false);
			for (let card of cards) this.ui.hand.erase(card);
		}

		let finished = this.game.players[plr_id].finished;
		if (finished) {
			this.ui.updatePoints();

			this.ui.indicateFinished(plr_id);
			this.ui.indicateTichu(plr_id, false);
			this.ui.indicateGrandTichu(plr_id, false);
		}

		this.ui.play_trick(trick);
		this.ui.updateOnTurn();
		this.ui.updateHandsize(plr_id);
		this.ui.clearPassInfo();

		if (this.game.should_round_end()) this.end_round();
	}

	end_round() {
		this.game.end_round();

		for (let i = 0; i < this.game.players.length; ++i) {
			this.ui.indicateFinished(i, false);
			this.ui.indicateTichu(i, false);
			this.ui.indicateGrandTichu(i, false);
		}

		setTimeout(() => {
			if (this.game.should_game_end()) {
				this.ui.hideButtons();
				this.ui.openEndwindow();
			}
		}, 2000);

		this.ui.updatePoints();
	}

	gameMessage(msg: string, player_id: PlayerID) {
		let name = this.comm.getPlayerNames().get(player_id);

		let chatmsg = `[${name}] ${msg}`;
		this.comm.chatMessage(MessageType.Info, chatmsg);
		this.ui.players.setMessage(msg, player_id);
	}

	// ---

	onevent(data: Event) {
		if (typeof data === "string") {
			if (data === "StartExchange") {
				this.game.start_exchange();

				for (let i = 0; i < this.game.players.length; ++i) {
					this.ui.indicateActive(i, false);
					this.ui.indicateFinished(i, false);
				}

				this.ui.updatePhase("Exchange");
				this.ui.startExchange();
			} else if (data === "NewGame") {
				this.game = Game.new(this.game.setting);
				this.ui.game = this.game;
				$(".Window").display(false);
			}

			return;
		}

		if ("Play" in data) {
			let [trick, plr_id] = data.Play;
			this.play_trick(trick, plr_id);
		} else if ("WishPlay" in data) {
			let [trick, wish, plr_id] = data.WishPlay;
			this.play_trick(trick, plr_id, wish);
		} else if ("Pass" in data) {
			let plr = data.Pass;

			this.game.pass();

			this.ui.indicatePass(plr);
			this.ui.updateOnTurn();

			// Best trick got taken away
			if (this.game.get_best_trick() === undefined) {
				this.ui.clearPassInfo();
				this.ui.players.toggleClass("Best", this.game.last_player, false);
			}

			if (this.game.phase === "GiveAway") this.ui.indicateGiveAwayPhase();
			if (this.game.should_round_end()) this.end_round();
		} else if ("Announce" in data) {
			let [ann, plr_id] = data.Announce;
			this.game.announce(ann, plr_id);

			let text = "";
			if (ann === "Tichu") {
				this.ui.indicateTichu(plr_id);
				text = "Tichu";
			}
			if (ann === "GrandTichu") {
				this.ui.indicateGrandTichu(plr_id);
				text = "Grand Tichu";
			}

			if (text) this.gameMessage(text, plr_id);

			if (plr_id == this.player_id) this.ui.updateTichubutton(false);
			this.ui.updatePoints();
		} else if ("ExchangeCards" in data) {
			let cards = data.ExchangeCards;

			let num_players = this.game.players.length;
			for (let i = 0; i < cards.length; ++i) {
				let id = (this.player_id + i + 1) % num_players;

				let ele = get_card_ele(cards[i]);
				this.ui.players.setMessage(ele, id, 20000);
			}

			this.ui.add_cards(cards);
			this.ui.stopExchange();
		} else if ("DidExchange" in data) {
			let plr = data.DidExchange;

			this.ui.indicateActive(plr, false);
		} else if ("GiveAway" in data) {
			let target = data.GiveAway;
			this.game.give_away(target);

			this.gameMessage("I received the dragon!", target);
			this.ui.indicateGiveAwayPhase(false);
		} else if ("AddCards" in data) {
			let obj = data.AddCards as any;
			let cardset = Cardset.from_object(obj);
			if (cardset === undefined) return;

			this.ui.add_cards(cardset);
		} else if ("StartPlaying" in data) {
			this.game.start_playing();
			this.game.current_player = data.StartPlaying;

			for (let i = 0; i < this.game.players.length; ++i) {
				this.ui.indicateFinished(i, false);
			}

			this.ui.updatePhase("Playing");
			this.ui.showInfos();
			this.ui.hand.selectMode(true);
			this.ui.updateOnTurn();
			this.ui.updateTichubutton(true);
			this.ui.updateHandsize();
		} else if ("StartDistribution" in data) {
			let obj = data.StartDistribution as any;
			let cardset = Cardset.from_object(obj);
			if (cardset === undefined) return;

			this.game.start_new_round();

			let num_players = this.game.players.length;
			let num_cards = this.game.setting.num_cards_gt;
			for (let i = 0; i < num_players; ++i) {
				this.game.set_num_cards(num_cards, i);
				this.ui.indicateActive(i);
			}

			let delay = 0;
			if (this.game.should_round_end()) delay = 2000;

			this.ui.hideButtons();
			setTimeout(() => {
				this.ui.set_cards(cardset);
				this.ui.updatePhase("Distributing");
				this.ui.updateHandsize();
				this.ui.updatePoints();
				this.ui.clean_carpet();
				this.ui.update_gt_buttons();
			}, delay);
		} else if ("DecideGrandTichu" in data) {
			let [announce, plr] = data.DecideGrandTichu;

			if (announce) {
				this.game.announce("GrandTichu", plr);
				this.gameMessage("Grand Tichu", plr);
				this.ui.indicateGrandTichu(plr);
			}

			let num_cards = this.game.cards_per_player();
			this.game.set_num_cards(num_cards, plr);

			if (this.player_id == plr) this.ui.update_gt_buttons();

			this.ui.indicateFinished(plr);
			this.ui.indicateActive(plr, false);
			this.ui.updateHandsize(plr);
		} else if ("State" in data) {
			// TODO retrieve cards from exchange
			// TODO handle end window
			let [state, obj] = data.State;

			let parsed = Game.from_object(state);
			if (parsed) this.game = parsed;
			else alert("Could not load game state!");
			this.ui.game = this.game;

			let cardset = Cardset.from_object(obj);
			if (cardset !== undefined) this.ui.add_cards(cardset);

			let best_trick = this.game.get_best_trick();
			if (best_trick !== undefined) this.ui.play_trick(best_trick);

			this.setupUI();

			this.ui.indicateWish(this.game.wished_number);
			this.ui.updateOnTurn();
			this.ui.updatePoints();
			this.ui.updateTichubutton();
			this.ui.updateHandsize();

			if (this.game.phase === "Exchange") {
				this.ui.updatePhase("Exchange");
				this.ui.hand.selectMode(false);
				this.ui.startExchange();
			} else if (this.game.phase === "Distributing") {
				this.ui.updatePhase("Distributing");
				this.ui.hand.selectMode(false);
				this.ui.update_gt_buttons();
			} else if (this.game.phase === "GiveAway") {
				this.ui.indicateGiveAwayPhase();
			} else if (this.game.should_game_end()) {
				this.ui.openEndwindow();
			} else {
				this.ui.showInfos();
				this.ui.updatePhase("Playing");
				this.ui.hand.selectMode(true);
			}

			// TODO open windows depending on state
		} else if ("Setting" in data) {
			this.game = Game.new(data.Setting);
			this.ui.game = this.game;

			this.setupUI();
		}
	}
}
