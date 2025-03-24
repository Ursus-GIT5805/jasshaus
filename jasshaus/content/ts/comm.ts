import { ClientData, ClientID, PlayerID } from "./wshandler.js";

class RTC {
	stream: MediaStream;
	pc: RTCPeerConnection;

	constructor(
		config: RTCConfiguration,
		ice_callback?: (ice: RTCIceCandidate) => void,
	) {
		this.stream = new MediaStream();
		this.pc = new RTCPeerConnection(config);

		this.pc.ontrack = (e) => e.streams[0]
			.getTracks()
			.forEach((track) => this.stream.addTrack(track));

		if(ice_callback) {
			this.pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
				if(e.candidate) ice_callback(e.candidate);
			}
		}
	}
}

export class Client<Data> {
	name: string;
	player_id: PlayerID;

	data: undefined | Data;
	rtc: undefined | RTC = undefined;

	constructor(
		name: string,
		player_id: PlayerID,
	) {
		this.name = name;
		this.player_id = player_id;
	}

	getShortName(): string {
		return this.name.substring(0, 3);
	}
}


type ICECallback = (ice: RTCIceCandidate, client_id: ClientID) => void;

class LocalRTC {
	stream: MediaStream;
	config: RTCConfiguration;
	ice_callback: undefined | ICECallback = undefined;

	constructor(
		stream: MediaStream,
		config: RTCConfiguration,
		ice_callback?: ICECallback,
	) {
		this.stream = stream;
		this.config = config;
		this.ice_callback = ice_callback;
	}
}

/// Plugin for GameClient
/// Handles connected peers and their RTC connection
export class PeerHandler<Data> {
	clients = new Map< ClientID, Client<Data> >();

	rtc: undefined | LocalRTC = undefined;

	constructor() {}

	get(id: ClientID): undefined | Data {
		return this.clients.get(id)?.data;
	}

	set(
		id: ClientID,
		name: string,
		player_id: PlayerID,
	) {
		let client = new Client<Data>(name, player_id);
		this.clients.set(id, client);
	}

	delete(id: ClientID) {
		this.clients.delete(id);
	}

	size(): number {
		return this.clients.size;
	}

	// ---

	getPlayerNames() : Map<PlayerID, string> {
		let out = new Map<PlayerID, string>();

		for(let [_, client] of this.clients) {
			out.set(client.player_id, client.name);
		}

		return out;
	}

	// ---

	onclient(data: ClientData, client_id: ClientID, player_id: PlayerID) {
		this.set(client_id, data.name, player_id);
	}

	onclientleave(client_id: ClientID) {
		this.delete(client_id);
	}

	// ---

	async init_rtc(
		turnName: string = "",
		turnPass: string = "",
		ice_callback?: ICECallback,
	) {
		const config: RTCConfiguration = {
			iceServers: [
				{
					urls: "stun:a.relay.metered.ca:80",
				},
				{
					urls: "turn:a.relay.metered.ca:80",
					username: turnName,
					credential: turnPass,
				},
				{
					urls: "turn:a.relay.metered.ca:443",
					username: turnName,
					credential: turnPass,
				},
				{
					urls: "turn:a.relay.metered.ca:443?transport=tcp",
					username: turnName,
					credential: turnPass,
				}
			]
		};

		let stream = await navigator
			.mediaDevices
			.getUserMedia({ audio: true });

		this.rtc = new LocalRTC(stream, config, ice_callback);
	}

	setupRTC(id: ClientID) {
		let client = this.clients.get(id);
		let rtc = this.rtc;

		if(rtc && client) {
			let callback = rtc.ice_callback;

			if (callback) {
				let handler = (ice: RTCIceCandidate) => callback(ice, id);
				client.rtc = new RTC(rtc.config, handler);
			} else {
				client.rtc = new RTC(rtc.config);
			}

			rtc.stream.getTracks()
				.forEach((track) => client.rtc?.pc.addTrack(track, rtc.stream));
		}
	}

	// ---

	async rtc_onstart(
		client_id: ClientID
	): Promise<undefined | RTCSessionDescription> {
		if(this.rtc == undefined) return undefined;

		this.setupRTC(client_id);
		let pc = this.clients.get(client_id)?.rtc?.pc;
		if(!pc) return undefined;

		let offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		return new RTCSessionDescription( offer );
	}

	async rtc_onoffer(
		client_id: ClientID,
		offer: RTCSessionDescription,
	): Promise<undefined | RTCSessionDescription> {
		this.setupRTC(client_id);

		let pc = this.clients.get(client_id)?.rtc?.pc;
		if(!pc) return undefined;

		pc.setRemoteDescription(offer);

		let answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);

		return new RTCSessionDescription( answer );
	}

	async rtc_onanswer(
		client_id: ClientID,
		answer: RTCSessionDescription,
	) {
		let pc = this.clients.get(client_id)?.rtc?.pc;
		if(!pc) return;

		await pc.setRemoteDescription( answer );
	}

	async rtc_onicecandidate(
		client_id: ClientID,
		candidate: RTCIceCandidate,
	) {
		let pc = this.clients.get(client_id)?.rtc?.pc;
		if(!pc) return undefined;

		await pc.addIceCandidate( candidate );
	}
}
