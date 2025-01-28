// Helper struct containing the infos of a card
class HandCard {
	constructor(info) {
		this.info = info;
		this.selected = false;
		this.legal = true;
		this.ele = null;
	}
}

// The class containing all the HandCards
class Hand {
	constructor(container, contentHandler, onClick) {
		this.cards = [];
		this.container = container;

		this.card_cnt = 0;

		this.enable_clicks = true;
		this.onPlay = onClick;
		this.selecting = false;

		this.dragcounter = 0;

		this.contentHandler = contentHandler;

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

	/// Return all the cards info
	getCards() { return this.cards.map(x => x.info); }

	/// Append a new card
	appendCard(info) {
		let card = new HandCard(info, this.contentHandler);

		let ele = this.contentHandler(info);
		ele.draggable = true;

		ele.onclick = (ev) => {
			if(this.selecting) {
				card.selected = !card.selected;
				this.handleSelectedEffect(ele, card.selected);
			} else {
				if(!this.enable_clicks) return;
				if(this.onPlay(info)) {
					this.cards = this.cards.filter(x => x.ele != ele);
					ele.remove();
				}
			}
		}
		ele.ondragstart = (e) => {
			if(this.selecting) return;
			this.dragcounter = 0;

			let node = ele.cloneNode();
			e.dataTransfer.setData("text/plain", info);
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setDragImage(node, e.offsetX, e.offsetY);

			ele.style['opacity'] = "0";
 		}
		ele.ondragend = (e) => {
			if(this.selecting) return;
			e.preventDefault();
			ele.style['opacity'] = "100";

			if(this.dragcounter == 0) {
				if(this.onPlay(info)) {
					this.cards = this.cards.filter(x => x.ele != ele);
					ele.remove();
				}
			}

			this.container.style['border-color'] = "#000000";
		}

		ele.style["z-index"] = this.cards.length;
		card.ele = ele;

		this.cards.push(card);
		this.container.appendChild(card.ele);
	}

	/// Clear the hand
	clear() {
		this.cards = [];
		this.container.innerHTML = "";
	}

	/// Set the cards
	setCards(cards) {
		this.clear();
		for(let card of cards) this.appendCard(card);
	}

	handleLegalityEffect(ele, legal) {
		if( legal ) {
			ele.style['filter'] = "";
			ele.style['pointer-events'] = "auto";
		} else {
			ele.style['filter'] = "brightness(50%)";
			ele.style['pointer-events'] = "none";
		}
	}

	handleSelectedEffect(ele, selected) {
		ele.style['pointer-events'] = "auto";
		ele.style['filter'] = "";

		if( selected ) ele.style['transform'] = "translateY(-2rem)";
		else ele.style['transform'] = "";
	}

	/// Reload the cards content
	reloadContent() {
		for(let card of this.cards) {
			card.ele = this.contentHandler(this.card.info);
			this.handleLegalityEffect(card.ele, card.legal);
		}
	}

	/// Handle which cards are legal to play
	setLegality(legalityHandler) {
		for(let card of this.cards) {
			let legal = legalityHandler(card.info);
			card.legal = legal;
			this.handleLegalityEffect(card.ele, legal);
		}
	}

	/// Handle which cards are selected
	setSelected(selectHandler) {
		for(let card of this.cards) {
			let select = selectHandler(card.info);
			card.selected = select;
			this.handleSelectedEffect(card.ele, select);
		}
	}

	/// Choose whether or not to start selecting cards instead of playing
	setSelectMode(select) {
		if(select == undefined) this.selecting = !this.selecting;
		else this.selecting = select;

		for(let card of this.cards) {
			card.ele.draggable = !this.selecting;
			card.selected = false;
			this.handleSelectedEffect(card.ele, false);
		}

		if(!this.selecting) {
			for(let card of this.cards) {
				this.handleLegalityEffect(card.ele, card.legal);
			}
		}
	}

	/// Get all currently selected cards
	get_selected() {
		return Array.from(this.cards
						  .filter((card) => card.selected)
						  .map((card) => card.info));
	}

	/// Set all cards illegal to play
	setIllegal() {
		this.setLegality(() => false);
	}
}
