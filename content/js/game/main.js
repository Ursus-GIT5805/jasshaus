var settings = null;
var settings_getter = null;
var game = null;
var comm = null;
var voting = null;
var players = null;
var carpet = null;

var own = {
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
	let pref = "de";
	if(settings.card_lang == "french") pref = "fr";
	return "img/" + pref + "/" + card.color + card.number + ".png";
}

function initSettings() {
	JasshausForm['name']['disabled'] = true;
	JasshausForm['card_lang']['onchange'] = (lang) => {
		settings.card_lang = lang;
		hand.reloadContent();
		updateRoundDetails();
	};
	JasshausForm['cardclicks']['onchange'] = (c) => hand.enable_clicks = c;
	[form, settings_getter] = createForm(JasshausForm, settings);

	$("#settings").append(form);
	$("#settingsButton").click((e) => {
		let ele = $("#settingsWindow");
		if( ele.css("display") == "none" ) ele.css("display", "flex");
		else ele.css("display", "none");
	});
	$("#closeSettings").click(() => {
		$("#settingsButton").click();
		settings = settings_getter();
	});
}

function afterModule() {
	if(DEV_MODE) console.log("Loaded WASM module!");

	settings = getSettings();
	if(!settings) {
		settings = getDefaultSettings();
		settings.name = promptName();
	}
	settings = complementSettings(settings);

	hand.enable_clicks = settings["cardclicks"];
	comm = new CommunicationHandler();
	comm.initChat((msg) => send({ "ChatMessage": [msg, 0] }));
	$("#botrightbuttons").append( comm.createChatbutton() )
	initSettings();

	startWS();
}

$("#showButton").click(() => {
	if(hand.selecting) {
		let cards = hand.get_selected();
		let show = parse_show(cards);
		if(show) {
			send({"PlayShow": show});
			hand.setSelected(() => false);
		} else {
			players.setMessage("Dies ist kein Weis!", own.id, 2000);
		}

		$("#showButton").text("Weisen")
	} else {
		$("#showButton").text("Fertig")
	}

	hand.setSelectMode();
});
