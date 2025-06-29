use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

use htmlform::HtmlForm;
use htmlform_macros::HtmlForm;

pub const NUM_COLORS: usize = 4;
pub const NUM_NUMBERS: usize = 9;
pub const NUM_CARDS: usize = NUM_COLORS * NUM_NUMBERS;

#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug, Hash)]
#[repr(u8)]
pub enum CardNumber {
	Six, Seven, Eight, Nine, Ten,
	Boy, Queen, King, Ace
}

/// The standard card struct.
/// Contains a color and a number.
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug, Hash)]
#[derive(PartialOrd, Ord)]
#[derive(HtmlForm)]
pub struct Card {
    pub color: u8,
    pub number: u8,
}

impl Card {
    pub fn new(color: u8, number: u8) -> Self {
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
}

impl Default for Card {
    fn default() -> Self {
        Card::new(4, 2)
    }
}


/// Return a Vec<Card> containing all possible cards
#[wasm_bindgen]
pub fn all_cards() -> Vec<Card> {
    (0..NUM_COLORS)
        .flat_map(|col| (0..NUM_NUMBERS).map(move |num| Card::new(col as u8, num as u8)))
        .collect()
}


#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn card_from_id(id: u8) -> Card {
	Card::from_id(id)
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn get_card_id(card: Card) -> u8 {
	card.get_id()
}

/// Standard show
/// Contains the starting point (color, number) and the type of the show
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, std::fmt::Debug)]
pub struct Show {
    pub color: u8,
    pub number: u8,
    pub row: u8,
}

#[wasm_bindgen]
impl Show {
    pub fn new(color: u8, number: u8, row: u8) -> Self {
        Show { color, number, row }
    }

    pub fn as_cards(&self) -> Vec<Card> {
        match self.row {
            1 => (0..NUM_COLORS as u8).map(|i| Card::new(i, self.number)).collect(),
            _ => (0..self.row)
                .map(|i| Card::new(self.color, self.number + i))
                .collect(),
        }
    }
}

impl TryFrom<Vec<Card>> for Show {
	type Error = ();

	fn try_from(value: Vec<Card>) -> Result<Self, Self::Error> {
		if value.len() <= 2 { return Err(()); }

		let mut cards = value;
		cards.sort();

		let col = cards[0].color;
		let num = cards[0].number;

		// Four different cards
		if cards[1].color != col {
			if cards.len() != NUM_COLORS {
				return Err(());
			}
			for i in 0..cards.len()-1 {
				if cards[i].number != cards[i+1].number || cards[i].color + 1 != cards[i+1].color {
					return Err(());
				}
			}

			return Ok(Show::new(col, num, 1));
		}

		for i in 0..cards.len()-1 {
			if cards[i].color != cards[i+1].color || cards[i].number+1 != cards[i+1].number {
				return Err(());
			}
		}

		Ok(Show::new(col, num, cards.len() as u8))
	}
}

impl Default for Show {
    fn default() -> Self {
        Show::new(4, 2, 0)
    }
}

#[derive(std::fmt::Debug)]
#[wasm_bindgen]
pub enum ShowError {
    Illegal,
    DoesNotContain,
    IsSubset,
}

/// If the list of cards form a union of a set of shows, it extracts the set with the most elements.
/// If no valid set is found, it returns an empty vector.
#[wasm_bindgen]
pub fn extract_shows(cards: Vec<Card>) -> Vec<Show> {
	let mut v = vec![];

	let mut num_cnt = vec![0; NUM_NUMBERS];
	for card in cards.iter() {
		num_cnt[card.number as usize] += 1;
	}

	let mut can_break = true;
	let mut row = 0u8;
	let mut last = Card::new(NUM_COLORS as u8, NUM_NUMBERS as u8);

	for card in cards {
		let breaks = card.color != last.color ||
			last.number + 1 != card.number;

		if breaks {
			if row < 3 && !can_break {
				return vec![];
			}


			if 3 <= row {
				let start = last.number + 1 - row;
				v.push(Show::new(last.color, start, row));
			}

			row = 1;
			can_break = num_cnt[card.number as usize] == NUM_COLORS;
		} else {
			row += 1;
			can_break = can_break && num_cnt[card.number as usize] == NUM_COLORS;
		}

		last = card;
	}

	if 3 <= row {
		let start = last.number + 1 - row;
		v.push(Show::new(last.color, start, row));
	}

	let all_nums = num_cnt.into_iter()
		.enumerate()
		.filter(|(_, cnt)| *cnt == NUM_COLORS)
		.map(|(num, _)| num);

	for num in all_nums {
		v.push( Show::new(0, num as u8, 1) );
	}

	v
}

