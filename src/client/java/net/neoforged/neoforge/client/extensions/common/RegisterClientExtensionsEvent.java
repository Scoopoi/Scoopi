package net.neoforged.neoforge.client.extensions.common;

import net.minecraft.world.level.block.Block;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

/** Not fired on Fabric. */
public class RegisterClientExtensionsEvent extends Event implements IModBusEvent {
    public void registerBlock(IClientBlockExtensions extensions, Block... blocks) {
    }
}
