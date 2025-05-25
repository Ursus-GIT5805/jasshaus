use wasm_bindgen::prelude::*;
use tsify_next::Tsify;
use serde::{Serialize, Deserialize};

use htmlform::*;
use htmlform_macros::*;

use crate::card::NUM_CARDS;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone)]
#[derive(PartialEq, Eq)]
#[derive(Serialize, Deserialize)]
#[derive(HtmlForm)]
pub enum EndCondition {
	Points(i32),
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone)]
#[derive(PartialEq, Eq)]
#[derive(Serialize, Deserialize)]
#[derive(HtmlForm)]
pub struct Setting {
	// Number of players in the game
	#[Form("#name": "Number of players")]
	pub num_players: usize,

	// How does the game end?
	#[Form("#name": "Ending condition")]
	#[Form("#desc": "Decide how the game is finished")]
	pub end_condition: EndCondition,

	// Number of cards a player has to decide GT
	#[Form("#name": "Grand Tichu cards")]
	#[Form("#desc": "Number of cards for deciding Grand Tichu")]
	pub num_cards_gt: usize,

	// Skip exchange?
	#[Form("#name": "Skip Exchange")]
	pub skip_exchange: bool,

	// Points to gain (or lose) on Tichu
	#[Form("#name": "Tichu points")]
	#[Form("#desc": "Points gained/lost for announcing Tichu")]
	pub tichu_points: i32,
	// Points to gain (or lose) on Grand Tichu
	#[Form("#name": "Grand Tichu points")]
	#[Form("#desc": "Points gained/lost for announcing Grand Tichu")]
	pub grand_tichu_points: i32,

	// Points to receive when one team finishes before any other team's player
	#[Form("#name": "First finish")]
	#[Form("#desc": "Points gained for a team finishing before any other")]
	pub fast_finish_points: i32,
}

#[derive(PartialEq, Eq)]
#[derive(Clone, Copy)]
pub enum LegalityError {
	MorePlayerThanCards,
	TooManyGTCards,
}


impl Setting {
	pub fn is_legal(&self) -> Result<(), LegalityError> {
		let cards_per_player = NUM_CARDS / self.num_players;

		if self.num_players < NUM_CARDS {
			return Err(LegalityError::MorePlayerThanCards);
		}
		if self.num_cards_gt < cards_per_player {
			return Err(LegalityError::TooManyGTCards);
		}

		Ok(())
	}
}

impl Default for Setting {
	fn default() -> Self {
		Self {
			num_players: 4,
			end_condition: EndCondition::Points(1000),
			num_cards_gt: 8,
			skip_exchange: false,

			tichu_points: 100,
			grand_tichu_points: 200,
			fast_finish_points: 100,
		}
	}
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn setting_classic() -> Setting {
	Setting::default()
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn get_gamesettingform() -> String {
	json::stringify(Setting::form_data())
}
