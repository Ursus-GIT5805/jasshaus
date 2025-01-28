b:
	cd game && wasm-pack build --target web
	cp -r game/pkg content/pkg

run:
	make b
	make serv

br:
	rm -r content/pkg/
	make b

cont:
	python3 -m http.server -d content

serv:
	cd server/jassserver && cargo run

clean:
	cd game && cargo clean
	cd server && cargo clean
	cd htmlform && cargo clean
	cd server/jassserver && cargo clean
	rm -r content/pkg

ICEusername=""
ICEpassword=""
ICEfile="./build/content/js/chat.js"

target="aarch64-unknown-linux-gnu"

replaceICE:
	bash make/replace.sh $(ICEusername) $(ICEpassword)

install:
	mkdir -p build
	mkdir -p build/content
	cd server && cargo build --release --target $(target)
	cp server/target/$(target)/release/jasshaus-server build/jasshaus-server
	cd game && wasm-pack build --target web --release
	rm -r content/pkg
	mv game/pkg content
	cp -r content build
	make replaceICE
