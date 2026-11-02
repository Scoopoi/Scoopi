package net.neoforged.neoforge.client.event;

import com.mojang.serialization.MapCodec;

import net.minecraft.client.renderer.item.ItemModel;
import net.minecraft.client.renderer.item.ItemModels;
import net.minecraft.resources.Identifier;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterItemModelsEvent extends Event implements IModBusEvent {
    public void register(Identifier location, MapCodec<? extends ItemModel.Unbaked> source) {
        ItemModels.ID_MAPPER.put(location, source);
    }
}
