package net.neoforged.fml.loading.moddiscovery;

import net.fabricmc.loader.api.FabricLoader;

public class ModInfo {
    private final String modId;

    public ModInfo(String modId) {
        this.modId = modId;
    }

    public String getModId() {
        return modId;
    }

    public String getDisplayName() {
        return FabricLoader.getInstance().getModContainer(modId).map(c -> c.getMetadata().getName()).orElse(modId);
    }

    public String getVersion() {
        return FabricLoader.getInstance().getModContainer(modId)
                .map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("0");
    }
}
