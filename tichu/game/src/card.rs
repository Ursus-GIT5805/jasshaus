use std::iter::Iterator;
use std::convert::TryInto;

use wasm_bindgen::prelude::*;
use tsify_next::Tsify;
use serde::{Deserialize, Serialize};

#[cfg(feature = "server")]
use rand::prelude::SliceRandom;

pub const NUM_COLORS: usize = 4;
pub const NUM_NUMBERS: usize = 14;
pub const NUM_SPECIAL_CARDS: usize = 4;
pub const NUM_CARDS: usize = NUM_COLORS * NUM_NUMBERS + NUM_SPECIAL_CARDS;

/// The standard card struct.
/// Contains a color and a number.
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug, Hash)]
#[derive(PartialOrd, Ord)]
pub struct Card {
    pub color: u8,
    pub number: u8,
}

pub const SPECIAL_COLOR: u8 = NUM_COLORS as u8;

pub const ONE: Card = Card::new(SPECIAL_COLOR, 0);
pub const DRAGON: Card = Card::new(SPECIAL_COLOR, 1);
pub const PHOENIX: Card = Card::new(SPECIAL_COLOR, 2);
pub const DOG: Card = Card::new(SPECIAL_COLOR, 3);

pub const SPECIAL_CARDS: [Card; NUM_SPECIAL_CARDS] = [
	ONE, DRAGON, PHOENIX, DOG
];

impl Card {
    pub const fn new(color: u8, number: u8) -> Self {
        Card { color, number }
    }

    pub fn from_id(card_id: u8) -> Self {
        Card {
            color: card_id / NUM_NUMBERS as u8,
            number: card_id % NUM_NUMBERS as u8,
        }
    }

    pub fn get_id(&self) -> u8 {
        self.color * NUM_NUMBERS as u8 + self.number
    }

	pub fn is_legal(&self) -> bool {
		let norm = (0..NUM_COLORS as u8).contains(&self.color) && (0..NUM_NUMBERS as u8).contains(&self.number);
		let spec = self.color == SPECIAL_COLOR && (0..4).contains(&self.number);
		norm || spec
	}
}

impl Default for Card {
    fn default() -> Self {
        Card::new(5, 11)
    }
}

#[wasm_bindgen]
/// Return a Vec<Card> containing all possible cards
pub fn all_cards() -> Vec<Card> {
	(0..NUM_COLORS)
        .flat_map(|col| (1..NUM_NUMBERS).map(move |num| Card::new(col as u8, num as u8)))
        .chain(SPECIAL_CARDS)
        .collect()
}

#[wasm_bindgen]
pub fn get_card_id(card: Card) -> u8 {
	card.get_id()
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug, Hash)]
#[derive(PartialOrd, Ord)]
pub enum Playtype {
	Single,
	Double,
	Triple,
	Street(u8),
	Stairs(u8),
	Fullhouse,

	Dog,
	Dragon,

	QuadBomb,
	StreetBomb(u8),
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug, Hash)]
#[derive(PartialOrd, Ord)]
pub enum Trick {
	Single {
		color: u8,
		number: u8,
	},
	Double {
		colors: [u8; 2],
		number: u8,
	},
	Triple {
		colors: [u8; 3],
		number: u8,
	},
	// ---
	Street {
		colors: Vec<u8>,
		number: u8,
	},
	Stairs {
		colors: Vec<(u8, u8)>,
		number: u8,
	},
	// ---
	Fullhouse {
		num2: u8,
		num3: u8,
		col2: [u8; 2],
		col3: [u8; 3],
	},
	Dog,
	Dragon,
	QuadBomb { number: u8 },
	StreetBomb { len: u8, color: u8, number: u8 },
}

const JOKER_COL: u8 = 5;

