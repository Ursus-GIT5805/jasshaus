export const DATA: string = "cardinfo";

export class Hand<Card extends object> {
	container: JQuery<HTMLElement>;
	cards_gen: number = 0;
	content_handler: (ele: Card) => JQuery<HTMLElement>;
	play_handler: (ele: Card) => boolean;

	selecting: boolean = false;
	enable_reshuffling: boolean = true;

	allow_clicks: boolean = true;
	indicate_new: boolean = true;

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
			this.container.addClass("DragOver");
		});
		this.container[0].ondragleave = (e: MouseEvent) => {
			let rt = e.relatedTarget as HTMLElement;
			if( this.container[0].contains( rt ) ) return;

			this.container.removeClass("DragOver");
		};

		this.container.on('dragover', (e) => e.preventDefault());
		this.container.on('drop', () => this.container.removeClass("DragOver"));
	}

	getCards(): Card[] {
		let iter = this.container.children()
			.map((_, child) => $(child).data(DATA) as Card);

		return Array.from(iter);
	}

	/// Append a new card
	appendCard(card: Card) {
		const id = `card${this.cards_gen}`;
		this.cards_gen += 1;

		let ele = this.content_handler(card);

		ele.data(DATA, card);
		ele.attr('id',  id);
		ele.attr('draggable', 'true');

		let on_play = () => {
			let can_play = !ele.hasClass("Illegal") &&
				!this.selecting;

			if(can_play && this.play_handler(card)) ele.remove();
		};

		ele.click(() => {
			if(this.selecting) {
				ele.toggleClass("Selected");
			} else {
				if(ele.hasClass("Illegal")) return;
				if(!this.allow_clicks) return;
				on_play();
			}
		});

		const card_string = JSON.stringify(card);
		ele[0].ondragstart = (e) => {
			let can_drag = !ele.hasClass("Illegal") &&
				!this.selecting;
			if(!can_drag) {
				e.preventDefault();
				return;
			}

			e.dataTransfer?.setData("card", card_string);

			const parent_id = ele.parent().attr("id");
			if(parent_id) e.dataTransfer?.setData("parent", parent_id);
			e.dataTransfer?.setData("id", id);

			// let node = ele.cloneNode();
			// node.style['opacity'] = 1;
			// e.dataTransfer.effectAllowed = "move";
			// e.dataTransfer.setDragImage(node, e.offsetX, e.offsetY);
		};

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

	sort(fn: (card: Card) => number) {
		let arr: [number, HTMLElement][] = [];
		this.container.children()
			.each((_, child) => {
				let card = $(child).data(DATA) as Card;
				let num = fn(card);
				$(child).detach();
				arr.push( [num, child] );
			});

		arr.sort((a, b) => a[0] - b[0]);

		for(let data of arr) {
			let [_, ele] = data;
			this.container.append(ele);
		}
	}

	erase(card: Card) {
		let card_string = JSON.stringify(card);

		this.container.children()
			.filter((_, child) => {
				let cc = $(child).data(DATA) as Card;
				return JSON.stringify(cc) == card_string;
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
		if(select !== undefined) this.selecting = select;
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
