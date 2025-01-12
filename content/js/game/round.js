var said_marriage = false;

function pt_img_url(pt) {
	if(pt == "Updown") return "img/updown.png";
	else if(pt == "Downup") return "img/downup.png";
	else if(pt == "SlalomUpdown") return "img/slalomup.png";
	else if(pt == "SlalomDownup") return "img/slalomdown.png";
	else if(pt == "Guschti") return "img/guschti.png";
	else if(pt == "Mary") return "img/mary.png";

	if(typeof pt === 'object') {
		if(pt["Color"] == 0) return "img/trumpfshield.png";
		if(pt["Color"] == 1) return "img/trumpfacorn.png";
		if(pt["Color"] == 2) return "img/trumpfrose.png";
		if(pt["Color"] == 3) return "img/trumpfbell.png";
	}

	return "";
}

function pt_name(pt) {
	if(pt == "Updown") return "Obenabe";
	else if(pt == "Downup") return "Undeufe";
	else if(pt == "SlalomUpdown") return "Slalom Obenabe";
	else if(pt == "SlalomDownup") return "Slalom Undeufe";
	else if(pt == "Guschti") return "Guschti";
	else if(pt == "Mary") return "Mary";

	if(typeof pt === 'object') {
		if(pt["Color"] == 0) return "Trumpf Schilte";
		if(pt["Color"] == 1) return "Trumpf Eichle";
		if(pt["Color"] == 2) return "Trumpf Rose";
		if(pt["Color"] == 3) return "Trumpf Schelle";
	}

	return "";
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

	if(ruleset.playtype == "None"){
		$("#namePT").css("visibility", "hidden");
		$("#roundSymbols").css("visibility", "hidden");
		$("#roundPass").css("visibility", "hidden");
        return;
    } else {
		$("#namePT").css("visibility", "visible");
		$("#roundSymbols").css("visibility", "visible");
	}

	$("#namePT").text(pt_name(ruleset.playtype));

	$("#roundPT").attr("src", pt_img_url(ruleset.playtype));

	if( !objEquals(ruleset.playtype, ruleset.active) ) {
		$("#roundRT").attr("src", pt_img_url(ruleset.active)).css("visibility", "visible");
	} else {
		$("#roundRT").css("visibility", "hidden");
	}

	let state = [ "hidden", "visible" ];
	let filter = ["invert(0)", "invert(100%)"][ +ruleset.misere ];

    $("#roundDetails").css("filter", filter);
	$("#roundMisere").css("visibility", state[ +ruleset.misere ]);
	$("#roundPass").css("visibility", state[ +(game.passed > 0) ]);
}

function handleOnTurn() {
	let cardset = Cardset.from_list( hand.getCards() );
	hand.setLegality((card) => game.is_legal_card(cardset, card));

	if(game.get_turn() == 0) {
		let shows = cardset.get_shows();
		for(let show of shows) openShow(show, "Weisen?", true);
	}
}
