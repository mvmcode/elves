# Homebrew cask formula for ELVES — visual multi-agent orchestration for Claude Code and Codex.
# Template: update version, sha256, and URL for each release.

cask "elves" do
  version "0.1.0"
  sha256 "PLACEHOLDER_SHA256"

  url "https://github.com/mvmcode/elves/releases/download/v#{version}/ELVES_v#{version}_aarch64.dmg"
  name "ELVES"
  desc "Summon your AI army — visual multi-agent orchestration for Claude Code and Codex"
  homepage "https://elves.dev"

  depends_on macos: ">= :ventura"

  app "ELVES.app"

  zap trash: [
    "~/.elves",
    "~/Library/Application Support/dev.elves.app",
    "~/Library/Caches/dev.elves.app",
    "~/Library/Preferences/dev.elves.app.plist",
  ]
end
