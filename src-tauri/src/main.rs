#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = horion_lib::run() {
        eprintln!("Horion failed to start: {error}");
        std::process::exit(1);
    }
}
