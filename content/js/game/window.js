// All variables and functions for all the popup windows

// Announce window ---
var annMisere = false;

function startAnnounce(){
	annMisere = false;
	hand.setLegality((c) => true);

	$("#announcePT").html("");
	$("#announcePTCol").html("");

	for(let id = 0 ; id < 14 ; id++) {
		if(!game.setting.playtype[id].allow) continue;

		let pt = Playtype.from_id(id);
		let but = $("<div>").click(() => announce(pt))
			.append( $("<img>").attr("src", pt_img_url(pt)) )
			.append( $("<a>").text( pt_name(pt) ) );

		if(pt.hasOwnProperty("Color")) $("#announcePTCol").append(but);
		else $("#announcePT").append(but);
	}

	$("#passmisere").html("");
	if(game.setting.allow_misere) {
		let but = $("<div>")
			.append( $("<img>").attr("src", MISERE_IMG) )
			.append( $("<a>").text( "Misère" ) )
			.click(() => {
				annMisere = !annMisere;
				$("#announceWindow").css("filter", ["invert(0)", "invert(100%)"][+annMisere]);
			});
		$("#passmisere").append(but);
	}
	if(game.can_pass(own.id) && game.setting.allow_pass) {
		let but = $("<div>")
			.append( $("<img>").attr("src", PASS_IMG) )
			.append( $("<a>").text( "Schieben" ) )
			.click(() => {
				send("Pass");
				hand.setIllegal();
				$("#announceWindow").css("display", "none");
			});

		$("#passmisere").append(but);
	}

	$("#announceWindow").css("display", "flex").css("filter", "");
}

function announce(pt){
    send({"Announce": [pt, annMisere]});
	hand.setIllegal();
	$("#announceWindow").css("display", "none");
}

// Show window ---
var toShow = [];

// Displays a show in the show-window
// isShowing (bool) - when false it means, the player must decide to show. If true, the show is visible for everyone.
function openShow(show, push=true){
	if(push) toShow.push(show);
	if(toShow.length > 1) return;

	let ele = $("#showCards");
    ele.html(""); // Clear current cards

	let cards = show_to_cards(show);
	for(let card of cards) ele.append( $('<img src="' + card_get_img_url(card) + '"/>') );

	$("#showWindow").css("display", "flex");
}

function closeShow(e) {
	toShow.shift();
	if(toShow.length > 0) openShow(toShow[0][0], toShow[0][1], toShow[0][2], false);
	else $("#showWindow").css("display", "none");
}

$("#showConfirm").click((e) => {
	send({ "PlayShow": toShow[0][0] });
	closeShow(e);
});

$("#showCancel").click(closeShow);

// Round summary ---
var endRound = false;

function openSummary() {
	$("#roundSummary").html("");

	for(let team_id in game.teams) {
		let team = game.teams[team_id];

		let bef = team.points - team.won_points - team.show_points;

		let plr_id = Array.from(game.get_players_of_team(team_id));
		let plrs = plr_id.map((id) => players.getName(id))

		// <span class="Summaryname">
		// <a text="short_player3">BBB</a>
		// <div class="Playercards" id="hand3"></div>
		// </span>

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

		$("#roundSummary").append(ele);
	}

	$("#roundWindow").css("display", "block");
}

$("#closeSummary").click((e) => {
	$("#roundWindow").css("display", "none");

	updatePoints();
	updateRoundDetails();
	updateHand();

	if(game.should_end()) openEndwindow();
	else {
		players.setCurrent(game.current_player);
		if(game.current_player == own.id) startAnnounce();
	}
});

// Endresult window ---

var sentRevanche = false;
var agreedRevanche = 0;

$("#revancheButton").click((e) => {
	let button = $("#revancheButton");
	if(sentRevanche) send();
});

function openEndwindow() {
	players.setCurrent(null);

	let teams = game.rank_teams();

	let container = $("#endTeams").html("");
	$("#endResult").text("Die Partie ist beendet!");

	for(let i = 0 ; i < teams.length ; i++) {
		let tid = teams[i];
		let points = game.teams[tid].points;

		let place = i+1;
		let plr_ids = Array.from(game.get_players_of_team(tid));
		let name = plr_ids.map((pid) => players.getName(pid)).join(", ");

		let title = place + ". " + name + " (" + points + ")";

		let ele = null;
		if(i == 0) ele = $("<h1>").text(title);
		else if(i == 1) ele = $("<h2>").text(title);
		else if(i == 2) ele = $("<h3>").text(title);
		else ele = $("<h4>").text(title);

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

// Team window --- (for choosing teams)

let chosen = false;

function chooseT( index ){
    if( chosen ) return;
    let plr = (id + index) % 4;

    for(let i = 0 ; i < 4 ; ++i){
        document.getElementById("choose" + i).style.backgroundColor = ["#AA0000", "#00DD00"][+(index == i)];
    }

    send({ "Mate": plr });
    chosen = true;
}
