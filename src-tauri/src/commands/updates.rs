// Homebrew update check — fetches the tap formula and returns the latest version if newer.

use std::time::Duration;

/// Fetch the latest version from the Homebrew tap cask formula.
/// Returns `Some(version)` if a version string was found, `None` on any failure.
/// Uses a 5-second timeout so bad network never stalls app startup.
#[tauri::command]
pub async fn check_homebrew_update() -> Option<String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .ok()?;

    let body = client
        .get("https://raw.githubusercontent.com/mvmcode/homebrew-tap/main/Casks/elves.rb")
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()?;

    // Parse `version "X.Y.Z"` from the cask formula using string ops (no regex crate).
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("version ") {
            let version = trimmed
                .trim_start_matches("version ")
                .trim_matches('"')
                .trim()
                .to_string();
            if !version.is_empty() {
                return Some(version);
            }
        }
    }

    None
}
