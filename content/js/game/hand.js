class Hand {
	constructor(container, contentHandler, onClick) {
		this.cards = [];
		this.container = container;

		this.card_cnt = 0;

		this.contentHandler = contentHandler;
		this.onClick = onClick;
 	}

	getCards() {
		return this.cards.map(x => x[1]);
	}

	appendCard(card) {
		let handler = (card) => this.onClick(card);
		let ele = this.contentHandler(card);
		let id = this.card_cnt++;

		ele.onclick = (ev) => {
			if(handler(card)) {
				this.cards = this.cards.filter(x => x[0] != id);
				ele.remove();
			}
		}
		ele.style["z-index"] = this.cards.length;

		this.cards.push([id, card, ele]);
		this.container.appendChild(ele);
	}

	clear() {
		this.cards = [];
		this.container.innerHTML = "";
	}

	setCards(cards) {
		this.clear();
		for(let card of cards) this.appendCard(card);
	}

	setLegality(legalityHandler) {
		for(let [id, card, ele] of this.cards) {
			if( legalityHandler(card) ) {
				ele.style["filter"] = "";
				ele.style["pointer-events"] = "auto";
			} else {
				ele.style["filter"] = "brightness(50%)";
				ele.style["pointer-events"] = "none";
			}
		}
	}

	/// Set all cards illegal to play
	setIllegal() {
		this.setLegality((c) => false);
	}
}
