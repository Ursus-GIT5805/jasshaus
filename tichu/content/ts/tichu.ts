import { Cardset, Fullhouse, Stairs, Street, StreetBomb, Trick } from "../pkg/tichu_game.js";
import { Card } from "./pkg/tichu_game.js"

function get_card_img(card: Card): string {
	return `./img/classic/card${card.color},${card.number+1}.jpg`;
}

export function get_card_ele(card: Card): JQuery<HTMLElement> {
	let ele = $('<img class="Card">');
	ele.attr('src', get_card_img(card));
	return ele;
}

export function trick_to_ele(trick: Trick): JQuery<HTMLElement> {
	let cards: Card[] = [];

	console.log(trick);

	if(typeof trick !== 'string') {
		if('Fullhouse' in trick) {
			let fullhouse = Fullhouse.from_object(trick.Fullhouse);

			let triplet = fullhouse.get_triplet();
			let pair = fullhouse.get_pair();

			let div_triplet = $('<div class="Trick">');
			let div_pair = $('<div class="Trick">');
			for(let card of triplet) div_triplet.append( get_card_ele(card) );
			for(let card of pair) div_pair.append( get_card_ele(card) );

			let ele = $('<div class="TrickWrapper">')
				.append(div_triplet)
				.append(div_pair);

			return ele;
		} else if('Street' in trick) {
			let data = Street.from_object(trick.Street);
			cards = data.get_cards();
		} else if('StreetBomb' in trick) {
			let data = StreetBomb.from_object(trick.StreetBomb);
			cards = data.get_cards();
		} else if('Stairs' in trick) {
			let data = Stairs.from_object(trick.Stairs);
			cards = data.get_cards();
		}
	}

	if(cards.length === 0) {
		let cardset = Cardset.from_trick(trick);
		cards = cardset.as_vec();
	}

	let ele = $('<div class="Trick">');
	for(let card of cards) ele.append( get_card_ele(card) );
	return ele;
}

export function trick_name(trick: Trick): string {
	/// TODO especially if localising in different languages: make a Map<string,string> instead.
	if(typeof trick === 'string') return trick;
	let keys = Object.keys(trick);
	return keys[0];
}

export function number_name(num: number): string {
	const names = [
		"1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
		"Boy", "Queen", "King", "Ace"
	];

	return names[num];
}
