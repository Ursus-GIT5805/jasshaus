var settings = null;
var settings_getter = null;
var game = null;
var comm = null;
var voting = null;
var players = new Playerhandler(4);

var own = {
	name: getName(),
	id: 0,
};

var hand = new Hand(
	document.getElementById("cards"),
	(card) => {
		let img = document.createElement("img");
		img.src = card_get_img_url(card);
		return img;
	},
	(card) => {
		// Cancel when showWindow or announceWindow is active
		if( $("#announceWindow").css("display") != 'none' ) return false;
		if( $("#showWindow").css("display") != 'none' ) return false;
		send({
			"PlayCard": {
				"color": card.color,
				"number": card.number,
			}
		});
		return true;
	}
);

function objEquals(a, b) {
	if(typeof a !== typeof b) return false;

	if(typeof a === 'object') {
		if( Object.keys(a).length !== Object.keys(b).length ) return false;
		for(let key in a) {
			if(!b.hasOwnProperty(key) || a[key] !== b[key]) return false;
		}
	} else {
		return a === b;
	}

	return true;
}

function card_get_img_url(card) {
	return "img/de/" + card.color + card.number + ".png"
}

function getName() {
    settings = getSettings();

	if(!settings) settings = {};

	let name = "";
	if(settings && settings.hasOwnProperty("name")) name = settings["name"];

    if(name.length > 16) name = name.substr(0,16);

    while(name == ""){
        name = prompt("Gib einen Spitznamen ein! (Max. 16 Buchstaben)", "");
        if(name == null) name = "Unnamed"; // User must have disabled "prompt()"
		settings["name"] = name;
    }

	return name;
}

function initSettings() {
	[form, settings_getter] = createForm(JasshausForm, settings);

	$("#settings").append(form);
	$("#settingsButton").click((e) => {
		let ele = $("#settingsWindow");
		if( ele.css("display") == "none" ) ele.css("display", "flex");
		else ele.css("display", "none");
	});
	$("#closeSettings").click($("#settingsButton").click());
}

window.onload = (e) => {
	comm = new CommunicationHandler();
	carpet = new Carpet(4, 0);
	comm.initChat((msg) => send({ "ChatMessage": [msg, 0] }));
	$("#botrightbuttons").append( comm.createChatbutton() )
	// initSettings();
}

function afterModule() {
	if(DEV_MODE) console.log("Loaded WASM module!");

	startWS();
	game = new Game();
	updateRoundDetails();
}
