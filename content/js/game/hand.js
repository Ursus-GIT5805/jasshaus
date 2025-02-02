// Helper struct containing the infos of a card
class HandCard {
	constructor(info) {
		this.info = info;
		this.selected = false;
		this.selectable = true;
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
		this.enable_reshuffling = true;

		this.onPlay = onClick;
		this.indicate_new = true;

		this.selecting = false;

		this.dragged = null;
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
		let card = new HandCard(info);

		let ele = this.contentHandler(info);

		ele.draggable = true;
		ele.onclick = (ev) => {
			if(this.selecting) {
				if(!card.selectable) return;
				card.selected = !card.selected;
				this.handleSelectedEffect(ele, card.selected);
			} else {
				if(!this.enable_clicks) return;
				if(!card.legal) return;
				if(this.onPlay(info)) {
					this.cards = this.cards.filter(x => x.ele != ele);
					ele.remove();
				}
			}
		}
		ele.ondragstart = (e) => {
			if(this.selecting) {
				e.preventDefault();
				return;
			}
			this.dragcounter = 0;

			let node = ele.cloneNode();
			node.style['opacity'] = 1;
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setDragImage(node, e.offsetX, e.offsetY);

			this.dragged = ele;
			ele.style['opacity'] = 0;
		}
		ele.ondragend = (e) => {
			if(this.selecting) return;
			e.preventDefault();
			ele.style['opacity'] = 1;

			if(this.dragcounter == 0 && card.legal) {
				if(this.onPlay(info)) {
					this.cards = this.cards.filter(x => x.ele != ele);
					ele.remove();
				}
			}

			this.dragged = null;
			this.container.style['border-color'] = "#000000";
		}

		if(this.enable_reshuffling) {
			ele.ondragover = (e) => {
				let box = ele.getBoundingClientRect();
				let on_left = e.offsetX < box.width / 2;

				if(on_left) ele.style['margin'] = "0 0 0 1rem";
				else ele.style['margin'] = "0 1rem 0 0";
			}
			ele.ondragleave = (e) => ele.style['margin'] = "0";

			ele.ondrop = (e) => {
				if(this.dragged != e.target) {
					let box = ele.getBoundingClientRect();
					let on_left = e.offsetX < box.width / 2;

					if(on_left) this.container.insertBefore(this.dragged, ele);
					else this.container.insertBefore(this.dragged, ele.nextSibling);
				}

				this.dragged.style['margin'] = "0";
				ele.style['margin'] = "0";
			}
		}

		if(this.indicate_new) {
			ele.classList.add("NewCard");
			ele.onmouseleave = (e) => {
				ele.classList.remove("NewCard");
				ele.onmouseleave = () => {};
			};
		}

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
		if( legal ) ele.classList.remove("Illegal");
		else ele.classList.add("Illegal");
	}

	handleSelectedEffect(ele, selected) {
		if( selected ) ele.classList.add("Selected");
		else ele.classList.remove("Selected");
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
	toggleSelectMode(select) {
		if(select == undefined) this.selecting = !this.selecting;
		else this.selecting = select;

		for(let card of this.cards) {
			card.ele.draggable = !this.selecting;
			card.selected = false;
			this.handleLegalityEffect(card.ele, card.selectable);
			this.handleSelectedEffect(card.ele, false);
		}

		if(!this.selecting) {
			for(let card of this.cards) {
				this.handleLegalityEffect(card.ele, card.legal);
			}
		}

		return this.selecting;
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
