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

	let name = PlayTypes[id].name;
	if(typeof name === 'function') return pref + name();
	return pref + name;
}

function pt_img_url(pt) {
	let id = get_playtype_id(pt);
	let src = PlayTypes[id].img;
	if(typeof src === 'function') return src();
	return src;
}

function updateSetting() {
	updateGameDetails();
	players.updateNames();
	$('*[text="max_points"]')
		.map((_,ele) => ele.innerText = game.setting.max_points);
}

// Updates the points of a team in the gameDetails
function updatePoints() {
	game.teams.map((team, idx) => {
		let bef = team.points - team.won_points - team.show_points;

		$('*[text="points_team' + idx + '"]')
			.map((_,ele) => ele.innerText = bef);
		$('*[text="wonpoints_team' + idx + '"]')
			.map((_,ele) => ele.innerText = team.won_points);
		$('*[text="showpoints_team' + idx + '"]')
			.map((_,ele) => ele.innerText = team.show_points);
		$('*[text="wonshowpoints_team' + idx + '"]')
			.map((_,ele) => ele.innerText = team.won_points + team.show_points);
	});
}

function updateGameDetails() {
	for(let team = 0 ; team < game.teams.length ; team++) {
		let plrs = Array.from(game.get_players_of_team(team));

		let ele = $("<div>");

		for(const [i, pid] of plrs.entries()) {
			ele.append( $('<a text="short_player' + pid + '" text=>???</a>') )
			if(i+1 < plrs.length) ele.append( $("<a> + </a>") );
		}

		ele.append( $("<a>: </a>") );
		ele.append( $("<a>").text("0").attr("text", "points_team" + team) );
		ele.append( $("<a> + </a>") );
		ele.append( $("<a>").text("0").attr("text", "wonshowpoints_team" + team) );

		$("#gameTeams").append(ele);
	}
}

// Updates the symbols in the top left corner
function updateRoundDetails(){
	let ruleset = game.ruleset;

	let state = [ "hidden", "visible" ];
	$("#roundPass").css("visibility", state[ +(game.passed > 0) ]);

	if(ruleset.playtype == "None"){
		$("#roundDetails").css("filter", "");
		$("#namePT").css("visibility", "hidden");
		$("#roundMisere").css("visibility", "hidden");
		$("#roundSymbols").css("visibility", "hidden");
		$("#roundRT").css("visibility", "hidden");
        return;
    } else {
		$("#namePT").css("visibility", "visible");
		$("#roundSymbols").css("visibility", "visible");
	}

	let title = pt_name(ruleset.playtype, ruleset.misere);
	$("#namePT").text(title);

	$("#roundPT").attr("src", pt_img_url(ruleset.playtype));

	if( !objEquals(ruleset.playtype, ruleset.active) ) {
		$("#roundRT").attr("src", pt_img_url(ruleset.active)).css("visibility", "visible");
	} else {
		$("#roundRT").css("visibility", "hidden");
	}

	let filter = ["invert(0)", "invert(100%)"][ +ruleset.misere ];

    $("#roundDetails").css("filter", filter);
	$("#roundMisere").css("visibility", state[ +ruleset.misere ]);
}

function handleOnTurn() {
	let cardset = Cardset.from_list( hand.getCards() );
	hand.setLegality((card) => game.is_legal_card(cardset, card));

	if(game.get_turn() == 0 && game.setting.allow_shows) $("#showButton").css("display", "block");
	else $("#showButton").css("display", "none");
}
