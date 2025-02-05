// All variables and functions for all the popup windows

// Announce window ---
var announceWindow = $("#announceWindow");
var annMisere = false;

function startAnnounce(){
	annMisere = false;
	hand.setLegality((c) => true);

	let pts = announceWindow.find("#announcePT").html("");
	let cpts = announceWindow.find("#announcePTCol").html("");

	let button = (text, src, click, atext=null, imgsrc=null) => $("<div>")
		.click(click)
		.append( $("<img>").attr("src", src).attr("imgsrc", imgsrc) )
		.append( $("<a>").text(text).attr("text", atext) );

	// Display Playtypes
	for(let id = 0 ; id < 14 ; id++) {
		if(!game.setting.playtype[id].allow) continue;

		let pt = Playtype.from_id(id);
		let mult = game.setting.playtype[id].multiplier;

		let title = pt_name(pt);
		if(mult != 1) title += " (" + mult + "x)";

		// Create Button
		let ident = "pt" + id;
		let but = button(title, pt_img_url(pt), () => announce(pt), ident, ident);

		// Append it
		if(pt.hasOwnProperty("Color")) cpts.append(but);
		else pts.append(but);
	}

	/// Display
	let passmisere = announceWindow.find("#passmisere").html("");

	if(game.setting.allow_misere) {
		let click = () => {
			annMisere = !annMisere;
			announceWindow.css("filter", ["invert(0)", "invert(100%)"][+annMisere]);
		};
		let but = button("Misère", MISERE_IMG, click);

		passmisere.append(but);
	}

	// Display Pass Button
	if(game.can_pass(wshandler.own.pid) && game.setting.allow_pass) {
		let but = button("Schieben", PASS_IMG, pass);
		passmisere.append(but);
	}

	announceWindow.display(true).css("filter", "");
}

function announce(pt){
	ev_announce(pt, annMisere);
	hand.setIllegal();
	announceWindow.display(false);
}

function pass() {
	ev_pass();
	hand.setIllegal();
	announceWindow.display(false);
}

// Round summary ---
function updateSummary() {
	let roundSummary = $("#roundSummary").html("");
	let names = wshandler.comm.getPlayerNames();

	for(let team_id in game.teams) {
		let team = game.teams[team_id];

		let plr_mar = game.player_with_played_marriage();
		let got_marriage = plr_mar && game.players[plr_mar].team_id == team_id;

		let bef = team.points;
		let gain = team.won_points + team.show_points + team.marriage_points;
		let after = bef + gain;

		let plr_id = Array.from(game.get_players_of_team(team_id));
		let plrs = plr_id.map((id) => {
			if(!names[id]) return "???";
			return names[id].substr(0,3);
		});

		let ele = $(`
<div class="SummaryTeam">
 <div class="SummaryStats">
  <div style="font-size: 2em;" id="names"></div>
  <div><a style="float: left;">Beginn</a> <a style="float: right;">` + bef + `</a></div>
  <div id="mods"></div>
  <div>----------</div>
  <div style="font-size: 1.5em;">
   <a style="float: left;">Endstand</a> <a style="float: right;">` + after + `</a></div>
  </div>
</div>
`);
		ele.find("#names").text( plrs.join(" & ") );

		let ele_gain = (title, points) => {
			let title_a = $("<a>").css("float", "left").text(title);
			let plus = ["", "+"][ +(points > 0) ];
			let points_a = $("<a>").css("float", "right").text(plus + points);

			return $('<div>')
				.append(title_a)
				.append(points_a);
		};

		let mods = ele.find("#mods");
		if(team.won_points > 0) mods.append( ele_gain("Stich", team.won_points) );
		if(team.show_points > 0) mods.append( ele_gain("Weis", team.show_points) );
		if(team.marriage_points > 0) mods.append( ele_gain("Stöck", team.marriage_points) );

		let woncards = new Cardset(BigInt(team.won.list));
		let cardlist = $("<div>").addClass("SummaryCards");

		for(let color = 0 ; color < 4 ; color++) {
			let div = $("<div>");
			for(let number = 0 ; number < 9 ; number++){
				let card = Card.new(color, number);
				let img = $("<img>")
					.attr("src", card_get_img_url(card))
					.attr("imgsrc", "card" + get_card_id(card));
				if(!woncards.contains(card)) img.css("filter", "brightness(50%)");
				div.append(img);
			}
			cardlist.append(div);
		}
		ele.append(cardlist);

		roundSummary.append(ele);
	}
}

$("#closeSummary").click((e) => {
	$("#roundWindow").display(false);

	if(!game.should_end()) $('*[text="game_rounds"]').text(game.round+1);
	carpet.clean();
	updatePoints();
	updateRoundDetails();
	updateHand();

	if(game.should_end()) openEndwindow();
	else {
		updateCurrentPlayer(game.current_player);
		if(game.current_player == wshandler.own.pid) startAnnounce();
	}
});

// Endresult window ---

function openEndwindow() {
	hand.clear();
	updateCurrentPlayer(null);

	let teams = game.rank_teams();
	let container = $("#endTeams");
	let names = wshandler.comm.getPlayerNames();

	container.html("");

	for(let i = 0 ; i < teams.length ; i++) {
		let tid = teams[i];
		let points = game.teams[tid].points;

		let place = i+1;
		let plr_ids = Array.from( game.get_players_of_team(tid) );

		// Update the title
		if(plr_ids.includes(wshandler.own.pid)) $("#endResult").text("Du bist " + place + ". Platz!");

		let name = plr_ids.map((pid) => names[pid] || "???").join(", ");
		let title = place + ". " + name + " (" + points + ")";

		let ele = $("<h" + place + ">").text(title);
		container.append(ele);
	}

	$("#endWindow").css("display", "flex");
}
