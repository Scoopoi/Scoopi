package net.neoforged.fml;

import java.util.Optional;

import net.fabricmc.loader.api.FabricLoader;

public final class ModList {
    private static final ModList INSTANCE = new ModList();

    public static ModList get() {
        return INSTANCE;
    }

    public boolean isLoaded(String modId) {
        return FabricLoader.getInstance().isModLoaded(modId);
    }

    public Optional<? extends ModContainer> getModContainerById(String modId) {
        if (ModLoader.AE2_CONTAINER != null && ModLoader.AE2_CONTAINER.getModId().equals(modId)) {
            return Optional.of(ModLoader.AE2_CONTAINER);
        }
        return ModContainer.forFabric(modId);
    }
}
