const LOCALSTORAGE_KEY = "JasshausData";

var JasshausForm = {
	"name": {
		"#title": "Spitzname",
		"#type": "text",
		"#maxlength": 16,
		"#default": "",
	},
	"mute_players": {
		"#title": "Spieler stummschalten",
		"#description": "Ob alle Spieler standardmässig stummgeschalten werden.",
		"#type": "checkbox",
		"#default": false,
	},
	"card_lang": {
		"#title": "Kartentyp",
		"#option": true,
		"#default": "german",

		"german": { "#title": "Deutsch", "#type": "none" },
		"french": { "#title": "Französisch", "#type": "none" },
	},
	"cardclicks": {
		"#title": "Kartenklick",
		"#description": "Entscheiden, ob das Klicken einer Karte sie spielen soll.",
		"#type": "checkbox",
		"#default": true,
	}
};

function createGameSettingForm() {
	let formdata = JSON.parse(get_gamesettingform());
	formdata['playtype']['#type']['#movable'] = false;
	formdata['playtype']['#type']['#resizable'] = false;
	formdata['playtype']['#type']['#id'] = "playtypes";

	formdata['point_recv_order']['#type']['#resizable'] = false;
	formdata['point_recv_order']['#type']['#list']['#disabled'] = true;

	form = createForm("Form", formdata, Setting.schieber());

	form.ele.find("#playtypes")
		.children().eq(1).children()
		.each((i, ele) => {
			let name = $("<div>").text(pt_name(Playtype.from_id(i))).addClass("Title")[0]
			ele.children[1].prepend( name );
		});

	return form;
}

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
