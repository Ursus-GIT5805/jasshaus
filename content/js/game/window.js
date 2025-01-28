// All variables and functions for all the popup windows

// Announce window ---
var announceWindow = $("#announceWindow");
var annMisere = false;

function startAnnounce(){
	annMisere = false;
	hand.setLegality((c) => true);

	let pts = announceWindow.find("#announcePT").html("");
	let cpts = announceWindow.find("#announcePTCol").html("");

	let button = (text, src, click) => $("<div>")
		.click(click)
		.append( $("<img>").attr("src", src) )
		.append( $("<a>").text(text) );

	// Display Playtypes
	for(let id = 0 ; id < 14 ; id++) {
		if(!game.setting.playtype[id].allow) continue;

		// Create Button
		let pt = Playtype.from_id(id);
		let but = button(pt_name(pt), pt_img_url(pt), () => announce(pt));

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
	if(game.can_pass(ownid) && game.setting.allow_pass) {
		let but = button("Schieben", PASS_IMG, pass);
		passmisere.append(but);
	}

	announceWindow.display(true).css("filter", "");
}

function announce(pt){
    send({"Announce": [pt, annMisere]});
	hand.setIllegal();
	announceWindow.display(false);
}

function pass() {
	send("Pass");
	hand.setIllegal();
	announceWindow.display(false);
}

// Round summary ---
function openSummary() {
	let summaryWindow = $("#roundSummary").html("");

	for(let team_id in game.teams) {
		let team = game.teams[team_id];

		let bef = team.points - team.won_points - team.show_points;
		let plr_id = Array.from(game.get_players_of_team(team_id));
		let plrs = plr_id.map((id) => players.getName(id))

		let ele = $(`
<div class="SummaryTeam">
 <div class="SummaryStats">
  <div style="font-size: 2em;">` + plrs.join(" & ") + `</div>
  <div><a style="float: left;">Beginn</a> <a style="float: right;">` + bef + `</a></div>
  <div><a style="float: left;">Stich</a> <a style="float: right;">+` + team.won_points + `</a></div>
  <div><a style="float: left;">Weis</a> <a style="float: right;">+` + team.show_points + `</a></div>
  <div>----------</div>
  <div style="font-size: 1.5em;">
   <a style="float: left;">Endstand</a> <a style="float: right;">` + team.points + `</a></div>
  </div>
</div>
`);

		let woncards = new Cardset(BigInt(team.won.list));
		let cardlist = $("<div>").addClass("SummaryCards");

		for(let color = 0 ; color < 4 ; color++) {
			let div = $("<div>");
			for(let number = 0 ; number < 9 ; number++){
				let card = Card.new(color, number);
				let img = $("<img>").attr("src", card_get_img_url(card));
				if(!woncards.contains(card)) img.css("filter", "brightness(50%)");
				div.append(img);
			}
			cardlist.append(div);
		}
		ele.append(cardlist);

		summaryWindow.append(ele);
	}

	summaryWindow.css("display", "block");
}

$("#closeSummary").click((e) => {
	$("#roundWindow").css("display", "none");
	$('*[text="game_rounds"]').text(game.round+1);

	updatePoints();
	updateRoundDetails();
	updateHand();

	if(game.should_end()) openEndwindow();
	else {
		players.setCurrent(game.current_player);
		if(game.current_player == ownid) startAnnounce();
	}
});

// Endresult window ---

function openEndwindow() {
	players.setCurrent(null);

	let teams = game.rank_teams();
	let container = $("#endTeams").html("");

	for(let i = 0 ; i < teams.length ; i++) {
		let tid = teams[i];
		let points = game.teams[tid].points;

		let place = i+1;
		let plr_ids = Array.from( game.get_players_of_team(tid) );
		if(plr_ids.includes(ownid)) $("#endResult").text("Du bist " + place + ". Platz!");

		let name = plr_ids.map((pid) => players.getName(pid)).join(", ");
		let title = place + ". " + name + " (" + points + ")";

		let ele = $("<h" + place + ">").text(title);
		container.append(ele);
	}

	$("#endWindow").css("display", "flex");
}

// Info window ---

function openInfo(title, info, onConfirm){
	$("#infoTitle").text(title);
	$("#infoText").text(info);
	$("#infoButton").click(onConfirm);
	$("#infoWindow").css("display", "block");
}
