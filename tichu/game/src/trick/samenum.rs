use super::*;
use crate::card::*;

use serde_big_array::BigArray;

#[derive(Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct SameNum<const N: usize> {
	#[serde(with = "BigArray")]
	colors: [u8; N],
	number: u8,
}

impl<const N: usize> Tricktype for SameNum<N> {
	fn get_power(&self) -> Power {
		self.number + 1
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		if cardset.contains(DOG) || cardset.contains(DRAGON) || cardset.len() != N {
			return vec![];
		}

		let jokers = cardset.count_jokers();
		if jokers == N {
			return vec![];
		}

		let cards = cardset.as_vec_no_jokers();
		let num = match cards.get(0) {
			Some(c) => c.number,
			None => return vec![],
		};

		if cards.iter().any(|c| c.number != num) {
			return vec![];
		}
		if cards.len() + jokers != N {
			return vec![];
		}

		let mut cols = [SPECIAL_COLOR; N];
		for (i, card) in cards.iter().enumerate() {
			cols[i] = card.color;
		}

		let out = SameNum::<N> {
			colors: cols,
			number: num,
		};

		vec![out]
	}

	fn as_cardset(&self) -> Cardset {
		let iter = self.colors.iter().map(|&col| {
			if self.number == 0 || col != SPECIAL_COLOR {
				Card::new(col, self.number)
			} else {
				PHOENIX
			}
		});

		Cardset::from(iter)
	}

	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool {
		if number + 1 < power {
			false
		} else {
			let cnt = cardset.count_number(number);
			if cnt == 0 {
				false
			} else {
				let jokers = cardset.count_jokers();
				N <= cnt + jokers
			}
		}
	}
}

//  ===== Wrapper structs =====
// Due that wasm_bindgen doesn't support generics yet, this is necessary

#[derive(Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
#[repr(transparent)]
pub struct Single {
	data: SameNum<1>,
}

impl Tricktype for Single {
	fn get_power(&self) -> Power {
		self.data.get_power()
	}
	fn as_cardset(&self) -> Cardset {
		self.data.as_cardset()
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		SameNum::<1>::parse(cardset)
			.into_iter()
			.map(|data| Self { data })
			.collect()
	}
	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool {
		SameNum::<1>::can_fulfill(cardset, power, number)
	}
}

// ---

#[derive(Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
#[repr(transparent)]
pub struct Double {
	data: SameNum<2>,
}

impl Tricktype for Double {
	fn get_power(&self) -> Power {
		self.data.get_power()
	}
	fn as_cardset(&self) -> Cardset {
		self.data.as_cardset()
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		SameNum::<2>::parse(cardset)
			.into_iter()
			.map(|data| Self { data })
			.collect()
	}
	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool {
		SameNum::<2>::can_fulfill(cardset, power, number)
	}
}

// ---

#[derive(Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
#[repr(transparent)]
pub struct Triple {
	data: SameNum<3>,
}

impl Tricktype for Triple {
	fn get_power(&self) -> Power {
		self.data.get_power()
	}
	fn as_cardset(&self) -> Cardset {
		self.data.as_cardset()
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		SameNum::<3>::parse(cardset)
			.into_iter()
			.map(|data| Self { data })
			.collect()
	}
	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool {
		SameNum::<3>::can_fulfill(cardset, power, number)
	}
}

/*
#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn test() {
		let cards = Cardset::from(Card::new(1, 2));
		let trick = Trick::try_from(ONE).unwrap();

		assert!(Single::can_fulfill(&cards, trick.get_power()+1, 2));
	}
}
*/
