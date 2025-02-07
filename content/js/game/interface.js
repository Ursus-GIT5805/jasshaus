// Functions regarding the interface/UI
//
// functions starting with "setup" should be called once (at the beginning)
// functions starting with "update" should then update certain UI elements

var said_marriage = false;
var carpet = null;
var lock_interface_updates = false;

/// The Hand, contains all the cards
var hand = new Hand(
	document.getElementById("cards"), // Put the cards into #cards
	(card) => { // ContentHandler
		let img = document.createElement("img");
		img.setAttribute("imgsrc", "card" + get_card_id(card));
		img.src = card_get_img_url(card);
		return img;
	},
	(card) => { // onPlay
		if( $("#announceWindow").visible() ) return false;
		if( $("#bidWindow").visible() ) return false;
		ev_play_card(card);
		return true;
	}
);
hand.indicate_new = false;

/// Setup the entire interface. Should be called only once
function setupInterface() {
	setupGamedetails();
	setupShowButton();

	updateRoundDetails();
	updatePoints();
}

function infoMessage(text) {
	players.setTextMessage(text, null, 2000);
}

var shown = new Set();
/// Setup the button to show
function setupShowButton() {
	let showButton = $("#showButton");
	showButton.click(function () {
		if(hand.selecting) {
			let cards = hand.get_selected();
			let show = parse_show(cards);

			if(!show) {
				if(cards.length > 0) infoMessage("Dies ist kein Weis!");
			} else {
				let string = JSON.stringify(show);
				let hs = Cardset.from_list( hand.getCards() );

				let has_show = true;
				try { hs.has_show(show); }
				catch(e) { has_show = false; }

				if(shown.has(string)) {
					infoMessage("Schon gewiesen!");
				} else if( !has_show ) {
					infoMessage("Du kannst noch mehr weisen ;)");
				} else {
					let row = showToFlexbox(show);
					$("#showqueue").append(row);
					shown.add(string);
					ev_play_show(show);
				}
			}
		}

		if(hand.toggleSelectMode()) showButton.text("Fertig");
		else showButton.text("Weisen");
	});
}

/// Update the points in the top right corner
function updatePoints() {
	if(lock_interface_updates) return;

	game.teams.map((team, idx) => {
		let gain = team.won_points + team.show_points + team.marriage_points;

		$('*[text="points_team' + idx + '"]').text(team.points);
		$('*[text="wonpoints_team' + idx + '"]').text(team.won_points);
		$('*[text="showpoints_team' + idx + '"]').text(team.show_points);
		$('*[text="gainpoints_team' + idx + '"]').text(gain);

		let target = team.target;
		if(target == I32_MIN) target = 0;
		$('*[text="target_team' + idx + '"]').text(target);
	});
}

/// Setup the content in the top right corner
function setupGamedetails() {
	// Title
	let end = game.setting.end_condition;
	if(end.hasOwnProperty('Points')) $("#gameTitle").text("Punkte " + end['Points']);
	if(end.hasOwnProperty('Rounds')) {
		$("#gameTitle")
			.append( $("<a>").text("Runde ") )
			.append( $("<a>").attr('text', 'game_rounds').text(game.round+1) )
			.append( $("<a>").text("/" + end['Rounds']) );
	}

	// Create an entry for each team
	$("#gameTeams").html("");
	for(let team = 0 ; team < game.teams.length ; team++) {
		let plrs = Array.from(game.get_players_of_team(team));

		let ele = $("<div>");

		for(const [i, pid] of plrs.entries()) {
			ele.append( $('<a text="short_player' + pid + '" text=>???</a>') )
			if(i+1 < plrs.length) ele.append( $("<a> + </a>") );
		}

		ele.append( $('<a>: </a>') );
		ele.append( $('<a>0</a>').attr("text", "points_team" + team) );

		let gainpoints = $('<a> (<a text="gainpoints_team{}"></a>)</a>'.replaceAll("{}", team));
		ele.append(gainpoints);

		if( must_bid(game.setting) ) {
			let bid = $('<a> [<a text="target_team{}"></a>]</a>'.replaceAll("{}", team));
			ele.append( bid );
		}

		$("#gameTeams").append(ele);
	}
}

/// Update the current active player
function updateCurrentPlayer(plr=null) {
	if(lock_interface_updates) return;
	players.updateCurrent(plr);
}

function updateCardskin() {
	$('*[imgsrc^=card]').map((i, ele) => {
		let att = ele.getAttribute("imgsrc");

		let card_id = Number(att.substr(4));
		let card = Card.from_id(card_id)

		ele.setAttribute("src", card_get_img_url(card));
	});
}

function updatePlaytypeSRC() {
	if(lock_interface_updates) return;

	$('*[imgsrc^=pt]').map((i, ele) => {
		let att = ele.getAttribute("imgsrc");

		let pt_id = Number(att.substr(2));
		let pt = Playtype.from_id(pt_id);
		ele.setAttribute("src", pt_img_url(pt));
	});

	$('*[text^=pt]').map((i, ele) => {
		let att = ele.getAttribute("text");

		let pt_id = Number(att.substr(2));
		let pt = Playtype.from_id(pt_id);
		ele.innerText = pt_name(pt);
	});
}

/// Update the symbols in the top left corner
function updateRoundDetails(){
	if(lock_interface_updates) return;

	let ruleset = game.ruleset;
	let announced = game.is_announced();

	// display the main playtype
	let title = pt_name(ruleset.playtype, ruleset.misere);
	$("#namePT").text(title).vis(announced);
	$("#roundPT").attr("src", pt_img_url(ruleset.playtype)).vis(announced);

	// Handle Ruletype (if it differs the playtype)
	let hasRT = !objEquals(ruleset.playtype, ruleset.active)
	let rt = $("#roundRT").vis(hasRT && announced);
	if(hasRT) rt.attr("src", pt_img_url(ruleset.active));

	// Handle show/pass
	$("#roundPass").vis(game.passed > 0);
	$("#roundMisere").vis(ruleset.misere && announced);

	// Invert everything on misere
	let filter = ["invert(0)", "invert(100%)"][ +ruleset.misere ];
    $("#roundDetails").css("filter", filter);
}

/// Local settings variable
var settings = null;

/// Setups the settings window
function setupSettings() {
	settings = getSettings();
	if(!settings) {
		settings = getDefaultSettings();
		settings.name = promptName();
		localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(settings));
	}
	settings = complementSettings(settings);

	// Adjust the form, so it automatically updates the UI
	JasshausForm['name']['#disabled'] = true;
	JasshausForm['card_lang']['#onchange'] = (lang) => {
		settings.card_lang = lang;

		updateCardskin();
		updatePlaytypeSRC();
		updateRoundDetails();
	};
	JasshausForm['cardclicks']['#onchange'] = (c) => hand.enable_clicks = c;

	form = createForm("Einstellungen", JasshausForm, settings);
	$("#settings").append(form.ele);

	// Setup events and DOM elements
	let button = $('<img class="ActionButton">')
		.attr("src", "img/settings.svg")
		.click(() => $("#settingsWindow").toggle());

	$("#closeSettings").click(() => {
		button.click();
		settings = form.get();
	});
	$("#botleftbuttons").append(button);
}


var handhash = null;
/// Update the hand, if there are new cards to get
function updateHand() {
	if(lock_interface_updates) return;

	if(handhash) {
		let cards = new Cardset( BigInt(handhash) ).as_vec();
		hand.setCards(cards);

		let legal = on_turn();
		hand.setLegality(() => legal);
		handhash = null;
	}
}
