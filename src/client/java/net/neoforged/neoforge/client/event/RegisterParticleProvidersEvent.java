package net.neoforged.neoforge.client.event;

import net.fabricmc.fabric.api.client.particle.v1.ParticleProviderRegistry;
import net.minecraft.client.particle.ParticleProvider;
import net.minecraft.client.particle.ParticleResources;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleType;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterParticleProvidersEvent extends Event implements IModBusEvent {
    public <T extends ParticleOptions> void registerSpecial(ParticleType<T> type, ParticleProvider<T> provider) {
        ParticleProviderRegistry.getInstance().register(type, provider);
    }

    public <T extends ParticleOptions> void registerSpriteSet(ParticleType<T> type,
            ParticleResources.SpriteParticleRegistration<T> registration) {
        ParticleProviderRegistry.getInstance().register(type, registration::create);
    }
}
