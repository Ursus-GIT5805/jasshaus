class Voting {
	constructor(text, n, options, voteCallback) {
		this.voted = false;
		this.total = n;

		this.options = options;
		this.buttons = [];
		this.agrees = [];

		let ele = $('<div>')
			.attr("id", "voteButtons");

		for(let i = 0 ; i < options.length ; i++) {
			let button = $("<div>")
				.text( options[i] + " (0/" + this.total + ")" );

			this.agrees.push(0);

			button.click(() => {
				if(this.voted) return;
				for(let b of this.buttons) b.css("background-color", "red");
				button.css("background-color", "green");
				this.agreeTo(i)
				voteCallback(i);
				this.voted = true;
			});
			ele.append(button);

			this.buttons.push(button);
		}

		$("body").append($("<div>")
						 .attr("id", "voteWindow")
						 .append( $("<h2>").text(text) )
						 .append( ele ));
	}

	agreeTo(option) {
		this.agrees[option] += 1;
		let text = this.options[option] + " (" + this.agrees[option] + "/" + this.total + ")";
		this.buttons[option].text(text);
	}

	setTotal(total) {
		this.total = total;

		for(let option in options) {
			let text = this.options[option] + " (" + this.agrees[option] + "/" + this.total + ")";
			this.buttons[option].text(text);
		}
	}
}
