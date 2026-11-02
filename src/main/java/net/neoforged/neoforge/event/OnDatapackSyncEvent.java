package net.neoforged.neoforge.event;

import java.util.function.Consumer;

import net.minecraft.world.item.crafting.RecipeType;
import net.neoforged.bus.api.Event;

/** Fired once during Fabric init; recipe types are registered for client synchronization. */
public class OnDatapackSyncEvent extends Event {
    private final Consumer<RecipeType<?>> sink;

    public OnDatapackSyncEvent(Consumer<RecipeType<?>> sink) {
        this.sink = sink;
    }

    public void sendRecipes(RecipeType<?>... types) {
        for (var type : types) {
            sink.accept(type);
        }
    }
}
