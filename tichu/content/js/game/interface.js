function get_card_ele(card) {
	let ele = document.createElement("div");
	ele.classList.add("Card");

	let nums = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
				"Boy", "Queen", "King", "Ace"];

	let colors = ["Green", "Blue", "Red", "Yellow", ""];
	let css = ["green", "lightblue", "red", "yellow", "white"];

	let name = "";

	if(card.color == 4) {
		let names = ["One", "Dragon", "Pheonix", "Dog"];
		name = names[card.number];
	} else {
		name = colors[card.color] + " " + nums[card.number];
	}

	ele.style['background-color'] = css[card.color];
	ele.innerHTML = name;
	return ele;
}

// TODO this function should also handle spaces in fullhouses (so it's more visible WHAT type it is!)
function trick_to_cards(trick) {
	let cardset = Cardset.from_trick(trick);
	let cards = cardset.as_vec();

	let container = $('<div class="Trick">');
	for(let card of cards) container.append(get_card_ele(card));

	return container;
}

function play_trick(trick) {
	let ele = trick_to_cards(trick);
	$("#carpet").html( ele );
}

function clean_carpet() {
	$("#carpet").html("");
}

var carpet = null;
var hand = new Hand(
	document.getElementById("cards"), // Container
	get_card_ele, // ContentHandler
	(card) => {}
);
hand.indicate_new = true;
hand.toggleSelectMode(true);

function setupInterface() {
	setupPoints();
	setupButtons();

	wshandler.comm.updateNames();
}

function setupPoints() {
	for(let tid = 0 ; tid < game.teams.length ; ++tid) {
		let plrs = Array.from(game.get_players_of_team(tid));
		let ele = $('<div>');

		for(const [i, pid] of plrs.entries()) {
			ele.append( $('<span text="short_player' + pid + '" text=>???</span>') )
			if(i+1 < plrs.length) ele.append( $("<span> + </span>") );
		}

		ele.append( $('<span>: </span>') );
		ele.append( $('<span>0</span>').attr("text", "points_team" + tid ) );

		$('#teampoints').append( ele );
	}
}

function updatePoints() {
	game.teams.map((team, idx) => {
		$('*[text="points_team' + idx + '"]').text(team.points);
	});
}

function setupButtons() {
	$("#play").click(() => {
		let cards = hand.get_selected();
		let trick = parse_trick( cards );

		if(trick) ev_play(trick);
	});
	$("#pass").click(() => ev_pass());

	$("#announceTichu").click(() => ev_announce());

	$("#announceGTichu").click(() => decide_gt(true));
	$("#cancelGTichu").click(() => decide_gt(false));
}

function decide_gt(announce) {
	ev_decide_gt(announce);
	$("#announceGTichu").css("display", "none");
	$("#cancelGTichu").css("display", "none");
}

function updateOnTurn() {
	let is_onturn = on_turn();

	if( is_onturn ) {
		$("#play").css("display", "block");
		$("#pass").css("display", "block");
	} else {
		$("#play").css("display", "none");
		$("#pass").css("display", "none");
	}
}

// --- Exchange ---

var exchange = [];
var num_selected = 0;

function openExchange() {
	hand.setSelected(() => false);
	hand.max_selected = 1;

	exchange = [];
	num_selected = 0;

	let num = game.players.length-1;
	exchange = Array(num);

	let container = $("#exchangeHolder");
	for(let i = 0 ; i < num ; ++i) {
		let idx = i;
		let ele = $('<div>');

		ele.click(() => {
			let cards = hand.get_selected();
			if(cards.length == 0) return;

			let card = cards[0];
			if(exchange[idx]) {
				hand.appendCard(exchange[idx]);
			} else {
				num_selected += 1;
			}
			exchange[idx] = card;
			hand.removeCard(card);

			ele.html( get_card_ele(card) );
		});

		container.append(ele);
	}

	$("#exchange").click(() => {
		if(num_selected != game.players.length-1) return;
		ev_exchange(exchange);
		$("#exchange").attr('disabled', 'true');
	});

	$("#exchange").attr('disabled', '');
	$("#exchangeWindow").css("display", "block");
}
