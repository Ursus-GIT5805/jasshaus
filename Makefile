host=""
server_pwd="server/jasshaus_server"
target="aarch64-unknown-linux-gnu"


b:
	cd game && wasm-pack build --target web --dev
	rsync -av game/pkg content/js/pkg

run:
	make b
	make build_serv
	(trap 'kill 0' SIGINT; make cont & make serv)

cont:
	mkdir -p content/js/
	make b
	tsc -p content/tsdebug.json
	python3 -m http.server -d content

build_serv:
	cd $(server_pwd) && cargo build

serv:
	cd $(server_pwd) && cargo run

clean:
	find . -type f -name Cargo.toml -exec dirname {} \; | xargs -I {} bash -c "cd {} && pwd && cargo clean"
	rm -r content/pkg

release:
	mkdir -p build
	cd $(server_pwd) && cargo build --release --target $(target)
	rsync -v $(server_pwd)/target/$(target)/release/jasshaus-server build/jasshaus-server
	cd game && wasm-pack build --target web --release
	mkdir -p content/js/
	rsync -av game/pkg content/js/
	rsync -av content build
	find ./build/content/js/ -maxdepth 1 -type f -exec uglifyjs {} -m -c -o {} \;

push:
	rsync -av build/ $(host)

deploy:
	make install
	make push
