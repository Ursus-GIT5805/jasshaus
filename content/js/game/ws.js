const DEV_MODE = window.location.protocol == "file:" || window.location.protocol == "http:";

let WEB_URL = "https://" + window.location.host + "/";
let WSS_URL = "wss://" + window.location.host + "/ws"

if(DEV_MODE){
    if(window.location.protocol == "http:"){
        WEB_URL = "http://" + window.location.host + "/";
        WSS_URL = "ws://" + window.location.hostname + ":7999/ws";
    } else {
        WEB_URL = "file://" + window.location.pathname.substr( 0, window.location.pathname.lastIndexOf("/jasshaus/content/")+17 ) + "/";
        WSS_URL = "ws://127.0.0.1:7999/ws";
    }
}


var socket = null;
var handhash = null;

function gameMessage(msg, plr) {
	let name = players.getName(plr);
	let chatmsg = "[" + name + "]: " + msg;

	players.setMessage(msg, plr);
	comm.chatMessage(MessageType.Info, chatmsg);
}

function updateHand() {
	if(handhash) {
		let cards = new Cardset(handhash).as_vec();
		hand.setCards(cards);
		hand.setIllegal()
		handhash = null;
	}
}

function getGreet() {
	let choices = ["Grüezi", "Guten Tag", "Heyho", "Hallo"];
	let index = Math.floor(Math.random() * choices.length);
	return choices[index];
}

async function setupMic(data){
	let answerHandler = (answer, id) => send({ "RtcSignaling": [JSON.stringify(answer), "Answer", id] });
	let ICEHandler = (candidate, id) => send({ "RtcSignaling": [JSON.stringify(candidate), "ICECandidate", id] });

	await comm.initVoiceChat(answerHandler, ICEHandler);
	send({ "RtcStart": 0 });

	$("#botrightbuttons").append( comm.createMicbutton() )
}

async function FUNC_PlayerID(player_id) {
	own.id = player_id;
}

async function FUNC_ClientJoined(data) {
	let [client_id, player_id] = data;
	comm.newClient(client_id);
	comm.clients[client_id].player_id = player_id;
	comm.clients[client_id].muted = settings.mute_players;

	let def = "Unnamed" + client_id
	comm.setName(def, client_id);
	players.setName(def, player_id );
}

async function FUNC_JoinedClients(list) {
	for(let [name, client_id, player_id] of list) {
		comm.newClient(client_id);
		comm.clients[client_id].player_id = player_id;

		comm.setName( name, client_id );
		players.setName( name, player_id );
	}
	if(players) players.updateNames();
}

async function FUNC_ClientDisconnected(client_id) {
	let name = comm.clients[client_id].name;
	let pid = comm.clients[client_id].player_id;

	comm.removeClient(client_id);
	comm.chatMessage(MessageType.Info, name + " left the table.");
	players.setName( "", pid );
	// if(!voting) voting.setTotal(comm.clients.num_clients+1);
}

async function FUNC_StartMating(u) {
	$("#startWindow").css("display", "none");
	$("#teamWindow").css("display", "block");
}

async function FUNC_NewCards(data) {
	handhash = BigInt(data.list);
}

function initGame(n) {
	players = new Playerhandler(n);
	carpet = new Carpet(n, 0);

	players.createPlayers(own.id);
	players.setName(settings.name, own.id);
	players.setMessage(getGreet(), own.id);
	carpet.rotate_by_players(own.id);
}

async function FUNC_GameSetting(setting) {
	game = new Game(setting);
	initGame(setting.num_players);
	updateSetting();
}

async function FUNC_GameState(data) {
	let [state, cardset] = data;
	initGame(state.setting.num_players);
	game = new Game(state.setting);

	let cards = new Cardset(BigInt(cardset.list)).as_vec();
	hand.setCards(cards);
	hand.setIllegal();

	for(let key in state) {
		if(key != 'ruleset') game[key] = state[key];
		else game[key] = RuleSet.new( state[key].playtype, state[key].misere );
	}

	if(game.marriage.hasOwnProperty('PlayedBoth')) said_marriage = true;

	let begplayer = game.get_beginplayer();
	let pcards = game.get_playedcards()
	let numplayers = game.players.length;
	for(let i = 0 ; i < pcards.length ; i++) {
		let card = pcards[i];
		let plr = (begplayer + i) % numplayers;
		carpet.playCard(card, plr, objEquals(card, game.bestcard));
	}

	game.update_ruletype();
	$("#startWindow").css("display", "none");

	players.setCurrent(game.current_player);
	updateGameDetails();
	updateRoundDetails();
	updatePoints();

	console.log("HES");
	if(state.current_player == own.id) {
		if(!game.is_announced()) startAnnounce();
		else handleOnTurn();
	}
}

async function FUNC_SetAnnouncePlayer(plr) {
	game.announce_player = plr;
	game.current_player = plr;

	updateHand();
	players.setCurrent(game.current_player);
    if( plr == own.id ) startAnnounce();
}

async function FUNC_Announce(ann) {
	let [pt, misere] = ann;
    if( game.cards_played != 0 ) {
		$("#closeSummary").click();
		updateHand();
	}

	let title = pt_name(pt, misere);
	gameMessage(title, game.current_player);

	said_marriage = false;
	game.announce(pt, misere);

	players.setCurrent(game.current_player);
	updateRoundDetails();
	if( own.id == game.current_player ) handleOnTurn();
}

