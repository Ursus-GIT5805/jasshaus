use std::sync::Arc;
use tokio::sync::Mutex;

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    routing::get,
    Router,
};

use futures:: StreamExt;
use jasshaus_comm::socket_message::SocketMessage;

#[macro_use]
mod log;
mod room;

use room::Room;

async fn handle_websocket(ws: WebSocket, room: Arc<Mutex<Room>>) {
    let (ws_tx, mut ws_rx) = ws.split();
    let client_id: usize = room
        .lock()
        .await
        .register(ws_tx)
        .await
        .expect("The room was already full!");

    debug!("Client[{}] connected!", client_id);

    while let Some(message) = ws_rx.next().await {
        if let Message::Text(string) = message.unwrap() {
            debug!("Client[{}]: {}", client_id, string);
            let msg: SocketMessage = serde_json::from_str(string.as_str())
                .expect("Could not parse SocketMessage from JSON!");

            room.lock().await.handle_input(msg, client_id).await;
        } else {
            // TODO handle closing and other codes etc...
            error!("Could not extract message!");
        }
    }

	let mut rlock = room.lock().await;
    rlock.unregister(client_id).await;
	if rlock.should_close() {
		rlock.cleanup().await;
	}
    debug!("Client[{}] disconnected!", client_id);
}

#[tokio::main]
async fn main() {
	let room = Arc::new(Mutex::new(Room::new()));

    let app = Router::new().route(
        "/ws",
        get(|ws: WebSocketUpgrade| async move {
            ws.on_upgrade(|ws: WebSocket| async move {
				handle_websocket(ws, room.clone()).await;
			})
        }),
    );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:7999").await.unwrap();
	axum::serve(listener, app).await.unwrap();
}
