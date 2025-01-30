/// ===== Event Handlers =====

async function FUNC_NewCards(data) {
	handhash = BigInt(data.list);
}

async function FUNC_GameSetting(setting) {
	game = new Game(setting);
	setupInterface();
	wshandler.comm.updateNames();
}

async function FUNC_GameState(data) {
	let [state, cardset] = data;
	game = new Game(state.setting);

	handhash = cardset.list;
	updateHand();

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

	if(state.current_player == wshandler.own.pid) {
		if(!game.is_announced()) startAnnounce();
		else handleOnTurn();
	}
}

async function FUNC_SetAnnouncePlayer(plr) {
	game.announce_player = plr;
	game.current_player = plr;

	updateHand();
	updateCurrentPlayer(game.current_player);
    if( plr == wshandler.own.pid ) startAnnounce();
}

async function FUNC_Announce(ann) {
	let [pt, misere] = ann;

	if( $("#roundWindow").visible() ) {
		$("#closeSummary").click();
		updateHand();
	}

	gameMessage(pt_name(pt, misere), game.current_player);

	said_marriage = false;
	game.announce(pt, misere);

	updateCurrentPlayer(game.current_player);
	updateRoundDetails();
	if( wshandler.own.pid == game.current_player ) handleOnTurn();
}

async function FUNC_Pass(u) {
	gameMessage("Ich schiebe!", game.current_player);
	game.pass();

	updateCurrentPlayer(game.current_player);
	updateRoundDetails();
	if( wshandler.own.pid == game.current_player ) startAnnounce();
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

		updatePoints();
	}

	// Handle Marriage
	if(game.marriage.hasOwnProperty('PlayedBoth') && !said_marriage) {
		let plr = game.marriage['PlayedBoth'];
		gameMessage("Stöck", plr);
		said_marriage = true;
	}

	// Check if round ended
	$("#showButton").display(false);
	if(game.should_end() || game.round_ended()) {
		hand.setIllegal();
		setTimeout(() => {
			openSummary();
			carpet.clean();
			game.start_new_round([]);
		}, 2000);
	} else {
		if( game.current_player == wshandler.own.pid ) handleOnTurn();
		else hand.setIllegal();
		updateCurrentPlayer(game.current_player);
	}

	updateRoundDetails();
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
			let cards = show_to_cards(show);

			let row = $("<div>")
				.css("display", "flex")
				.css("flex-direction", "row")
				.css("flex-wrap", "nowrap");

			for(let card of cards) {
				let img = $("<img>")
					.attr("src", card_get_img_url(card))
					.css("height", "3em");
				row.append(img);
			}

			// Play the show!
			game.play_show(show, pid);

			rows.append(row);
		}

		// Display the shows as a message
		PlayerMSG(rows, pid, 15000);
	}

	updatePoints();
}

async function FUNC_HasMarriage(plr) {
	game.set_marriage(plr);
}

async function FUNC_StartGame() {
	// Create a new game
	game = new Game(game.setting);

	// Close all windows
	$(".Window").display(false);

	wshandler.quitVote();
	carpet.clean();

	updatePoints();
	updateRoundDetails();
}

async function FUNC_EverythingPlaytype(pt) {
	gameMessage(pt_name(pt, game.misere), game.current_player);

	let ruleset = game.ruleset;
	ruleset.active = pt;
	game.ruleset = ruleset;

	updateRoundDetails();
}

// Gameplay actions
function ev_send(ele) { wshandler.send({ "Event": ele }); }

function ev_play_card(card) { ev_send({ "PlayCard": { "color": card.color, "number": card.number } }); }
function ev_announce(pt, misere) { ev_send({ "Announce": [pt, misere] }) }
function ev_pass() { ev_send("Pass"); }
function ev_play_show(show) { ev_send({ "PlayShow": show }); }
