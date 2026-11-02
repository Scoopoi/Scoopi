package net.neoforged.neoforge.client.event;

import java.util.function.Supplier;

import net.fabricmc.fabric.api.client.rendering.v1.PictureInPictureRendererRegistry;
import net.minecraft.client.gui.render.pip.PictureInPictureRenderer;
import net.minecraft.client.gui.render.state.pip.PictureInPictureRenderState;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterPictureInPictureRenderersEvent extends Event implements IModBusEvent {
    public <T extends PictureInPictureRenderState> void register(Class<T> stateClass,
            Supplier<PictureInPictureRenderer<T>> factory) {
        PictureInPictureRendererRegistry.register(context -> factory.get());
    }
}
