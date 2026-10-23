# БУНКЕР — sakuradaemon
## Beta 09 — Game Loop Foundation

This is the Godot desktop prototype. It is not yet an online multiplayer build.

### Current milestone
- Preserve the existing bunker UI and local party flow.
- Fix the typed table header construction.
- Guard phase timer calls against invalid instances.
- Keep the next development stages explicit rather than claiming unfinished online features.

### Roadmap
1. Stabilize the local game loop: setup, character dealing, reveal, discussion, voting, tie-break, ending.
2. Align character cards to the specification: profession, biology, health, hobby, baggage, special condition, extra fact.
3. Add the three ending modes: Rescue, Revival, Survival Story.
4. Add robust secret ballots, runoff on ties, and persistent match history.
5. Only after local gameplay is stable, consider networking.

### Run
Open `project.godot` in Godot 4 and press F6/F5 as appropriate.
This archive has been edited by script but has not been launched in the Godot editor in this environment.

## Beta 10 additions
- Larger participant characteristic table remains central.
- Personal characteristic tiles now explicitly indicate click-to-reveal.
- Room chat screen for player-written messages (local prototype, not network-synced).
- Like/dislike relationship ratings per AI participant (local and non-binding; does not affect votes).
- Orange is emphasized on the threat header.

## Beta 11 — Compact game screen
- Large catastrophe title, description and survival requirements at the top.
- Player's own characteristic cards follow below.
- Large all-player characteristic table follows.
- Compact Chat and Relations buttons open pop-up windows.
- Removed radio/scouting buttons from the main gameplay screen.
- Chat and relations remain local prototype features, not network-synchronized.
