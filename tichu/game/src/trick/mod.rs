pub mod samenum;
pub mod consecutive;

pub mod fullhouse;

pub mod quadbomb;
pub mod streetbomb;

use std::mem::discriminant;
use wasm_bindgen::prelude::*;

use crate::card::*;

use samenum::*;
use fullhouse::*;
use consecutive::*;
use quadbomb::QuadBomb;
use streetbomb::StreetBomb;

pub type Power = u8;

// ---

pub trait Tricktype: Sized {
	fn get_power(&self) -> Power;
	fn as_cardset(&self) -> Cardset;

	fn parse(cardset: Cardset) -> Vec<Self>;
	fn can_fulfill(cardset: &Cardset, power: Power, number: u8) -> bool;
}

pub trait DynamicTricktype: Sized {
	fn get_power(&self) -> Power;
	fn get_length(&self) -> usize;
	fn as_cardset(&self) -> Cardset;

	fn parse(cardset: Cardset) -> Vec<Self>;
	fn can_fulfill(cardset: &Cardset, len: usize, power: Power, number: u8) -> bool;
}

// ---

#[derive(Clone)]
#[derive(Eq, PartialEq)]
#[derive(serde::Serialize, serde::Deserialize)]
#[derive(tsify_next::Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[non_exhaustive]
pub enum Trick {
	Single(Single),
	Double(Double),
	Triple(Triple),

	Street(Street),
	Stairs(Stairs),

	Fullhouse(Fullhouse),

	QuadBomb(QuadBomb),
	StreetBomb(StreetBomb),

	Dog,
	Dragon,
	Phoenix(u8),
}

fn parse_col_num_pair(data: (u8, u8)) -> Card {
	let (col, num) = data;

	if num == 0 || col != SPECIAL_COLOR {
		Card::new(col, num)
	} else {
		PHOENIX
	}
}

fn parse_and_collect<T: Tricktype, F: FnMut(T) -> Trick>(
    item: &Cardset,
    collector: &mut Vec<Trick>,
    mapper: F,
) {
	collector.extend(
		T::parse(item.clone()).into_iter()
			.map(mapper)
	);
}

fn parse_dyn_and_collect<T: DynamicTricktype, F: FnMut(T) -> Trick>(
    item: &Cardset,
    collector: &mut Vec<Trick>,
    mapper: F,
) {
	collector.extend(
		T::parse(item.clone()).into_iter()
			.map(mapper)
	);
}

#[wasm_bindgen]
pub fn parse_all_tricks(item: Cardset) -> Vec<Trick> {
	let mut v = vec![];

	if item.len() == 1 {
		if item.contains(DRAGON) {
			v.push(Trick::Dragon);
		} else if item.contains(DOG) {
			v.push(Trick::Dog);
		} else if item.contains(PHOENIX) {
			v.push(Trick::Phoenix(0));
		}
	}

	parse_and_collect::<Single, _>(&item, &mut v, Trick::Single);
	parse_and_collect::<Double, _>(&item, &mut v, Trick::Double);
	parse_and_collect::<Triple, _>(&item, &mut v, Trick::Triple);
	parse_and_collect::<Fullhouse, _>(&item, &mut v, Trick::Fullhouse);

	parse_dyn_and_collect::<Street, _>(&item, &mut v, Trick::Street);
	parse_dyn_and_collect::<Stairs, _>(&item, &mut v, Trick::Stairs);

	parse_and_collect::<QuadBomb, _>(&item, &mut v, Trick::QuadBomb);
	parse_dyn_and_collect::<StreetBomb, _>(&item, &mut v, Trick::StreetBomb);

	v
}

#[wasm_bindgen]
pub fn parse_trick(item: Vec<Card>) -> Option<Trick> {
	let cardset = Cardset::from(item);

	match Trick::try_from(cardset) {
		Ok(t) => Some(t),
		Err(_) => None,
	}
}

/// Returns whether the given cardset can fulfill the wish, considering it must beat the given trick
pub fn can_fulfill(cardset: &Cardset, trick: Trick, number: u8) -> bool {
	if cardset.count_number(number) == 0 {
		return false;
	}

	let res = match &trick {
		Trick::Phoenix(pow) => Single::can_fulfill(&cardset, *pow+1, number),
		Trick::Single(data) => Single::can_fulfill(&cardset, data.get_power()+1, number),

		Trick::Double(data) => Double::can_fulfill(&cardset, data.get_power()+1, number),
		Trick::Triple(data) => Triple::can_fulfill(&cardset, data.get_power()+1, number),
		Trick::Fullhouse(data) => Fullhouse::can_fulfill(&cardset, data.get_power()+1, number),

		Trick::Street(data) => Street::can_fulfill(&cardset, data.get_length(), data.get_power()+1, number),
		Trick::Stairs(data) => Stairs::can_fulfill(&cardset, data.get_length(), data.get_power()+1, number),
		_ => false,
	};
	if res {
		return true;
	}

	// Check if you can bomb
	let can_bomb = match &trick {
		Trick::QuadBomb(data) => {
			QuadBomb::can_fulfill(&cardset, data.get_power()+1, number) ||
				StreetBomb::can_fulfill(&cardset, 5, 0, number)
		},
		Trick::StreetBomb(data) => {
			StreetBomb::can_fulfill(&cardset, data.get_length(), data.get_power()+1, number)
		}
		Trick::Dog => false,
		_ => {
			QuadBomb::can_fulfill(&cardset, 0, number) ||
				StreetBomb::can_fulfill(&cardset, 5, 0, number)
		},
	};

	can_bomb
}

