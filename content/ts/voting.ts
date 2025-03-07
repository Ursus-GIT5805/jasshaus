import { ClientID } from "./wshandler";

class Option {
	name: string;
	ele: JQuery<HTMLElement>;
	total: number = 0;
	agrees: number = 0;

	constructor(name: string, total: number) {
		this.name = name;
		this.total = total;

		this.ele = $('<div>').click(() => {
			this.agree();
			this.ele.addClass("Selected");
		});
		this.update();
	}

	update(): void {
		this.ele.text(`${this.name} (${this.agrees}/${this.total})`);
	}

	setTotal(n: number): void {
		this.total = n;
		this.update();
	}

	agree(num?: number) {
		if(num !== undefined) this.agrees += num;
		else this.agrees += 1;
		this.update();
	}
}

class VoteManager {
	total: number = 0;
	options: Option[] = [];
	ele: JQuery<HTMLElement>;
	votes = new Map<number, number>();

	constructor(
		text: string,
		total: number,
		options: string[],
		container: JQuery<HTMLElement>,
		voteCallback?: (index: number) => void,
	) {
		this.total = total;
		let ele = $('<div class="VoteButtons">');

		for(let i = 0 ; i < options.length ; ++i) {
			let opt = new Option(options[i], total);
			if(voteCallback) opt.ele.click(() => voteCallback(i));

			this.options.push(opt);
			ele.append(opt.ele);
		}

		let cont = $('<div class="VoteWindow">')
			.append( $('<h2>').text(text) )
			.append( ele );
		this.ele = cont;

		container.append( cont );
	}

	agreeTo(opt: number, useVote: boolean, client_id?: number): void {
		if(useVote) {
			this.options[opt].ele.click();
		} else {
			this.options[opt].agree();
		}

		if(client_id) this.votes.set(client_id, opt);
	}

	setTotal(total: number): void {
		this.total = total;
		for(let opt of this.options) opt.setTotal(total);
	}

	onClientQuit(client_id: number): void {
		let vote = this.votes.get(client_id);
		this.votes.delete(client_id);

		if(vote !== undefined) this.options[vote].agree(-1);
		this.setTotal(this.total-1);
	}

	remove() {
		this.ele.remove();
	}
}

export class VoteHandler {
	num_clients: number = 1;
	container: JQuery<HTMLElement>;

	vote?: VoteManager = undefined;
	callback?: (index: number) => void = undefined;

	constructor(
		container?: JQuery<HTMLElement>,
		callback?: (index: number) => void,
	) {
		if(container) this.container = container;
		else this.container = $("body");

		this.callback = callback;
	}

	onclient() {
		this.num_clients += 1;
		if(this.vote) this.vote.setTotal(this.num_clients);
	}

	onclientleave(client_id: ClientID) {
		this.num_clients -= 1;
		if(this.vote) this.vote.onClientQuit(client_id);
	}

	onvote(vote: number, client_id: ClientID) {
		if(!this.vote) return;
		this.vote.agreeTo(vote, false, client_id);
	}

	onnewvote(type: string) {
		let opts: string[] = [];

		if(type == "Revanche") opts = ["Ja", "Nein"];

		this.vote = new VoteManager(
			type,
			this.num_clients,
			opts,
			$("body"),
			this.callback
		);
	}

	onvotequit() {
		if(this.vote) this.vote.remove();
		this.vote = undefined;
	}
}
