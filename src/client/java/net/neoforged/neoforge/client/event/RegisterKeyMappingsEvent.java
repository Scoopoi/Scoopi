package net.neoforged.neoforge.client.event;

import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterKeyMappingsEvent extends Event implements IModBusEvent {
    public void register(KeyMapping key) {
        KeyMappingHelper.registerKeyMapping(key);
    }

    public void registerCategory(KeyMapping.Category category) {
        // Categories are registered implicitly on Fabric
    }
}
