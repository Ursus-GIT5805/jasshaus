var settings = null;
var form = null;
var game = null;
var comm = null;
var voting = null;
var players = null;
var carpet = null;
var ownid = 0;

// Some QoL one-liners
jQuery.fn.vis = function(v){ return this.css('visibility', ['hidden', 'visible'][+v]); }
jQuery.fn.visible = function(){ return this.css('display') != "none"; }
jQuery.fn.display = function(v){ return this.css('display', ['none', 'block'][+v]); }

var hand = new Hand(
	document.getElementById("cards"),
	(card) => {
		let img = document.createElement("img");
		img.src = card_get_img_url(card);
		return img;
	},
	(card) => {
		// Cancel if the announceWindow is active
		if( $("#announceWindow").visible() ) return false;
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

function setupSettings() {
	settings = getSettings();
	if(!settings) {
		settings = getDefaultSettings();
		settings.name = promptName();
	}
	settings = complementSettings(settings);

	JasshausForm['name']['#disabled'] = true;
	JasshausForm['card_lang']['#onchange'] = (lang) => {
		settings.card_lang = lang;
		hand.reloadContent();
		updateRoundDetails();
	};
	JasshausForm['cardclicks']['#onchange'] = (c) => hand.enable_clicks = c;

	form = createForm("Einstellungen", JasshausForm, settings);
	$("#settings").append(form.ele);

	// Setup events and DOM elements
	let button = $('<img class="ActionButton">')
		.attr("src", "img/settings.svg")
		.click(() => $("#settingsWindow").toggle());

	$("#closeSettings").click(() => {
		button.click();
		settings = form.get();
	});
	$("#botleftbuttons").append(button);
}

function afterModule() {
	if(DEV_MODE) console.log("Loaded WASM module!");

	comm = new CommunicationHandler();
	comm.initChat((msg) => send({ "ChatMessage": [msg, 0] }));

	setupSettings();
	startWS();
}

$("#showButton").click(function () {
	if(hand.selecting) {
		let cards = hand.get_selected();
		let show = parse_show(cards);
		if(show) send({"PlayShow": show});
		else players.setMessage("Dies ist kein Weis!", ownid, 2000);
		this.text("Weisen");
	} else {
		this.text("Fertig")
	}

	hand.setSelectMode();
});
