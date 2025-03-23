use crate::card::*;

use super::*;

// use serde_big_array::BigArray;

/// A trick containing consecutive N-tuples of the same number
/// The trick contains at least L such N-tuples
#[derive(Clone)]
#[derive(Eq, PartialEq)]
#[derive(serde::Serialize, serde::Deserialize)]
pub struct Consecutive<const N: usize, const L: usize> {
	colors: Vec<Vec<u8>>,
	number: u8,
}

impl<const N: usize, const L: usize> DynamicTricktype for Consecutive<N, L> {
	fn get_power(&self) -> Power {
		self.number
	}

	fn get_length(&self) -> usize {
		self.colors.len()
	}

	fn parse(cardset: Cardset) -> Vec<Self> {
		if cardset.contains(DOG) || cardset.contains(DRAGON) {
			return vec![];
		}

		let len = cardset.len() / N;
		if len < L || cardset.len() % N != 0 {
			return vec![];
		}

		if N == 1 {
			let cards = cardset.as_vec();
			let col = match cards.get(0) {
				Some(c) => c.color,
				_ => return vec![],
			};

			// This is a Streetbomb!
			if !cards.into_iter().any(|c| c.color != col) {
				return vec![];
			}
		} else {
			if cardset.contains(ONE) {
				return vec![];
			}
		}

		let mut jokers = cardset.count_jokers() as i32;
		let hist = cardset.get_number_histogram();

		let start = hist.iter()
			.enumerate()
			.find(|(_, v)| !v.is_empty())
			.map(|(i, _)| i)
			.unwrap_or(0)
			.min(NUM_NUMBERS - len);

		let mut v = vec![];
		for hs in &hist[start..start+len] {
			let mut cols = vec![SPECIAL_COLOR; N];

			let iter = hs.iter()
				.enumerate()
				.take(N);

			for (i, col) in iter {
				cols[i] = *col;
			}

			jokers -= (N as i32 - hs.len() as i32).max(0);
			v.push(cols);
		}

		if jokers < 0 {
			vec![]
		} else {
			let out = Consecutive::<N, L> {
				colors: v,
				number: start as u8,
			};

			vec![out]
		}
	}

	fn as_cardset(&self) -> Cardset {
		Cardset::from( self.get_cards() )
	}

	fn can_fulfill(cardset: &Cardset, len: usize, power: Power, number: u8) -> bool {
		if NUM_NUMBERS <= (power as usize) + len {
			return false;
		}

		let hist = cardset.get_number_histogram();
		let jokers = cardset.count_jokers() as i32;

		let start = power as usize;

		// Do a sliding window keeping track of jokers needed
		let mut cnt = 0;
		for v in &hist[start..start+len] {
			cnt += (N as i32 - v.len() as i32).max(0);
		}

		let num = number as usize;
		let mut i = start;
		while i + len <= NUM_NUMBERS {
			if jokers <= cnt && (i..i+len).contains(&num) {
				return true;
			}

			cnt -= (N as i32 - hist[i].len() as i32).max(0);
			if i+len+1 < NUM_NUMBERS {
				cnt += (N as i32 - hist[i].len() as i32).max(0);
			}
			i += 1;
		}

		false
	}
}

impl<const N: usize, const L: usize> Consecutive<N, L> {
	pub fn get_cards(&self) -> Vec<Card> {
		let iter = self.colors.iter()
			.enumerate()
			.flat_map(|(i, cols)| {
				let num = self.number + i as u8;

				cols.iter()
					.map(move |&col| (col, num))
					.map(parse_col_num_pair)
			});

		iter.collect()
	}
}

// ---

#[derive(Clone)]
#[derive(Eq, PartialEq)]
#[derive(serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
#[repr(transparent)]
pub struct Street {
	data: Consecutive<1,5>,
}

impl DynamicTricktype for Street {
	fn get_power(&self) -> Power { self.data.get_power() }
	fn get_length(&self) -> usize { self.data.get_length() }
	fn as_cardset(&self) -> Cardset { self.data.as_cardset() }

	fn parse(cardset: Cardset) -> Vec<Self> {
		Consecutive::<1,5>::parse(cardset).into_iter()
			.map(|data| Self { data })
			.collect()
	}
	fn can_fulfill(cardset: &Cardset, len: usize, power: Power, number: u8) -> bool {
		Consecutive::<1, 5>::can_fulfill(cardset, len, power, number)
	}
}

#[wasm_bindgen]
impl Street {
	pub fn get_cards(&self) -> Vec<Card> { self.data.get_cards() }

	#[cfg(target_family = "wasm")]
	pub fn from_object(obj: JsValue) -> Self {
		serde_wasm_bindgen::from_value(obj).unwrap_throw()
	}
}

// ---

#[derive(Clone)]
#[derive(Eq, PartialEq)]
#[derive(serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
#[repr(transparent)]
pub struct Stairs {
	data: Consecutive<2,2>,
}

impl DynamicTricktype for Stairs {
	fn get_power(&self) -> Power { self.data.get_power() }
	fn get_length(&self) -> usize { self.data.get_length() }
	fn as_cardset(&self) -> Cardset { self.data.as_cardset() }

	fn parse(cardset: Cardset) -> Vec<Self> {
		Consecutive::<2,2>::parse(cardset).into_iter()
			.map(|data| Self { data })
			.collect()
	}
	fn can_fulfill(cardset: &Cardset, len: usize, power: Power, number: u8) -> bool {
		Consecutive::<2, 2>::can_fulfill(cardset, len, power, number)
	}
}

#[wasm_bindgen]
impl Stairs {
	pub fn get_cards(&self) -> Vec<Card> { self.data.get_cards() }

	#[cfg(target_family = "wasm")]
	pub fn from_object(obj: JsValue) -> Self {
		serde_wasm_bindgen::from_value(obj).unwrap_throw()
	}
}
