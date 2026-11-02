package net.neoforged.neoforge.event;

import java.util.function.BiConsumer;

import net.minecraft.resources.Identifier;
import net.minecraft.server.packs.resources.PreparableReloadListener;
import net.neoforged.bus.api.Event;

/** Fired once during Fabric init; listeners are registered with Fabric's resource loader. */
public class AddServerReloadListenersEvent extends Event {
    private final BiConsumer<Identifier, PreparableReloadListener> sink;

    public AddServerReloadListenersEvent(BiConsumer<Identifier, PreparableReloadListener> sink) {
        this.sink = sink;
    }

    public void addListener(Identifier id, PreparableReloadListener listener) {
        sink.accept(id, listener);
    }
}
