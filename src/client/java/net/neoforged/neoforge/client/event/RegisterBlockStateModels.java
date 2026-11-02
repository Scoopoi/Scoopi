package net.neoforged.neoforge.client.event;

import com.mojang.serialization.MapCodec;

import net.minecraft.resources.Identifier;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;
import net.neoforged.neoforge.client.model.block.CustomUnbakedBlockStateModel;

public class RegisterBlockStateModels extends Event implements IModBusEvent {
    public void registerModel(Identifier location, MapCodec<? extends CustomUnbakedBlockStateModel> codec) {
        net.fabricmc.fabric.api.client.model.loading.v1.CustomUnbakedBlockStateModel.register(location, codec);
    }
}
