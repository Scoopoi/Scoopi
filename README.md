# Scoopi mods

| Mod | Minecraft | Folder |
|-----|-----------|--------|
| **Creeper Tackle**: sprint and right-click a creeper to tackle and defuse it | 1.21.1 (Fabric) | repository root |
| **Stormcaller Bow**: arrows lift the target into the air and smite it with lightning | 26.2 (Fabric) | [`lightning-bow/`](lightning-bow/) |

---

# Creeper Tackle

A Fabric mod for **Minecraft 1.21.1** that lets you tackle creepers before they blow up.

## How to tackle

**Sprint at a creeper and right-click it.**

- You dive forward and bowl the creeper over.
- It gets knocked onto its back with a bouncy, cartoony fall and squash on impact.
- It lies there wobbling for ~3 seconds with dizzy sparkles circling its head, then wiggles and scrambles back up.
- Its fuse is snuffed out (smoke + hiss), and the first tackle knocks a **gunpowder** out of it.
- The creeper is **permanently defused**: it can never explode again, whether from its AI or flint & steel. This is saved with the world.
- If you're the one who tackled it, your screen shakes on impact.

There's a 1-second cooldown between tackles, and you can't tackle a creeper that's already pinned.

## Install

1. Install [Fabric Loader](https://fabricmc.net/use/) for Minecraft 1.21.1.
2. Put [Fabric API](https://modrinth.com/mod/fabric-api) and `creeper-tackle-1.0.0.jar` in your `mods` folder.

On multiplayer, the mod must be installed on the server *and* on each client.

## Building

Requires Java 21.

```sh
./gradlew build      # jar ends up in build/libs/
./gradlew runClient  # launch a dev client with the mod
```
