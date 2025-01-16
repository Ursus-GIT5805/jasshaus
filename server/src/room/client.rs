use axum::extract::ws::{Message, WebSocket};
use futures::stream::SplitSink;
use futures::SinkExt;

use jasshaus_comm::socket_message::SocketMessage;

pub type WsWriter = SplitSink<WebSocket, Message>;

pub struct Client {
    pub name: String,
    pub player_id: usize,
	pub vote: Option<usize>,
	pub ws: WsWriter,
}

impl Client {
    pub const fn new(player_id: usize, ws_tx: WsWriter) -> Self {
        Client {
            name: String::new(),
            player_id,
			vote: None,
            ws: ws_tx,
        }
    }

    pub async fn send(&mut self, data: SocketMessage) {
        let jsonstr = serde_json::to_string(&data).unwrap();
        let msg = Message::Text(jsonstr.into());

        if let Err(e) = self.ws.send(msg).await {
            eprintln!("Error sending data: {:?}", e);
        }
    }
}
