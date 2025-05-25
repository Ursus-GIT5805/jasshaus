import { createForm, extractDefault } from "./formcreator.js";

const LOCALSTORAGE_KEY = "TichuData";

export var tichu_settings: any = {
	"choose_best": {
		"#name": "Autoplay best trick",
		"#desc": "Play always the strongest trick, if there are more options",
		"#type": "bool",
		"#default": true,
	}
};

function get_stored_settings(): any {
	let item = localStorage.getItem(LOCALSTORAGE_KEY);
	if(item) return JSON.parse(item);
	return undefined;
}

export function get_tichu_settings() {
	return get_stored_settings() || extractDefault(tichu_settings);
}

export function save_tichu_setting(data: any) {
	localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
}

export function get_setting_form() {
	let def = get_tichu_settings();
	let form = createForm(tichu_settings, "Einstellungen", def);
	return form;
}