/// Returns true if the given list of cards contains a bomb
#[wasm_bindgen]
pub fn contains_bomb(cards: Vec<Card>) -> bool {
	let cardset = Cardset::from(cards);
	QuadBomb::createable_from(&cardset) ||
		StreetBomb::createable_from(&cardset)
}

impl Trick {
	pub fn get_power(&self) -> Power {
		match self {
			Trick::Single(data) => data.get_power(),
			Trick::Double(data) => data.get_power(),
			Trick::Triple(data) => data.get_power(),
			Trick::Fullhouse(data) => data.get_power(),
			Trick::Street(data) => data.get_power(),
			Trick::Stairs(data) => data.get_power(),
			Trick::Phoenix(pow) => *pow,
			_ => 0,
		}
	}

	pub fn get_length(&self) -> usize {
		match self {
			Trick::Street(data) => data.get_length(),
			Trick::Stairs(data) => data.get_length(),
			Trick::StreetBomb(data) => data.get_length(),
			_ => 0,
		}
	}

	/// Returns whether this trick can beat the given trick
	pub fn can_beat(&self, rhs: &Trick) -> bool {
		// If one of them is a bomb, it's already determined
		if self.is_bomb() != rhs.is_bomb() {
			return self.is_bomb();
		}

		// If they are of the same type, then just compare the power and length.
		if discriminant(self) == discriminant(rhs) {
			let legal_length = match self {
				Trick::StreetBomb(data) => {
					match data.get_length().cmp( &rhs.get_length() ) {
						std::cmp::Ordering::Less => return false, // is shorter: never beats
						std::cmp::Ordering::Greater => return true, // is longer: always beats
						_ => true, // is same: check for power
					}
				},
				_ => self.get_length() == rhs.get_length(),
			};

			return legal_length && rhs.get_power() < self.get_power();
		}

		match self {
			// Dragon might beat singles/phoenix
			Trick::Dragon => match &rhs {
				Trick::Single(_) | Trick::Phoenix(_) => true,
				_ => false,
			},
			// Singles might beat phoenix!
			Trick::Single(data) => match &rhs {
				Trick::Phoenix(pow) => *pow < data.get_power(),
				_ => false,
			},
			// Phoenix might beat single
			Trick::Phoenix(_) => match &rhs {
				Trick::Single(_) => true,
				_ => false,
			},
			// Street bombs are stronger than Quadbombs
			Trick::StreetBomb(_) => match &rhs {
				Trick::QuadBomb(_) => true,
				_ => false,
			}
			_ => false,
		}
	}

	/// Returns whether this trick is a bomb
	pub fn is_bomb(&self) -> bool {
		match self {
			Trick::QuadBomb(_) |
			Trick::StreetBomb(_) => true,
			_ => false,
		}
	}

	pub fn get_cards(&self) -> Cardset {
		match &self {
			Trick::Single(data) => data.as_cardset(),
			Trick::Double(data) => data.as_cardset(),
			Trick::Triple(data) => data.as_cardset(),
			Trick::Fullhouse(data) => data.as_cardset(),

			Trick::Stairs(data) => data.as_cardset(),
			Trick::Street(data) => data.as_cardset(),

			Trick::QuadBomb(data) => data.as_cardset(),
			Trick::StreetBomb(data) => data.as_cardset(),

			Trick::Dragon => Cardset::from(DRAGON),
			Trick::Phoenix(_) => Cardset::from(PHOENIX),
			Trick::Dog => Cardset::from(DOG),
		}
	}
}

impl TryFrom<Cardset> for Trick {
	type Error = ();

	fn try_from(value: Cardset) -> Result<Self, Self::Error> {
		let v = parse_all_tricks(value);

		if v.len() == 1 {
			Ok( v[0].clone() )
		} else {
			Err(())
		}
	}
}

impl Into<Cardset> for Trick {
	fn into(self) -> Cardset {
		self.get_cards()
	}
}

impl TryFrom<Card> for Trick {
	type Error = ();
	fn try_from(value: Card) -> Result<Self, Self::Error> {
		Self::try_from( Cardset::from(value) )
	}
}
