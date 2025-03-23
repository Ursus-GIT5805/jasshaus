import { createForm, extractDefault } from "./formcreator.js"
import { card_img_path, get_pt_img_path, get_pt_name, set_card_skin } from "./jass.js";
import { card_from_id, playtype_from_id } from "../pkg/jasshaus_game.js";

const LOCALSTORAGE_KEY = "JasshausData2";

function updateCardskin(res: any) {
	set_card_skin(res);

	// Update card images
	$('*[imgsrc^=card]').map((_, ele) => {
		let att = ele.getAttribute("imgsrc");
		if(att === null) return;

		let card_id = Number(att.substring(4));
		let card = card_from_id(card_id);

		ele.setAttribute("src", card_img_path(card));
	});

	// Update playtype images
	$('*[imgsrc^=pt]').map((_, ele) => {
		let att = ele.getAttribute("imgsrc");
		if(att === null) return;

		let pt_id = Number(att.substring(2));
		let pt = playtype_from_id(pt_id);
		if(pt === undefined) return;

		let path = get_pt_img_path(pt) || "";
		$(ele).attr("src", path)
	});

	// Update playtype names
	$('*[text^=pt]').map((_, ele) => {
		let att = ele.getAttribute("text");
		if(att === null) return;

		let pt_id = Number(att.substring(2));
		let pt = playtype_from_id(pt_id);
		if(pt === undefined) return;

		let text = get_pt_name(pt) || "";
		$(ele).text(text);
	});
}

export var jass_settings: any = {
	"card_skin": {
		"#title": "Kartentyp",
		"#option": true,
		"#default": "german",
		"#onchange": updateCardskin,

		"de": { "#title": "Deutsch", "#type": "none" },
		"fr": { "#title": "Französisch", "#type": "none" },
	},
	"cardclicks": {
		"#title": "Kartenklick",
		"#description": "Entscheiden, ob das Klicken einer Karte sie spielen soll.",
		"#type": "checkbox",
		"#default": true,
	}
};

function get_stored_jass_settings(): any {
	let item = localStorage.getItem(LOCALSTORAGE_KEY);
	if(item) return JSON.parse(item);
	return undefined;
}

export function get_jass_settings() {
	return get_stored_jass_settings() || extractDefault(jass_settings);
}

export function save_jass_setting(data: any) {
	localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
}

export function get_setting_form() {
	let def = get_jass_settings();
	let form = createForm(jass_settings, "Einstellungen", def);
	return form;
}
