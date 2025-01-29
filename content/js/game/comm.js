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
		this.vote = false;
	}

	getShortName() {
		if(this.name.length == 0) return "???";
		return this.name.substr(0, 3);
	}
}

/// Class which handles the chat, voicechat and contains the information of other clients
class CommunicationHandler {
	constructor(seats) {
		this.clients = {};
		this.num_clients = 0;
	}

	/// Sets and update the UI for the given name
	setName(name, cid) {
		if(cid in this.clients) {
			this.clients[cid].name = name;
			let pid = this.clients[cid].player_id;

			$('*[text="clientName' + cid + '"]').text(name);
			$('*[text="player' + pid + '"]').text(name);

			let shortname = this.clients[cid].getShortName();
			$('*[text="short_clientName' + cid + '"]').text(shortname);
			$('*[text="short_player' + pid + '"]').text(shortname);
		}
	}

	/// Update the UI for the player/client names
	updateNames() {
		for(let cid in this.clients) this.setName(this.clients[cid].name, cid);
	}

	/// Return the name of the client with the given player_id
	getPlayerName(pid) {
		for(let cid in this.clients) {
			if(this.clients[cid].player_id == pid) {
				return this.clients[cid].player_id;
			}
		}
		return null;
	}

	/// Returns an object in the form obj[player_id] = name;
	getPlayerNames() {
		let out = {};
		for(let cid in this.clients) {
			out[this.clients[cid].player_id] = this.clients[cid].name;
		}
		return out;
	}

	initChat(onMessageCallback) {
		let chat = $(`
                      <div id="chatWindow">
                       <div id="chatClose">Close</div>
                       <div id="chat">
                        <input id="chatInput" placeholder="Input"/>
                        <div id="chatHistory"></div>
                       </div>
                       <div id="playerSettings"></div>
                      </div>`);

		let input = chat.find("#chatInput");

		window.addEventListener('keydown', (e) => {
			if(chat.css("display") == "none"){
				if(e.which == 84) this.toggleChat(); // on 't', open chat
			} else {
				if(e.which == 27) this.toggleChat(); // on 'escape', close chat
				else input.focus();
			}
		});

		chat.find("#chatClose").click((e) => this.toggleChat());

		input.keydown((e) => {
			// If enter is pressed
			if(e.which == 13) {
				if(e.ctrlKey) return;
				let text = input.val();
				if(text.length > 0) onMessageCallback(text);
				input.val("");
			}
		});

		this.chatMessage(MessageType.System, "This is the chat. Be respectful!");
		if(this.onchatinit) this.onchatinit();
		this.chatInit = true;
		$(document.body).append(chat);
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
		if(this.onvoiceinit) this.onvoiceinit();
		this.voiceChatInit = true;
	}

	addVolumeBar(cid) {
		let vol = $('<input type="range" min="0" max="100" value="50">')
			.change((e) => $("#audioObj" + cid)[0].volume = vol.val() / 100);

		$("#clientSettings" + cid)
			.append(vol);
	}

	newClient(id) {
		this.clients[id] = new Client();
		this.num_clients += 1;

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
		this.setName("", id);
		this.num_clients -= 1;
		$("#clientSettings" + id).remove();
		delete this.clients[id];
	}

	// Display a chatmessage
	chatMessage(type, message) {
		let div = message;
		if(typeof message === 'string') div = $('<div>').addClass(type).text(message);

		$("#chatHistory").append(div).scrollTop($("#chatHistory").height());
		if(this.onchatmessage) this.onchatmessage(type, message);
	}

	// Toggle the chatWindow
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
		audio.id = "audioObj" + id;
		audio.srcObject = this.clients[id].stream;
		audio.volume = 0.5;
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
			this.micmuted = !this.micmuted;

			this.localstream.getAudioTracks()[0].enabled = !this.micmuted;
			if(this.micmuted) {
				ele.css("border-style", "none").css("opacity", 0.6);
			} else {
				ele.css("border-style", "solid").css("opacity", 1.0);
			}
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
		this.addVolumeBar(id);
	}

	async onAnswer(answer, id){
		const remDesc = new RTCSessionDescription( answer );
		await this.clients[id].pc.setRemoteDescription( remDesc );
		this.addVolumeBar(id);
	}

	async onIceCandidate(candidate, id){
		try {
			await this.clients[id].pc.addIceCandidate( candidate );
		} catch(e) {
			console.error("Error when adding ice canditate", e);
		}
	}
}