async function FUNC_Pass(u) {
	gameMessage("Ich schiebe!", game.current_player);
	game.pass();
	if( own.id == game.current_player ) startAnnounce();
	players.setCurrent(game.current_player);
	updateRoundDetails();
}

async function FUNC_ClientIntroduction(data) {
	let [name, cid] = data;
	let pid = comm.clients[cid].player_id;

	comm.setName(name, cid);
	players.setName(name, pid);
	comm.chatMessage(MessageType.Info, name + " joined the table.");
	players.setMessage(getGreet(), pid);
}

async function FUNC_PlayCard(card){
	let curplr = game.current_player;
	game.play_card(card);

	let isbest = false;
	if(game.bestcard) {
		if(objEquals(game.bestcard, card)) isbest = true;
	} else {
		if(game.current_player == curplr) isbest = true;
	}

	if(carpet.get_num_cards() == game.players.length) carpet.clean();
	carpet.playCard(card, curplr, isbest);
	if(carpet.get_num_cards() == game.players.length) updatePoints();

	// ---

	$("#showButton").css("display", "none");
	if(game.marriage.hasOwnProperty('PlayedBoth') && !said_marriage) {
		let plr = game.marriage['PlayedBoth'];
		gameMessage("Stöck", plr);
		said_marriage = true;
	}

	if(game.should_end() || game.cards_played == 36) {
		hand.setIllegal();
		setTimeout(() => {
			openSummary();

			carpet.clean();
			game.start_new_round([]);
		}, 2000);
	} else {
		if( game.current_player == own.id ) handleOnTurn();
		else hand.setIllegal();
		players.setCurrent(game.current_player);
	}
	updateRoundDetails();
}

async function FUNC_ChatMessage(data) {
	let [msg, client_id] = data;

	let name = settings.name;
	if(client_id in comm.clients) {
		if(comm.clients[client_id].muted) return;
		let plr_id = comm.clients[client_id].player_id;
		name = comm.clients[client_id].name;

		players.setMessage(msg, plr_id);
	}
	let message = "[" + name + "]: " + msg;

	comm.chatMessage(MessageType.Normal, message);
}

async function FUNC_ShowPoints(data) {
	let [points, plr] = data;
	gameMessage(points, plr);
}

async function FUNC_ShowList(list) {
	for(let i = 0 ; i < list.length ; i++) {
		let shows = list[i];
		if(shows.length == 0) continue;

		let name = players.getName(i);
		let rows = $("<div>")
			.css("display", "flex")
			.css("flex-direction", "column");

		for(let show of shows) {
			let cards = show_to_cards(show);

			let row = $("<div>")
				.css("display", "flex")
				.css("flex-direction", "row")
				.css("flex-wrap", "nowrap");

			for(let card of cards) {
				let img = $("<img>")
					.attr("src", card_get_img_url(card))
					.css("height", "3em");
				row.append(img);
			}

			rows.append(row);
			game.play_show(show, i);
		}

		players.setEleMessage(rows, i, 15000);
	}
	updatePoints();
}

async function FUNC_HasMarriage(plr) {
	game.set_marriage(plr);
}

async function FUNC_RtcStart(cid) {
	if(!comm.voiceChatInit) return;
	let offer = await comm.createOffer(cid);
	send({ "RtcSignaling": [JSON.stringify(offer), "Offer", cid] });
}

async function FUNC_RtcSignaling(data) {
	let [jsonstr, signal, cid] = data;

	let json = JSON.parse(jsonstr);

	if(signal == "Offer") await comm.onOffer(json, cid);
	if(signal == "Answer") await comm.onAnswer(json, cid);
	if(signal == "ICECandidate") await comm.onIceCandidate(json, cid);
}

async function FUNC_Vote(data) {
	if(!voting) return;

	let [opt, cid] = data;
	voting.agreeTo(opt);
}

async function FUNC_NewVote(data) {
	let clients = comm.num_clients+1;
	let handler = (id) => send({ "Vote": [id, 0] });
	if(data === 'Revanche') voting = new Voting("Revanche", clients, ["Ja", "Nein"], handler);
}

async function FUNC_StartGame() {
	if(game) {
		let setting = game.setting;
		game = new Game(setting);
	}

	$("#voteWindow").remove();
	$("#startWindow").css("display", "none");
	$("#endWindow").css("display", "none");
	$("#teamWindow").css("display", "none");

	updatePoints();
	updateRoundDetails();
}

async function FUNC_EverythingPlaytype(pt) {
	let title = pt_name(pt, game.misere);
	gameMessage(title, game.current_player);

	let ruleset = game.ruleset;
	ruleset.active = pt;
	game.ruleset = ruleset;

	updateRoundDetails();
}

// Websocket handling
function startWS(){
    socket = new WebSocket( WSS_URL );

    socket.onopen = async function(e){
		send({ "ClientIntroduction": [settings.name, 0, ] })
		await setupMic();
    }

    socket.onmessage = async function(e){
		let obj = JSON.parse(e.data);
		let head = Object.keys(obj)[0];
		if(head == "0") head = obj;

		if(DEV_MODE) console.log(obj);

		// Run the function related to the header
        await window["FUNC_" + String(head)]( obj[head] );
    }

    socket.onclose = function(e){
        openInfo("Meldung",
                'Die Verbindung zum Server wurde geschlossen! Die Seite wird mit "Okay" verlassen.',
                () => window.location.replace("index.html"));
    }
}

/// Converts and sends data
function send( data ){
	if(DEV_MODE) console.log(data);

	try {
        socket.send(JSON.stringify(data));
    } catch(e){
        console.error("Error when sending data!", e);
    }
}
