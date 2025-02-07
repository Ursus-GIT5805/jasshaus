class HostData {
	constructor(name) {
		this.name = name;
		this.allow_rtc = true;
		this.mute_players = false;
	}
}

class GameClient {
	constructor(addr, data, onopen=null, onclose=null) {
		let socket = new WebSocket(addr);
		this.own = data;

		socket.onopen = async (e) => {
			if(onopen) onopen();

			this.send({ "ClientIntroduction": [this.own.name, 0] });
			this.comm.initChat((msg) => this.send({ "ChatMessage": [msg, 0] }));

			let answerHandler = (answer, id) =>
				this.send({ "RtcSignaling": [JSON.stringify(answer), "Answer", id] });
			let ICEHandler = (candidate, id) =>
				this.send({ "RtcSignaling": [JSON.stringify(candidate), "ICECandidate", id] });

			if(data.allow_rtc) await this.comm.initVoiceChat(answerHandler, ICEHandler);
			this.send({ "RtcStart": 0 });

			this.run_event("voicechat");
		}

		socket.onmessage = async (e) => {
			let obj = JSON.parse(e.data);
			let head = Object.keys(obj)[0];
			if(head == "0") head = obj;

			// Run the function related to the header
			this["FUNC_" + String(head)]( obj[head] );
		}

		socket.onerror = async (e) => {
			alert("Ein Fehler während der Verbindung des Servers ist aufgetreten!");
		}

		socket.onclose = (e) => {
			alert("Die Verbindung zum Server wurde geschlossen!");
			if(onclose) onclose();
		}

		this.socket = socket;
		this.voting = null;
		this.comm = new CommunicationHandler();
		this.comm.automute = this.own.mute_players;

		this.plugins = [];
	}

	send( data ){
		try { this.socket.send(JSON.stringify(data)); }
		catch(e) { console.error("Error when sending data!", e); }
	}

	quitVote() {
		if(!this.voting) return;
		this.voting.ele.remove();
		this.voting = null;
	}

	run_event(event, ...args) {
		// Run the method name of itself and all the plugins (if exists)
		let method = "on" + event;
		for(let plugin of this.plugins) plugin[method]?.(...args);
		this[method]?.(...args);
	}

	setName(name, client_id) {
		if(!name) name = "unnamed" + client_id;
		this.comm.setName(name, client_id);
	}

	//  ===== Methods =====

	async FUNC_PlayerID(data) {
		let [client_id, player_id, num_players] = data;
		this.run_event("init", player_id, num_players);

		this.own.cid = client_id;
		this.own.pid = player_id;

		this.comm.newClient(client_id);
		this.comm.clients[client_id].player_id = player_id;
		this.setName(this.own.name, client_id);
	}

	async FUNC_Event(data) {
		let head = Object.keys(data)[0];
		let obj = data[head];
		if(head == "0") head = obj;

		// This is reserved not to plugins
		if(typeof this.onevent === 'function') this.onevent(data);
	}

	// ===== Client Join/Quit =====

	async FUNC_ClientJoined(data) {
		let [client_id, player_id] = data;
		this.comm.newClient(client_id);
		this.comm.clients[client_id].player_id = player_id;

		if(this.voting) this.voting.onClientJoin(client_id);
		this.run_event("playerjoin", player_id);
	}

	async FUNC_ClientDisconnected(client_id) {
		let name = this.comm.clients[client_id].name;
		let pid = this.comm.clients[client_id].player_id;

		this.comm.removeClient(client_id);
		this.comm.chatMessage(MessageType.Info, name + " left the table.");

		if(this.voting) this.voting.onClientQuit(client_id);
		this.run_event("playerquit", pid);
	}

	async FUNC_ClientIntroduction(data) {
		let [name, cid] = data;
		let pid = this.comm.clients[cid].player_id;

		this.setName(name, cid);
		this.comm.chatMessage(MessageType.Info, name + " joined the table.");
		this.run_event("playergreet", pid);
	}

	async FUNC_JoinedClients(list) {
		for(let [name, client_id, player_id] of list) {
			this.comm.newClient(client_id);
			this.comm.clients[client_id].player_id = player_id;
			this.setName(name, client_id);
		}
	}

	// ===== Chat Message =====

	async FUNC_ChatMessage(data) {
		let [msg, client_id] = data;

		let name = "You";
		let plr_id = null;
		if(client_id in this.comm.clients) {
			if(this.comm.clients[client_id].muted) return;
			plr_id = this.comm.clients[client_id].player_id;
			name = this.comm.clients[client_id].name;
		}
		let message = "[" + name + "]: " + msg;

		this.comm.chatMessage(MessageType.Normal, message);
		this.run_event("chatmessage", msg, plr_id);
	}


	//  ===== RTC =====

	async FUNC_RtcStart(cid) {
		if(!this.comm.voiceChatInit) return;
		let offer = await this.comm.createOffer(cid);
		this.send({ "RtcSignaling": [JSON.stringify(offer), "Offer", cid] });
	}

	async FUNC_RtcSignaling(data) {
		let [jsonstr, signal, cid] = data;
		let json = JSON.parse(jsonstr);

		if(signal == "Offer") await this.comm.onOffer(json, cid);
		if(signal == "Answer") await this.comm.onAnswer(json, cid);
		if(signal == "ICECandidate") await this.comm.onIceCandidate(json, cid);
	}


	// ===== Voting =====

	async FUNC_Vote(data) {
		if(!this.voting) return;
		let [opt, cid] = data;
		this.voting.agreeTo(opt, cid);
	}

	async FUNC_NewVote(data) {
		let clients = this.comm.num_clients;
		let handler = (id) => this.send({ "Vote": [id, 0] });
		if(data === 'Revanche') {
			this.voting = new Voting("Revanche", clients, ["Ja", "Nein"], handler);
		}
	}

	async FUNC_CurrentVote(data) {
		let [votetype, votes] = data;
		await this.FUNC_NewVote(votetype);
		for(let vote of votes) await this.FUNC_Vote(vote);
	}

	async FUNC_Ping() {
		this.send("Pong");
	}
}
