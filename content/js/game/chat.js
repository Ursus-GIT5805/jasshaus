const TURNusername=""; // TODO
const TURNpassword=""; // TODO

const MessageType = Object.freeze({
	System: "msg_system",
	Info: "msg_info",
	Error: "msg_error",
	Normal: "msg_normal",
});

class Client {
	constructor() {
		this.name = "";
		this.player_id = -1;
		this.muted = false;
	}

	getShortName() {
		return this.name.substr(0, 3);
	}
}

/// Class which handles the chat, voicechat and contains the information of other clients
class CommunicationHandler {
	constructor(seats) {
		this.clients = {};
		this.num_clients = 0;
	}

	setName(name, cid) {
		if(cid in this.clients) {
			this.clients[cid].name = name;
			$('*[text="clientName' + cid + '"]')
				.map((_,ele) => ele.innerText = name);
		}
	}

	initChat(onMessageCallback) {
		let chat = $("#chatWindow");
		let input = $("#chatInput");

		window.addEventListener('keydown', (e) => {
			if(chat.css("display") == "none"){
				if(e.which == 84) this.toggleChat(); // on 't', open chat
			} else {
				if(e.which == 27) this.toggleChat(); // on 'escape', close chat
				else input.focus();
			}
		});

		$("#chatClose").click((e) => this.toggleChat());

		input.keydown((e) => {
			// If enter is pressed
			if(e.which == 13) {
				if(e.ctrlKey) return;
				let text = input.val();
				if(text.length > 0) onMessageCallback(text);
				input.val("");
			}
		});

		this.chatMessage(MessageType.System, "Dies ist der Chat. Bleibe respektvoll!")
		this.chatInit = true;
	}

	async initVoiceChat(answerCallback, ICEcandidateCallback) {
		const VCconfig = {
			iceServers: [
				{
					urls: "stun:a.relay.metered.ca:80",
				},
				{
					urls: "turn:a.relay.metered.ca:80",
					username: TURNusername,
					credential: TURNpassword,
				},
				{
					urls: "turn:a.relay.metered.ca:443",
					username: TURNusername,
					credential: TURNpassword,
				},
				{
					urls: "turn:a.relay.metered.ca:443?transport=tcp",
					username: TURNusername,
					credential: TURNpassword,
				}
			]
		};

		let localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		this.localstream = localStream;
		this.RTCconfig = VCconfig;
		this.RTCanswerCallback = answerCallback;
		this.ICEcandidateHandler = ICEcandidateCallback;
		this.micmuted = false;
		this.voiceChatInit = true;
	}

	newClient(id) {
		this.clients[id] = new Client();
		this.num_clients += 1;

		console.log(this.chatInit);
		if(this.chatInit) {
			let entry = $("<div>").addClass("playerSettingsEntry");
			entry.attr("id", "clientSettings" + id);
			entry.append( $("<h1>").attr("text", "clientName" + id) );

			let mutediv = $('<div><a>Muted: </a></div>');
			let box = $('<input type="checkbox"/>').click((e) => {
				let mute = !this.clients[id].muted;
				let name = this.clients[id].name;
				this.clients[id].muted = mute;

				if(mute) this.chatMessage(MessageType.System, "You have muted " + name);
				else this.chatMessage(MessageType.System, "You have unmuted " + name);
			});
			mutediv.append(box)
			entry.append(mutediv);

			$("#playerSettings").append(entry);
		}
	}

	removeClient(id) {
		this.num_clients -= 1;
		$("#clientSettings" + id).remove();
		delete this.clients[id];
	}

	chatMessage(type, message) {
		let div = $('<div>').addClass(type).text(message);
		$("#chatHistory").append(div).scrollTop($("#chatHistory").height());
	}

	toggleChat() {
		let ele = $("#chatWindow");
		if(ele.css("display") == "flex") ele.css("display", "none");
		else ele.css("display", "flex")
	}

	setupRtc(id) {
		this.clients[id].stream = new MediaStream();
		this.clients[id].pc = new RTCPeerConnection(this.RTCconfig);
		this.clients[id].pc.ontrack =
			(e) => e.streams[0].getTracks().forEach((track) => this.clients[id].stream.addTrack(track));

		this.clients[id].pc.onicecandidate = (e) => {
			if(!(e.candidate)) return;
			this.ICEcandidateHandler(e.candidate, id);
		};

		this.localstream.getTracks().forEach( (track) => this.clients[id].pc.addTrack(track, this.localstream));

		// Create audio source
		let audio = document.createElement('audio');
		audio.srcObject = this.clients[id].stream;
		audio.autoplay = true;
		document.body.appendChild(audio);
	}

	createChatbutton() {
		return $("<img>")
			.attr("src", "img/chat.svg")
			.addClass("ActionButton")
			.click(() => this.toggleChat());
	}

	createMicbutton() {
		let ele = $("<img>")
			.attr("src", "img/mic.svg")
			.addClass("ActionButton")
			.css("border-style", "solid")
			.css("border-color", "lime");

		ele.click(() => {
			if(this.micmuted) ele.css("border-style", "solid");
			else ele.css("border-style", "none");
			this.localstream.getAudioTracks()[0].enabled = this.micmuted;

			this.micmuted = !this.micmuted;
		});

		return ele;
	}

	async createOffer(id){
		this.setupRtc(id);
		const offDesc = await this.clients[id].pc.createOffer();
		await this.clients[id].pc.setLocalDescription(offDesc);
		return offDesc;
	}

	async onOffer(offer, id){
		// Initialize RTCPeerConnection
		this.setupRtc(id);

		// Create and send answer
		this.clients[id].pc.setRemoteDescription( new RTCSessionDescription(offer) );
		const answer = await this.clients[id].pc.createAnswer();
		await this.clients[id].pc.setLocalDescription(answer);

		// The callback must handle the forwarding
		this.RTCanswerCallback(answer, id);
	}

	async onAnswer(answer, id){
		const remDesc = new RTCSessionDescription( answer );
		await this.clients[id].pc.setRemoteDescription( remDesc );
	}

	async onIceCandidate(candidate, id){
		try {
			await this.clients[id].pc.addIceCandidate( candidate );
		} catch(e) {
			console.error("Error when adding ice canditate", e);
		}
	}
}
