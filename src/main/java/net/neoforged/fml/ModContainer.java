package net.neoforged.fml;

import java.util.Optional;

import net.fabricmc.loader.api.FabricLoader;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.config.ModConfig;
import net.neoforged.fml.loading.moddiscovery.ModInfo;
import net.neoforged.neoforge.common.ModConfigSpec;

public class ModContainer {
    private final String modId;
    private final IEventBus eventBus;
    private final ModInfo modInfo;

    public ModContainer(String modId, IEventBus eventBus) {
        this.modId = modId;
        this.eventBus = eventBus;
        this.modInfo = new ModInfo(modId);
    }

    public String getModId() {
        return modId;
    }

    public String getNamespace() {
        return modId;
    }

    public ModInfo getModInfo() {
        return modInfo;
    }

    public IEventBus getEventBus() {
        return eventBus;
    }

    public void registerConfig(ModConfig.Type type, ModConfigSpec spec) {
        registerConfig(type, spec, modId + "-" + type.extension() + ".json");
    }

    public void registerConfig(ModConfig.Type type, ModConfigSpec spec, String fileName) {
        var config = new ModConfig(type, spec, this, fileName);
        config.load();
        configs.add(config);
    }

    private final java.util.List<ModConfig> configs = new java.util.ArrayList<>();

    /** Fired by the Fabric bootstrap once the mod constructor has run and listeners are registered. */
    public void fireConfigLoading() {
        if (eventBus != null) {
            for (var config : configs) {
                eventBus.post(new net.neoforged.fml.event.config.ModConfigEvent.Loading(config));
            }
        }
    }

    public <T> void registerExtensionPoint(Class<T> point, T extension) {
        // Not supported on Fabric
    }

    public static Optional<ModContainer> forFabric(String modId) {
        return FabricLoader.getInstance().getModContainer(modId).map(c -> new ModContainer(modId, null));
    }
}
