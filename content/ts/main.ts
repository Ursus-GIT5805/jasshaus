import { Main } from "./game.js";
import { determine_ws_url, DEV_MODE, ROOM_ID } from "./utility.js";
import { set_card_skin } from "./jass.js";
import { ClientSetting, get_client_settings } from "./clientsetting.js";
import { get_jass_settings, get_setting_form, jass_settings, save_jass_setting } from "./jasssettings.js";
import init from "../pkg/jasshaus_game.js"

const WS_URL = `${determine_ws_url(7999)}/${ROOM_ID}`;

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

	if(ROOM_ID) $(`*[text="room_id"]`).text(ROOM_ID);
	if(DEV_MODE) console.log("Started WS");
};
