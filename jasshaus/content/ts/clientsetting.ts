import { createForm, extractDefault } from "./formcreator.js"

const LOCALSTORAGE_KEY = "GAME_CLIENTSETTINGS";

export function promptSettings(): ClientSetting {
	let name = "";

	let res = prompt("Gib einen Spitznamen ein! (Max. 16 Buchstaben)", "");
    if(!res) name = `unn${Math.random() % 10000}`;
	name = name.substring(0, 16);

	return new ClientSetting(name);
}

export class ClientSetting {
	name: string;
	mute_players: boolean = false;
	allow_rtc: boolean = true;

	constructor(name: string) {
		this.name = name;
	}
}

export var ClientSettingForm = {
	"name": {
		"#title": "Spitzname",
		"#type": "text",
		"#maxlength": 16,
		"#default": "unnamed",
	},
	"mute_players": {
		"#title": "Spieler stummschalten",
		"#description": "Ob alle Spieler standardmässig stummgeschalten werden.",
		"#type": "checkbox",
		"#default": false,
	},
	"allow_rtc": {
		"#title": "WebRTC aktivieren",
		"#description": "WebRTC wird benötigt, um den VoiceChat zu benutzen.",
		"#type": "checkbox",
		"#default": true,
	},
};

function get_stored_client_settings(): any {
	let item = localStorage.getItem(LOCALSTORAGE_KEY);
	if(item) return JSON.parse(item);
	return undefined;
}

export function get_client_settings(): any {
	return get_stored_client_settings() || extractDefault(ClientSettingForm);
}

export function save_client_setting(data: any) {
	localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
}

export function getClientSettingForm() {
	let def = get_client_settings();
	let form = createForm(ClientSettingForm, "Personal Settings", def);
	let bef = form.get;
	form.get = () => {
		let out = bef();

		let setting = new ClientSetting(out["name"]);
		setting.allow_rtc = out["allow_rtc"];
		setting.mute_players = out["mute_players"];

		return setting;
	};

	return form;
}
