export const DATA: string = "cardinfo";

export class Hand<Card extends object> {
	container: JQuery<HTMLElement>;
	cards_gen: number = 0;
	content_handler: (ele: Card) => JQuery<HTMLElement>;
	play_handler: (ele: Card) => boolean;

	selecting: boolean = false;
	allow_reshuffling: boolean = false;

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

	/// Get all cards in the current hand
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
			let can_drag = !ele.hasClass("Illegal");
			if(!can_drag) {
				e.preventDefault();
				return;
			}

			e.dataTransfer?.setData("card", card_string);

			const parent_id = ele.parent().attr("id");
			if(parent_id) e.dataTransfer?.setData("parent", parent_id);
			e.dataTransfer?.setData("id", id);

			if(e.dataTransfer) {
				let node = ele;

				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setDragImage(node[0], e.offsetX, e.offsetY);
			}
		};

		ele[0].ondragover = (e) => {
			if(!this.allow_reshuffling) return;
			e.preventDefault();

			let box = ele[0].getBoundingClientRect();
			let on_left = e.offsetX < box.width / 2;

			ele.toggleClass("InsertLeft", on_left)
				.toggleClass("InsertRight", !on_left);
		}

		ele[0].ondragleave = (e) => {
			ele.removeClass("InsertLeft").removeClass("InsertRight");
		};

		ele[0].ondrop = (e) => {
			if(!this.allow_reshuffling) return;

			let id = e.dataTransfer?.getData("id");
			let card = e.dataTransfer?.getData("card");

			if(id === undefined || card === undefined) return;

			let dragged = $(`#${id}`);

			let box = ele[0].getBoundingClientRect();
			let on_left = e.offsetX < box.width / 2;

			if(on_left) dragged.insertBefore(ele);
			else dragged.insertAfter(ele);

			dragged.removeClass("InsertLeft").removeClass("InsertRight");
			ele.removeClass("InsertLeft").removeClass("InsertRight");
		}


		if(this.indicate_new) {
			ele.addClass("NewCard");
			ele.on('mouseleave', () => {
				ele.removeClass("NewCard");
				ele.on('mouseleave', () => {});
			});
		}

		this.container.append(ele);
	}

	/// Sort the card according to the given function
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

	/// Erase all cards matching the given card
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

	/// Clear the hand
	clear() { this.container.html(""); }

	/// Set the cards according to list
	setCards(cards: Card[]) {
		this.clear();
		for(let card of cards) this.appendCard(card);
	}

	/// Determine for each card if it's legal
	setLegality(handler: (card: Card) => boolean) {
		this.container.children()
			.each((_, child) => {
				let cc = $(child).data(DATA) as Card;
				if(handler(cc)) $(child).removeClass("Illegal");
				else $(child).addClass("Illegal");
			});
	}

	/// Determine for each card if it should appear selected
	setSelected(handler: (card: Card) => boolean) {
		this.container.children()
			.each((_, child) => {
				let cc = $(child).data(DATA) as Card;
				if(handler(cc)) $(child).addClass("Selected");
				else $(child).removeClass("Selected");
			});
	}

	/// Toggle select mode. If a boolean is provided, set the mode instead.
	selectMode(select?: boolean): boolean {
		if(select !== undefined) this.selecting = select;
		else this.selecting = !this.selecting;

		this.setSelected(() => false);
		return this.selecting;
	}

	/// Return the currently selected cards
	get_selected(): Card[] {
		let iter = this.container.children()
			.filter((_, child) => $(child).hasClass("Selected"))
			.map((_, child) => {
				let cc = $(child).data(DATA) as Card;
				return cc;
			});

		return Array.from(iter);
	}

	/// Set all cards to illegal
	setIllegal() {
		this.setLegality(() => false);
	}
}
