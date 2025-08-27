import { ClientSetting } from "./clientsetting.js";
import { Client, PeerHandler } from "./comm.js";
import { PlayerID, ClientID, ClientData } from "./wshandler.js";

export class CommClientData {
	muted: boolean = false;
	constructor() {}
}

export enum MessageType {
	System = "msg_system",
	Info = "msg_info",
	Error = "msg_error",
	Normal = "msg_normal",
}

export class CommHandler extends PeerHandler<CommClientData> {
	setting: ClientSetting;
	chat: undefined | JQuery<HTMLElement> = undefined;

	constructor(setting: ClientSetting) {
		super();

		this.setting = setting;
	}

	set(id: ClientID, name: string, player_id: PlayerID) {
		let client = new Client<CommClientData>(name, player_id);
		client.data = new CommClientData();
		this.clients.set(id, client);
	}

	displayClientName(client_id: ClientID) {
		let client = this.clients.get(client_id);
		if (!client) return;

		let pid = client.player_id;
		let name = client.name;
		let shortname = client.getShortName();

		$('*[text="clientName' + client_id + '"]').text(name);
		$('*[text="player' + pid + '"]').text(name);

		$('*[text="short_clientName' + client_id + '"]').text(shortname);
		$('*[text="short_player' + pid + '"]').text(shortname);
	}

	displayClientNames() {
		for (let [key, _] of this.clients) this.displayClientName(key);
	}

	initChat(onMessageCallback: (msg: string) => void) {
		let chat = $(`<div id="chatWindow">
                       <div id="chatClose">Close</div>
                       <div id="chat">
                        <input id="chatInput" placeholder="Input"/>
                        <div id="chatHistory"></div>
                       </div>
                       <div id="playerSettings"></div>
                      </div>`);

		let input = chat.find("#chatInput");

		window.addEventListener("keydown", (e) => {
			if (chat.css("display") == "none") {
				if (e.which == 84) this.toggleChat(); // on 't', open chat
			} else {
				if (e.which == 27)
					this.toggleChat(); // on 'escape', close chat
				else input.focus();
			}
		});

		chat.find("#chatClose").click((_) => this.toggleChat());

		input.keydown((e) => {
			// If enter is pressed
			if (e.which == 13) {
				if (e.ctrlKey) return;
				let text = input.val();

				if (typeof text === "string") {
					if (text.length > 0) onMessageCallback(text);
				}
				input.val("");
			}
		});

		this.chat = chat;
		$("body").append(this.chat);

		this.chatMessage(MessageType.System, "This is the chat. Be respectful!");
	}

	// ---

	chatMessage(type: MessageType, msg: JQuery<HTMLElement> | string) {
		let div = null;

		if (typeof msg === "string") div = $("<div>").addClass(type).text(msg);
		else div = msg;

		if (this.chat) {
			let history = $("#chatHistory");
			history.append(div).scrollTop(history.height() || 0);
		}
	}

	toggleChat() {
		if (this.chat === undefined) return;

		let visible = this.chat.css("display") !== "none";
		let style = ["flex", "none"][+visible];
		this.chat.css("display", style);
	}

	// ---

	addAudio(client_id: ClientID) {
		let rtc = this.clients.get(client_id)?.rtc;

		if (!this.chat || !rtc) return;

		let audio = $("<audio>");

		let ele = audio[0] as HTMLAudioElement;
		ele.srcObject = rtc.stream;
		ele.autoplay = true;
		ele.volume = 0.5;

		let vol = $('<input type="range" min="0" max="100" value="50">');
		vol.change((_) => (ele.volume = (vol.val() as number) / 100));

		this.chat
			.find("#clientSettings" + client_id)
			.append(vol)
			.append(audio);
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
			.addClass("Active")
			.click(() => {
				ele.toggleClass("Active");
				let active: boolean = ele.hasClass("Active");
				if (this.rtc) this.rtc.stream.getAudioTracks()[0].enabled = active;
			});

		return ele;
	}

	// ---

	oninit(client: ClientID, plr: PlayerID) {
		this.set(client, this.setting.name, plr);
	}

	onclient(data: ClientData, client_id: ClientID, player_id: PlayerID) {
		super.onclient(data, client_id, player_id);

		if (this.chat) {
			let entry = $("<div>").addClass("playerSettingsEntry");
			entry.attr("id", `clientSettings${client_id}`);
			entry.append($("<h1>").attr("text", `clientSettings${client_id}`).text(data.name));

			let mutediv = $("<div><a>Muted: </a></div>");
			let box = $('<input type="checkbox"/>');

			box.change((_) => {
				let client = this.clients.get(client_id);
				if (client === undefined) return;

				let mute = box.is(":checked");
				if (client.data) client.data.muted = mute;

				let mut = ["unmuted", "muted"][+mute];
				let msg = `You have ${mut} ${client.name}`;

				this.chatMessage(MessageType.System, msg);
			});

			if (this.setting.mute_players) {
				let client = this.clients.get(client_id);
				if (client?.data) client.data.muted = true;
				box.attr("checked", "true");
			}
			mutediv.append(box);
			entry.append(mutediv);

			this.chat.find("#playerSettings").append(entry);
		}

		this.displayClientName(client_id);
	}

	onclientleave(client_id: ClientID) {
		super.onclientleave(client_id);
		if (this.chat) this.chat.find("#clientSettings" + client_id).remove();
	}

	onchatmessage(msg: string, client_id: ClientID) {
		let client = this.clients.get(client_id);
		if (client === undefined) return;

		let name = client.name || "???";
		let text = `[${name}]: ${msg}`;

		this.chatMessage(MessageType.Normal, text);
	}

	async rtc_onoffer(
		client_id: ClientID,
		offer: RTCSessionDescription,
	): Promise<undefined | RTCSessionDescription> {
		let answer = await super.rtc_onoffer(client_id, offer);
		if (answer === undefined) return undefined;
		this.addAudio(client_id);
		return answer;
	}

	async rtc_onanswer(client_id: ClientID, answer: RTCSessionDescription) {
		await super.rtc_onanswer(client_id, answer);
		this.addAudio(client_id);
	}
}
