// MINIONS desktop app entry point — bootstraps the Tauri application.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    minions_lib::run()
}
