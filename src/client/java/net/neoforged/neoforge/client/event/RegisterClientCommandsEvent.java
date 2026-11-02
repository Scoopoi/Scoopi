package net.neoforged.neoforge.client.event;

import com.mojang.brigadier.CommandDispatcher;

import net.minecraft.commands.CommandSourceStack;
import net.neoforged.bus.api.Event;

/** Client-side debug commands are not supported on Fabric (different command source type). Never fired. */
public class RegisterClientCommandsEvent extends Event {
    private final CommandDispatcher<CommandSourceStack> dispatcher = new CommandDispatcher<>();

    public CommandDispatcher<CommandSourceStack> getDispatcher() {
        return dispatcher;
    }
}
