run:
	cd game && wasm-pack build --target web
	mv -f game/pkg content
	cd server && cargo run

serv:
	cd server && cargo run

clean:
	cd game && cargo clean
	cd comm && cargo clean
	cd server && cargo clean
	rm -r content/pkg
