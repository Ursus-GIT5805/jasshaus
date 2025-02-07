ICEusername=""
ICEpassword=""
server_pwd="server/jasshaus_server"
target="aarch64-unknown-linux-gnu"

b:
	cd game && wasm-pack build --target web
	rsync -av game/pkg content/

run:
	make b
	bash make/run.sh

cont:
	python3 -m http.server -d content

serv:
	cd $(server_pwd) && cargo run

clean:
	find . -type f -name Cargo.toml -exec dirname {} \; | xargs -I {} bash -c "cd {} && pwd && cargo clean"
	rm -r content/pkg

replaceICE:
	bash make/replace.sh $(ICEusername) $(ICEpassword)

install:
	mkdir -p build
	mkdir -p build/content
	cd $(server_pwd) && cargo build --release --target $(target)
	rsync -v $(server_pwd)/target/$(target)/release/jasshaus-server build/jasshaus-server
	cd game && wasm-pack build --target web --release
	rsync -av game/pkg content/
	rsync -av content build
	make replaceICE
