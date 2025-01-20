use crate::card::*;

use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug)]
#[derive(Default)]
#[repr(u8)]
#[non_exhaustive]
pub enum Playtype {
    Updown,
    Downup,
    Color(u8),
    SlalomUpdown,
    SlalomDownup,
    Guschti,
    Mary,
	BigSlalomUpdown,
	BigSlalomDownup,
	Molotow,
	Everything,
	#[default]
    None = 255,
}

// #[wasm_bindgen]
pub const NUM_PLAYTYPES: usize = 14;

#[wasm_bindgen]
impl Playtype {
	pub fn from_id(id: usize) -> Option<Self> {
		let res = match id {
			0 => Playtype::Updown,
			1 => Playtype::Downup,
			2 => Playtype::Color(0),
			3 => Playtype::Color(1),
			4 => Playtype::Color(2),
			5 => Playtype::Color(3),
			6 => Playtype::SlalomUpdown,
			7 => Playtype::SlalomDownup,
			8 => Playtype::Guschti,
			9 => Playtype::Mary,
			10 => Playtype::BigSlalomUpdown,
			11 => Playtype::BigSlalomDownup,
			12 => Playtype::Molotow,
			13 => Playtype::Everything,
			_ => return None,
		};
		Some(res)
	}

	/// Returns the ID of the current playtype.
	/// They have to map from a number between 0..NUM_PLAYTYPES
	pub fn get_id(&self) -> Option<usize> {
		let res = match self {
			Playtype::Updown => 0,
			Playtype::Downup => 1,
			Playtype::Color(x) => match *x {
				0 => 2,
				1 => 3,
				2 => 4,
				3 => 5,
				_ => return None,
			},
			Playtype::SlalomUpdown => 6,
			Playtype::SlalomDownup => 7,
			Playtype::Guschti => 8,
			Playtype::Mary => 9,
			Playtype::BigSlalomUpdown => 10,
			Playtype::BigSlalomDownup => 11,
			Playtype::Molotow => 12,
			Playtype::Everything => 13,
			_ => return None,
		};
		Some(res)
	}
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn get_playtype_id(item: Playtype) -> Option<usize> {
	item.get_id()
}

// #[derive(Tsify)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug)]
#[derive(Default)]
#[wasm_bindgen]
pub struct RuleSet {
    pub playtype: Playtype,
    pub active: Playtype,
    pub misere: bool,
}

#[wasm_bindgen]
impl RuleSet {
    pub fn new(playtype: Playtype, misere: bool) -> Self {
        Self {
			playtype,
			active: playtype,
			misere,
		}
    }

    pub fn is_trumpf(&self) -> bool {
        if let Playtype::Color(_) = self.playtype {
            true
        } else {
            false
        }
    }

    pub fn get_trumpf_color(&self) -> Option<u8> {
        match self.playtype {
            Playtype::Color(col) => Some(col),
            _ => None,
        }
    }

    pub fn is_color_trumpf(&self, color: u8) -> bool {
        match self.playtype {
            Playtype::Color(col) => col == color,
            _ => false,
        }
    }

	/// Returns true if the 'new' is a stronger card than 'current'
	/// Regards the current ACTIVE playtype
    pub fn is_card_stronger(&self, current: Card, new: Card) -> bool {
        match self.active {
            Playtype::Updown => current.color == new.color && current.number < new.number, // Basic updown
            Playtype::Downup => current.color == new.color && current.number > new.number, // Basic downup
            Playtype::Color(trumpf) => {
                let tcur = current.color == trumpf;
                let tnew = new.color == trumpf;

                if !tcur && !tnew {
                    current.color == new.color && current.number < new.number // Basic updown
                } else if tcur != tnew {
                    tnew // If tnew is trumpf, tcur wouldn't and vice versa
                } else {
                    // both are trumpf!
                    let order: [u8; 9] = [0, 1, 2, 7, 3, 8, 4, 5, 6];
                    order[current.number as usize] < order[new.number as usize] // Basic, but with trumpf order!
                }
            }
            _ => false, // No rules
        }
    }

	/// Returns the card point value
	/// Regards the overall playtype
    pub fn get_card_value(&self, card: Card) -> i32 {
        match self.playtype {
			Playtype::Everything |
            Playtype::Updown | Playtype::SlalomUpdown |
			Playtype::Guschti  | Playtype::BigSlalomUpdown => {
                let values: [i32; 9] = [0, 0, 8, 0, 10, 2, 3, 4, 11];
                values[card.number as usize]
            }
            Playtype::Downup | Playtype::SlalomDownup |
			Playtype::Mary | Playtype::BigSlalomDownup => {
                let values: [i32; 9] = [11, 0, 8, 0, 10, 2, 3, 4, 0];
                values[card.number as usize]
            }
            Playtype::Color(col) => {
                let trumpf = (card.color == col) as i32;
                let values: [i32; 9] = [0, 0, 0, 14 * trumpf, 10, 2 + 18 * trumpf, 3, 4, 11];
                values[card.number as usize]
            },
			Playtype::Molotow => {
				// Special about molotow: You have to handle the points
				// seperately and depending on the ACTIVE playtype
				let trumpf = match self.active {
					Playtype::Color(c) => card.color == c,
					_ => false,
				} as i32;

				let values: [i32; 9] = [0, 0, 0, 14*trumpf, 10, 2 + 18*trumpf, 3, 4, 11];
                values[card.number as usize]
			},
            _ => 0,
        }
    }

	/// Returns true if the 'new' is stronger than 'new'
	/// Regards the given playtype
    pub fn is_show_stronger(&self, current: Show, new: Show) -> bool {
        let pcur = self.get_show_value(current);
        let pnew = self.get_show_value(new);
        if pcur != pnew {
            return pcur < pnew;
        }
        // The shows has both the equal points
        if current.row != new.row {
            return current.row < new.row;
        } // You don't have to check for the 4-equals seperately

        // The shows are equally long
        if current.number != new.number {
            return match self.playtype {
                Playtype::Downup | Playtype::SlalomDownup|
				Playtype::Mary | Playtype::BigSlalomDownup => {
                    current.number > new.number
                }
                _ => current.number < new.number,
            };
        }

        // They have equal points, row, and number, but not color!
        // So if the new show's color is trumpf, it's better!
        return self.is_color_trumpf(new.color);
    }

	/// Returns the given shows value
    pub fn get_show_value(&self, show: Show) -> i32 {
        match show.row {
            0 => 0,
            1 => match show.number {
                3 => 150, // 9
                5 => 200, // boy
                _ => 100,
            },
            2 | 3 => 20,
            x => 50 * (x as i32 - 3),
        }
    }
}
