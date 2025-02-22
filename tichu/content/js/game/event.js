function FUNC_AddCards(data) {
	let cards = Cardset.from_hash( BigInt(data.list) ).as_vec();
	for(let card of cards) hand.appendCard(card);
}

function FUNC_StartDistribution(cards) {
	FUNC_AddCards(cards);

	$("#announceGTichu").css("display", "block");
	$("#cancelGTichu").css("display", "block");
}

function FUNC_StartExchange() {
	game.start_exchange();
	openExchange();
}

function FUNC_StartPlaying(plr) {
	game.start_playing();
	game.current_player = plr;

	// ---

	hand.setSelected(() => false);
	hand.max_selected = -1; // unlimit selection size
	updateOnTurn();
}

function FUNC_ExchangeCards(cards) {
	for(let card of cards) hand.appendCard(card);
	$("#exchangeWindow").css("display", "none");
}

function FUNC_Play(data) {
	let [trick, plr_id] = data;
	game.play_trick(trick, plr_id);
	play_trick(trick);

	if(plr_id = wshandler.own.pid) {
		let cset = Cardset.from_trick(trick);
		let cards = cset.as_vec();
		console.log(cards);
		for(let card of cards) hand.removeCard(card);
	}

	updateOnTurn();
}

function FUNC_WishPlay(data) {
	let [trick, wish, plr_id] = data;
	FUNC_Play([trick, plr_id]);
	game.wish(wish);
}


function FUNC_Pass(plr_id) {
	game.pass();
	updateOnTurn();
}


function FUNC_Announce(data) {
	let [ann, plr] = data;

	game.announce(ann, plr);
}

function FUNC_Setting(setting) {
	game = Game.new(setting);
	setupInterface();
	wshandler.comm.updateNames();
}

function FUNC_State(data) {
	let [state, cards] = data;
	game = Game.from_object(state);
	FUNC_AddCards(cards);

	// Update interface
	setupInterface();
	updateOnTurn();

	if(game.phase == "Exchange") {
		openExchange();
	}
}

// ---

function ev_send(ele) { wshandler.send({ "Event": ele }); }

function ev_play(trick, wish=null) {
	if(wish) {
		ev_send({
			"WishPlay": [ trick, wish, wshandler.own.pid ]
		});
	} else {
		ev_send({
			"Play": [ trick, wshandler.own.pid ]
		});
	}
}
function ev_pass() {
	ev_send({ "Pass": wshandler.own.pid });
}
function ev_exchange(cards) {
	ev_send({ "ExchangeCards": cards });
}

function ev_announce() {
	ev_send({"Announce": ["Tichu", wshandler.own.pid]});
}

function ev_decide_gt(announce) {
	ev_send({ "DecideGrandTichu": announce });
}
