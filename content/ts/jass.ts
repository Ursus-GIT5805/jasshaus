import { Card, get_card_id, get_playtype_id, Playtype, Show, show_to_cards } from "./pkg/jasshaus_game.js"

export const PASS_IMG = "img/pass.svg";
export const MISERE_IMG = "img/misere.svg";

type Language = "de" | "fr";

let card_lang: Language = "de";
export function set_card_skin(lang: Language) {
	card_lang = lang;
}

/// Helper function to get the image-path of a Color Playtype
export function trumpf_img_path(color: number, updown = true): string {
	let pref = [ "down", "" ][+updown];
	return `img/${card_lang}/${pref}trumpf${color}.svg`;
}

/// Returns an element the card image, given the card
export function card_img_path(card: Card): string {
	return `img/${card_lang}/${card.color}${card.number}.png`;
}

export function get_card_ele(card: Card): JQuery<HTMLElement> {
	let img = $("<img>")
		.attr("imgsrc", "card" + get_card_id(card))
		.attr("src", card_img_path(card));
	return img;
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
			if(card_lang === "fr") return "Trumpf Schaufeln";
			return "Trumpf Schilten";
		},
		img: () => trumpf_img_path(0),
	},
	{
		name: () => {
			if(card_lang === "fr") return "Trumpf Kreuz";
			return "Trumpf Eichle";
		},
		img: () => trumpf_img_path(1),
	},
	{
		name: () => {
			if(card_lang === "fr") return "Trumpf Herz";
			return "Trumpf Rose";
		},
		img: () => trumpf_img_path(2),
	},
	{
		name: () => {
			if(card_lang === "fr") return "Trumpf Ecken";
			return "Trumpf Schellen";
		},
		img: () => trumpf_img_path(3),
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
	{
		name: "Mezzo",
		img: "img/mezzo.svg",
	},
	{
		name: () => {
			if(card_lang === "fr") return "Trumpf Undenufe Schaufeln";
			return "Trumpf Undenufe Schilten";
		},
		img: () => trumpf_img_path(0, false),
	},
	{
		name: () => {
			if(card_lang === "fr") return "Trumpf Undenufe Kreuz";
			return "Trumpf Undenufe Eichle";
		},
		img: () => trumpf_img_path(1, false),
	},
	{
		name: () => {
			if(card_lang === "fr") return "Trumpf Undenufe Herz";
			return "Trumpf Undenufe Rose";
		},
		img: () => trumpf_img_path(2, false),
	},
	{
		name: () => {
			if(card_lang === "fr") return "Trumpf Undenufe Ecken";
			return "Trumpf Undenufe Schellen";
		},
		img: () => trumpf_img_path(3, false),
	},
];

/// Returns the name of the given playtype
export function get_pt_name(
	pt: Playtype,
	misere: boolean = false,
): undefined | string {
	let id = get_playtype_id(pt);
	if(id === undefined) return undefined;
	if(!(id in PlayTypes)) return undefined;

	let pref = "";
	if(misere) pref = "Misère: ";

	let name = PlayTypes[id].name;
	if(typeof name === 'function') return pref + name();
	return pref + name;
}

/// Returns the image-path of the given playtype
export function get_pt_img_path(
	pt: Playtype
): undefined | string {
	let id = get_playtype_id(pt);
	if(id === undefined) return undefined;
	if(!(id in PlayTypes)) return undefined;

	let src = PlayTypes[id].img;
	if(typeof src === 'function') return src();
	return src;
}

/// Returns an element with the given show
export function show_to_ele(show: Show) {
	let row = $('<div class="Show">')
		.css("display", "flex")
		.css("flex-direction", "row")
		.css("flex-wrap", "nowrap");

	let cards = show_to_cards(show);
	for(let card of cards) row.append( get_card_ele(card) );

	return row;
}
