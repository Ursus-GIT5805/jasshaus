const DATA: string = "cardinfo";

export class Hand<Card extends object> {
	container: JQuery<HTMLElement>;
	content_handler: (ele: Card) => JQuery<HTMLElement>;
	play_handler: (ele: Card) => boolean;

	dragged: undefined | JQuery<HTMLElement>;

	selecting: boolean = false;
	enable_reshuffling: boolean = true;

	allow_clicks: boolean = true;
	indicate_new: boolean = true;

	dragcounter: number = 0;

	constructor(
		container: JQuery<HTMLElement>,
		content_handler: (ele: Card) => JQuery<HTMLElement>,
		play_handler: (ele: Card) => boolean,
	) {
		this.container = container;
		this.content_handler = content_handler;
		this.play_handler = play_handler;

		// ---

		this.container.on('dragenter', (e) => {
			e.preventDefault();
			e.stopPropagation();

			this.dragcounter += 1;
			this.container.css('border-color', '#FFFF00');
		})
		this.container.on('dragleave', (e) => {
			e.preventDefault();
			this.dragcounter -= 1;
			if(this.dragcounter == 0) this.container.css('border-color', '#000000');
		});
		this.container.on('dragover', (e) => e.preventDefault());
		this.container.on('drop', (e) => {
			e.preventDefault();
			this.dragcounter += 1;
		})
	}

	getCards(): Card[] {
		let iter = this.container.children()
			.map((_, child) => $(child).data(DATA) as Card);

		return Array.from(iter);
	}

	/// Append a new card
	appendCard(card: Card) {
		let ele = this.content_handler(card);

		ele.data(DATA, card);
		ele.attr('draggable', 'true');

		ele.click(() => {
			if(this.selecting) {
				ele.toggleClass("Selected");
			} else {
				if(ele.hasClass("Illegal")) return;
				if(!this.allow_clicks) return;
				if( this.play_handler(card) ) ele.remove();
			}
		});

		ele.on('dragstart', () => {
			this.dragcounter = 0;

			// let node = ele.cloneNode();
			// node.style['opacity'] = 1;
			// e.dataTransfer.effectAllowed = "move";
			// e.dataTransfer.setDragImage(node, e.offsetX, e.offsetY);

			this.dragged = ele;
		});
		ele.on('dragend', (e) => {
			e.preventDefault();
			// ele.style['opacity'] = 1;

			let play_card = this.dragcounter == 0 &&
				!ele.hasClass("Illegal") &&
				!this.selecting;

			if(play_card && this.play_handler(card)) ele.remove();

			this.dragged = undefined;
			this.container.css('border-color', '#000000');
		});

		/*if(this.enable_reshuffling) {
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
		}*/

		if(this.indicate_new) {
			ele.addClass("NewCard");
			ele.on('mouseleave', () => {
				ele.removeClass("NewCard");
				ele.on('mouseleave', () => {});
			});
		}

		this.container.append(ele);
	}

	erase(card: Card) {
		this.container.children()
			.filter((_, child) => {
				let cc = $(child).data(DATA) as Card;
				return JSON.stringify(cc) == JSON.stringify(card);
			})
			.each((_: number, child: HTMLElement) => {
				$(child).remove();
			});

		this.container.data(DATA);
	}

	clear() { this.container.html(""); }

	setCards(cards: Card[]) {
		this.clear();
		for(let card of cards) this.appendCard(card);
	}

	setLegality(handler: (card: Card) => boolean) {
		this.container.children()
			.each((_, child) => {
				let cc = $(child).data(DATA) as Card;
				if(handler(cc)) $(child).removeClass("Illegal");
				else $(child).addClass("Illegal");
			});
	}

	setSelected(handler: (card: Card) => boolean) {
		this.container.children()
			.each((_, child) => {
				let cc = $(child).data(DATA) as Card;
				if(handler(cc)) $(child).addClass("Selected");
				else $(child).removeClass("Selected");
			});
	}

	selectMode(select?: boolean): boolean {
		if(select) this.selecting = select;
		else this.selecting = !this.selecting;

		this.setSelected(() => false);
		return this.selecting;
	}

	get_selected(): Card[] {
		let iter = this.container.children()
			.filter((_, child) => $(child).hasClass("Selected"))
			.map((_, child) => {
				let cc = $(child).data(DATA) as Card;
				return cc;
			});

		return Array.from(iter);
	}

	setIllegal() {
		this.setLegality(() => false);
	}
}
