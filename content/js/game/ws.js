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
	players.setName(own.name, player_id);
	players.createPlayers(player_id);
	carpet.rotate_by_players(player_id);

	players.setMessage(getGreet(), own.id);
}

async function FUNC_GameSetting(setting) {
	game.setting = setting;
	updateSetting();
}

async function FUNC_ClientJoined(data) {
	let [client_id, player_id] = data;
	comm.newClient(client_id);
	comm.clients[client_id].player_id = player_id;

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
}

async function FUNC_ClientDisconnected(client_id) {
	let name = comm.clients[client_id].name;
	let pid = comm.clients[client_id].player_id;

	comm.removeClient(client_id);
	comm.chatMessage(MessageType.Info, name + " left the table.");
	players.setName( "", pid );
}

async function FUNC_StartMating(u) {
	$("#startWindow").css("display", "none");
	$("#teamWindow").css("display", "block");
}

async function FUNC_NewCards(data) {
	handhash = BigInt(data.list);
}

async function FUNC_GameState(data) {
	let [state, cardset] = data;

	let cards = new Cardset(BigInt(cardset.list)).as_vec();
	hand.setCards(cards);
	hand.setIllegal();

	for(let key in state) {
		if(key != 'ruleset') game[key] = state[key];
		else game[key] = RuleSet.new( state[key].playtype, state[key].misere );
	}

	if(game.marriage.hasOwnProperty('PlayedBoth')) said_marriage = true;

	let pcards = game.get_playedcards();
	let numplayers = game.players.length;
	let begplayer = game.current_player + numplayers - pcards.length;

	for(let i = 0 ; i < pcards.length ; i++) {
		let card = pcards[i];
		let plr = (begplayer + i) % numplayers;
		carpet.playCard(card, plr, objEquals(card, game.bestcard));
	}

	game.update_ruletype();
	$("#startWindow").css("display", "none");

	updatePoints();
	updateRoundDetails();

	if(state.current_player == own.id) {
		if(!game.is_announced()) startAnnounce();
		else handleOnTurn();
		players.setCurrent(game.current_player);
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

	let title = "";
	if(misere) title = "Misère: ";
	title += pt_name(pt);
	gameMessage(title, game.current_player);

	said_marriage = false;
	game.announce(pt, misere);
	updateRoundDetails();

	if( own.id == game.current_player ) handleOnTurn();
}

async function FUNC_Pass(u) {
	game.pass();
	if( own.id == game.current_player ) startAnnounce();
	players.setCurrent(game.current_player);
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
	let isbest = false;
	if(game.bestcard) isbest = game.ruleset.is_card_stronger(game.bestcard, card);
	else isbest = true;

	let curplr = game.current_player;
	game.play_card(card);

	if(carpet.get_num_cards() == game.players.length) carpet.clean();
	carpet.playCard(card, curplr, isbest);
	if(carpet.get_num_cards() == game.players.length) updatePoints();

	// ---

	if(game.marriage.hasOwnProperty('PlayedBoth') && !said_marriage) {
		let plr = game.marriage['PlayedBoth'];
		gameMessage("Stöck", plr);
		said_marriage = true;
	}

	if(game.should_end() || game.cards_played == 36) {
		hand.setIllegal();
		setTimeout(openSummary, 2000);
	} else {
		if( game.current_player == own.id ) handleOnTurn();
		else hand.setIllegal();
		players.setCurrent(game.current_player);
	}
}

async function FUNC_ChatMessage(data) {
	let [msg, client_id] = data;

	let name = own.name;
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
	gameMessage(plr, points);
}

async function FUNC_ShowList(list) {
	for(let i = 0 ; i < list.length ; i++) {
		let shows = list[i];
		let name = players.getName(i);

		for(let show of shows) {
			game.play_show(show, i);
			openShow(show, name, false);
		}
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

async function FUNC_StartGame(u) {
	if(game) {
		let setting = game.setting;
		game = new Game();
		game.setting = setting;
	}

	$("#voteWindow").remove();
	$("#startWindow").css("display", "none");
	$("#endWindow").css("display", "none");
	$("#teamWindow").css("display", "none");

	updatePoints();
	updateRoundDetails();
}

// Websocket handling
function startWS(){
    socket = new WebSocket( WSS_URL );

    socket.onopen = async function(e){
		send({ "ClientIntroduction": [own.name, 0, ] })
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
