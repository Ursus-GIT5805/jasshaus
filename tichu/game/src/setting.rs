use wasm_bindgen::prelude::*;
use tsify_next::Tsify;
use serde::{Serialize, Deserialize};

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone)]
#[derive(PartialEq, Eq)]
#[derive(Serialize, Deserialize)]
pub enum EndCondition {
	Points(i32),
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone)]
#[derive(PartialEq, Eq)]
#[derive(Serialize, Deserialize)]
pub struct Setting {
	// Number of players in the game (usually 4)
	pub num_players: usize,

	// How does the game end?
	pub end_condition: EndCondition,

	// Number of cards a player has to decide GT
	pub num_cards_gt: usize,

	// Skip exchange?
	pub skip_exchange: bool,

	// Points to gain (or lose) on Tichu
	pub tichu_points: i32,
	// Points to gain (or lose) on Grand Tichu
	pub grand_tichu_points: i32,

	// Points to receive when one team finishes before any other team's player
	pub fast_finish_points: i32,
}

#[wasm_bindgen]
pub fn setting_classic() -> Setting {
	Setting::default()
}

impl Default for Setting {
	fn default() -> Self {
		Self {
			num_players: 4,
			end_condition: EndCondition::Points(1000),
			num_cards_gt: 8,
			skip_exchange: true,

			tichu_points: 100,
			grand_tichu_points: 200,
			fast_finish_points: 100,
		}
	}
}
