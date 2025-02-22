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
	pub num_players: usize,
	pub end_condition: EndCondition,

	pub num_cards_gt: usize,
}

#[wasm_bindgen]
impl Setting {
	pub fn new() -> Self {
		Self::default()
	}
}

impl Default for Setting {
	fn default() -> Self {
		Self {
			num_players: 4,
			end_condition: EndCondition::Points(1000),
			num_cards_gt: 8,
		}
	}
}
