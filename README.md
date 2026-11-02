# Applied Energistics 2 – Fabric port (Minecraft 26.2)

Unofficial, work-in-progress port of [Applied Energistics 2](https://github.com/AppliedEnergistics/Applied-Energistics-2)
(version 26.2.1-alpha, originally NeoForge-only) to **Fabric** for **Minecraft 26.2**.

## How it works

AE2's own code is kept almost unchanged. Instead, a small compatibility layer re-implements the parts of the
NeoForge API AE2 uses on top of Fabric API:

| NeoForge feature | Fabric implementation |
| --- | --- |
| Mod/game event buses, `@SubscribeEvent` | `appeng.fabric.shim.SimpleEventBus`, events fired from Fabric callbacks (`appeng.fabric.FabricEventBridge`) |
| `DeferredRegister`, custom registries | NeoForge sources + `FabricRegistryBuilder` |
| `ModConfigSpec` configs | JSON files in `config/` |
| Transfer API (`ResourceHandler`, transactions) | NeoForge sources, bridged both ways to the **Fabric Transfer API** (hoppers, pipes and other Fabric mods can talk to AE2) |
| Capabilities | NeoForge capability classes with Fabric API Lookup fallbacks |
| Extension methods on vanilla classes | Loom interface injection + mixins (`appeng.mixins.shim`) |
| Networking | Fabric networking API |
| Menus with extra data | `ExtendedMenuType` |
| Custom block state models / model data | Fabric Model Loading API + Renderer API (`emitQuads`), block entity render data |
| Data conditions / difference ingredients | `fabric:load_conditions`, `fabric:difference` |

## Building

Requirements: **Java 25**.

```
./gradlew build
```

The mod jar ends up in `build/libs/`. Put it in your `mods` folder together with **Fabric API** (0.161.0+26.2 or newer)
and **Fabric Loader** 0.20.1+.

To start a development client: `./gradlew runClient`.
To run the automated in-game smoke test: `./gradlew runClientGameTest`.

## Not working yet / known differences

- No GuideME guide book (GuideME has no Fabric version), and no JEI/REI/EMI/Jade/WTHIT/Curios integrations.
- No in-game config screen.
- No Forge Energy (FE) interop with other mods (Fabric API has no energy standard).
- The spatial storage dimension uses the default sky instead of AE2's custom sky.
- Area overlays (spatial IO/wireless range previews) and custom part selection outlines are not rendered.
- Per-vertex colors in a few dynamic models (paint splotches, P2P frequency) are drawn white.
- Custom hit/break particles for cable buses use vanilla particles.

## License

AE2's code is licensed under LGPLv3 (see `LICENSE`); NeoForge-derived files under `net/neoforged` are LGPL-2.1.
AE2's assets have their own license, see the upstream repository.
