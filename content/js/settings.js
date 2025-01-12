const LOCALSTORAGE_KEY = "JasshausData";

var JasshausForm = {
	name: {
		title: "Spitzname",
		type: "text",
		maxlength: 16,
	},
	/*muted_players: {
		title: "Spieler stummschalten",
		description: "Ob alle Spieler standardmässig stummgeschalten werden.",
		type: "checkbox",
	},
	card_lang: {
		title: "Kartentyp",
		type: "select",
		options: [
			["german", "Deutsch"],
			["french", "Französisch"],
		],
	},
	darkness: {
		title: "Kartendunkelheit",
		type: "range",
		min: 0,
		max: 100,
		default: 50,
	},*/
};

let getSettings = () => JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY));
