# Homebrew cask formula for ELVES — visual multi-agent orchestration for Claude Code and Codex.
# Template: update version, sha256, and URL for each release.

cask "elves" do
  version "1.0.0"
  sha256 "daf3a327ff1eaee225b5c06d5b51b473d40303b362c502640fe45cef9988d5dc"

  url "https://github.com/mvmcode/elves/releases/download/v#{version}/ELVES_#{version}_aarch64.dmg"
  name "ELVES"
  desc "Summon your AI army — visual multi-agent orchestration for Claude Code and Codex"
  homepage "https://elves.dev"

  depends_on macos: ">= :ventura"

  app "ELVES.app"

  caveats <<~EOS
    ELVES is not notarized (open-source project). If macOS says it is
    "damaged" or "can't be verified", run:

      xattr -cr /Applications/ELVES.app

    Or reinstall with:

      brew reinstall --no-quarantine mvmcode/tap/elves
  EOS

  zap trash: [
    "~/.elves",
    "~/Library/Application Support/dev.elves.app",
    "~/Library/Caches/dev.elves.app",
    "~/Library/Preferences/dev.elves.app.plist",
  ]
end