impl From<Trick> for Play {
	fn from(item: Trick) -> Self {
		match item {
			Trick::Single { color, number } => match color {
				_ => Play {
					power: match color {
						SPECIAL_COLOR => number,
						_ => (number+1)*2,
					},
					ty: Playtype::Single,
				}
			},
			Trick::Double { number, .. } => Play {
				power: number,
				ty: Playtype::Double,
			},
			Trick::Triple { number, .. } => Play {
				power: number,
				ty: Playtype::Triple,
			},
			Trick::Street { colors, number } => Play {
				power: number,
				ty: Playtype::Street(colors.len() as u8),
			},
			Trick::Stairs { colors, number } => Play {
				power: number,
				ty: Playtype::Stairs(colors.len() as u8),
			},
			Trick::Fullhouse { num3, .. } => Play {
				power: num3,
				ty: Playtype::Fullhouse,
			},
			// ---
			Trick::Dog => Play {
				power: 0,
				ty: Playtype::Dog,
			},
			Trick::Dragon => Play {
				power: 0,
				ty: Playtype::Dragon,
			},
			// ---
			Trick::QuadBomb { number } => Play {
				power: number,
				ty: Playtype::QuadBomb,
			},
			Trick::StreetBomb { len, number, .. } => Play {
				power: number,
				ty: Playtype::StreetBomb(len),
			}
		}
	}
}

impl Into<Cardset> for Trick {
	fn into(self) -> Cardset {

		let pairs: Vec<(u8,u8)> = match self {
			Trick::Single { color, number } => return Cardset::from( Card::new(color, number) ),
			Trick::Dragon => return Cardset::from(DRAGON),
			Trick::Dog => return Cardset::from(DOG),
			Trick::Double { colors, number } => colors.into_iter()
				.map(|col| (col, number))
				.collect(),
			Trick::Triple { colors, number } => colors.into_iter()
				.map(|col| (col, number))
				.collect(),
			Trick::Street { colors, number } => colors.into_iter()
				.enumerate()
				.map(|(idx, col)| (col, number + (idx as u8)))
				.collect(),
			Trick::Stairs { colors, number } => colors.into_iter()
				.enumerate()
				.map(|(idx, (col1, col2))| vec![(col1, number+idx as u8), (col2, number+idx as u8)])
				.flatten()
				.collect(),
			Trick::Fullhouse { num2, num3, col2, col3 } => col2.into_iter()
				.map(|col| (col, num2))
				.chain( col3.into_iter().map(|col| (col, num3)) )
				.collect(),
			Trick::QuadBomb { number } => (0..NUM_COLORS as u8)
				.map(|col| (col, number))
				.collect(),
			Trick::StreetBomb { len, color, number } => (0..len)
				.map(|idx| (color, number+idx))
				.collect(),
		};

		let map = pairs.into_iter()
			.map(|(col, num)| if col == JOKER_COL {
				PHOENIX
			} else {
				Card::new(col, num)
			});

		Cardset::from(map)
	}
}

impl TryFrom<Cardset> for Trick {
	type Error = ();

