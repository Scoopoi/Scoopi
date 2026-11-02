package net.neoforged.neoforge.client.event;

import net.minecraft.resources.Identifier;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

/** Not supported on Fabric yet (custom sky/clouds/weather for the spatial storage dimension). Never fired. */
public class RegisterCustomEnvironmentEffectRendererEvent extends Event implements IModBusEvent {
    public void registerCloudRenderer(Identifier id, Object renderer) {
    }

    public void registerSkyboxRenderer(Identifier id, Object renderer) {
    }

    public void registerWeatherEffectRenderer(Identifier id, Object renderer) {
    }
}
