use jasshaus_game::server::*;
use game_server::run_server;

#[tokio::main]
async fn main() {
	run_server::<GameEvent, JassRoom>("0.0.0.0:7999").await;
}
