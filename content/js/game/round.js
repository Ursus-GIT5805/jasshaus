var said_marriage = false;

const PASS_IMG = "img/pass.svg";
const MISERE_IMG = "img/misere.svg";

function trumpf_img(col) {
	let pref = "de";
	if(settings.card_lang == "french") pref = "fr";
	return "img/" + pref + "/trumpf" + col + ".svg";
}

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

function pt_name(pt, misere=false) {
	let id = get_playtype_id(pt);
	let pref = "";
	if(misere) pref = "Misère: ";

	if(!(id in PlayTypes)) return "";

	let name = PlayTypes[id].name;
	if(typeof name === 'function') return pref + name();
	return pref + name;
}

function pt_img_url(pt) {
	let id = get_playtype_id(pt);

	if(!(id in PlayTypes)) return "";
	let src = PlayTypes[id].img;
	if(typeof src === 'function') return src();
	return src;
}

function setupInterface() {
	// Display the chatbutton
	$("#botrightbuttons").append( comm.createChatbutton() );

	// Setup the game/round-details
	setupGamedetails();
	updateRoundDetails();
	players.updateNames();
	updatePoints();
}

// Updates the points of a team in the gameDetails
function updatePoints() {
	game.teams.map((team, idx) => {
		let bef = team.points - team.won_points - team.show_points;

		$('*[text="points_team' + idx + '"]').text(bef);
		$('*[text="wonpoints_team' + idx + '"]').text(team.won_points);
		$('*[text="showpoints_team' + idx + '"]').text(team.show_points);
		$('*[text="wonshowpoints_team' + idx + '"]').text(team.won_points + team.show_points);
	});
}

function setupGamedetails() {
	let end = game.setting.end_condition;
	if(end.hasOwnProperty('Points')) $("#gameTitle").text("Punkte " + end['Points']);
	if(end.hasOwnProperty('Rounds')) {
		$("#gameTitle")
			.append( $("<a>").text("Round ") )
			.append( $("<a>").attr('text', 'game_rounds').text(game.round+1) )
			.append( $("<a>").text("/" + end['Rounds']) );
	}

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

// Updates the symbols in the top left corner
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

// Handles
function handleOnTurn() {
	if(game.should_end()) return;

	let cardset = Cardset.from_list( hand.getCards() );
	hand.setLegality((card) => game.is_legal_card(cardset, card));

	$("#showButton").display(game.get_turn() == 0 && game.setting.allow_shows);
}
