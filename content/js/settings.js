const LOCALSTORAGE_KEY = "JasshausData";

var JasshausForm = {
	name: {
		title: "Spitzname",
		default: "",
		type: "text",
		maxlength: 16,
	},
	mute_players: {
		title: "Spieler stummschalten",
		default: false,
		description: "Ob alle Spieler standardmässig stummgeschalten werden.",
		type: "checkbox",
	},
	card_lang: {
		title: "Kartentyp",
		type: "select",
		default: "german",
		options: [
			["german", "Deutsch"],
			["french", "Französisch"],
		],
	},
	cardclicks: {
		title: "Kartenklick",
		description: "Entscheiden, ob das Klicken einer Karte sie spielen soll.",
		type: "checkbox",
		default: true,
	}
	/*darkness: {
		title: "Kartendunkelheit",
		type: "range",
		min: 0,
		max: 100,
		default: 50,
	},*/
};

function promptName() {
    while(name == ""){
        name = prompt("Gib einen Spitznamen ein! (Max. 16 Buchstaben)", "");
        if(name == null) name = "Unnamed"; // User must have disabled "prompt()"
    }

	return name.substr(0,16);
}

function getDefaultSettings() {
	let out = {};
	for(let key in JasshausForm) out[key] = JasshausForm[key].default;
	return out;
}

function complementSettings(setting) {
	for(let key in JasshausForm) {
		if(!setting.hasOwnProperty(key)) setting[key] = JasshausForm[key].default;
	}
	return setting;
}

let getSettings = () => JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY));
