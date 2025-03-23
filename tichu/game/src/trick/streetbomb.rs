use crate::card::*;

use super::*;

const MIN_LENGTH: usize = 5;

#[derive(Clone)]
#[derive(Eq, PartialEq)]
#[derive(serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
pub struct StreetBomb {
	color: u8,
	number: u8,
	len: u8,
}

impl DynamicTricktype for StreetBomb {
	fn get_power(&self) -> Power {
		self.number
	}

	fn get_length(&self) -> usize {
		self.len as usize
	}

	fn as_cardset(&self) -> Cardset {
		Cardset::from(self.get_cards())
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		let cards = {
			let mut c = cardset.as_vec();
			c.sort_by_key(|c| c.number);
			c
		};

		let (color, number) = {
			let c = match cards.get(0) {
				Some(c) => c,
				None => return vec![],
			};
			(c.color, c.number)
		};

		if cards.len() < 5 {
			return vec![];
		}
		if color == SPECIAL_COLOR || cards.iter().any(|c| c.color != color) {
			return vec![];
		}

		for i in 0..cards.len()-1 {
			if cards[i].number+1 != cards[i+1].number {
				return vec![];
			}
		}

		let out = StreetBomb {
			color,
			number,
			len: cards.len() as u8,
		};

		vec![out]
	}

	fn can_fulfill(cardset: &Cardset, len: usize, power: Power, number: u8) -> bool {
		if NUM_NUMBERS <= (power as usize) + len {
			return false;
		}

		let low = power;

		for col in 0..NUM_COLORS as u8 {
			let mut l = 0;

			for i in low..NUM_NUMBERS as u8 {
				if !cardset.contains( Card::new(col, i) ) {
					l = i+1;
				} else {
					let diff = (i-l) as usize;
					if len < diff && (l..=i).contains(&number) {
						return true;
					}
				}
			}
		}

		false
	}
}

#[wasm_bindgen]
impl StreetBomb {
	pub fn longest_possible(cardset: &Cardset) -> usize {
		let mut best = 0;

		for col in 0..NUM_COLORS as u8 {
			let mut l = 0;

			for i in 0..NUM_NUMBERS as u8 {
				if !cardset.contains( Card::new(col, i) ) {
					l = i+1;
				} else {
					let diff = (i-l) as usize;
					best = std::cmp::max(diff, best);
				}
			}
		}

		best
	}

	pub fn createable_from(cardset: &Cardset) -> bool {
		MIN_LENGTH <= Self::longest_possible(cardset)
	}

	pub fn get_cards(&self) -> Vec<Card> {
		(self.number..self.number+self.len)
			.map(|num| Card::new(self.color, num))
			.collect()
	}

	#[cfg(target_family = "wasm")]
	pub fn from_object(obj: JsValue) -> Self {
		serde_wasm_bindgen::from_value(obj).unwrap_throw()
	}
}
