/// ===== Event Handlers =====

async function FUNC_NewCards(data) {
	handhash = BigInt(data.list);
	updateHand();
}

async function FUNC_GameSetting(setting) {
	game = new Game(setting);
	setupInterface();
	wshandler.comm.updateNames();
}

async function FUNC_GameState(data) {
	let [state, cardset, shows] = data;
	game = new Game(state.setting);

	handhash = cardset.list;
	updateHand();
	hand.setIllegal();

	// Update the entire state
	for(let key in state) {
		if(key != 'ruleset') game[key] = state[key];
		else { // special handling for RuleSet
			let rs = RuleSet.new(state[key].playtype, state[key].misere);
			rs.active = state[key].active;
			game[key] = rs;
		}
	}
	if(game.marriage.hasOwnProperty('PlayedBoth')) said_marriage = true;

	// Display the cards on the carpet
	let begplayer = game.get_beginplayer();
	let pcards = game.get_playedcards()
	let numplayers = game.players.length;
	for(let i = 0 ; i < pcards.length ; i++) {
		let card = pcards[i];
		let plr = (begplayer + i) % numplayers;
		carpet.playCard(card, plr, objEquals(card, game.bestcard));
	}

	// Setup Interface
	setupInterface();
	wshandler.comm.updateNames();
	updateCurrentPlayer(game.current_player);

	if(game.is_announced()) {
		let pt = game.ruleset.playtype;
		let misere = game.ruleset.misere;
		console.log(pt_name(pt, misere));
		gameMessage(pt_name(pt, misere), game.get_announcing_player());

		if( on_turn() ) handleOnTurn();
	} else {
		if( on_turn() ) startAnnounce();
	}

	if(game.get_turn() == 0) {
		for(let show of shows) {
			let row = showToFlexbox(show);
			$("#showqueue").append(row);
			shown.add(JSON.stringify(show));
		}
	}
}

async function FUNC_Announce(ann) {
	let [pt, misere] = ann;

	gameMessage(pt_name(pt, misere), game.current_player);

	shown = new Set();
	said_marriage = false;
	game.announce(pt, misere);

	updateCurrentPlayer(game.current_player);
	updateRoundDetails();
	if( on_turn() ) handleOnTurn();
}

async function FUNC_Pass(u) {
	gameMessage("Ich schiebe!", game.current_player);
	game.pass();

	updateCurrentPlayer(game.current_player);
	updateRoundDetails();
	if( on_turn() ) startAnnounce();
}

async function FUNC_PlayCard(card){
	let curplr = game.current_player;
	let isbest = game.would_card_beat(card);

	let playedcards = Cardset.from_list(game.get_playedcards());
	playedcards.insert(card);

	game.play_card(card);

	carpet.playCard(card, curplr, isbest);

	let newturn = game.played_cards.length == 0;
	if(newturn) {
		if(game.setting.allow_table_shows) {
			let shows = playedcards.get_shows();
			let sum = 0;
			for(let show of shows) sum += game.get_show_value(show);
			if(sum != 0) gameMessage("Tischweis: " + sum, game.current_player);
		}
	}

	// Handle Marriage
	if(game.marriage.hasOwnProperty('PlayedBoth') && !said_marriage) {
		let plr = game.marriage['PlayedBoth'];
		gameMessage("Stöck", plr);
		said_marriage = true;
	}

	// Check if round ended
	$("#showButton").display(false);
	$("#turnindicator").display(false);
	if(game.should_end() || game.round_ended()) {
		hand.setIllegal();
		updateSummary();
		updatePoints();

		lock_interface_updates = true;

		game.update_round_results();
		game.start_new_round([]);

		setTimeout(() => {
			carpet.clean()
			lock_interface_updates = false;
			$("#roundWindow").display(true);
		}, 2000);
	} else {
		if( on_turn() ) handleOnTurn();
		else hand.setIllegal();
		updateCurrentPlayer(game.current_player);
	}

	updateRoundDetails();
	if(newturn) updatePoints();
}

async function FUNC_ShowPoints(data) {
	let [points, plr] = data;
	gameMessage(points, plr);
}

async function FUNC_ShowList(list) {
	let names = wshandler.comm.getPlayerNames();

	for(let pid = 0 ; pid < list.length ; pid++) {
		let shows = list[pid];
		if(shows.length == 0) continue;

		let name = names[pid];
		let rows = $("<div>")
			.css("display", "flex")
			.css("flex-direction", "column");

		// Display each show on a new row
		for(let show of shows) {
			game.play_show(show, pid);

			let row = showToFlexbox(show);
			rows.append(row);
		}

		// Display the shows as a message
		players.setMessage(rows, pid, 15000);
	}

	updatePoints();
}

async function FUNC_HasMarriage(plr) {
	game.set_marriage(plr);
}

async function FUNC_StartGame(data) {
	let plr = data;

	// Create a new game
	game = new Game(game.setting);

	game.announce_player = plr;
	game.current_player = plr;

	// Close all windows
	$(".Window").display(false);

	wshandler.quitVote();
	carpet.clean();

	updateHand();
	updatePoints();
	updateRoundDetails();
	updateCurrentPlayer(game.current_player);

	if( game.setting.announce == "Choose" ) {
		if( on_turn() ) startAnnounce();
	}
}

async function FUNC_EverythingPlaytype(pt) {
	gameMessage(pt_name(pt, game.ruleset.misere), game.current_player);

	let ruleset = game.ruleset;
	ruleset.active = pt;
	game.ruleset = ruleset;

	updateRoundDetails();
}

async function FUNC_Bid(bid) {
	gameMessage("Ich biete: " + bid, game.current_player);
	game.bid(bid);

	updatePoints();
	updateCurrentPlayer(game.current_player);
	if( on_turn() ) handleOnTurn();
}

// Gameplay actions
function ev_send(ele) { wshandler.send({ "Event": ele }); }

function ev_play_card(card) { ev_send({ "PlayCard": { "color": card.color, "number": card.number } }); }
function ev_announce(pt, misere) { ev_send({ "Announce": [pt, misere] }) }
function ev_pass() { ev_send("Pass"); }
function ev_play_show(show) { ev_send({ "PlayShow": show }); }
function ev_bid(bid) { ev_send({ "Bid": bid }); }
