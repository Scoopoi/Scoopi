package net.neoforged.neoforge.client.event;

import java.util.function.Function;

import net.fabricmc.fabric.api.client.rendering.v1.ClientTooltipComponentCallback;
import net.minecraft.client.gui.screens.inventory.tooltip.ClientTooltipComponent;
import net.minecraft.world.inventory.tooltip.TooltipComponent;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterClientTooltipComponentFactoriesEvent extends Event implements IModBusEvent {
    public <T extends TooltipComponent> void register(Class<T> type,
            Function<? super T, ? extends ClientTooltipComponent> factory) {
        ClientTooltipComponentCallback.EVENT.register(component -> type.isInstance(component)
                ? factory.apply(type.cast(component))
                : null);
    }
}
