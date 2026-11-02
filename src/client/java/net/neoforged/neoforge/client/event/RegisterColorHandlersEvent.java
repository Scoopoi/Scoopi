package net.neoforged.neoforge.client.event;

import java.util.List;

import com.mojang.serialization.MapCodec;

import net.fabricmc.fabric.api.client.rendering.v1.BlockColorRegistry;
import net.minecraft.client.color.block.BlockTintSource;
import net.minecraft.client.color.item.ItemTintSource;
import net.minecraft.resources.Identifier;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public abstract class RegisterColorHandlersEvent extends Event implements IModBusEvent {
    public static class BlockTintSources extends RegisterColorHandlersEvent {
        public void register(List<BlockTintSource> tintSources, net.minecraft.world.level.block.Block... blocks) {
            BlockColorRegistry.register(tintSources, blocks);
        }
    }

    public static class ItemTintSources extends RegisterColorHandlersEvent {
        public void register(Identifier location, MapCodec<? extends ItemTintSource> source) {
            net.minecraft.client.color.item.ItemTintSources.ID_MAPPER.put(location, source);
        }
    }
}
