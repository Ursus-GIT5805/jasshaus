const DEV_MODE = window.location.protocol == "file:" || window.location.protocol == "http:";

let WS_URL = "wss://" + window.location.host + "/ws/"
if(DEV_MODE){
    if(window.location.protocol == "http:") WS_URL = "ws://" + window.location.hostname + ":7998/ws/";
    else WS_URL = "ws://127.0.0.1:7998/ws/";
}

let params = new URLSearchParams(location.search);
let room_id = params.get('room');
WS_URL += room_id;

// ---

function on_turn() {
	return game.current_player == wshandler.own.pid && game.phase == "Playing";
}

// ---

var players = new PlayerHandler();
var wshandler = null;
var game = null;

// Websocket handling
function startWS () {
	let host = new HostData("");
	host.mute_players = false;
	host.allow_rtc = false;

	let goaway = () => {
		if(!DEV_MODE) window.location.replace("index.html");
	};
	wshandler = new GameClient(WS_URL, host, null, goaway);
	wshandler.plugins.push(players);

	wshandler.onevent = (ev) => {
		if(DEV_MODE) console.log(ev);
		let head = Object.keys(ev)[0];
		if(head == "0") head = ev;

		console.log(JSON.stringify(ev));

		// Run the corresponding event handler
		window["FUNC_" + String(head)]( ev[head] );
	}

	// Append Mic/Chat button upon load
	let ctnr = $("#botrightbuttons")
	wshandler.comm.onchatinit = () => ctnr.append( wshandler.comm.createChatbutton() );
	wshandler.comm.onvoiceinit = () => ctnr.append( wshandler.comm.createMicbutton() );

	if(DEV_MODE) console.log("Started WS");
}

function afterModule() {
	if(DEV_MODE) console.log("Loaded WASM module!");

	startWS();
	$('*[text="room_id"]').text(room_id);
}
