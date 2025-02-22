server_pwd="server"

b:
	cd game && wasm-pack build --target web
	rsync -av game/pkg content/

run:
	make b
	cd $(server_pwd) && cargo build
	(trap 'kill 0' SIGINT; make cont & make serv)

cont:
	python3 -m http.server -d content


serv:
	cd $(server_pwd) && cargo run

browser=xdg-open

doc:
	cd game && cargo doc
	$(browser) "game/target/doc/tichu_game/index.html"
