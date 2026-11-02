package net.neoforged.neoforge.client.event;

import com.mojang.blaze3d.pipeline.RenderPipeline;

import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterRenderPipelinesEvent extends Event implements IModBusEvent {
    public void registerPipeline(RenderPipeline pipeline) {
        net.minecraft.client.renderer.RenderPipelines.register(pipeline);
    }
}
