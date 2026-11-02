package net.neoforged.neoforge.client.event;

import com.mojang.serialization.MapCodec;

import net.minecraft.client.renderer.item.properties.numeric.RangeSelectItemModelProperties;
import net.minecraft.client.renderer.item.properties.numeric.RangeSelectItemModelProperty;
import net.minecraft.resources.Identifier;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterRangeSelectItemModelPropertyEvent extends Event implements IModBusEvent {
    public void register(Identifier location, MapCodec<? extends RangeSelectItemModelProperty> source) {
        RangeSelectItemModelProperties.ID_MAPPER.put(location, source);
    }
}
