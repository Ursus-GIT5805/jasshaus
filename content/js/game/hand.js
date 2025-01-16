class Hand {
	constructor(container, contentHandler, onClick) {
		this.cards = [];
		this.container = container;

		this.card_cnt = 0;

		this.contentHandler = contentHandler;
		this.onClick = onClick;

		this.dragcounter = 0;

		// Container events ---

		this.container.ondragenter = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.dragcounter += 1;
			this.container.style['border-color'] = "#FFFF00";
		}
		this.container.ondragleave = (e) => {
			e.preventDefault();
			this.dragcounter -= 1;
			if(this.dragcounter == 0) this.container.style['border-color'] = "#000000";
		}
		this.container.ondragover = (e) => e.preventDefault();
		this.container.ondrop = (e) => {
			e.preventDefault();
			this.dragcounter += 1;
		}
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
		ele.draggable = true;

		ele.ondragstart = (e) => {
			this.dragcounter = 0;

			let node = ele.cloneNode();
			e.dataTransfer.setData("text/plain", id);
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setDragImage(node, e.offsetX, e.offsetY);

			ele.style['opacity'] = "0";
 		};
		ele.ondragend = (e) => {
			e.preventDefault();
			ele.style['opacity'] = "100";
			if(this.dragcounter == 0) {
				if(handler(card)) {
					this.cards = this.cards.filter(x => x[0] != id);
					ele.remove();
				}
			}

			this.container.style['border-color'] = "#000000";
		};

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

	reloadContent() {
		let cards = this.cards.map((v) => [v[1], v[2].style["pointer-events"] == "none"]);

		console.log(cards);

		this.clear();
		for(let [card, illegal] of cards) this.appendCard(card);

		for(let i = 0 ; i < cards.length ; i++) {
			if(cards[i][1]) {
				this.cards[i][2].style["pointer-events"] = "none";
				this.cards[i][2].style["filter"] = "brightness(50%)";
			}
		}

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
