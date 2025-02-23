host=""
server_pwd="server/jasshaus_server"
target="aarch64-unknown-linux-gnu"

b:
	cd game && wasm-pack build --target web --dev
	rsync -av game/pkg content/

run:
	make b
	make build_serv
	(trap 'kill 0' SIGINT; make cont & make serv)

cont:
	python3 -m http.server -d content

build_serv:
	cd $(server_pwd) && cargo build

serv:
	cd $(server_pwd) && cargo run

clean:
	find . -type f -name Cargo.toml -exec dirname {} \; | xargs -I {} bash -c "cd {} && pwd && cargo clean"
	rm -r content/pkg

install:
	mkdir -p build
	cd $(server_pwd) && cargo build --release --target $(target)
	rsync -v $(server_pwd)/target/$(target)/release/jasshaus-server build/jasshaus-server
	cd game && wasm-pack build --target web --release
	rsync -av game/pkg content/
	rsync -av content build

push:
	rsync -av build/ $(host)

deploy:
	make install
	make push
