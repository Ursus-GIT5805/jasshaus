use jasshaus_game::{
	Event,
	server::*,
	setting::*,
};
use game_server::run_server;

#[tokio::main]
async fn main() {
	run_server::<Setting, Event, JassRoom>("0.0.0.0:7999").await;
}
