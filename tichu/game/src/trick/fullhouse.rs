use crate::card::*;

use super::*;

use serde_big_array::BigArray;

#[derive(Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct PairSameNum<const A: usize = 3, const B: usize = 2> {
	num_a: u8,
	num_b: u8,
	#[serde(with = "BigArray")]
	col_a: [u8; A],
	#[serde(with = "BigArray")]
	col_b: [u8; B],
}

fn parse_color_strips<const A: usize, const B: usize>(
	jokers: i32,
	strip_a: (usize, Vec<u8>),
	strip_b: (usize, Vec<u8>),
) -> Option<PairSameNum<A, B>> {
	let j_a = A as i32 - strip_a.1.len() as i32;
	let j_b = B as i32 - strip_b.1.len() as i32;

	let needed = j_a + j_b;

	if std::cmp::min(j_a, j_b) < 0 {
		None
	} else if jokers < needed {
		None
	} else {
		let num_a = strip_a.0 as u8;
		let mut col_a = [SPECIAL_COLOR; A];
		for (i, &col) in strip_a.1.iter().enumerate() {
			col_a[i] = col;
		}

		let num_b = strip_b.0 as u8;
		let mut col_b = [SPECIAL_COLOR; B];
		for (i, &col) in strip_b.1.iter().enumerate() {
			col_b[i] = col;
		}

		Some(PairSameNum::<A, B> {
			num_a,
			num_b,
			col_a,
			col_b,
		})
	}
}

impl<const A: usize, const B: usize> Tricktype for PairSameNum<A, B> {
	fn get_power(&self) -> Power {
		self.num_a
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		if cardset.contains(DOG) || cardset.contains(DRAGON) {
			return vec![];
		}

		if cardset.len() != A + B {
			return vec![];
		}

		let jokers = cardset.count_jokers() as i32;
		let hist = cardset.get_number_histogram();

		let num_to_cols: Vec<_> = hist
			.into_iter()
			.enumerate()
			.filter(|(_, v)| !v.is_empty())
			.collect();

		if num_to_cols.len() != 2 {
			return vec![];
		}

		let opt_ab: Option<Self> =
			parse_color_strips(jokers, num_to_cols[0].clone(), num_to_cols[1].clone());

		let opt_ba: Option<Self> =
			parse_color_strips(jokers, num_to_cols[1].clone(), num_to_cols[0].clone());

		vec![opt_ab, opt_ba]
			.into_iter()
			.filter(|x| x.is_some())
			.map(|x| x.unwrap())
			.collect()
	}

	fn as_cardset(&self) -> Cardset {
		let iter = self.get_cards_a().into_iter().chain(self.get_cards_b());

		Cardset::from(iter)
	}

	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool {
		let joker = cardset.count_jokers() as i32;
		let hist = cardset.get_number_histogram();

		let cnt = hist[number as usize].len() as i32;

		if cnt == 0 {
			return false;
		}

		let iter = hist
			.iter()
			.enumerate()
			.filter(|(num, _)| *num != number as usize);

		let j_wish_b = (B as i32 - cnt as i32).max(0);
		for (_, hs) in iter.clone() {
			let j_a = (A as i32 - hs.len() as i32).max(0);
			let j = j_a + j_wish_b;

			if j < joker {
				return true;
			}
		}

		if power <= number {
			let j_wish_a = (A as i32 - cnt as i32).max(0);

			for (_, hs) in iter {
				let j_b = (B as i32 - hs.len() as i32).max(0);
				let j = j_b + j_wish_a;

				if j < joker {
					return true;
				}
			}
		}

		false
	}
}

impl<const A: usize, const B: usize> PairSameNum<A, B> {
	pub fn get_cards_a(&self) -> Vec<Card> {
		self.col_a
			.iter()
			.map(|&col| (col, self.num_a))
			.map(parse_col_num_pair)
			.collect()
	}
	pub fn get_cards_b(&self) -> Vec<Card> {
		self.col_b
			.iter()
			.map(|&col| (col, self.num_b))
			.map(parse_col_num_pair)
			.collect()
	}
}

// ---

#[derive(Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
#[repr(transparent)]
pub struct Fullhouse {
	data: PairSameNum<3, 2>,
}

impl Tricktype for Fullhouse {
	fn get_power(&self) -> Power {
		self.data.get_power()
	}
	fn as_cardset(&self) -> Cardset {
		self.data.as_cardset()
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		PairSameNum::<3, 2>::parse(cardset)
			.into_iter()
			.map(|data| Self { data })
			.collect()
	}
	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool {
		PairSameNum::<3, 2>::can_fulfill(cardset, power, number)
	}
}

#[wasm_bindgen]
impl Fullhouse {
	pub fn get_triplet(&self) -> Vec<Card> {
		self.data.get_cards_a()
	}
	pub fn get_pair(&self) -> Vec<Card> {
		self.data.get_cards_b()
	}

	#[cfg(target_family = "wasm")]
	pub fn from_object(obj: JsValue) -> Self {
		serde_wasm_bindgen::from_value(obj).unwrap_throw()
	}
}
