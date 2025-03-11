import { CommHandler } from "./chat.js";
import { Main } from "./game.js";
import { DEV_MODE } from "./utility.js";
import { VoteHandler } from "./voting.js";
import { set_card_skin } from "./jass.js";
import { ClientSetting, get_client_settings } from "./clientsetting.js";
import { get_jass_settings, get_setting_form, jass_settings, save_jass_setting } from "./jasssettings.js";
import init from "./pkg/jasshaus_game.js"

function getRoomID(): null | string {
	let params = new URLSearchParams(location.search);
	return params.get('room');
}
const room_id = getRoomID();

function determine_ws_url(): string {
	if(DEV_MODE){
		const PORT = 7999;

		if(location.protocol == "http:") {
			return `ws://${location.hostname}:${PORT}/ws`;
		}
		return `ws://127.0.0.1:${PORT}/ws`;
	}
	return `wss://${location.host}/ws`;
}

const WS_URL = `${determine_ws_url()}/${room_id}`;

// ---

const SettingWindow = $("#settingsWindow");

function setupSettings() {
	let form = get_setting_form();
	if(!form.ele) return;

	let setting = get_jass_settings();
	set_card_skin(setting["card_skin"]);

	$("#settings").append(form.ele);
	window.onbeforeunload = () => save_jass_setting(form.get());

	let toggle = () => {
		let visible = SettingWindow.css("display") != 'none';
		let style = [ "flex", "none" ][ +visible ];
		SettingWindow.css("display", style);
	};

	let button = $("<img>")
		.attr("src", "img/settings.svg")
		.addClass("ActionButton")
		.click(toggle);

	SettingWindow.find("#closeSettings").click(toggle);

	$("#botleftbuttons").append(button);
}

// ---

window.onload = async () => {
	await init();

	let client_setting = get_client_settings();
	let name = client_setting['name'];

	let setting = new ClientSetting(name);

	let main = new Main(WS_URL, setting);

	try {
		main.comm.initChat((msg) => main.wshandler.sendChatmessage(msg));
		$("#botrightbuttons").append( main.comm.createChatbutton() );
	} catch(e) {
		console.error(e);
	}

	if(setting.allow_rtc) {
		// Spawn a task handling RTC
		setTimeout(async () => {
			let response = await fetch("turn_credentials.json");
			let cred = await response.json();

			await main.comm.init_rtc(
				cred.username,
				cred.password,
				(ice, id) => main.wshandler.sendICECandidate(ice, id)
			);
			main.wshandler.rtc_start();

			$("#botrightbuttons").append( main.comm.createMicbutton() );
		});
 	}

	jass_settings['cardclicks']["#onchange"] = (val: boolean) => {
		main.ui.hand.allow_clicks = val;
	};
	setupSettings();

	if(room_id) $(`*[text="room_id"]`).text(room_id);
	if(DEV_MODE) console.log("Started WS");
};
