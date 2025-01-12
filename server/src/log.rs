macro_rules! log {
    ($t:expr, $($args:tt)*) => {
        #[cfg(debug_assertions)]
        {
            print!(
                "[ {} | {}:{}: {} ] ",
                chrono::offset::Local::now().format("%H:%M:%S"),
                std::file!(),
                std::line!(),
                $t,
            );
            println!($($args)*)
        }
    };
}

macro_rules! debug {
    ($($args:tt)*) => {
        log!("\x1b[36mDEBUG\x1b[0m",$($args)*)
    };
}

macro_rules! error {
    ($($args:tt)*) => {
        log!("\x1b[31mERROR\x1b[0m",$($args)*)
    };
}
