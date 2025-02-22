use tichu_game::{
	server::*,
	setting::*,
};
use game_server::run_server;

#[tokio::main]
async fn main() {
	run_server::<Setting, Event, TichuRoom>("0.0.0.0:7998").await;
}
