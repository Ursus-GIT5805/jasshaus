// Functions regarding the interface/UI
//
// functions starting with "setup" should be called once (at the beginning)
// functions starting with "update" should then update certain UI elements

var said_marriage = false;
var carpet = null;

const PASS_IMG = "img/pass.svg";
const MISERE_IMG = "img/misere.svg";

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
		if( $("#announceWindow").visible() ) return false; // Cancel
		ev_play_card(card);
		return true;
	}
);

/// Helper functino to get the image-path of a Color Playtype
function trumpf_img(col) {
	let pref = "de";
	if(settings.card_lang == "french") pref = "fr";
	return "img/" + pref + "/trumpf" + col + ".svg";
}

/// Returns the path to the card image, given the card
function card_get_img_url(card) {
	let pref = "de";
	if(settings.card_lang == "french") pref = "fr";
	return "img/" + pref + "/" + card.color + card.number + ".png";
}

/// Big List containing the UI infos about a playtype
/// They are sorted by their PlaytypeID
const PlayTypes = [
	{
		name: "Obenabe",
		img: "img/updown.svg"
	},
	{
		name: "Undeufe",
		img: "img/downup.svg",
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Schaufeln";
			return "Trumpf Schilten";
		},
		img: () => trumpf_img(0),
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Kreuz";
			return "Trumpf Eichle";
		},
		img: () => trumpf_img(1),
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Herz";
			return "Trumpf Rose";
		},
		img: () => trumpf_img(2),
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Ecken";
			return "Trumpf Schellen";
		},
		img: () => trumpf_img(3),
	},
	{
		name: "Slalom Obenabe",
		img: "img/slalomup.svg",
	},
	{
		name: "Slalom Undeufe",
		img: "img/slalomdown.svg",
	},
	{
		name: "Guschti",
		img: "img/guschti.svg",
	},
	{
		name: "Mary",
		img: "img/mary.svg",
	},
	{
		name: "Riesenslalom Obenabe",
		img: "img/bigslalomup.svg",
	},
	{
		name: "Riesenslalom Undeufe",
		img: "img/bigslalomdown.svg",
	},
	{
		name: "Molotow",
		img: "img/molotow.svg",
	},
	{
		name: "Alles",
		img: "img/de/everything.svg",
	},
];

/// Returns the name of the given playtype
function pt_name(pt, misere=false) {
	let id = get_playtype_id(pt);
	if(!(id in PlayTypes)) return "";

	let pref = "";
	if(misere) pref = "Misère: ";

	let name = PlayTypes[id].name;
	if(typeof name === 'function') return pref + name();
	return pref + name;
}

/// Returns the image-path of the given playtype
function pt_img_url(pt) {
	let id = get_playtype_id(pt);
	if(!(id in PlayTypes)) return "";

	let src = PlayTypes[id].img;
	if(typeof src === 'function') return src();
	return src;
}

/// Setup the entire interface. Should be called only once
function setupInterface() {
	setupGamedetails();
	setupShowButton();

	updateRoundDetails();
	updatePoints();
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
				if(cards.length > 0) PlayerMSG_Text("Dies ist kein Weis!", null, 2000);
			} else {
				let string = JSON.stringify(show);
				let hs = Cardset.from_list( hand.getCards() );

				let has_show = true;
				try { hs.has_show(show); }
				catch(e) { has_show = false; }

				if(shown.has(string)) {
					PlayerMSG_Text("Schon gewiesen!", null, 2000);
				} else if( !has_show ) {
					PlayerMSG_Text("Du kannst noch mehr weisen ;)", null, 2000);
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
	game.teams.map((team, idx) => {
		let bef = team.points - team.won_points - team.show_points;

		$('*[text="points_team' + idx + '"]').text(bef);
		$('*[text="wonpoints_team' + idx + '"]').text(team.won_points);
		$('*[text="showpoints_team' + idx + '"]').text(team.show_points);
		$('*[text="wonshowpoints_team' + idx + '"]').text(team.won_points + team.show_points);
	});
}

/// Setup the content in the top right corner
function setupGamedetails() {
	// Title
	let end = game.setting.end_condition;
	if(end.hasOwnProperty('Points')) $("#gameTitle").text("Punkte " + end['Points']);
	if(end.hasOwnProperty('Rounds')) {
		$("#gameTitle")
			.append( $("<a>").text("Round ") )
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

		ele.append(
			$('<a>: <a text="points_team{}">0</a> + <a text="wonshowpoints_team{}">0</a></a>'
			  .replaceAll("{}", team))
		)
		$("#gameTeams").append(ele);
	}
}

/// Setup the PlayerBoxes
function setupPlayerboxes(shift, num_players) {
	for(let i = 1 ; i < num_players ; ++i) {
		let r = (shift + i) % num_players;
		let ele = $('<div text="player' + r + '" id="player' + r + '" class="Player"></div>');

		if(i < num_players / 3) $("#pright").append(ele);
		else if(i < num_players / 3*2) $("#pup").append(ele);
		else if(i < num_players) $("#pleft").append(ele);
	}
}

/// Displays a message from the player (as text)
function PlayerMSG_Text(msg, plr_id, delay=6000) {
	let div = $('<a>').text(msg);
	PlayerMSG( div, plr_id, delay );
}

/// Displays a message from the player (any element)
function PlayerMSG(ele, plr_id, delay=6000) {
	let div = $('<div class="PlayerMSG">').append(ele);
	div.click(() => div.remove());
	if(delay > 0) setTimeout(() => div.remove(), delay);

	let parent = $("#player" + plr_id);
	if(parent.length == 0) $("body").append( div.css("bottom", "30%").addClass("CenterX") );
	else parent.append(div);
}

var curplr = null;
/// Update the current active player
function updateCurrentPlayer(plr=null) {
	if(curplr != null) $("#player" + curplr).css("border-style", "none");
	if(plr != null) $("#player" + plr).css("border-style", "solid");
	curplr = plr;
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
