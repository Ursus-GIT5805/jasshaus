use jasshaus_game::{
	Event,
	server::*,
	setting::*,
};
use game_server::*;

#[tokio::main]
async fn main() {
	Server::new("0.0.0.0:7999", "jasshaus")
		.unix_socket("unix_sock")
		.build::<Setting, Event, JassRoom>()
		.await;
}