/// A bitset containing cards info
/// There are no duplicates.
#[derive(Default, PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Cardset {
    list: u64,
}

#[wasm_bindgen]
impl Cardset {
	#[wasm_bindgen(constructor)]
    pub fn new(list: u64) -> Self {
		Cardset { list }
    }

    pub fn insert(&mut self, card: Card) {
        self.list |= 1u64 << card.get_id();
    }

	pub fn merge(&mut self, set: Cardset) {
		self.list |= set.list;
	}

    pub fn erase(&mut self, card: Card) {
        self.list &= !(1u64 << card.get_id());
    }

    pub fn clear(&mut self) {
        self.list = 0;
    }

	pub fn len(&self) -> usize {
		self.list.count_ones() as usize
	}

    pub fn contains(&self, card: Card) -> bool {
        self.list & (1 << card.get_id()) != 0
    }

    pub fn has_color(&self, color: u8) -> bool {
        self.list & (0x01FF << (color * 9)) != 0
    }

    pub fn only_has_color(&self, color: u8) -> bool {
        self.list & (0x01FF << (color * 9)) == self.list
    }

    pub fn count_color(&self, color: u8) -> u32 {
        (self.list & (0x01FF << (color * NUM_NUMBERS as u8))).count_ones()
    }

	pub fn count_number(&self, number: u8) -> u32 {
        (self.list & (0x0008040201 << number)).count_ones()
	}

    pub fn has_show(&self, show: Show) -> Result<(), ShowError> {
        // Rows that do not exist are not legal
        if show.row < 1 || 9 < show.row || show.row == 2 {
            return Err(ShowError::Illegal);
        }
        if show.row != 1 && show.number + show.row > 9 {
            return Err(ShowError::Illegal);
        }

        // Handle the show for 4-equals
        if show.row == 1 {
            let mask: u64 = 0x0008040201 << show.number;
            return if self.list & mask == mask {
                Ok(())
            } else {
                Err(ShowError::DoesNotContain)
            };
        }

        // Let the mask look like this 0000111000...
        let mask: u64 = {
            let tmp: u64 = 1 << (show.color * 9 + show.number);
            (tmp << show.row) - tmp
        };

        if self.list & mask != mask {
            return Err(ShowError::DoesNotContain);
        }

        // Everything is fine so far but... He could've shown only a smaller subset of another show!
        if show.number > 0 {
            // Can you shift right?
            // If this is also possible, then you could show a row of {show.row+1}
            if self.list & (mask >> 1) == (mask >> 1) {
                return Err(ShowError::IsSubset);
            }
        }

        if show.number + show.row == 9 {
            Ok(())
        }
        // Same procedure with shifting left
        else {
            if self.list & (mask << 1) == mask << 1 {
                Err(ShowError::IsSubset)
            } else {
                Ok(())
            }
        }
    }

    /// Return all possible shows from the current cardset
    pub fn get_shows(&self) -> Vec<Show> {
        let mut out = vec![];

        let mut x = self.list;
        for col in 0..NUM_COLORS as u8 {
            let mut row = 0u8;

            for num in 0..NUM_NUMBERS as u8 {
                if (x & 1) != 0 {
                    row += 1;
                } else {
                    if row > 2 {
                        out.push(Show::new(col, num - row, row))
                    }
                    row = 0;
                }
                x >>= 1;
            }
            if row > 2 {
                out.push(Show::new(col, NUM_NUMBERS as u8 - row, row))
            }
        }

        let mask: u64 = 0x0008040201;
        x = self.list;
        for num in 0..NUM_NUMBERS as u8 {
            if x & mask == mask {
                out.push(Show::new(0, num, 1));
            }
            x >>= 1;
        }

        out
    }

    /// Return the cards in the set as Vec<Card>
    pub fn as_vec(&self) -> Vec<Card> {
		all_cards()
			.into_iter()
			.filter(|c| self.contains(*c))
			.collect()
    }
}

impl From<Vec<Card>> for Cardset {
	fn from(item: Vec<Card>) -> Self {
		let mut set = Cardset::new(0);
        for card in item { set.insert(card) }
        set
	}
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn show_to_cards(show: Show) -> Vec<Card> {
	show.as_cards()
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn parse_show(item: Vec<Card>) -> Option<Show> {
	match Show::try_from(item) {
		Ok(r) => Some(r),
		_ => None,
	}
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
impl Cardset {
	pub fn from_list(item: Vec<Card>) -> Self {
		Self::from(item)
	}


	pub fn from_object(obj: JsValue) -> Option<Self> {
		match serde_wasm_bindgen::from_value(obj) {
			Ok(r) => Some(r),
			Err(_) => None,
		}
	}
}
