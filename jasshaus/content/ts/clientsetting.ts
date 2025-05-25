import { createForm, extractDefault } from "./formcreator.js"

const LOCALSTORAGE_KEY = "GAME_CLIENTSETTINGS";

type Lang = "de" | "en";

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

export var ClientSettingForm_DE = {
	"name": {
		"#name": "Spitzname",
		"#type": "string",
		"#default": "unnamed",
	},
	"mute_players": {
		"#name": "Spieler stummschalten",
		"#desc": "Ob alle Spieler standardmässig stummgeschalten werden.",
		"#type": "bool",
		"#default": false,
	},
	"allow_rtc": {
		"#name": "WebRTC aktivieren",
		"#desc": "WebRTC wird benötigt, um den VoiceChat zu benutzen.",
		"#type": "bool",
		"#default": true,
	},
};

export var ClientSettingForm_EN = {
	"name": {
		"#name": "Nickname",
		"#type": "string",
		"#default": "unnamed",
	},
	"mute_players": {
		"#name": "Mute players",
		"#desc": "Decide whether all players are muted by default.",
		"#type": "bool",
		"#default": false,
	},
	"allow_rtc": {
		"#name": "Activate WebRTC",
		"#desc": "WebRTC is necessary for the voice chat.",
		"#type": "bool",
		"#default": true,
	},
};

function get_stored_client_settings(): any {
	let item = localStorage.getItem(LOCALSTORAGE_KEY);
	if(item) return JSON.parse(item);
	return undefined;
}

function client_settings_formdata(lang: Lang = "en"): any {
	if(lang === "en") return ClientSettingForm_EN;
	if(lang === "de") return ClientSettingForm_DE;
}

export function get_client_settings(lang: Lang = "en"): any {
	return get_stored_client_settings() || extractDefault( client_settings_formdata(lang) );
}

export function save_client_setting(data: any) {
	localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
}

export function getClientSettingForm(lang: Lang = "en") {
	let def = get_client_settings();
	let form = createForm(client_settings_formdata(lang), "Personal Settings", def);
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
