use std::iter::Iterator;
use std::convert::TryInto;

use wasm_bindgen::prelude::*;
use tsify_next::Tsify;
use serde::{Deserialize, Serialize};

use crate::trick::Trick;

#[cfg(feature = "server")]
use rand::seq::IteratorRandom;

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

/// The special cards in the game
/// They all have SPECIAL_COLOR as their color.
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

const CARDSET_N: usize = (NUM_CARDS >> 3) + (NUM_CARDS & 0b111 > 0) as usize;

/// A bitset containing cards info
/// There are no duplicates.
#[wasm_bindgen]
#[derive(Default, PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
#[repr(transparent)]
pub struct Cardset {
	// #[cfg_attr(feature = "server", serde(with = "serde_bytes"))]
    bs: [u8; CARDSET_N],
}

#[wasm_bindgen]
impl Cardset {
	/// Creates an empty Cardset
    pub fn new() -> Self {
		Cardset { bs: [0; CARDSET_N] }
    }

	/// Creates an Cardset with all cards
	pub fn full() -> Self {
		Self::from_list(all_cards())
	}

	/// Inserts the card (does nothing if the card is already in the set)
    pub fn insert(&mut self, card: Card) {
		let id = card.get_id() as usize;
		self.bs[id >> 3] |= 1 << (id & 0b111);
    }

	/// Merges the current set with another one
	pub fn merge(&mut self, set: &Cardset) {
		for (i, byte) in self.bs.iter_mut().enumerate() {
			*byte |= set.bs[i];
		}
	}

	/// Erase a card from the set (does nothing if the card isn't in the set)
    pub fn erase(&mut self, card: Card) {
		let id = card.get_id() as usize;
		self.bs[id >> 3] &= !(1 << (id & 0b111));
    }

	/// Erase all cards which are in this set AND in the given set
    pub fn erase_set(&mut self, set: &Cardset) {
		for (i, byte) in self.bs.iter_mut().enumerate() {
			*byte &= 0xFF ^ set.bs[i];
		}
    }

	/// Clears all cards
    pub fn clear(&mut self) {
		self.bs = [0; CARDSET_N];
    }

	/// Returns the number of cards in the set
	pub fn len(&self) -> usize {
		self.bs.iter()
			.map(|byte| byte.count_ones() as usize)
			.sum()
	}

	pub fn is_empty(&self) -> bool {
		self.bs.is_empty()
	}

    pub fn contains(&self, card: Card) -> bool {
		let id = card.get_id() as usize;
		self.bs[id >> 3] & 1 << (id & 0b111) != 0
    }

	/// Count the points in this cardset
	pub fn count_points(&self) -> i32 {
		let five = self.count_number(4) as i32;
		let ten = (self.count_number(9) + self.count_number(12)) as i32;
		let phoenix = self.contains(PHOENIX) as i32;
		let dragon = self.contains(DRAGON) as i32;

		five*5 + ten*10 + 25*(dragon - phoenix)
	}

	pub fn count_number(&self, number: u8) -> usize {
		(0..NUM_COLORS as u8)
			.filter(|&col| self.contains(Card::new(col, number)))
			.count()
	}

	/// Get one card in this set which has the given number
	/// Return None if no such card exists
	pub fn get_card_of_number(&self, number: u8) -> Option<Card> {
		let col = (0..NUM_COLORS as u8)
			.find(|&col| self.contains(Card::new(col, number)));

		match col {
			Some(c) => Some( Card::new(c, number) ),
			None => None,
		}
	}

	#[cfg(feature = "server")]
	/// Returns a cardset which are k cards chosen at random from this cardset.
	/// If k is bigger than the number of elements, the entire set is returned instead.
	pub fn choose_k(&self, k: usize) -> Cardset {
		let mut rng = rand::thread_rng();

		let cards = self.clone().as_vec();
		let chosen = cards.into_iter()
			.choose_multiple(&mut rng, k);

		Cardset::from(chosen)
	}
}

impl From<Card> for Cardset {
	fn from(item: Card) -> Self {
		let mut set = Cardset::new();
		set.insert(item);
        set
	}
}

impl TryInto<Card> for Cardset {
	type Error = ();

	fn try_into(self) -> Result<Card, Self::Error> {
		let vec = self.as_vec();

		if vec.len() == 1 {
			Ok(vec[0])
		} else {
			Err(())
		}
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

    /// Return the cards in the set as Vec<Card>
    pub fn as_vec(&self) -> Vec<Card> {
		all_cards()
			.into_iter()
			.filter(|c| self.contains(*c))
			.collect()
    }

    /// Return the cards in the set as Vec<Card> (without joker)
    pub fn as_vec_no_jokers(&self) -> Vec<Card> {
		all_cards()
			.into_iter()
			.filter(|c| *c != PHOENIX)
			.filter(|c| self.contains(*c))
			.collect()
    }

    /// Return the cards in the set as Vec<Card> (without special cards)
    pub fn as_nonspecial_vec(&self) -> Vec<Card> {
		all_cards()
			.into_iter()
			.filter(|c| c.color != SPECIAL_COLOR)
			.filter(|c| self.contains(*c))
			.collect()
    }

	/// Returns true if the this set contains either a Dragon, Phoenix, or Dog
	pub fn contains_an_animal(&self) -> bool {
		self.contains(DOG) ||
			self.contains(PHOENIX) ||
			self.contains(DRAGON)
	}

	#[cfg(target_family = "wasm")]
	pub fn from_object(obj: JsValue) -> Self {
		serde_wasm_bindgen::from_value(obj).unwrap_throw()
	}
}

impl Cardset {
	pub fn contains_set(&self, cards: impl Into<Cardset>) -> bool {
		let set = cards.into();

		!self.bs.iter()
			.enumerate()
			.any(|(i, &byte)| byte | set.bs[i] != byte)
	}

	pub fn contains_any<T>(&self, iter: T) -> bool
	where T: std::iter::IntoIterator<Item = Card>
	{
		iter.into_iter().any(|c| self.contains(c))
	}

	/// Returns an histogram of v[i] = the colors of number i
	/// Does ignore Dog, Dragon, and phoenix, but does not ignore the special one
	pub fn get_number_histogram(&self) -> Vec<Vec<u8>> {
		let cards = self.as_vec();

		let mut hist = vec![vec![]; NUM_NUMBERS];
		for card in cards {
			if card.number != 0 && card.color == SPECIAL_COLOR {
				continue;
			}

			hist[ card.number as usize ].push( card.color );
		}
		hist
	}

	pub fn count_jokers(&self) -> usize {
		self.contains(PHOENIX) as usize
	}
}

/*#[cfg(test)]
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
}*/