	// TODO Make this function check for multiple possible Playtypes!
	fn try_from(mut item: Cardset) -> Result<Self, Self::Error> {
		let num_cards = item.len();

		if item.is_empty() {
			return Err(());
		}

		// Handle single card
		if num_cards == 1 {
			let card = item.as_vec()[0];
			return Ok( Self::from(card) );
		}

		// ENHANCEMENT: support for more than 1 jokers!
		let num_jokers = item.contains(PHOENIX) as usize;

		item.erase(PHOENIX);
		// Cardset contains 1< cards, so no dragon/dog allowed
		if item.contains_any(vec![DOG, DRAGON]) {
			return Err(());
		}

		let cards = {
			let mut v = item.as_vec();
			v.sort_by_key(|c| c.number);
			v
		};

		let unique = {
			let num = cards[0].number;

			if cards.iter().any(|c| c.number != num) {
				None
			} else {
				Some(num)
			}
		};

		if let Some(num) = unique {
			// Possible is: Single, Dog, Dragon, Pairs, Triples, Quadbombs

			let mut cards = cards;
			for _ in 0..num_jokers {
				cards.push(Card::new(JOKER_COL, num))
			}

			let cols: Vec<_> = cards.iter().map(|c| c.color).collect();

			let res = match cols.len() {
				2 => Self::Double {
					colors: cols.try_into().unwrap(),
					number: num,
				},
				3 => Self::Triple {
					colors: cols.try_into().unwrap(),
					number: num,
				},
				4 => if num_jokers == 0 {
					Self::QuadBomb {
						number: num,
					}
				} else {
					return Err(());
				}
				_ => return Err(()),
			};

			return Ok(res);
		}

		let has_duplicates = {
			let mut v = vec![false; NUM_NUMBERS];
			let mut res = false;
			for card in cards.iter() {
				res = res || v[card.number as usize];
				v[card.number as usize] = true;
			}
			res
		};

		if has_duplicates {
			// Possible is: Stairs/Fullhouse

			if item.contains(ONE) {
				return Err(());
			}

			// No stair can have 5 cards!
			if num_cards == 5 {
				let num_to_cols: Vec<(u8, Vec<u8>)> = {
					let mut v = vec![vec![]; NUM_NUMBERS];
					for card in cards.iter() {
						v[card.number as usize].push(card.color);
					}

					v.into_iter().enumerate()
						.filter(|(_, v)| !v.is_empty())
						.map(|(col, v)| (col as u8, v))
						.collect()
				};

				// Only two numbers are alloed
				if num_to_cols.len() != 2 {
					return Err(());
				}

				let mut data2 = &mut num_to_cols[0].clone();
				let mut data3 = &mut num_to_cols[1].clone();

				if data2.1.len() > data3.1.len() {
					std::mem::swap(&mut data2, &mut data3);
				}

				if 0 < num_jokers {
					if data3.1.len() == 3 {
						data2.1.push(JOKER_COL);
					} else {
						// TODO return error instead, indicating multiple choices
						data3.1.push(JOKER_COL);
					}
				}

				let (num2, col2) = data2.clone();
				let (num3, col3) = data3.clone();

				let res = Self::Fullhouse {
					num2, num3,
					col2: col2.try_into().unwrap(),
					col3: col3.try_into().unwrap(),
				};

				return Ok(res);
			} else {
				let is_odd = (num_cards & 1) == 1;
				if is_odd { return Err(()); }

				let len = num_cards / 2;

				if NUM_CARDS < len {
					return Err(());
				}

				let low = std::cmp::min(
					cards[0].number,
					(NUM_NUMBERS-len) as u8
				);

				let end = low + len as u8;
				let mut cols = vec![Vec::<u8>::new(); len];
				let mut jokers_needed = 0;

				for card in cards.iter() {
					if !(low..end).contains(&card.number) {
						return Err(());
					}

					let idx = card.number-low;
					cols[idx as usize].push(card.color);
				}

				for entry in cols.iter_mut() {
					if 2 < entry.len() {
						return Err(());
					}

					while entry.len() < 2 {
						entry.push(JOKER_COL);
						jokers_needed += 1;
					}
				}

				if num_jokers < jokers_needed {
					return Err(());
				}

				let cols: Vec<_> = cols.into_iter()
					.map(|v| (v[0], v[1]))
					.collect();

				let res = Trick::Stairs {
					colors: cols,
					number: low,
				};

				return Ok(res);
			}
		} else {
			// Possible is: Street/StreetBomb

			if num_cards < 5 || NUM_NUMBERS < num_cards {
				return Err(());
			}

			let (cols, low) = {
				let mut v = vec![JOKER_COL; num_cards];

				let low = std::cmp::min(
					cards[0].number,
					(NUM_NUMBERS-num_cards) as u8
				);

				for card in cards.iter() {
					let idx = (card.number - low) as usize;
					if num_cards <= idx {
						return Err(());
					}

					v[idx] = card.color;
				}

				// You can't use the joker as a ONE!
				if low == 0 && v[0] == JOKER_COL {
					return Err(());
				}

				let jokers_needed = v.iter()
					.filter(|&c| *c == JOKER_COL)
					.count();

				// More jokers needed than provided
				if num_jokers < jokers_needed {
					return Err(());
				}

				assert_eq!(v.len(), num_cards);
				(v, low)
			};

			let num_colors: usize = {
				let mut v = vec![false; NUM_COLORS+2];
				for col in cols.iter() {
					v[*col as usize] = true;
				}
				v.into_iter().filter(|&b| b).count()
			};

			let res = if num_colors == 1 {
				Trick::StreetBomb {
					len: num_cards as u8,
					color: cards[0].color,
					number: low,
				}
			} else {
				Trick::Street {
					colors: cols,
					number: low,
				}
			};

			return Ok(res);
		}
	}
}


