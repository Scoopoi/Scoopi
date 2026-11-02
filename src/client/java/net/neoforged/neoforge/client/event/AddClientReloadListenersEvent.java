package net.neoforged.neoforge.client.event;

import net.fabricmc.fabric.api.resource.v1.ResourceLoader;
import net.minecraft.resources.Identifier;
import net.minecraft.server.packs.PackType;
import net.minecraft.server.packs.resources.PreparableReloadListener;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class AddClientReloadListenersEvent extends Event implements IModBusEvent {
    public void addListener(Identifier id, PreparableReloadListener listener) {
        ResourceLoader.get(PackType.CLIENT_RESOURCES).registerReloadListener(id, listener);
    }

    /** {@code dependency} will run before {@code dependent}. */
    public void addDependency(Identifier dependency, Identifier dependent) {
        ResourceLoader.get(PackType.CLIENT_RESOURCES).addListenerOrdering(dependency, dependent);
    }
}
