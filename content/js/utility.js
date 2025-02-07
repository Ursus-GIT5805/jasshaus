const PASS_IMG = "img/pass.svg";
const MISERE_IMG = "img/misere.svg";

/// Helper functino to get the image-path of a Color Playtype
function trumpf_img(col) {
	let pref = "de";
	if(settings.card_lang == "french") pref = "fr";
	return "img/" + pref + "/trumpf" + col + ".svg";
}

/// Returns the path to the card image, given the card
function card_get_img_url(card) {
	let pref = "de";
	if(settings.card_lang == "french") pref = "fr";
	return "img/" + pref + "/" + card.color + card.number + ".png";
}

/// Big List containing the UI infos about a playtype
/// They are sorted by their PlaytypeID
const PlayTypes = [
	{
		name: "Obenabe",
		img: "img/updown.svg"
	},
	{
		name: "Undeufe",
		img: "img/downup.svg",
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Schaufeln";
			return "Trumpf Schilten";
		},
		img: () => trumpf_img(0),
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Kreuz";
			return "Trumpf Eichle";
		},
		img: () => trumpf_img(1),
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Herz";
			return "Trumpf Rose";
		},
		img: () => trumpf_img(2),
	},
	{
		name: () => {
			if(settings.card_lang == "french") return "Trumpf Ecken";
			return "Trumpf Schellen";
		},
		img: () => trumpf_img(3),
	},
	{
		name: "Slalom Obenabe",
		img: "img/slalomup.svg",
	},
	{
		name: "Slalom Undeufe",
		img: "img/slalomdown.svg",
	},
	{
		name: "Guschti",
		img: "img/guschti.svg",
	},
	{
		name: "Mary",
		img: "img/mary.svg",
	},
	{
		name: "Riesenslalom Obenabe",
		img: "img/bigslalomup.svg",
	},
	{
		name: "Riesenslalom Undeufe",
		img: "img/bigslalomdown.svg",
	},
	{
		name: "Molotow",
		img: "img/molotow.svg",
	},
	{
		name: "Alles",
		img: "img/de/everything.svg",
	},
];

/// Returns the name of the given playtype
function pt_name(pt, misere=false) {
	let id = get_playtype_id(pt);
	if(!(id in PlayTypes)) return "";

	let pref = "";
	if(misere) pref = "Misère: ";

	let name = PlayTypes[id].name;
	if(typeof name === 'function') return pref + name();
	return pref + name;
}

/// Returns the image-path of the given playtype
function pt_img_url(pt) {
	let id = get_playtype_id(pt);
	if(!(id in PlayTypes)) return "";

	let src = PlayTypes[id].img;
	if(typeof src === 'function') return src();
	return src;
}
