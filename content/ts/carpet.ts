import { objEquals } from "./utility.js";
import { PlayerID } from "./wshandler.js";

export class Carpet<Card> {
	total_player: number;
	bestcard: undefined | JQuery<HTMLElement> = undefined;

	rotate: number;
	container: JQuery<HTMLElement>;
	content_handler: (card: Card) => JQuery<HTMLElement>;

	radiusX: number = 100;
	radiusY: number = 100;

	autoclean: undefined | number = undefined;

	constructor(
		num_players: number,
		rotate: number = 0,
		content_handler: (card: Card) => JQuery<HTMLElement>,
	) {
		this.total_player = num_players;
		this.rotate = Math.PI / 2.0 + 2.0 * Math.PI * (rotate / num_players);
		this.container = $("#carpet"); // TODO mb change this
		this.content_handler = content_handler;
	}

	playCard(
		card: Card,
		player: PlayerID,
		newbestcard: boolean,
	) {
		if(this.autoclean) {
			if(this.autoclean <= this.container.children().length) this.clean();
		}

		let ele = this.content_handler(card);

		let angle = this.rotate - (2*Math.PI / this.total_player * player);

		let x = -50 + Math.cos(angle) * this.radiusX;
		let y = -50 + Math.sin(angle) * this.radiusY;
		let transform = `translateX(${x}%) translateY(${y}%)`;

		ele.css('transform', transform);
		if(newbestcard) {
			if(this.bestcard) this.bestcard.removeClass("BestCard");
			this.bestcard = ele;
			ele.addClass("BestCard");
		}

		this.container.append(ele);
	}

	rotate_by_players(shift: number) {
		this.rotate = Math.PI / 2.0 + (2*Math.PI / this.total_player * shift);
	}

	set_cards(cards: Card[], begin_player: PlayerID, bestcard?: Card) {
		for(let i = 0 ; i < cards.length ; ++i) {
			let card = cards[i];
			let best = objEquals(card, bestcard);
			let plr = (begin_player + i) % this.total_player;

			this.playCard(card, plr, best);
		}
	}

	/// Utility functions
	clean() {
		this.container.html("");
		this.bestcard = undefined;
	}
	get_num_cards() { return this.container.children.length; }
}
