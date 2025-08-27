host=""
server_pwd=server
target=aarch64-unknown-linux-gnu
rustfmt := $(PWD)/rustfmt.toml

build_web:
	cd game && wasm-pack build --target web --dev
	rsync -av game/pkg content/
	mkdir -p content/js/
	tsc -p content/tsdebug.json

build_server:
	cd $(server_pwd) && cargo build

cont:
	make build_web
	python3 -m http.server -d content

serv:
	cd $(server_pwd) && cargo run

server:
	make serv
	echo $(server_pwd)/target/$(target)/release/$(server_name)

run:
	make build_web
	make build_server
	(trap 'kill 0' SIGINT; make cont & make serv)

todos:
	git grep TODO

clean:
	find . -type f -name Cargo.toml -exec dirname {} \; | xargs -I {} bash -c "cd {} && pwd && cargo clean"
	rm -r content/pkg

release:
	make build_web
	mkdir -p build
	cd $(server_pwd) && cargo build --release --target $(target)
	rsync -av --copy-links $(server_pwd)/target/$(target)/release/$(server_name) build/
	cd game && wasm-pack build --target web --release
	mkdir -p content/js/
	rsync -av game/pkg content/
	rsync -av --include-from="filter.txt" content build
	# find ./build/content/js/ -maxdepth 1 -type f -exec uglifyjs {} -m -c -o {} \;

fmt:
	@biome format --fix
	@find . -name Cargo.toml -not -path "*/target/*" | while read cargo_file; do \
		project_dir=$$(dirname $$cargo_file); \
		echo "Formatting in $$project_dir"; \
		(cd $$project_dir && cargo fmt --all -- --config-path $(rustfmt)); \
	done

fmt-check:
	@biome check
	@find . -name Cargo.toml -not -path "*/target/*" | while read cargo_file; do \
		project_dir=$$(dirname $$cargo_file); \
		echo "Check formatting in $$project_dir"; \
		(cd $$project_dir && cargo fmt --all --check -- --config-path $(rustfmt)); \
	done
