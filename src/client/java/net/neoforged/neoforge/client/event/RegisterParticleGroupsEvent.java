package net.neoforged.neoforge.client.event;

import java.util.function.Function;

import net.fabricmc.fabric.api.client.particle.v1.ParticleGroupRegistry;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.client.particle.ParticleGroup;
import net.minecraft.client.particle.ParticleRenderType;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterParticleGroupsEvent extends Event implements IModBusEvent {
    public void register(ParticleRenderType group, Function<ParticleEngine, ParticleGroup<?>> factory) {
        ParticleGroupRegistry.register(group, factory);
    }
}
