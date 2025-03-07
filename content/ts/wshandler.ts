// import { CommHandler } from "./chat.js";

import { ClientSetting } from "./clientsetting";

export type ClientID = number;
export type PlayerID = number;

export type ClientData = {
	name: string;
}

export interface GamePlugin {
	oninit?: (client: ClientID, plr: PlayerID, num_players: number) => void;

	onclient?: (data: ClientData, client_id: ClientID, player_id: PlayerID) => void;
	onclientleave?: (client_id: ClientID) => void;

	onchatmessage?: (msg: string, client: ClientID) => void;

	onevent?: (event: any) => void;

	onvote?: (vote: number, client: ClientID) => void;
	onnewvote?: (type: string) => void;
	onvotequit?: () => void;

	rtc_onstart?: (client_id: ClientID) => Promise<undefined | RTCSessionDescription>;
	rtc_onoffer?: (client_id: ClientID, offer: RTCSessionDescription) => Promise<undefined | RTCSessionDescription>;
	rtc_onanswer?: (client_id: ClientID, answer: RTCSessionDescription) => Promise<void>;
	rtc_onicecandidate?: (client_id: ClientID, candidate: RTCIceCandidate) => Promise<void>;
}

// TODO create GamePeers as it's own GamePlugin

export class GameClient {
	socket: WebSocket;

	plugins: GamePlugin[] = [];

	constructor(
		addr: string,
		setting: ClientSetting,
		plugins?: GamePlugin[],
	) {
		if(plugins) this.plugins = plugins;
		this.socket = new WebSocket(addr);

		this.socket.onopen = async (_) => {
			this.send({
				"Introduction": {
					"name": setting.name,
				}
			});
		}

		this.socket.onmessage = async (e) => {
			let obj: any = JSON.parse(e.data);
			let head = Object.keys(obj)[0];
			if(head == "0") head = obj;

			console.log(obj);

			let data = obj[head];

			if(typeof obj === 'string') {
				if("QuitVote" === obj) this.QuitVote();
				return;
			}

			if("PlayerID" in obj) this.PlayerID(data);
			if("ClientJoined" in obj) this.ClientJoined(data);
			if("ClientDisconnected" in obj) this.ClientDisconnected(data);
			if("JoinedClients" in obj) this.JoinedClients(data);
			if("ChatMessage" in obj) this.ChatMessage(data);
			if("RtcStart" in obj) this.RtcStart(data);
			if("RtcSignaling" in obj) this.RtcSignaling(data);
			if("Vote" in obj) this.HandleVote(data);
			if("CurrentVote" in obj) this.CurrentVote(data);
			if("NewVote" in obj) this.HandleNewVote(data);
			if("Ping" in obj) this.Ping(data);
			if("Event" in obj) this.Event(data);
		}

		this.socket.onerror = async (_) => {
			alert("Ein Fehler während der Verbindung des Servers ist aufgetreten!");
		}

		this.socket.onclose = (_) => {
			alert("Die Verbindung zum Server wurde geschlossen!");
		}
	}

	send( data: any ){
		let str = JSON.stringify(data);

		// let pref = "\"" + BIG_IND;
		// let suff = BIG_IND + "\"";
		// string = string.replaceAll(pref, "");
		// string = string.replaceAll(suff, "");

		try { this.socket.send(str); }
		catch(e) { console.error("Error when sending data!", e); }
	}

	rtc_start() {
		this.send({ "RtcStart": 0 });
	}

	// ===== Methods Handler =====

	PlayerID(data: any) {
		let [client_id, player_id, num_players]: [ClientID, PlayerID, number] = data;
		this.plugins.forEach((plugin) => plugin.oninit?.(client_id, player_id, num_players));
	}

	// -----

	ClientJoined([data, client_id, player_id]: [any, ClientID, PlayerID]) {
		this.plugins.forEach((plugin) => plugin.onclient?.(data, client_id, player_id));
	}

	ClientDisconnected(client_id: number) {
		this.plugins.forEach((plugin) => plugin.onclientleave?.(client_id));
	}

	JoinedClients(list: any[]) {
		for(let entry of list) {
			let [data, client_id, player_id]: [string, ClientID, PlayerID] = entry;
			this.ClientJoined([data, client_id, player_id]);
		}
	}

	// -----

	Event(event: any) {
		this.plugins.forEach((plugin) => plugin.onevent?.(event));
	}

	// -----

	ChatMessage([msg, client_id]: [string, ClientID]) {
		this.plugins.forEach((plugin) => plugin.onchatmessage?.(msg, client_id));
	}

	// -----

	async RtcStart(client_id: ClientID) {
		this.plugins.forEach(async (plugin) => {
			let offer = await plugin.rtc_onstart?.(client_id);
			if(!offer) return;

			this.send({ "RtcSignaling": [JSON.stringify(offer), "Offer", client_id] });
		});
	}

	async RtcSignaling(data: any) {
		let [jsonstr, signal, client_id]: [string, string, ClientID] = data;
		let json: any = JSON.parse(jsonstr);

		if(signal == "Offer") {
			let offer = json as RTCSessionDescription;

			this.plugins.forEach(async (plugin) => {
				let answer = await plugin.rtc_onoffer?.(client_id, offer);
				if(!answer) return;

				this.send({ "RtcSignaling": [JSON.stringify(answer), "Answer", client_id] });
			});
		}
		if(signal == "Answer") {
			let answer = json as RTCSessionDescription;
			this.plugins.forEach(async (plugin) => await plugin.rtc_onanswer?.(client_id, answer));
		}
		if(signal == "ICECandidate") {
			let ice = json as RTCIceCandidate;
			this.plugins.forEach(async (plugin) => await plugin.rtc_onicecandidate?.(client_id, ice));
		}
	}

	// ---

	vote(index: number) {
		this.send({ "Vote": [index, 0] });
	}

	sendChatmessage(msg: string) {
		this.send({ "ChatMessage": [msg, 0] });
	}

	sendICECandidate(candidate: RTCIceCandidate, client_id: ClientID) {
		let json = JSON.stringify(candidate);
		this.send({ "RtcSignaling": [json, "ICECandidate", client_id] });
	}

	// ---

	HandleVote(data: any) {
		let [opt, cid]: [number, PlayerID] = data;
		this.plugins.forEach((plugin) => plugin.onvote?.(opt, cid));
	}

	HandleNewVote(type: string) {
		this.plugins.forEach((plugin) => plugin.onnewvote?.(type));
	}

	CurrentVote(data: any) {
		let [votetype, votes]: [string, any] = data;

		this.HandleNewVote(votetype);
		for(let vote of votes) this.HandleVote(vote);
	}

	QuitVote() {
		this.plugins.forEach((plugin) => plugin.onvotequit?.());
	}

	// ---

	Ping(_: any) {
		this.send("Pong");
	}
}

/*const BIG_IND = "!XX!"
BigInt.prototype.toJSON = function() { return BIG_IND + this.toString() + BIG_IND  }
*/
