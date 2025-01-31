const DEV_MODE = window.location.protocol == "file:" || window.location.protocol == "http:";

let WS_URL = "wss://" + window.location.host + "/ws"
if(DEV_MODE){
    if(window.location.protocol == "http:") WS_URL = "ws://" + window.location.hostname + ":7999/ws";
    else WS_URL = "ws://127.0.0.1:7999/ws";
}

function detectMobile() {
	let regexp = /android|iphone|kindle|ipad/i;
	return regexp.test(navigator.userAgent);
}

function quitError(message) {
	alert(message);
	window.location.replace("index.html");
}

const IS_MOBILE = detectMobile();

var settings = null;
var form = null;
var game = null;
var wshandler = null;

//  ===== QoL functions =====
if(typeof jQuery === 'undefined') quitError("Could not load jQuery!");

jQuery.fn.vis = function(v){ return this.css('visibility', ['hidden', 'visible'][+v]); }
jQuery.fn.visible = function(){ return this.css('display') != "none"; }
jQuery.fn.display = function(v){ return this.css('display', ['none', 'block'][+v]); }

/// Return true if two objects are equal in their properties
function objEquals(a, b) {
	if(typeof a !== typeof b) return false;
	if(typeof a === 'object') {
		if( Object.keys(a).length !== Object.keys(b).length ) return false;
		for(let key in a) {
			if(!b.hasOwnProperty(key) || !objEquals(a[key], b[key])) return false;
		}
	} else {
		return a === b;
	}
	return true;
}

// ===== Helpers for events =====

/// Handler for when the host is on turn
function handleOnTurn() {
	if(game.should_end()) return;

	let cardset = Cardset.from_list( hand.getCards() );
	hand.setLegality((card) => game.is_legal_card(cardset, card));

	let can_show = game.get_turn() == 0 && game.setting.allow_shows;
	if(can_show) {
		$("#showqueue").html("");
		$("#showButton").display(true);
	}
	$("#turnindicator").display(true);
}

var handhash = null;
/// Update the hand, if there are new cards to get
function updateHand() {
	if(handhash) {
		let cards = new Cardset( BigInt(handhash) ).as_vec();
		hand.setCards(cards);
		hand.setIllegal()
		handhash = null;
	}
}

/// Create a flex container with all cards from the show
function showToFlexbox(show) {
	let row = $("<div>")
		.css("display", "flex")
		.css("flex-direction", "row")
		.css("flex-wrap", "nowrap");

	let cards = show_to_cards(show);
	for(let card of cards) {
		let img = $("<img>")
			.attr("src", card_get_img_url(card))
			.css("height", "3em");
		row.append(img);
	}

	return row;
}

/// Display a gameplay message, as bubble and in chat
function gameMessage(msg, plr) {
	let name = wshandler.comm.getPlayerName(plr);
	let chatmsg = "[" + name + "]: " + msg;

	PlayerMSG_Text(msg, plr);
	wshandler.comm.chatMessage(MessageType.Info, chatmsg);
}

/// Get a random greet
function getGreet() {
	let choices = ["Grüezi", "Guten Tag", "Heyho", "Hallo"];
	let index = Math.floor(Math.random() * choices.length);
	return choices[index];
}

function toggleFullscreen() {
	if(window.fullScreen) document.exitFullscreen();
	else document.documentElement.requestFullscreen();
}

// ===== Setup =====

// Websocket handling
function startWS () {
	let host = new HostData(settings.name);
	host.mute_players = settings.mute_players;
	host.allow_rtc = settings.allow_rtc;

	let goaway = () => {
		if(!DEV_MODE) window.location.replace("index.html")
	};
	wshandler = new GameClient(WS_URL, host, null, goaway);

	wshandler.oninit = (pid, num_players) => {
		setupPlayerboxes(pid, num_players);

		carpet = new Carpet(num_players, 0);
		carpet.autoclean = num_players;
		carpet.rotate_by_players(pid);
	}
	wshandler.onchatmessage = PlayerMSG_Text;

	wshandler.onevent = (ev) => {
		if(DEV_MODE) console.log(ev);
		let head = Object.keys(ev)[0];
		if(head == "0") head = ev;

		// Run the corresponding event handler
		window["FUNC_" + String(head)]( ev[head] );
	}

	wshandler.onplayergreet = (pid) => PlayerMSG_Text(getGreet(), pid);

	// Append Mic/Chat button upon load
	let ctnr = $("#botrightbuttons")
	if(!IS_MOBILE) {
		wshandler.comm.onchatinit = () => ctnr.append( wshandler.comm.createChatbutton() );
	} else {
		let fullscreen = $("<img>")
			.addClass("ActionButton")
			.attr("src", "img/fullscreen.svg")
			.click(toggleFullscreen);
		ctnr.append( fullscreen );
	}
	wshandler.comm.onvoiceinit = () => ctnr.append( wshandler.comm.createMicbutton() );

	if(DEV_MODE) console.log("Started WS");
}

function afterModule() {
	if(DEV_MODE) console.log("Loaded WASM module!");

	setupSettings();
	startWS();
}