impl From<Card> for Trick {
	fn from(item: Card) -> Self {
		match item {
			DOG => Self::Dog,
			DRAGON => Self::Dragon,
			_ => Self::Single {
				color: item.color,
				number: item.number,
			}
		}
	}
}


impl Playtype {
	/// Returns whether this playtype can be beat another playtype.
	/// If a playtype beats another, it can be played altough it isn't the
	/// desired/played playtype
	pub fn can_beat(&self, other: Playtype) -> bool {
		match *self {
			Playtype::Dragon => other == Playtype::Single,
			Playtype::QuadBomb => !other.is_bomb(),
			Playtype::StreetBomb(len) => match other {
				Playtype::StreetBomb(o_len) => o_len < len,
				_ => false,
			},
			_ => false
		}
	}

	pub fn is_bomb(&self) -> bool {
		match *self {
			Playtype::QuadBomb |
			Playtype::StreetBomb(_) => true,
			_ => false,
		}
	}
}

#[wasm_bindgen]
pub fn parse_trick(cards: Vec<Card>) -> Option<Trick> {
	let cset = Cardset::from(cards);

	match Trick::try_from(cset) {
		Ok(r) => Some(r),
		Err(_) => None,
	}
}

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug, Hash)]
#[derive(PartialOrd, Ord)]
pub struct Play {
	pub power: u8,
	pub ty: Playtype,
}

impl TryFrom<Cardset> for Play {
	type Error = ();
	fn try_from(item: Cardset) -> Result<Self, Self::Error> {
		match Trick::try_from(item) {
			Ok(r) => Ok(r.into()),
			Err(_) => Err(()),
		}
	}
}

impl From<Card> for Play {
	fn from(item: Card) -> Self {
		Trick::from(item).into()
	}
}


/// A bitset containing cards info
/// There are no duplicates.
#[wasm_bindgen]
#[derive(Default, PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Cardset {
    list: u64,
}

#[wasm_bindgen]
impl Cardset {
    pub fn new() -> Self {
		Cardset { list: 0 }
    }

	pub fn full() -> Self {
		Self::from_list(all_cards())
	}

    pub fn insert_ref(&mut self, card: &Card) {
        self.list |= 1u64 << card.get_id();
    }

    pub fn insert(&mut self, card: Card) {
        self.list |= 1u64 << card.get_id();
    }

	pub fn merge(&mut self, set: Cardset) {
		self.list |= set.list;
	}

    pub fn erase(&mut self, card: Card) {
        self.list &= !(1u64 << card.get_id() as u64);
    }

    pub fn erase_set(&mut self, cards: Cardset) {
		self.list &= !(cards.list);
    }

    pub fn clear(&mut self) {
        self.list = 0;
    }

	pub fn len(&self) -> usize {
		self.list.count_ones() as usize
	}

	pub fn is_empty(&self) -> bool {
		self.list == 0
	}

