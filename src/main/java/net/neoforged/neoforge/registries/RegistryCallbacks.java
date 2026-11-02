package net.neoforged.neoforge.registries;

import java.util.ArrayList;
import java.util.List;

import net.fabricmc.fabric.api.event.registry.RegistryEntryAddedCallback;
import net.fabricmc.fabric.api.event.registry.RegistryIdRemapCallback;
import net.minecraft.core.Registry;
import net.neoforged.neoforge.registries.callback.AddCallback;
import net.neoforged.neoforge.registries.callback.BakeCallback;
import net.neoforged.neoforge.registries.callback.RegistryCallback;

/**
 * Fabric replacement for NeoForge's registry callback extension.
 */
public final class RegistryCallbacks {
    private record Bake<T>(Registry<T> registry, BakeCallback<T> callback) {
        void run() {
            callback.onBake(registry);
        }
    }

    private static final List<Bake<?>> BAKE_CALLBACKS = new ArrayList<>();

    private RegistryCallbacks() {
    }

    public static <T> void attach(Registry<T> registry, List<RegistryCallback<T>> callbacks) {
        for (var cb : callbacks) {
            addCallback(registry, cb);
        }
    }

    public static <T> void addCallback(Registry<T> registry, RegistryCallback<T> callback) {
        if (callback instanceof AddCallback<T> add) {
            RegistryEntryAddedCallback.event(registry).register((rawId, id, object) -> add.onAdd(registry, rawId,
                    net.minecraft.resources.ResourceKey.create(registry.key(), id), object));
        } else if (callback instanceof BakeCallback<T> bake) {
            var b = new Bake<>(registry, bake);
            BAKE_CALLBACKS.add(b);
            RegistryIdRemapCallback.event(registry).register(state -> b.run());
        }
    }

    /** Called by the Fabric bootstrap once all registration is done. */
    public static void bakeAll() {
        for (var b : BAKE_CALLBACKS) {
            b.run();
        }
    }
}
