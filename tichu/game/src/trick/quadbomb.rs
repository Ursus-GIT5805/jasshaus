use crate::card::*;

use super::*;

#[derive(Clone, Eq, PartialEq, tsify_next::Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(serde::Serialize, serde::Deserialize)]
pub struct QuadBomb {
	number: u8,
}

impl Tricktype for QuadBomb {
	fn get_power(&self) -> Power {
		self.number
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		let cards = cardset.as_nonspecial_vec();
		let num = match cards.get(0) {
			Some(c) => c.number,
			None => return vec![],
		};

		if cards.len() != 4 || cards.iter().any(|c| c.number != num) {
			vec![]
		} else {
			vec![QuadBomb { number: num }]
		}
	}

	fn as_cardset(&self) -> Cardset {
		let iter = (0..NUM_COLORS as u8).map(|col| Card::new(col, self.number));

		Cardset::from(iter)
	}

	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool {
		if number < power {
			false
		} else {
			cardset.count_number(number) == 4
		}
	}
}

impl QuadBomb {
	pub fn createable_from(cardset: &Cardset) -> bool {
		let hist = cardset.get_number_histogram();

		for num in hist {
			if num.len() == NUM_COLORS {
				return true;
			}
		}

		false
	}
}