    pub fn contains(&self, card: Card) -> bool {
        self.list & (1 << card.get_id()) != 0
    }

	pub fn count_points(&self) -> i32 {
		(self.count_number(3) as i32)*5
			+ (self.count_number(8) as i32 + self.count_number(11) as i32)*10
	}

    pub fn has_color(&self, color: u8) -> bool {
        self.list & (0x01FF << (color * 9)) != 0
    }

    pub fn only_has_color(&self, color: u8) -> bool {
        self.list & (0x01FF << (color * 9)) == self.list
    }

    pub fn count_color(&self, color: u8) -> u32 {
        (self.list & (0x3FFF << (color * NUM_NUMBERS as u8))).count_ones()
    }

	pub fn count_number(&self, number: u8) -> u32 {
		// this hash is constructed such that every card with number 0 is included
		let hash = 0x40010004001 << number;
        (self.list & hash).count_ones()
	}

	pub fn get_card_of_number(&self, number: u8) -> Option<Card> {
		let hash = 0x40010004001 << number;
		let new = self.list & hash;
		let cset = Self::from_hash(new);

		match cset.as_vec().get(0) {
			Some(card) => Some(*card),
			None => None,
		}
	}

	#[cfg(feature = "server")]
	pub fn choose_k(&self, k: usize) -> Cardset {
		let active: Vec<usize> = (0..64)
			.filter(|i| ((self.list >> i) & 1) == 1)
			.collect();

		let mut rng = rand::thread_rng();
		let entries = active.choose_multiple(&mut rng, k);

		let list = {
			let mut x = 0;
			for idx in entries {
				x |= 1 << idx;
			}
			x
		};

		Cardset { list }
	}
}

impl From<Card> for Cardset {
	fn from(item: Card) -> Self {
		let mut set = Cardset::new();
		set.insert(item);
        set
	}
}

impl<T> From<T> for Cardset
where T: std::iter::IntoIterator<Item = Card>
{
	fn from(item: T) -> Self {
		let mut set = Cardset::new();
        for card in item { set.insert(card) }
        set
	}
}

#[wasm_bindgen]
impl Cardset {
	pub fn from_list(item: Vec<Card>) -> Self {
		Self::from(item)
	}

	pub fn from_trick(item: Trick) -> Self {
		item.into()
	}

	pub fn from_hash(item: u64) -> Self {
		Self { list: item }
	}

	pub fn get_hash(&self) -> u64 {
		self.list
	}

    /// Return the cards in the set as Vec<Card>
    pub fn as_vec(&self) -> Vec<Card> {
		all_cards()
			.into_iter()
			.filter(|c| self.contains(*c))
			.collect()
    }

	#[cfg(target_family = "wasm")]
	pub fn from_object(obj: JsValue) -> Option<Self> {
		match serde_wasm_bindgen::from_value(obj) {
			Ok(r) => Some(r),
			Err(_) => None,
		}
	}
}

impl Cardset {
	pub fn contains_set(&self, cards: impl Into<Cardset>) -> bool {
		let list = cards.into().list;
		self.list & list == list
	}

	pub fn contains_any<T>(&self, iter: T) -> bool
	where T: std::iter::IntoIterator<Item = Card>
	{
		iter.into_iter().any(|c| self.contains(c))
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use rand::Rng;

	#[test]
	fn playtype_cardset_conversion() {
		let set = Cardset::from_list(all_cards());
		let init_hash = set.get_hash();

		let mut rng = rand::thread_rng();

		for i in 0..2000 {
			let hash = rng.gen::<u64>() & init_hash;
			let cards = Cardset::from_hash(hash);

			println!("{:?}", cards.as_vec());

			match Trick::try_from( cards ) {
				Ok(p) => {
					let cset: Cardset = p.into();
					assert_eq!(cset, cards);
				},
				Err(_) => {},
			}
		}
	}
}
