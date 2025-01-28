// ===== Carpet =====
//
// A class which handles how cards are display on the playmat.

class Carpet {
	constructor(n, rotation) {
		this.total_player = n;
		this.bestcard = null;

		this.rotate = Math.PI / 2.0 + rotation;
		this.container = document.getElementById("carpet");

		this.radiusX = 100;
		this.radiusY = 60;
	}

	/// Display that PLAYER played CARD
	playCard(card, player, newbestcard) {
		let img = document.createElement('img');
		img.src = card_get_img_url(card);

		let angle = this.rotate - (2*Math.PI / this.total_player * player);

		let x = -50 + Math.cos(angle) * this.radiusX;
		let y = -50 + Math.sin(angle) * this.radiusY;

		if(newbestcard) {
			if(this.bestcard) this.bestcard.style['border-style'] = "none";
			img.style['border-style'] = "solid";
			this.bestcard = img;
		}
		img.style['transform'] = "translateX(" + x + "%) translateY(" + y + "%) ";

		this.container.appendChild(img);
	}

	rotate_by_players(n) {
		this.rotate = Math.PI / 2.0 + (2*Math.PI / this.total_player * n);
	}

	/// Utility functions
	clean() { this.container.innerHTML = ""; }
	get_num_cards() { return this.container.children.length; }
}
